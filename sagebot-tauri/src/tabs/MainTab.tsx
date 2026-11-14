import React from "react";
import { Play, Square } from "lucide-react";

interface MainTabProps {
  isRunning: boolean;
  hotkey: string;
  logs: string[];
  logBoxRef: React.RefObject<HTMLDivElement | null>;
  onToggleBot: () => void;
}

export const MainTab: React.FC<MainTabProps> = ({
  isRunning,
  hotkey,
  logs,
  logBoxRef,
  onToggleBot,
}) => (
  <div className="tab-pane">
    <div className="card status-header-card">
      <div className="status-row">
        <span className="status-label">STATUS:</span>
        <span
          className={`status-value ${isRunning ? "val-running" : "val-stopped"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span
            className={`nav-live-dot ${isRunning ? "dot-bot-running" : "dot-bot-stopped"}`}
            style={{ margin: 0 }}
          />
          {isRunning ? "RUNNING" : "STOPPED"}
        </span>
      </div>
      <div className="status-row" style={{ marginTop: "6px" }}>
        <span className="status-label">HOTKEY:</span>
        <span className="status-value val-hotkey">{hotkey}</span>
      </div>
    </div>

    <button
      className={`primary-action-btn ${isRunning ? "btn-stop" : "btn-start"}`}
      onClick={onToggleBot}
    >
      {isRunning ? (
        <>
          <Square size={16} fill="white" /> STOP SAGEBOT
        </>
      ) : (
        <>
          <Play size={16} fill="white" /> START SAGEBOT
        </>
      )}
    </button>

    <div className="card log-card">
      <div className="log-container" ref={logBoxRef}>
        {logs.map((line, i) => (
          <div key={i} className="log-line">
            {line}
          </div>
        ))}
      </div>
    </div>
  </div>
);
