import React from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  Download,
  FileCode,
  History,
  Lock,
  Smartphone,
  Upload,
} from "lucide-react";
import type {
  AppConfig,
  PlayerEncounter,
  RecentMatchDetail,
  TrackedPlayer,
  UpdateInfo,
} from "../types/sagebot";
import type { PairRequest } from "../remoteHost";

interface AppModalsProps {
  showKillModal: boolean;
  setShowKillModal: (v: boolean) => void;
  onConfirmKillValorant: () => void;

  showLaunchModal: boolean;
  setShowLaunchModal: (v: boolean) => void;
  isRiotSignedIn: boolean;
  onLog: (msg: string) => void;
  onToast: (msg: string) => void;

  showChatWarningModal: boolean;
  setShowChatWarningModal: (v: boolean) => void;
  updateAndSaveConfig: (patch: Partial<AppConfig>) => void;

  playerToDelete: PlayerEncounter | null;
  setPlayerToDelete: (p: PlayerEncounter | null) => void;
  deletePlayerEncounter: (puuid: string) => Promise<void>;

  errorModal: { title: string; message: string; submessage?: string } | null;
  setErrorModal: (v: { title: string; message: string; submessage?: string } | null) => void;

  showUpdateModal: boolean;
  setShowUpdateModal: (v: boolean) => void;
  updateInfo: UpdateInfo | null;
  updateProgress: number;
  setUpdateProgress: (v: number) => void;
  updateError: string;
  setUpdateError: (v: string) => void;

  showMacroImportModal: boolean;
  setShowMacroImportModal: (v: boolean) => void;
  macroImportText: string;
  setMacroImportText: (v: string) => void;
  macroCompilerError: string;
  setMacroCompilerError: (v: string) => void;
  handleValidateAndApplyMacro: () => void;

  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
  authInput: string;
  setAuthInput: (v: string) => void;
  handleDevAuthSubmit: (e?: React.FormEvent) => void;

  selectedPlayerMatches: { player: TrackedPlayer; matches: RecentMatchDetail[] } | null;
  setSelectedPlayerMatches: (v: { player: TrackedPlayer; matches: RecentMatchDetail[] } | null) => void;
  formatMatchTime: (ts: number) => string;

  pendingPairRequest: PairRequest | null;
  deviceNicknameInput: string;
  setDeviceNicknameInput: (v: string) => void;
  handleDenyDevice: () => void;
  handleApproveDevice: () => void;

  showResetConfirmModal: boolean;
  setShowResetConfirmModal: (v: boolean) => void;
  handleResetRemoteCode: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  showKillModal,
  setShowKillModal,
  onConfirmKillValorant,
  showLaunchModal,
  setShowLaunchModal,
  isRiotSignedIn,
  onLog,
  onToast,
  showChatWarningModal,
  setShowChatWarningModal,
  updateAndSaveConfig,
  playerToDelete,
  setPlayerToDelete,
  deletePlayerEncounter,
  errorModal,
  setErrorModal,
  showUpdateModal,
  setShowUpdateModal,
  updateInfo,
  updateProgress,
  setUpdateProgress,
  updateError,
  setUpdateError,
  showMacroImportModal,
  setShowMacroImportModal,
  macroImportText,
  setMacroImportText,
  macroCompilerError,
  setMacroCompilerError,
  handleValidateAndApplyMacro,
  showAuthModal,
  setShowAuthModal,
  authInput,
  setAuthInput,
  handleDevAuthSubmit,
  selectedPlayerMatches,
  setSelectedPlayerMatches,
  formatMatchTime,
  pendingPairRequest,
  deviceNicknameInput,
  setDeviceNicknameInput,
  handleDenyDevice,
  handleApproveDevice,
  showResetConfirmModal,
  setShowResetConfirmModal,
  handleResetRemoteCode,
}) => (
  <>
    {/* Kill VALORANT Confirmation Modal */}
    {showKillModal && (
      <div className="modal-backdrop">
        <div className="modal-card">
          <div className="modal-header kill-modal-header">
            <AlertTriangle color="#ef4444" size={20} />
            <span style={{ color: "#ef4444" }}>Kill VALORANT Confirmation</span>
          </div>
          <div className="modal-body">
            <p style={{ fontWeight: 700, color: "#f87171" }}>
              ⚠️ FORCE QUIT VALORANT
            </p>
            <p style={{ marginTop: "8px" }}>
              Are you sure you want to close VALORANT? This will immediately terminate all active VALORANT processes (<span className="code-font">VALORANT.exe</span> and <span className="code-font">VALORANT-Win64-Shipping.exe</span>).
            </p>
            <p style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px" }}>
              Any active match, custom lobby, or agent select will be disconnected immediately.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="modal-btn secondary"
              onClick={() => setShowKillModal(false)}
            >
              Cancel
            </button>
            <button
              className="modal-btn danger"
              onClick={onConfirmKillValorant}
            >
              Kill VALORANT
            </button>
          </div>
        </div>
      </div>
    )}

    {/* VALORANT Not Detected Launch Modal */}
    {showLaunchModal && (
      <div className="modal-backdrop" onClick={() => setShowLaunchModal(false)} style={{ zIndex: 9999 }}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <div className="modal-header" style={{ color: "#38bdf8" }}>
            <AlertTriangle size={20} color="#38bdf8" />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#38bdf8" }}>VALORANT is not detected</span>
          </div>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5" }}>
              SageBot requires VALORANT to be running. Would you like SageBot to launch it for you?
            </p>
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isRiotSignedIn ? "#10b981" : "#f59e0b" }} />
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                {isRiotSignedIn
                  ? "Stay signed in is active. SageBot will launch directly into VALORANT."
                  : "Not signed in. Riot Client will open for authentication."}
              </span>
            </div>
          </div>
          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="modal-btn secondary"
              onClick={() => setShowLaunchModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal-btn primary"
              style={{ background: "#0284c7", borderColor: "#38bdf8", color: "#ffffff", fontWeight: 700 }}
              onClick={() => {
                setShowLaunchModal(false);
                if (isRiotSignedIn) {
                  onLog("[LAUNCH] Starting VALORANT via Riot Client...");
                  onToast("Launching VALORANT...");
                  invoke("launch_valorant")
                    .then(() => onLog("[LAUNCH] VALORANT launch command sent successfully."))
                    .catch((err) => onLog(`[LAUNCH] Failed: ${err}`));
                } else {
                  onLog("[LAUNCH] Opening Riot Client for login...");
                  onToast("Opening Riot Client for login...");
                  invoke("launch_riot_client")
                    .then(() => onLog("[LAUNCH] Riot Client started for login."))
                    .catch((err) => onLog(`[LAUNCH] Failed: ${err}`));
                }
              }}
            >
              {isRiotSignedIn ? "Launch VALORANT" : "Open Riot Client"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Auto Chat Warning Modal */}
    {showChatWarningModal && (
      <div className="modal-backdrop">
        <div className="modal-card">
          <div className="modal-header">
            <AlertTriangle color="#f59e0b" size={20} />
            <span>Notes</span>
          </div>
          <div className="modal-body">
            <p style={{ fontWeight: 600, color: "#fbbf24" }}>
              ⚠️ In-Game Chat Warning
            </p>
            <p style={{ marginTop: "8px" }}>
              Spamming chat in VALORANT does not lead to any penalties.
            </p>
            <p style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px" }}>
              However, consider not spamming something distasteful (racist, sexist, etc.) or admitting you are using tool for spamming.
            </p>
            <p style={{ marginTop: "8px" }}>
              Do you wish to proceed and enable Auto Chat?
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="modal-btn secondary"
              onClick={() => setShowChatWarningModal(false)}
            >
              No
            </button>
            <button
              className="modal-btn danger"
              onClick={() => {
                updateAndSaveConfig({ chat_enabled: true });
                onLog("[CHAT] Chat automation activated.");
                setShowChatWarningModal(false);
              }}
            >
              I know what I'm doing
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Delete Player Record Confirmation Modal */}
    {playerToDelete && (
      <div className="modal-backdrop" style={{ zIndex: 9999 }}>
        <div className="modal-card" style={{ maxWidth: 420 }}>
          <div className="modal-header kill-modal-header">
            <AlertTriangle color="#ef4444" size={20} />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#ef4444" }}>
              Delete Player Record?
            </span>
          </div>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#f87171", fontSize: "14px" }}>
              Are you sure you want to remove this player's record?
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5" }}>
              This will permanently delete all encounter history, win/loss stats, and saved match references for <strong style={{ color: "#f1f5f9" }}>{playerToDelete.name}{playerToDelete.tag ? ` #${playerToDelete.tag}` : ""}</strong>.
            </p>
          </div>
          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="modal-btn secondary"
              onClick={() => setPlayerToDelete(null)}
            >
              No
            </button>
            <button
              type="button"
              className="modal-btn danger"
              onClick={async () => {
                const targetPuuid = playerToDelete.puuid;
                setPlayerToDelete(null);
                await deletePlayerEncounter(targetPuuid);
              }}
              style={{ background: "#dc2626", borderColor: "#ef4444", color: "#ffffff", fontWeight: 700 }}
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Validation Error Modal */}
    {errorModal && (
      <div className="modal-backdrop">
        <div className="modal-card">
          <div className="modal-header kill-modal-header">
            <AlertTriangle color="#ef4444" size={20} />
            <span style={{ color: "#ef4444" }}>{errorModal.title}</span>
          </div>
          <div className="modal-body">
            <p style={{ fontWeight: 600, color: "#f87171" }}>
              {errorModal.message}
            </p>
            {errorModal.submessage && (
              <p style={{ marginTop: "8px", color: "#94a3b8", fontSize: "13px" }}>
                {errorModal.submessage}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="modal-btn danger"
              style={{ minWidth: "90px" }}
              onClick={() => setErrorModal(null)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Auto Update Modal */}
    {showUpdateModal && updateInfo && (
      <div className="modal-backdrop">
        <div className="modal-card">
          <div className="modal-header update-modal-header">
            <Download color="#10b981" size={20} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#10b981" }}>Updating SageBot</span>
              <span className="version-pill">{updateInfo.latest_version}</span>
            </div>
          </div>
          <div className="modal-body">
            <p style={{ fontWeight: 600, color: "#f8fafc" }}>
              {updateError
                ? "Update encountered an error"
                : updateProgress >= 100
                  ? "Update complete! Restarting SageBot..."
                  : "Downloading and installing update..."}
            </p>
            <p style={{ marginTop: "4px", color: "var(--text-secondary)", fontSize: "12px" }}>
              Current: v{updateInfo.current_version} → Latest: {updateInfo.latest_version}
            </p>

            {!updateError && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <span>{updateProgress >= 100 ? "Restarting SageBot..." : "Downloading update..."}</span>
                  <span style={{ fontWeight: 600, color: "#34d399" }}>{updateProgress}%</span>
                </div>
                <div className="update-progress-bar">
                  <div
                    className="update-progress-fill"
                    style={{ width: `${Math.max(updateProgress, 5)}%` }}
                  />
                </div>
              </div>
            )}

            {updateError && (
              <div style={{ marginTop: "12px", padding: "10px 12px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                <p style={{ color: "#f87171", fontSize: "12px", fontWeight: 600 }}>
                  ❌ {updateError}
                </p>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button
                    className="modal-btn secondary"
                    style={{ fontSize: "12px", padding: "5px 12px" }}
                    onClick={() => {
                      setShowUpdateModal(false);
                      setUpdateError("");
                    }}
                  >
                    Continue to SageBot
                  </button>
                  {updateInfo.download_url && (
                    <button
                      className="modal-btn primary update-primary-btn"
                      style={{ fontSize: "12px", padding: "5px 12px" }}
                      onClick={() => {
                        setShowUpdateModal(true);
                        setUpdateProgress(0);
                        setUpdateError("");
                        invoke("apply_update", { downloadUrl: updateInfo.download_url }).catch((err: any) => {
                          setUpdateError(typeof err === "string" ? err : err?.message || "Failed to download update");
                        });
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Macro JSON Import Modal */}
    {showMacroImportModal && (
      <div
        className="modal-backdrop"
        onClick={() => {
          setShowMacroImportModal(false);
          setMacroCompilerError("");
        }}
      >
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "520px", maxWidth: "92vw", border: "1px solid rgba(59, 130, 246, 0.4)" }}
        >
          <div className="modal-header" style={{ color: "#60a5fa" }}>
            <FileCode size={18} color="#60a5fa" />
            <span>Import Macro JSON</span>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>
              Paste custom macro JSON below or load a file from disk. The compiler will validate syntax, structure, and timing schema before applying.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <input
                type="file"
                id="macro-file-input"
                accept=".json,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = (event.target?.result as string) || "";
                      setMacroImportText(content);
                      setMacroCompilerError("");
                    };
                    reader.readAsText(file);
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="modal-btn secondary"
                style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "6px" }}
                onClick={() => document.getElementById("macro-file-input")?.click()}
              >
                <Upload size={13} />
                <span>Import File</span>
              </button>
            </div>

            <textarea
              value={macroImportText}
              onChange={(e) => {
                setMacroImportText(e.target.value);
                if (macroCompilerError) setMacroCompilerError("");
              }}
              placeholder={`{\n  "total_loop_ms": 1000,\n  "actions": [\n    { "key": "w", "start_ms": 0, "duration_ms": 200 }\n  ]\n}`}
              rows={10}
              style={{
                width: "100%",
                fontFamily: "Consolas, 'Courier New', monospace",
                fontSize: "12px",
                background: "rgba(0, 0, 0, 0.5)",
                border: macroCompilerError ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "10px",
                boxSizing: "border-box",
                outline: "none",
                resize: "vertical",
              }}
            />

            {macroCompilerError && (
              <div className="compiler-error-box" style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#f87171", marginBottom: "4px" }}>
                  <span>⚠ Compiler Diagnostic Error</span>
                </div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "11px", color: "#fca5a5" }}>
                  {macroCompilerError}
                </pre>
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              className="modal-btn secondary"
              onClick={() => {
                setShowMacroImportModal(false);
                setMacroCompilerError("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal-btn primary"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                borderColor: "#3b82f6",
                color: "#ffffff",
              }}
              onClick={handleValidateAndApplyMacro}
            >
              Validate & Apply
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Hidden Developer Authentication Modal (Ctrl + Shift + P) */}
    {showAuthModal && (
      <div
        className="modal-backdrop"
        onClick={() => {
          setShowAuthModal(false);
          setAuthInput("");
        }}
      >
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "320px", border: "1px solid rgba(168, 85, 247, 0.35)" }}
        >
          <div className="modal-header" style={{ color: "#c084fc" }}>
            <Lock size={18} color="#c084fc" />
            <span>Authentication</span>
          </div>
          <form onSubmit={handleDevAuthSubmit}>
            <div className="modal-body">
              <input
                type="password"
                autoFocus
                placeholder="Passkey"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(0, 0, 0, 0.45)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  outline: "none",
                  marginTop: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthInput("");
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn primary"
                style={{
                  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                  borderColor: "#a855f7",
                  color: "#ffffff",
                }}
              >
                Verify
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Recent Matches Detailed History Modal */}
    {selectedPlayerMatches && (
      <div className="modal-backdrop" onClick={() => setSelectedPlayerMatches(null)}>
        <div
          className="modal-card recent-matches-modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "560px", width: "95%" }}
        >
          <div className="modal-header" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <History size={20} color="#38bdf8" />
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>
                    {selectedPlayerMatches.player.name}
                  </span>
                  {selectedPlayerMatches.player.is_self && (
                    <span className="tracker-party-badge" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" }}>YOU</span>
                  )}
                </div>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {selectedPlayerMatches.player.agent_name || "Unknown Agent"} • {selectedPlayerMatches.player.current_rank_name || "Unranked"} ({selectedPlayerMatches.player.current_rr} RR)
                </span>
              </div>
            </div>
          </div>

          <div className="modal-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Recent Competitive Matches ({selectedPlayerMatches.matches.length})
              </span>
            </div>

            {selectedPlayerMatches.matches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#64748b", fontSize: "13px" }}>
                No recent competitive games recorded in the last 20 matches.
              </div>
            ) : (
              <div className="recent-matches-list" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "430px", overflowY: "auto", paddingRight: "4px" }}>
                {selectedPlayerMatches.matches.map((m, idx) => {
                  const isRankUp = m.is_rank_up;
                  const isDerank = m.is_derank;
                  const isWin = m.result === "W";
                  const isLoss = m.result === "L";

                  const rrColor = isRankUp
                    ? "#facc15"
                    : isDerank
                      ? "#c084fc"
                      : isWin
                        ? "#34d399"
                        : isLoss
                          ? "#fb7185"
                          : "#cbd5e1";

                  const rrBg = isRankUp
                    ? "rgba(234, 179, 8, 0.16)"
                    : isDerank
                      ? "rgba(168, 85, 247, 0.16)"
                      : isWin
                        ? "rgba(16, 185, 129, 0.12)"
                        : isLoss
                          ? "rgba(244, 63, 94, 0.12)"
                          : "rgba(148, 163, 184, 0.12)";

                  const rrBorder = isRankUp
                    ? "rgba(234, 179, 8, 0.55)"
                    : isDerank
                      ? "rgba(168, 85, 247, 0.55)"
                      : isWin
                        ? "rgba(16, 185, 129, 0.3)"
                        : isLoss
                          ? "rgba(244, 63, 94, 0.3)"
                          : "rgba(148, 163, 184, 0.25)";

                  const pillClass = isRankUp
                    ? "pill-rankup"
                    : isDerank
                      ? "pill-derank"
                      : `pill-${m.result.toLowerCase()}`;

                  const sign = m.rr_change > 0 ? "+" : "";

                  return (
                    <div
                      key={m.match_id || idx}
                      className="recent-match-card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${rrBorder}`,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span
                          className={`recent-game-pill ${pillClass}`}
                          style={{ width: "28px", height: "24px", fontSize: "11px", fontWeight: 800 }}
                        >
                          {m.result}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: "#f8fafc" }}>
                              {m.map_name || "Competitive Match"}
                            </span>
                            {isRankUp && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  padding: "2px 7px",
                                  borderRadius: "3px",
                                  background: "rgba(234, 179, 8, 0.2)",
                                  color: "#fef08a",
                                  border: "1px solid rgba(234, 179, 8, 0.55)",
                                  letterSpacing: "0.4px",
                                }}
                              >
                                ▲ RANK UP
                              </span>
                            )}
                            {isDerank && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  padding: "2px 7px",
                                  borderRadius: "3px",
                                  background: "rgba(168, 85, 247, 0.2)",
                                  color: "#e9d5ff",
                                  border: "1px solid rgba(168, 85, 247, 0.55)",
                                  letterSpacing: "0.4px",
                                }}
                              >
                                ▼ DERANK
                              </span>
                            )}
                            {m.performance_bonus > 0 && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "3px",
                                  background: "rgba(234, 179, 8, 0.2)",
                                  color: "#facc15",
                                  border: "1px solid rgba(234, 179, 8, 0.4)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                                title={`Performance Bonus: +${m.performance_bonus} RR`}
                              >
                                ★ +{m.performance_bonus}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {m.tier_name ? `${m.tier_name} • ${m.rr_after} RR` : `${m.rr_after} RR`}
                            {m.has_kda && (
                              <span style={{ color: (m.kd_ratio ?? 0) >= 1.0 ? "#86efac" : "#fca5a5", marginLeft: "4px" }}>
                                • {m.kills}/{m.deaths}/{m.assists} • K/D: {(m.kd_ratio ?? 0).toFixed(2)}
                              </span>
                            )}
                            {m.timestamp > 0 && ` • ${formatMatchTime(m.timestamp)}`}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          background: rrBg,
                          border: `1px solid ${rrBorder}`,
                          fontWeight: 800,
                          fontSize: "13px",
                          color: rrColor,
                          letterSpacing: "0.3px",
                          minWidth: "65px",
                          textAlign: "center",
                        }}
                      >
                        {sign}{m.rr_change} RR
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ padding: "12px 20px" }}>
            <button
              className="modal-btn secondary"
              onClick={() => setSelectedPlayerMatches(null)}
              style={{ width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Device Pairing Approval Modal */}
    {pendingPairRequest && (
      <div className="modal-backdrop" style={{ zIndex: 9999 }}>
        <div className="modal-card" style={{ maxWidth: 440 }}>
          <div className="modal-header" style={{ color: "#38bdf8" }}>
            <Smartphone size={20} color="#38bdf8" />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>Device Pairing Request</span>
          </div>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1" }}>
              A device is requesting permission to connect to SageBot.
            </p>
            {pendingPairRequest.fingerprint && (
              <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Security Verification Key</span>
                <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 800, letterSpacing: "2px", color: "#38bdf8" }}>
                  {pendingPairRequest.fingerprint}
                </span>
              </div>
            )}
            <div>
              <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                Give this device a nickname:
              </label>
              <input
                type="text"
                value={deviceNicknameInput}
                onChange={(e) => setDeviceNicknameInput(e.target.value)}
                placeholder="e.g. iPhone Duo, Living Room iPad"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 12px",
                  background: "#0b1120",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  color: "#f8fafc",
                  fontSize: "13px",
                }}
                autoFocus
              />
            </div>
          </div>
          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button className="modal-btn secondary" onClick={handleDenyDevice}>
              Deny
            </button>
            <button
              className="modal-btn primary"
              onClick={handleApproveDevice}
              style={{ background: "#0284c7", borderColor: "#38bdf8", color: "#ffffff", fontWeight: 700 }}
            >
              Approve &amp; Pair
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Reset Code Confirmation Modal */}
    {showResetConfirmModal && (
      <div className="modal-backdrop" style={{ zIndex: 9999 }}>
        <div className="modal-card" style={{ maxWidth: 420 }}>
          <div className="modal-header kill-modal-header">
            <AlertTriangle size={20} color="#ef4444" />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#ef4444" }}>Reset Remote Pairing Code?</span>
          </div>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5" }}>
              Resetting your pairing code will <strong>immediately disconnect and log out all connected mobile devices</strong> and generate a fresh 8-character code.
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              You will need to re-pair any device you wish to use with SageBot.
            </p>
          </div>
          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button
              className="modal-btn secondary"
              onClick={() => setShowResetConfirmModal(false)}
            >
              Cancel
            </button>
            <button
              className="modal-btn danger"
              onClick={handleResetRemoteCode}
              style={{ background: "#dc2626", borderColor: "#ef4444", color: "#ffffff", fontWeight: 700 }}
            >
              Reset &amp; Disconnect All
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
