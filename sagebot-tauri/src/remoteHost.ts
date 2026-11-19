/**
 * SageBot PC side of the Remote protocol (v4).
 *
 * Security & pairing model:
 *   - Single paired device only (replaces multi-device / Unique Control toggle).
 *   - Pairing window: PC listens on pairing topics ONLY after clicking Pair / Replace
 *     for up to 3 minutes, and closes on 5 failed attempts.
 *   - QR carries a one-time high-entropy token -> auto-approves & closes window.
 *   - Typed 8-character code -> shows one-time PC confirmation popup with fingerprint.
 *   - Reconnects use a signed HMAC nonce challenge (`auth_hello` -> `auth_ok`) to
 *     derive a fresh per-connection AES-256-GCM key via HKDF (survives Wi-Fi <-> 5G).
 */

import { RemoteBridge } from "./remoteBridge";
import {
  channelTopics,
  deriveConnectionKey,
  derivePairResult,
  derivePairSecrets,
  generateEcdhKeyPair,
  importMasterKeysFromB64,
  importTokenKey,
  isTimestampFresh,
  open,
  randomHex,
  seal,
  signProof,
  verifyProof,
  type MasterKeyBundle,
  type PairSecrets,
} from "./secureChannel";

export interface HostDevice {
  id: string;
  name: string;
  key: string; // base64 256-bit master secret (persisted via Rust DPAPI)
}

export interface PairRequest {
  client_id: string;
  proposed_name: string;
  fingerprint: string;
  is_replacing: boolean;
}

export interface RemoteHostOptions {
  channelId: string;
  getDevice: () => HostDevice | null;
  onPairRequest: (req: PairRequest) => void;
  onPairCancelled: (cid: string) => void;
  onPairingWindowClosed: (reason?: string) => void;
  onDevicePaired: (dev: HostDevice, newChannelId: string) => void;
  onDeviceConnected: (dev: HostDevice) => void;
  onCommand: (cid: string, data: Record<string, any>) => void;
  onReady: () => void;
}

interface PendingPair {
  cid: string;
  name: string;
  mobilePub: string;
  pcPub: string;
  keyB64: string;
  pairBoxKey: CryptoKey;
  fingerprint: string;
  proof: string;
  qrVerified: boolean;
  targetChannelId: string;
}

const MAX_NAME_LEN = 40;
const MAX_FAILED_PAIR_ATTEMPTS = 5;
const NONCE_TTL_MS = 5 * 60 * 1000;

export class RemoteHost {
  private opts: RemoteHostOptions;
  private bridge: RemoteBridge | null = null;
  private activeChannelId: string;
  private channel: { toPc: string; toMobile: string };

  private pairingOpen = false;
  private pair: PairSecrets | null = null;
  private activeQrToken: string | null = null;
  private targetChannelId: string | null = null;
  private pending: PendingPair | null = null;
  private failedAttempts = 0;

  private activeConnKey: CryptoKey | null = null;
  private masterBundleCache: { keyStr: string; bundle: MasterKeyBundle } | null = null;
  private seenAuthNonces = new Map<string, number>();
  private lastRekeySentAt = 0;
  private destroyed = false;

  private onlineHandler: (() => void) | null = null;

  constructor(opts: RemoteHostOptions) {
    this.opts = opts;
    this.activeChannelId = opts.channelId;
    this.channel = channelTopics(opts.channelId);
    this.start();
  }

  private start() {
    if (this.destroyed) return;
    this.bridge = new RemoteBridge([this.channel.toPc], {
      onBrokerReady: () => this.opts.onReady(),
      onBrokerReconnect: () => {
        this.opts.onReady();
        const dev = this.opts.getDevice();
        if (dev && !this.activeConnKey) {
          this.sendRekeyNotice(dev).catch(() => {});
        }
      },
      onMessage: (topic, data) => {
        if (this.pair && topic === this.pair.toPc) {
          this.handlePairing(data).catch(() => {});
        } else if (
          topic === this.channel.toPc ||
          (this.targetChannelId && topic === channelTopics(this.targetChannelId).toPc)
        ) {
          this.handleChannelMessage(data).catch(() => {});
        }
      },
    });

    if (typeof window !== "undefined") {
      this.onlineHandler = () => {
        this.bridge?.reconnectNow();
      };
      window.addEventListener("online", this.onlineHandler);
    }
  }

  private async getMasterBundle(keyB64: string): Promise<MasterKeyBundle> {
    if (this.masterBundleCache && this.masterBundleCache.keyStr === keyB64) {
      return this.masterBundleCache.bundle;
    }
    const bundle = await importMasterKeysFromB64(keyB64);
    this.masterBundleCache = { keyStr: keyB64, bundle };
    return bundle;
  }

  public async openPairingWindow(code: string, qrToken: string, targetChannelId: string) {
    if (this.destroyed) return;
    if (this.pair) {
      this.bridge?.removeTopic(this.pair.toPc);
    }
    this.pair = await derivePairSecrets(code);
    if (this.destroyed) return;

    this.pairingOpen = true;
    this.activeQrToken = qrToken;
    this.targetChannelId = targetChannelId;
    this.pending = null;
    this.failedAttempts = 0;

    this.bridge?.addTopic(this.pair.toPc);
    if (targetChannelId !== this.activeChannelId) {
      this.bridge?.addTopic(channelTopics(targetChannelId).toPc);
    }
  }

  public closePairingWindow(reason?: string) {
    const wasOpen = this.pairingOpen;
    this.pairingOpen = false;
    this.activeQrToken = null;
    if (this.pending) {
      this.opts.onPairCancelled(this.pending.cid);
      this.pending = null;
    }
    if (this.pair) {
      this.bridge?.removeTopic(this.pair.toPc);
      this.pair = null;
    }
    if (this.targetChannelId && this.targetChannelId !== this.activeChannelId) {
      this.bridge?.removeTopic(channelTopics(this.targetChannelId).toPc);
    }
    this.targetChannelId = null;
    this.failedAttempts = 0;
    if (wasOpen) {
      this.opts.onPairingWindowClosed(reason);
    }
  }

  public rotateChannel(newChannelId: string) {
    const oldPcTopic = this.channel.toPc;
    this.activeChannelId = newChannelId;
    this.channel = channelTopics(newChannelId);
    this.activeConnKey = null;
    this.masterBundleCache = null;
    this.seenAuthNonces.clear();
    if (this.bridge) {
      this.bridge.removeTopic(oldPcTopic);
      this.bridge.addTopic(this.channel.toPc);
    }
  }

  private rememberAuthNonce(nonce: string, now: number): boolean {
    if (this.seenAuthNonces.has(nonce)) return false;
    this.seenAuthNonces.set(nonce, now);
    if (this.seenAuthNonces.size > 500) {
      for (const [k, t] of this.seenAuthNonces) {
        if (now - t > NONCE_TTL_MS) this.seenAuthNonces.delete(k);
      }
    }
    return true;
  }

  private async sendRekeyNotice(dev: HostDevice) {
    const now = Date.now();
    if (!this.bridge || now - this.lastRekeySentAt < 2000) return;
    this.lastRekeySentAt = now;
    try {
      const bundle = await this.getMasterBundle(dev.key);
      const mac = await signProof(bundle.hmacKey, `auth-rekey|${dev.id}|${now}`);
      this.bridge.publish(this.channel.toMobile, {
        type: "auth_rekey",
        cid: dev.id,
        ts: now,
        mac,
      });
    } catch {
      // Ignore
    }
  }

  private async handleChannelMessage(msg: any) {
    if (!msg || this.destroyed) return;
    const dev = this.opts.getDevice();
    if (!dev || typeof msg.cid !== "string" || msg.cid !== dev.id) return;

    if (msg.type === "auth_hello") {
      const { nonce, ts, mac } = msg;
      if (typeof nonce !== "string" || nonce.length < 16 || nonce.length > 64) return;
      if (!isTimestampFresh(ts)) return;
      const now = Date.now();
      if (!this.rememberAuthNonce(nonce, now)) return;

      const bundle = await this.getMasterBundle(dev.key);
      if (!(await verifyProof(bundle.hmacKey, `auth-hello|${dev.id}|${nonce}|${ts}`, mac))) return;
      if (this.destroyed) return;

      const pcNonce = randomHex(16);
      const replyTs = Date.now();
      this.activeConnKey = await deriveConnectionKey(bundle.hkdfKey, dev.id, nonce, pcNonce);
      const okMac = await signProof(bundle.hmacKey, `auth-ok|${dev.id}|${nonce}|${pcNonce}|${replyTs}`);

      this.bridge?.publish(this.channel.toMobile, {
        type: "auth_ok",
        cid: dev.id,
        clientNonce: nonce,
        pcNonce,
        ts: replyTs,
        mac: okMac,
      });

      this.opts.onDeviceConnected(dev);
      return;
    }

    if (msg.type === "sec") {
      if (!this.activeConnKey) {
        await this.sendRekeyNotice(dev);
        return;
      }
      const data = await open(this.activeConnKey, "pc", msg);
      if (!data || this.destroyed) {
        await this.sendRekeyNotice(dev);
        return;
      }
      this.opts.onCommand(dev.id, data);
    }
  }

  private recordPairFailure() {
    this.failedAttempts += 1;
    if (this.failedAttempts >= MAX_FAILED_PAIR_ATTEMPTS) {
      this.closePairingWindow("Too many failed pairing attempts. Window closed.");
    }
  }

  private async handlePairing(msg: any) {
    const pair = this.pair;
    if (!this.pairingOpen || !pair || !msg || msg.type !== "pair_hello") return;
    const { cid, pub, proof, mac } = msg;
    if (typeof cid !== "string" || typeof pub !== "string" || cid.length > 64 || pub.length > 200) return;

    // Step 1: prove knowledge of the current pairing code
    if (!(await verifyProof(pair.proofKey, `hello|${cid}|${pub}`, proof))) {
      this.recordPairFailure();
      return;
    }

    const name = String(msg.name || "Phone").slice(0, MAX_NAME_LEN);

    // Retry for an active manual confirmation attempt
    if (this.pending && this.pending.cid === cid && this.pending.mobilePub === pub) {
      if (!this.pending.qrVerified) this.sendPending(this.pending);
      return;
    }
    if (this.pending && this.pending.cid !== cid) return; // One approval at a time.

    // Step 2: if a QR MAC was sent, validate & consume one-time QR token
    let qrVerified = false;
    let consumedQrToken: string | undefined;
    if (typeof mac === "string") {
      if (!this.activeQrToken) {
        this.recordPairFailure();
        return;
      }
      const tokenOk = await verifyProof(await importTokenKey(this.activeQrToken), `qr|${cid}|${pub}`, mac);
      if (!tokenOk) {
        this.recordPairFailure();
        return;
      }
      consumedQrToken = this.activeQrToken;
      this.activeQrToken = null; // Consume one-time token immediately
      qrVerified = true;
    }

    const nextChannelId = this.targetChannelId || this.activeChannelId;
    const { keyPair, pub: pcPub } = await generateEcdhKeyPair();
    const derived = await derivePairResult(keyPair.privateKey, pub, pcPub, pub, cid);
    const pending: PendingPair = {
      cid,
      name,
      mobilePub: pub,
      pcPub,
      keyB64: derived.keyB64,
      pairBoxKey: derived.pairBoxKey,
      fingerprint: derived.fingerprint,
      proof: await signProof(pair.proofKey, `pc|${cid}|${pcPub}|${pub}`),
      qrVerified,
      targetChannelId: nextChannelId,
    };

    if (qrVerified) {
      await this.completePairing(pending, name, consumedQrToken);
      return;
    }

    if (this.pending && this.pending.cid === cid) this.opts.onPairCancelled(cid);
    this.pending = pending;
    this.sendPending(pending);
    this.opts.onPairRequest({
      client_id: cid,
      proposed_name: name,
      fingerprint: derived.fingerprint,
      is_replacing: Boolean(this.opts.getDevice()),
    });
  }

  private sendPending(p: PendingPair) {
    this.publishPair({ type: "pair_pending", cid: p.cid, pub: p.pcPub, proof: p.proof });
  }

  private async completePairing(p: PendingPair, name: string, qrTokenForReply?: string): Promise<HostDevice> {
    const existing = this.opts.getDevice();
    if (existing && existing.id !== p.cid) {
      await this.revokeDevice(existing);
    }

    const newDev: HostDevice = { id: p.cid, name, key: p.keyB64 };
    const box = await seal(p.pairBoxKey, "m", p.cid, { channel: p.targetChannelId, name });
    const mac = qrTokenForReply
      ? await signProof(await importTokenKey(qrTokenForReply), `qr-pc|${p.cid}|${p.pcPub}|${p.mobilePub}`)
      : undefined;

    const oldPcTopic = this.channel.toPc;
    this.activeChannelId = p.targetChannelId;
    this.channel = channelTopics(p.targetChannelId);
    this.activeConnKey = null;
    this.masterBundleCache = null;
    this.seenAuthNonces.clear();
    if (oldPcTopic !== this.channel.toPc) {
      this.bridge?.removeTopic(oldPcTopic);
      this.bridge?.addTopic(this.channel.toPc);
    }

    this.opts.onDevicePaired(newDev, p.targetChannelId);
    this.publishPair({ type: "pair_ok", cid: p.cid, pub: p.pcPub, proof: p.proof, ...(mac ? { mac } : {}), box });
    this.closePairingWindow();
    return newDev;
  }

  private publishPair(data: Record<string, any>) {
    if (this.bridge && this.pair) this.bridge.publish(this.pair.toMobile, data);
  }

  /** Approves the pending manual code request shown in the PC popup. */
  public async approve(cid: string, name: string): Promise<HostDevice | null> {
    const p = this.pending;
    if (!p || p.cid !== cid) return null;
    this.pending = null;
    return this.completePairing(p, name.slice(0, MAX_NAME_LEN) || p.name);
  }

  public async deny(cid: string) {
    const p = this.pending;
    if (!p || p.cid !== cid) return;
    this.pending = null;
    if (this.pair) {
      this.publishPair({ type: "pair_denied", cid, proof: await signProof(this.pair.proofKey, `denied|${cid}|${p.mobilePub}`) });
    }
  }

  /** Revokes the currently paired device cleanly across both active connection and auth channel. */
  public async revokeDevice(dev?: HostDevice | null) {
    const d = dev ?? this.opts.getDevice();
    if (!d || !this.bridge) return;
    if (this.activeConnKey) {
      try {
        const env = await seal(this.activeConnKey, "m", d.id, { type: "revoked" });
        this.bridge.publish(this.channel.toMobile, env);
      } catch {
        // Ignore
      }
    }
    try {
      const bundle = await this.getMasterBundle(d.key);
      const ts = Date.now();
      const mac = await signProof(bundle.hmacKey, `auth-revoked|${d.id}|${ts}`);
      this.bridge.publish(this.channel.toMobile, {
        type: "auth_revoked",
        cid: d.id,
        ts,
        mac,
      });
    } catch {
      // Ignore
    }
    this.activeConnKey = null;
  }

  /** Sends an encrypted message to the currently connected paired device. */
  public async send(data: Record<string, any>): Promise<void> {
    const dev = this.opts.getDevice();
    if (!this.bridge || !dev || !this.activeConnKey) return;
    try {
      const env = await seal(this.activeConnKey, "m", dev.id, data);
      this.bridge.publish(this.channel.toMobile, env);
    } catch {
      // Ignore
    }
  }

  public destroy() {
    this.destroyed = true;
    if (typeof window !== "undefined" && this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
    this.bridge?.destroy();
    this.bridge = null;
  }
}
