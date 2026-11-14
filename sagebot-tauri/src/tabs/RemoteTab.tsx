import React from "react";
import { Lock, RotateCcw, Shield, Smartphone, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatCodeDisplay } from "../secureChannel";
import type { PairedDevice } from "../types/sagebot";

interface RemoteTabProps {
  remoteClientConnected: boolean;
  remoteRoomCode: string;
  secretToken: string;
  remoteUniqueControl: boolean;
  pairedDevices: PairedDevice[];
  onOpenResetModal: () => void;
  onToggleUniqueControl: () => void;
  onRemoveDevice: (devId: string) => void;
}

export const RemoteTab: React.FC<RemoteTabProps> = ({
  remoteClientConnected,
  remoteRoomCode,
  secretToken,
  remoteUniqueControl,
  pairedDevices,
  onOpenResetModal,
  onToggleUniqueControl,
  onRemoveDevice,
}) => (
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
              Control SageBot and the game from your phone.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`status-pill ${remoteClientConnected ? "active" : ""}`} style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: remoteClientConnected ? "#10b981" : "#64748b" }}></span>
            {remoteClientConnected ? "Phone Connected" : "Ready to Pair"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", marginTop: "20px", alignItems: "center", background: "rgba(0, 0, 0, 0.25)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-card)" }}>
        <div>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>
            QR Code
          </h4>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "14px" }}>
            Scan this QR code on your phone to control SageBot and VALORANT.
          </p>

          <div style={{ display: "inline-flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>OR ENTER 8-CHARACTER CODE</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "monospace", fontSize: "24px", fontWeight: 800, letterSpacing: "3px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                {formatCodeDisplay(remoteRoomCode)}
              </span>
              <button
                className="key-badge-btn"
                style={{ height: "40px", padding: "0 14px", display: "flex", alignItems: "center", gap: "6px" }}
                onClick={onOpenResetModal}
              >
                <RotateCcw size={14} />
                <span>Reset Code</span>
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
            value={`https://sagebot-remote.vercel.app/?room=${remoteRoomCode}&token=${secretToken}`}
            size={140}
            level="M"
          />
        </div>
      </div>

      {/* Security & Connected Devices Section */}
      <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <Shield size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>Connected Devices</span>
        </div>
        <div className="pane-subtitle" style={{ marginBottom: "14px" }}>
          Manage paired mobile devices authorized to monitor and control SageBot.
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-card)",
            padding: "12px 14px",
            borderRadius: "10px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Lock size={16} style={{ color: remoteUniqueControl ? "#10b981" : "var(--text-secondary)" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                Unique Control
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                Allow only one device to pair. Remove the current device or turn this off to pair another.
              </div>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={remoteUniqueControl}
              onChange={onToggleUniqueControl}
            />
            <span className="slider round" />
          </label>
        </div>

        {pairedDevices.length === 0 ? (
          <div style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px dashed rgba(255, 255, 255, 0.1)", padding: "20px", borderRadius: "10px", textAlign: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              No devices paired yet.
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pairedDevices.map((dev) => (
              <div
                key={dev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--border-card)",
                  padding: "10px 14px",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Smartphone size={18} style={{ color: "var(--accent)" }} />
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", display: "block" }}>
                      {dev.name}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                      Paired at {dev.paired_at}
                    </span>
                  </div>
                </div>
                <button
                  className="key-badge-btn"
                  style={{ height: "30px", padding: "0 10px", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", gap: "5px" }}
                  onClick={() => onRemoveDevice(dev.id)}
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);
