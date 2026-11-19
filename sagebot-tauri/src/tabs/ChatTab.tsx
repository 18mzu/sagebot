import React, { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { AppConfig, CustomChatMessage } from "../types/sagebot";

interface ChatTabProps {
  config: AppConfig;
  chatIntervalInput: string;
  setChatIntervalInput: (val: string) => void;
  commitChatInterval: () => void;
  updateAndSaveConfig: (patch: Partial<AppConfig>) => void;
  onLog: (msg: string) => void;
}

const MAX_SAVED_MESSAGES = 30;
const MAX_NAME_LEN = 24;
const MAX_TEXT_LEN = 500;

export const ChatTab: React.FC<ChatTabProps> = ({
  config,
  chatIntervalInput,
  setChatIntervalInput,
  commitChatInterval,
  updateAndSaveConfig,
  onLog,
}) => {
  const savedMessages = config.custom_chat_messages || [];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState("");

  const openAddForm = () => {
    setEditingId(null);
    setDraftName("");
    setDraftText("");
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (item: CustomChatMessage) => {
    setEditingId(item.id);
    setDraftName(item.name);
    setDraftText(item.text);
    setFormError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setDraftName("");
    setDraftText("");
    setFormError("");
  };

  const handleSaveCustomMessage = () => {
    const cleanName = draftName.trim();
    const cleanText = draftText.trim();
    if (!cleanName) {
      setFormError("Please enter a name for this chat.");
      return;
    }
    if (!cleanText) {
      setFormError("Please enter the chat message text.");
      return;
    }
    const duplicate = savedMessages.some(
      (m) => m.id !== editingId && m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setFormError(`A chat named "${cleanName}" already exists.`);
      return;
    }

    let nextList: CustomChatMessage[];
    if (editingId) {
      nextList = savedMessages.map((m) =>
        m.id === editingId ? { ...m, name: cleanName, text: cleanText } : m
      );
      onLog(`[CHAT] Updated custom message "${cleanName}".`);
    } else {
      const newItem: CustomChatMessage = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        text: cleanText,
      };
      nextList = [...savedMessages, newItem];
      onLog(`[CHAT] Saved custom message "${cleanName}".`);
    }

    updateAndSaveConfig({
      custom_chat_messages: nextList,
      custom_chat_seeded: true,
    });
    closeForm();
  };

  const handleDeleteCustomMessage = (item: CustomChatMessage) => {
    const nextList = savedMessages.filter((m) => m.id !== item.id);
    updateAndSaveConfig({
      custom_chat_messages: nextList,
      custom_chat_seeded: true,
    });
    if (editingId === item.id) {
      closeForm();
    }
    onLog(`[CHAT] Deleted saved message "${item.name}".`);
  };

  return (
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
                const enabled = e.target.checked;
                updateAndSaveConfig({ chat_enabled: enabled });
                onLog(enabled ? "[CHAT] Chat automation activated." : "[CHAT] Chat automation deactivated.");
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
          maxLength={MAX_TEXT_LEN}
          value={config.chat_text}
          onChange={(e) => updateAndSaveConfig({ chat_text: e.target.value })}
        />

        {/* Custom Saved Messages Section */}
        <div className="chat-saved-section">
          <div className="chat-saved-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="field-label">Saved Messages</span>
              <span className="char-count">
                {savedMessages.length}/{MAX_SAVED_MESSAGES}
              </span>
            </div>
            {!isFormOpen && (
              <button
                type="button"
                className="chat-add-btn"
                disabled={savedMessages.length >= MAX_SAVED_MESSAGES}
                onClick={openAddForm}
                title={
                  savedMessages.length >= MAX_SAVED_MESSAGES
                    ? `Limit of ${MAX_SAVED_MESSAGES} saved messages reached`
                    : "Save a new custom message"
                }
              >
                <Plus size={13} />
                <span>Add Message</span>
              </button>
            )}
          </div>

          {isFormOpen && (
            <div className="chat-saved-editor">
              <div className="chat-editor-row">
                <input
                  type="text"
                  maxLength={MAX_NAME_LEN}
                  className="chat-editor-name-input"
                  placeholder="Chat name (e.g. Callout, Meme...)"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (formError) setFormError("");
                  }}
                />
                <span className="char-count">{draftName.length}/{MAX_NAME_LEN}</span>
              </div>

              <div className="between-row" style={{ marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.55)" }}>
                  Message Text
                </span>
                <span className="char-count">{draftText.length}/{MAX_TEXT_LEN}</span>
              </div>
              <textarea
                className="chat-textarea"
                style={{ height: "70px" }}
                maxLength={MAX_TEXT_LEN}
                placeholder="Enter message text up to 500 characters..."
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  if (formError) setFormError("");
                }}
              />

              {formError && <div className="chat-editor-error">{formError}</div>}

              <div className="chat-editor-actions">
                <button type="button" className="chat-editor-cancel-btn" onClick={closeForm}>
                  <X size={13} />
                  <span>Cancel</span>
                </button>
                <button type="button" className="chat-editor-save-btn" onClick={handleSaveCustomMessage}>
                  <Check size={13} />
                  <span>{editingId ? "Update" : "Save"}</span>
                </button>
              </div>
            </div>
          )}

          {savedMessages.length === 0 ? (
            <div className="chat-saved-empty">
              No saved messages yet. Click <strong>+ Add Message</strong> to create one.
            </div>
          ) : (
            <div className="chat-saved-list">
              {savedMessages.map((item) => {
                const isSelected = config.chat_text === item.text;
                return (
                  <div
                    key={item.id}
                    className={`chat-saved-chip ${isSelected ? "active" : ""}`}
                    onClick={() => updateAndSaveConfig({ chat_text: item.text })}
                    title={item.text}
                  >
                    <span className="chat-saved-chip-name">{item.name}</span>
                    <div className="chat-saved-chip-actions">
                      <button
                        type="button"
                        className="chat-chip-icon-btn"
                        title="Edit message"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditForm(item);
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="chat-chip-icon-btn danger"
                        title="Delete message"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomMessage(item);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
