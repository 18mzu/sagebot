import React from "react";
import { APP_VERSION } from "../constants/valorant";

interface InfoTabProps {
  hotkey: string;
  changelogContent: string;
}

export const InfoTab: React.FC<InfoTabProps> = ({ hotkey, changelogContent }) => (
  <div className="tab-pane">
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="pane-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>SageBot</span>
            <span className="version-pill" style={{ fontSize: "10px", padding: "1.5px 8px" }}>
              v{APP_VERSION}
            </span>
          </div>
          <div className="pane-subtitle" style={{ marginTop: "4px" }}>
            SageBot is a multi-functional, external VALORANT utility.
          </div>
        </div>
      </div>
    </div>

    <div className="card" style={{ marginTop: "12px", border: "1px solid rgba(56, 189, 248, 0.3)", background: "rgba(14, 165, 233, 0.04)" }}>
      <div className="card-header" style={{ color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
        HOW TO USE SAGEBOT
      </div>
      <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "#cbd5e1" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: "#38bdf8", minWidth: "18px" }}>1.</span>
          <span>Take a look around and explore.</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: "#38bdf8", minWidth: "18px" }}>2.</span>
          <span>Hit the hotkey (<strong style={{ color: "#10b981" }}>{hotkey}</strong>) to start/stop.</span>
        </div>
      </div>
    </div>

    <div className="card" style={{ marginTop: "12px", border: "1px solid rgba(239, 68, 68, 0.35)", background: "rgba(239, 68, 68, 0.04)" }}>
      <div className="card-header" style={{ color: "#f87171", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>WHAT IS RISKY</span>
        <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "1px 7px", borderRadius: "10px", fontWeight: 700 }}>
          RISKY
        </span>
      </div>
      <p style={{ marginTop: "8px", fontSize: "12.5px", lineHeight: "1.6", color: "#cbd5e1" }}>
        These functions are a bit edgy. Handle with caution.
      </p>
    </div>

    <div className="card" style={{ marginTop: "12px" }}>
      <div className="card-header" style={{ color: "#10b981", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>CHANGELOG</span>
        <span style={{ fontSize: "11px", color: "#6ee7b7", fontWeight: 600 }}>v{APP_VERSION}</span>
      </div>
      <div style={{ marginTop: "10px" }}>
        <pre className="changelog-pre" style={{ maxHeight: "240px" }}>
          {changelogContent || "Loading changelog..."}
        </pre>
      </div>
    </div>
  </div>
);
