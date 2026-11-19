import React from "react";
import { Clock, Link2Off, QrCode, RefreshCw, Shield, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatCodeDisplay } from "../secureChannel";
import type { PairedDevice } from "../types/sagebot";

interface RemoteTabProps {
  remoteClientConnected: boolean;
  pairedDevice: PairedDevice | null;
  pairingWindowSecondsLeft: number;
  pairingCode: string;
  pairingQrToken: string;
  onStartPairingWindow: () => void;
  onClosePairingWindow: () => void;
  onOpenUnpairModal: () => void;
}

const formatCountdown = (secs: number): string => {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatLastSeen = (ms?: number): string => {
  if (!ms) return "Recently";
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString();
};

export const RemoteTab: React.FC<RemoteTabProps> = ({
  remoteClientConnected,
  pairedDevice,
  pairingWindowSecondsLeft,
  pairingCode,
  pairingQrToken,
  onStartPairingWindow,
  onClosePairingWindow,
  onOpenUnpairModal,
}) => {
  const isWindowOpen = pairingWindowSecondsLeft > 0;
  const statusLabel = remoteClientConnected
    ? "Phone Connected"
    : pairedDevice
      ? "Paired (Offline)"
      : isWindowOpen
        ? "Pairing Open"
        : "Not Paired";

  const statusDotColor = remoteClientConnected
    ? "#10b981"
    : pairedDevice
      ? "#38bdf8"
      : isWindowOpen
        ? "#f59e0b"
        : "#64748b";

  return (
    <div className="tab-pane">
      <div className="card">
        <div className="between-row">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Smartphone size={22} style={{ color: "var(--accent)" }} />
            <div>
              <div className="pane-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>SageBot Remote Control</span>
              </div>
              <div className="pane-subtitle" style={{ marginTop: "2px" }}>
                Control SageBot and VALORANT from a single paired mobile device.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className={`status-pill ${remoteClientConnected ? "active" : ""}`}
              style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDotColor }}></span>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Paired Device Card */}
        <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>Paired Device</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              Single-device mode · Encrypted via DPAPI
            </span>
          </div>

          {pairedDevice ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                background: "rgba(0, 0, 0, 0.28)",
                border: remoteClientConnected
                  ? "1px solid rgba(16, 185, 129, 0.35)"
                  : "1px solid var(--border-card)",
                padding: "14px 16px",
                borderRadius: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "9px",
                    background: remoteClientConnected ? "rgba(16, 185, 129, 0.14)" : "rgba(56, 189, 248, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Smartphone size={18} style={{ color: remoteClientConnected ? "#10b981" : "#38bdf8" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 700,
                        color: "#ffffff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pairedDevice.name}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: remoteClientConnected ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.15)",
                        color: remoteClientConnected ? "#34d399" : "#94a3b8",
                      }}
                    >
                      {remoteClientConnected ? "Online" : `Last seen ${formatLastSeen(pairedDevice.last_seen_ms)}`}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block", marginTop: "2px" }}>
                    Paired at {pairedDevice.paired_at} · Reconnects automatically across Wi-Fi / 5G switches
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <button
                  type="button"
                  className="key-badge-btn"
                  style={{ height: "32px", padding: "0 12px", display: "flex", alignItems: "center", gap: "6px" }}
                  onClick={onStartPairingWindow}
                >
                  <RefreshCw size={13} />
                  <span>{isWindowOpen ? "New Code" : "Replace Device"}</span>
                </button>
                <button
                  type="button"
                  className="key-badge-btn"
                  style={{
                    height: "32px",
                    padding: "0 12px",
                    color: "#f87171",
                    borderColor: "rgba(239, 68, 68, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  onClick={onOpenUnpairModal}
                >
                  <Link2Off size={13} />
                  <span>Unpair</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px dashed rgba(255, 255, 255, 0.14)",
                padding: "16px 18px",
                borderRadius: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>No device paired yet</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                  Pair your phone once with QR or code. After pairing, it reconnects automatically without extra approvals.
                </div>
              </div>
              {!isWindowOpen && (
                <button
                  type="button"
                  className="key-badge-btn"
                  style={{
                    height: "34px",
                    padding: "0 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    background: "rgba(56, 189, 248, 0.14)",
                    borderColor: "rgba(56, 189, 248, 0.45)",
                    color: "#38bdf8",
                    flexShrink: 0,
                  }}
                  onClick={onStartPairingWindow}
                >
                  <QrCode size={14} />
                  <span>Pair Device</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active 3-minute Pairing Window Panel */}
        {isWindowOpen && (
          <div
            style={{
              marginTop: "16px",
              background: "rgba(0, 0, 0, 0.28)",
              padding: "18px 20px",
              borderRadius: "12px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            {pairedDevice && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  fontSize: "12px",
                  color: "#fbbf24",
                }}
              >
                Replacing current device — pairing a new phone will disconnect <strong>{pairedDevice.name}</strong>.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    Pairing Window Open
                  </h4>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: pairingWindowSecondsLeft <= 30 ? "#f87171" : "#38bdf8",
                      background: pairingWindowSecondsLeft <= 30 ? "rgba(239, 68, 68, 0.15)" : "rgba(56, 189, 248, 0.12)",
                      padding: "3px 9px",
                      borderRadius: "6px",
                      fontFamily: "monospace",
                    }}
                  >
                    <Clock size={12} />
                    Expires in {formatCountdown(pairingWindowSecondsLeft)}
                  </span>
                </div>

                <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "12px" }}>
                  Scanning the QR pairs automatically. Typing the code requires one confirmation on PC.
                </p>

                <div style={{ display: "inline-flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>
                    8-CHARACTER PAIRING CODE
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "22px",
                        fontWeight: 800,
                        letterSpacing: "3px",
                        color: "#38bdf8",
                        background: "rgba(56, 189, 248, 0.1)",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                      }}
                    >
                      {formatCodeDisplay(pairingCode)}
                    </span>
                    <button
                      type="button"
                      className="key-badge-btn"
                      style={{ height: "38px", padding: "0 12px", display: "flex", alignItems: "center", gap: "5px" }}
                      onClick={onStartPairingWindow}
                    >
                      <RefreshCw size={13} />
                      <span>New Code</span>
                    </button>
                    <button
                      type="button"
                      className="key-badge-btn"
                      style={{
                        height: "38px",
                        padding: "0 12px",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                      onClick={onClosePairingWindow}
                    >
                      <X size={13} />
                      <span>Close</span>
                    </button>
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-tertiary)" }}>
                    through the link:{" "}
                    <a
                      href="https://sagebot-remote.vercel.app/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 600 }}
                    >
                      https://sagebot-remote.vercel.app/
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QRCodeSVG
                  value={`https://sagebot-remote.vercel.app/?room=${pairingCode}&token=${pairingQrToken}`}
                  size={140}
                  level="M"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
