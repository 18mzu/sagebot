import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { APP_VERSION } from "../constants/valorant";
import type { AppConfig, UpdateInfo } from "../types/sagebot";

interface SettingsTabProps {
  config: AppConfig;
  updateInfo: UpdateInfo | null;
  updateStatus: string;
  isRebindingMain: boolean;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setUpdateStatus: (status: string) => void;
  setShowUpdateModal: (show: boolean) => void;
  setIsRebindingMain: (val: boolean) => void;
  updateAndSaveConfig: (patch: Partial<AppConfig>) => void;
  onToast: (msg: string) => void;
  onLog: (msg: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  config,
  updateInfo,
  updateStatus,
  isRebindingMain,
  setUpdateInfo,
  setUpdateStatus,
  setShowUpdateModal,
  setIsRebindingMain,
  updateAndSaveConfig,
  onToast,
  onLog,
}) => (
  <div className="tab-pane">
    <div className="card">
      <div className="pane-title">Updates</div>
      <div className="pane-subtitle">Current Version: v{updateInfo?.current_version || APP_VERSION}</div>

      <div style={{ marginTop: "14px" }}>
        <button
          className="action-btn"
          onClick={async () => {
            setUpdateStatus("Checking for updates...");
            try {
              const info = await invoke<UpdateInfo>("check_for_updates");
              setUpdateInfo(info);
              if (info.available) {
                setShowUpdateModal(true);
                setUpdateStatus(`A newer version is available: ${info.latest_version}`);
              } else {
                setUpdateStatus(`You are running the latest version: v${info.current_version}`);
                onToast(`You are on the latest version (v${info.current_version})`);
              }
            } catch (err: any) {
              setUpdateStatus(`Update check error: ${err}`);
            }
          }}
        >
          Check for Updates
        </button>
      </div>

      {updateStatus && (
        <div className="status-feedback" style={{ marginTop: "10px" }}>
          {updateStatus}
        </div>
      )}
    </div>

    <div className="card" style={{ marginTop: "12px" }}>
      <div className="pane-title">Hotkey &amp; Window</div>
      <div className="pane-subtitle">
        Global controls and behavior options.
      </div>

      <div className="control-row" style={{ marginTop: "14px" }}>
        <div>
          <div className="control-title">Toggle Hotkey</div>
          <div className="pane-subtitle">Global shortcut to start/stop SageBot.</div>
        </div>
        <button
          className={`key-badge-btn ${isRebindingMain ? "rebinding" : ""}`}
          onClick={() => setIsRebindingMain(!isRebindingMain)}
        >
          {isRebindingMain ? "Press Key..." : config.hotkey}
        </button>
      </div>

      <div className="control-row" style={{ marginTop: "14px" }}>
        <div>
          <div className="control-title">Always on top</div>
          <div className="pane-subtitle">
            The app stays on top.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.always_on_top}
            onChange={(e) => {
              const val = e.target.checked;
              updateAndSaveConfig({ always_on_top: val });
              invoke("set_always_on_top", { alwaysOnTop: val }).catch(() => { });
              onLog(val ? "[SETTINGS] Always on top enabled." : "[SETTINGS] Always on top disabled.");
            }}
          />
          <span className="slider round"></span>
        </label>
      </div>

      <div className="control-row" style={{ marginTop: "14px" }}>
        <div>
          <div className="control-title">Low Detail Mode</div>
          <div className="pane-subtitle">
            Reduce GPU works.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.low_detail ?? false}
            onChange={(e) => {
              const val = e.target.checked;
              updateAndSaveConfig({ low_detail: val });
              onLog(val ? "[SETTINGS] Low Detail Mode enabled." : "[SETTINGS] Low Detail Mode disabled.");
            }}
          />
          <span className="slider round"></span>
        </label>
      </div>
    </div>
  </div>
);
