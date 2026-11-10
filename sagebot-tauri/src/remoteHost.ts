/**
 * SageBot PC side of the Remote protocol (v3).
 *
 * Pairing (plaintext topics derived from the code, carry no secrets):
 *   phone -> pair_hello   { cid, name, pub, proof, mac? }
 *   pc    -> pair_pending { cid, pub, proof }            (needs approval on PC)
 *   pc    -> pair_ok      { cid, pub, proof, mac?, box }  (box = sealed { channel, name })
 *   pc    -> pair_denied / pair_blocked { cid, proof }
 *
 *   proof = HMAC(PBKDF2(code), ...) proves knowledge of the 8-character code.
 *   mac   = HMAC(QR token, ...) proves the phone scanned the QR on this screen,
 *           which skips the approval popup.
 *
 * After pairing, everything goes through this PC's private channel topic as
 * AES-GCM envelopes sealed with that device's own key. Removing a device deletes
 * its key, so it can never decrypt or send anything again.
 */

import { RemoteBridge } from "./remoteBridge";
import {
  channelTopics,
  derivePairSecrets,
  deriveSessionKey,
  generateEcdhKeyPair,
  importTokenKey,
  open,
  seal,
  signProof,
  verifyProof,
  type PairSecrets,
} from "./secureChannel";

export interface HostDevice {
  id: string;
  name: string;
  key: string;
}

export interface PairRequest {
  client_id: string;
  proposed_name: string;
  fingerprint: string;
}

export interface RemoteHostOptions {
  code: string;
  channelId: string;
  getToken: () => string;
  getDevices: () => HostDevice[];
  /** False when Unique Control already has a device and this is a different one. */
  canAcceptDevice: (cid: string) => boolean;
  onPairRequest: (req: PairRequest) => void;
  onPairCancelled: (cid: string) => void;
  onDevicePaired: (dev: HostDevice) => void;
  onCommand: (cid: string, data: Record<string, any>) => void;
  onReady: () => void;
}

interface PendingPair {
  cid: string;
  name: string;
  mobilePub: string;
  pcPub: string;
  key: string;
  fingerprint: string;
  proof: string;
  qrVerified: boolean;
}

const MAX_NAME_LEN = 40;

export class RemoteHost {
  private opts: RemoteHostOptions;
  private bridge: RemoteBridge | null = null;
  private pair: PairSecrets | null = null;
  private channel: { toPc: string; toMobile: string };
  private pending: PendingPair | null = null;
  private destroyed = false;

  constructor(opts: RemoteHostOptions) {
    this.opts = opts;
    this.channel = channelTopics(opts.channelId);
    this.start();
  }

  private async start() {
    try {
      this.pair = await derivePairSecrets(this.opts.code);
    } catch (err) {
      console.error("Remote: secure crypto unavailable", err);
      return;
    }
    if (this.destroyed) return;
    this.bridge = new RemoteBridge([this.pair.toPc, this.channel.toPc], {
      onBrokerReady: () => this.opts.onReady(),
      onMessage: (topic, data) => {
        if (topic === this.channel.toPc) {
          this.handleSecure(data);
        } else {
          this.handlePairing(data).catch(() => {});
        }
      },
    });
  }

  private async handleSecure(env: any) {
    const dev = this.opts.getDevices().find((d) => d.id === env?.cid);
    if (!dev) return;
    const data = await open(dev.key, "pc", env);
    if (!data || this.destroyed) return;
    this.opts.onCommand(dev.id, data);
  }

  private async handlePairing(msg: any) {
    const pair = this.pair;
    if (!pair || !msg || msg.type !== "pair_hello") return;
    const { cid, pub, proof, mac } = msg;
    if (typeof cid !== "string" || typeof pub !== "string" || cid.length > 64 || pub.length > 200) return;

    // Step 1: the phone must prove it knows the 8-character code. Otherwise stay silent.
    if (!(await verifyProof(pair.proofKey, `hello|${cid}|${pub}`, proof))) return;

    const name = String(msg.name || "Phone").slice(0, MAX_NAME_LEN);

    if (!this.opts.canAcceptDevice(cid)) {
      this.publishPair({ type: "pair_blocked", cid, proof: await signProof(pair.proofKey, `blocked|${cid}|${pub}`) });
      return;
    }

    // Resend for the same attempt (phones retry until they hear back).
    if (this.pending && this.pending.cid === cid && this.pending.mobilePub === pub) {
      if (!this.pending.qrVerified) this.sendPending(this.pending);
      return;
    }
    if (this.pending && this.pending.cid !== cid) return; // One approval at a time.

    // Step 2: either the phone scanned the QR on this screen, or the user approves on PC.
    let qrVerified = false;
    if (typeof mac === "string") {
      const token = this.opts.getToken();
      if (token) qrVerified = await verifyProof(await importTokenKey(token), `qr|${cid}|${pub}`, mac);
    }

    const { keyPair, pub: pcPub } = await generateEcdhKeyPair();
    const { key, fingerprint } = await deriveSessionKey(keyPair.privateKey, pub, pcPub, pub, cid);
    const pending: PendingPair = {
      cid,
      name,
      mobilePub: pub,
      pcPub,
      key,
      fingerprint,
      proof: await signProof(pair.proofKey, `pc|${cid}|${pcPub}|${pub}`),
      qrVerified,
    };

    if (qrVerified) {
      await this.complete(pending, name);
      return;
    }

    if (this.pending && this.pending.cid === cid) this.opts.onPairCancelled(cid);
    this.pending = pending;
    this.sendPending(pending);
    this.opts.onPairRequest({ client_id: cid, proposed_name: name, fingerprint });
  }

  private sendPending(p: PendingPair) {
    this.publishPair({ type: "pair_pending", cid: p.cid, pub: p.pcPub, proof: p.proof });
  }

  private async complete(p: PendingPair, name: string): Promise<HostDevice> {
    const dev: HostDevice = { id: p.cid, name, key: p.key };
    const box = await seal(p.key, "m", p.cid, { channel: this.opts.channelId, name });
    let mac: string | undefined;
    if (p.qrVerified) {
      mac = await signProof(await importTokenKey(this.opts.getToken()), `qr-pc|${p.cid}|${p.pcPub}|${p.mobilePub}`);
    }
    this.opts.onDevicePaired(dev);
    this.publishPair({ type: "pair_ok", cid: p.cid, pub: p.pcPub, proof: p.proof, mac, box });
    return dev;
  }

  private publishPair(data: Record<string, any>) {
    if (this.bridge && this.pair) this.bridge.publish(this.pair.toMobile, data);
  }

  /** Approves the pending request shown in the PC popup. */
  public async approve(cid: string, name: string): Promise<HostDevice | null> {
    const p = this.pending;
    if (!p || p.cid !== cid) return null;
    this.pending = null;
    if (!this.opts.canAcceptDevice(cid)) {
      if (this.pair) {
        this.publishPair({ type: "pair_blocked", cid, proof: await signProof(this.pair.proofKey, `blocked|${cid}|${p.mobilePub}`) });
      }
      return null;
    }
    return this.complete(p, name.slice(0, MAX_NAME_LEN) || p.name);
  }

  public async deny(cid: string) {
    const p = this.pending;
    if (!p || p.cid !== cid) return;
    this.pending = null;
    if (this.pair) {
      this.publishPair({ type: "pair_denied", cid, proof: await signProof(this.pair.proofKey, `denied|${cid}|${p.mobilePub}`) });
    }
  }

  /** Sends an encrypted message to one paired device. */
  public async sendTo(cid: string, data: Record<string, any>) {
    const dev = this.opts.getDevices().find((d) => d.id === cid);
    if (!dev || !this.bridge) return;
    const env = await seal(dev.key, "m", dev.id, data);
    this.bridge?.publish(this.channel.toMobile, env);
  }

  /** Sends an encrypted copy of the message to every paired device. */
  public send(data: Record<string, any>): Promise<void> {
    if (!this.bridge) return Promise.resolve();
    const jobs = this.opts.getDevices().map((dev) =>
      seal(dev.key, "m", dev.id, data)
        .then((env) => this.bridge?.publish(this.channel.toMobile, env))
        .catch(() => {})
    );
    return Promise.all(jobs).then(() => {});
  }

  public destroy() {
    this.destroyed = true;
    this.bridge?.destroy();
    this.bridge = null;
  }
}
