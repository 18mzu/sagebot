import React from "react";
import type { AppConfig } from "../types/sagebot";

interface ChatTabProps {
  config: AppConfig;
  chatIntervalInput: string;
  setChatIntervalInput: (val: string) => void;
  commitChatInterval: () => void;
  setShowChatWarningModal: (show: boolean) => void;
  updateAndSaveConfig: (patch: Partial<AppConfig>) => void;
  onLog: (msg: string) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  config,
  chatIntervalInput,
  setChatIntervalInput,
  commitChatInterval,
  setShowChatWarningModal,
  updateAndSaveConfig,
  onLog,
}) => (
  <div className="tab-pane">
    <div className="card">
      <div className="pane-title">Auto Chat</div>
      <div className="pane-subtitle">
        Send a message through in-game chat.
      </div>

      <div className="control-row" style={{ marginTop: "12px" }}>
        <div>
          <div className="control-title">Enable</div>
          <div className="pane-subtitle">Send recurring in-game messages.</div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.chat_enabled}
            onChange={(e) => {
              if (e.target.checked) {
                setShowChatWarningModal(true);
              } else {
                updateAndSaveConfig({ chat_enabled: false });
                onLog("[CHAT] Chat automation deactivated.");
              }
            }}
          />
          <span className="slider round"></span>
        </label>
      </div>

      <div className="control-row" style={{ marginTop: "14px" }}>
        <div>
          <div className="control-title">Channel</div>
          <div className="pane-subtitle">Destination chat stream.</div>
        </div>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${config.chat_target === 0 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ chat_target: 0 });
              onLog("[CHAT] Target set to Team chat.");
            }}
          >
            Team Chat
          </button>
          <button
            type="button"
            className={`segmented-btn ${config.chat_target === 1 ? "active" : ""}`}
            onClick={() => {
              updateAndSaveConfig({ chat_target: 1 });
              onLog("[CHAT] Target set to All chat.");
            }}
          >
            All Chat (/all)
          </button>
        </div>
      </div>

      <div className="control-row" style={{ marginTop: "14px" }}>
        <div>
          <div className="control-title">Interval</div>
          <div className="pane-subtitle">(0 – 3600 seconds).</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <input
            type="text"
            className="interval-input"
            value={chatIntervalInput}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^0-9]/g, "");
              setChatIntervalInput(clean);
            }}
            onBlur={commitChatInterval}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitChatInterval();
                (e.target as HTMLElement).blur();
              }
            }}
          />
          <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
            sec
          </span>
        </div>
      </div>

      <div className="between-row" style={{ marginTop: "16px" }}>
        <span className="field-label">
          Message Content (max. 500 chars.)
        </span>
        <span className="char-count">
          {config.chat_text.length}/500
        </span>
      </div>

      <textarea
        className="chat-textarea"
        maxLength={500}
        value={config.chat_text}
        onChange={(e) => updateAndSaveConfig({ chat_text: e.target.value })}
      />

      <div className="preset-buttons-row">
        <button
          className="preset-btn"
          onClick={() =>
            updateAndSaveConfig({
              chat_text: "ggmrbeast.china1st",
            })
          }
        >
          ggmrbeast
        </button>
        <button
          className="preset-btn"
          onClick={() =>
            updateAndSaveConfig({
              chat_text:
                "Wintrading refers to any actions that a player or group of players may take in order to fix the outcome of a match, usually to boost a player’s MMR, rank, or account level. Wintrading undermines the integrity of the competitive experience and dilutes the value of ranked play by predetermining the results of a match. Additionally, players who find themselves in a fixed game are thrust into a deeply negative experience over which they have no control.",
            })
          }
        >
          Wintrading
        </button>
      </div>
    </div>
  </div>
);
