import React from "react";
import type { AppConfig } from "../types/sagebot";

interface VotingTabProps {
  config: AppConfig;
  isRebindingVoteYes: boolean;
  isRebindingVoteNo: boolean;
  onStartRebindVote: (target: "yes" | "no") => void;
  updateAndSaveConfig: (patch: Partial<AppConfig>) => void;
  onLog: (msg: string) => void;
  onToast: (msg: string) => void;
}

const CUSTOM_HALF_GROUPS = [
  {
    key: "first",
    title: "First Half (R6 – R12)",
    rounds: [6, 7, 8, 9, 10, 11, 12],
    min: 6,
    max: 12,
    lockField: "auto_ff_round_5" as const,
    lockLabel: "Locked by Round 5",
  },
  {
    key: "second",
    title: "Second Half (R15 – R24)",
    rounds: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    min: 15,
    max: 24,
    lockField: "auto_ff_round_14" as const,
    lockLabel: "Locked by Round 14",
  },
];

export const VotingTab: React.FC<VotingTabProps> = ({
  config,
  isRebindingVoteYes,
  isRebindingVoteNo,
  onStartRebindVote,
  updateAndSaveConfig,
  onLog,
  onToast,
}) => (
  <div className="tab-pane">
    {/* 1. Auto Surrender (Merged Surrender + Overtime + Custom Vote Keys) */}
    <div className="card">
      <div className="pane-title">Auto Surrender</div>
      <div className="pane-subtitle">
        Automatically casts surrender and overtime votes using your configured keys.
      </div>

      {/* Surrender Vote */}
      <div className="control-row" style={{ marginTop: "14px" }}>
        <div>
          <div className="control-title">Surrender Vote</div>
          <div className="pane-subtitle">Vote response for forfeit prompts.</div>
        </div>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${config.auto_vote_mode === 0 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ auto_vote_mode: 0 });
              onLog("[SETTINGS] Auto-Vote disabled.");
            }}
          >
            Disabled
          </button>
          <button
            type="button"
            className={`segmented-btn vote-yes ${config.auto_vote_mode === 1 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ auto_vote_mode: 1 });
              onLog(`[SETTINGS] Auto-Vote set to YES (${config.vote_yes_key || "F5"}).`);
            }}
          >
            Vote YES ({config.vote_yes_key || "F5"})
          </button>
          <button
            type="button"
            className={`segmented-btn vote-no ${config.auto_vote_mode === 2 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ auto_vote_mode: 2 });
              onLog(`[SETTINGS] Auto-Vote set to NO (${config.vote_no_key || "F6"}).`);
            }}
          >
            Vote NO ({config.vote_no_key || "F6"})
          </button>
        </div>
      </div>

      {/* Overtime Vote */}
      <div
        className="control-row"
        style={{
          marginTop: "14px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div className="control-title">Overtime Vote</div>
          <div className="pane-subtitle">Vote response during overtime prompts.</div>
        </div>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${config.auto_overtime_vote_mode === 0 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ auto_overtime_vote_mode: 0 });
              onLog("[SETTINGS] Overtime Vote disabled.");
            }}
          >
            Disabled
          </button>
          <button
            type="button"
            className={`segmented-btn vote-draw ${config.auto_overtime_vote_mode === 1 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ auto_overtime_vote_mode: 1 });
              onLog(`[SETTINGS] Overtime Vote set to DRAW (${config.vote_yes_key || "F5"}).`);
            }}
          >
            Vote DRAW ({config.vote_yes_key || "F5"})
          </button>
          <button
            type="button"
            className={`segmented-btn vote-continue ${config.auto_overtime_vote_mode === 2 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ auto_overtime_vote_mode: 2 });
              onLog(`[SETTINGS] Overtime Vote set to CONTINUE (${config.vote_no_key || "F6"}).`);
            }}
          >
            Vote CONTINUE ({config.vote_no_key || "F6"})
          </button>
        </div>
      </div>

      {/* Custom Vote Keybinds */}
      <div
        className="control-row"
        style={{
          marginTop: "14px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div className="control-title">Vote Keybinds</div>
          <div className="pane-subtitle">
            Custom keys matching your in-game Vote YES / DRAW and Vote NO / CONTINUE binds.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>YES</span>
            <button
              type="button"
              className={`key-badge-btn ${isRebindingVoteYes ? "rebinding" : ""}`}
              onClick={() => onStartRebindVote("yes")}
            >
              {isRebindingVoteYes ? "Press..." : (config.vote_yes_key || "F5")}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#f87171", fontWeight: 600 }}>NO</span>
            <button
              type="button"
              className={`key-badge-btn ${isRebindingVoteNo ? "rebinding" : ""}`}
              onClick={() => onStartRebindVote("no")}
            >
              {isRebindingVoteNo ? "Press..." : (config.vote_no_key || "F6")}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* 3. Auto Initiate Surrender */}
    <div className="card" style={{ marginTop: "12px" }}>
      <div className="between-row">
        <div>
          <div className="pane-title">Auto Initiate Surrender</div>
          <div className="pane-subtitle">
            Attempts to initiate Surrender at designated rounds.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.auto_ff_enabled}
            onChange={(e) => updateAndSaveConfig({ auto_ff_enabled: e.target.checked })}
          />
          <span className="slider round"></span>
        </label>
      </div>

      <div
        style={{
          marginTop: "14px",
          opacity: config.auto_ff_enabled ? 1 : 0.45,
          pointerEvents: config.auto_ff_enabled ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      >
        <div className="field-label" style={{ marginBottom: "8px", fontWeight: 600 }}>
          Surrender Stages:
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
          <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.auto_ff_round_5}
              onChange={(e) => {
                const val = e.target.checked;
                const cur = config.auto_ff_custom_rounds || [];
                const nextCustom = val ? cur.filter((x) => x < 6 || x > 12) : cur;
                updateAndSaveConfig({
                  auto_ff_round_5: val,
                  auto_ff_custom_rounds: nextCustom,
                });
              }}
            />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Round 5 (First Half)</span>
          </label>

          <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.auto_ff_round_13}
              onChange={(e) => updateAndSaveConfig({ auto_ff_round_13: e.target.checked })}
            />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Round 13 (Begin Second Half)</span>
          </label>

          <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.auto_ff_round_14}
              onChange={(e) => {
                const val = e.target.checked;
                const cur = config.auto_ff_custom_rounds || [];
                const nextCustom = val ? cur.filter((x) => x < 15 || x > 24) : cur;
                updateAndSaveConfig({
                  auto_ff_round_14: val,
                  auto_ff_custom_rounds: nextCustom,
                });
              }}
            />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Round 14 (Second Half)</span>
          </label>
        </div>

        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "14px" }}>
          <div className="pane-subtitle" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px" }}>
            Custom Rounds:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {CUSTOM_HALF_GROUPS.map((group) => {
              const selectedRound = (config.auto_ff_custom_rounds || []).find(
                (r) => r >= group.min && r <= group.max
              );
              const isLocked = config[group.lockField];
              return (
                <div key={group.key} className={`custom-round-group ${isLocked ? "group-locked" : ""}`}>
                  <div className="custom-round-group-header">
                    <span className="custom-round-group-title">{group.title}</span>
                    {isLocked && (
                      <span className="custom-round-group-badge">{group.lockLabel}</span>
                    )}
                  </div>
                  <div className="custom-round-pills-row">
                    {group.rounds.map((r) => {
                      const isBlocked = isLocked || (selectedRound !== undefined && selectedRound !== r);
                      const isSelected = !isLocked && selectedRound === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (isBlocked) {
                              onToast("You can only surrender once per half");
                              return;
                            }
                            const cur = config.auto_ff_custom_rounds || [];
                            if (isSelected) {
                              updateAndSaveConfig({
                                auto_ff_custom_rounds: cur.filter((x) => x !== r),
                              });
                            } else {
                              const filtered = cur.filter((x) => x < group.min || x > group.max);
                              updateAndSaveConfig({
                                auto_ff_custom_rounds: [...filtered, r].sort((a, b) => a - b),
                              });
                            }
                          }}
                          className={`round-pill-btn ${isSelected ? "active" : ""} ${isBlocked ? "blocked" : ""}`}
                          data-tooltip={
                            isBlocked
                              ? "Disabled: You can only surrender once per half"
                              : `Toggle surrender at Round ${r}`
                          }
                        >
                          R{r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </div>
);
