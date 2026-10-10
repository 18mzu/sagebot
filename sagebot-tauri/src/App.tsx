import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Play,
  Square,
  Minus,
  X,
  AlertTriangle,
  FileText,
  Settings as SettingsIcon,
  RefreshCw,
  XOctagon,
  CheckCircle2,
} from "lucide-react";
import "./App.css";

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  color: string;
  is_starter: boolean;
}

interface AppConfig {
  hotkey: string;
  auto_vote_mode: number;
  auto_overtime_vote_mode: number;
  auto_ff_enabled: boolean;
  auto_ff_round_5: boolean;
  auto_ff_round_13: boolean;
  auto_ff_round_14: boolean;
  auto_ff_custom_rounds: number[];
  anti_afk_mode: number;
  anti_afk_key: string;
  anti_afk_slow_mode: boolean;
  chat_enabled: boolean;
  chat_target: number;
  chat_interval: number;
  chat_text: string;
  webhook_enabled: boolean;
  webhook_url: string;
  webhook_user_id: string;
  agents_enabled: boolean;
  instalock_enabled: boolean;
  lock_delay: number;
  starter_fallback_enabled: boolean;
  selected_agents: string[];
  music_volume: number;
  auto_focus_game: boolean;
  always_on_top: boolean;
  auto_derank_enabled: boolean;
  auto_queue_enabled: boolean;
}

interface StatusResponse {
  is_connected: boolean;
  game_live: boolean;
  is_game_ready: boolean;
  client_type: string;
  port: number;
  pid: number;
  error_message?: string;
  player_name?: string;
  player_tag?: string;
  puuid?: string;
  match_state: string;
  rank_name: string;
  map_name: string;
  gamemode: string;
  score_ally: number;
  score_enemy: number;
  current_agent: string;
}

type TabType =
  | "main"
  | "status"
  | "config"
  | "agents"
  | "chat"
  | "autovote"
  | "music"
  | "webhook"
  | "changelog"
  | "settings";

interface ToastMsg {
  id: number;
  text: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("main");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [status, setStatus] = useState<StatusResponse>({
    is_connected: false,
    game_live: false,
    is_game_ready: false,
    client_type: "",
    port: 0,
    pid: 0,
    match_state: "OFFLINE",
    rank_name: "Unranked",
    map_name: "-",
    gamemode: "-",
    score_ally: 0,
    score_enemy: 0,
    current_agent: "-",
  });

  const [config, setConfig] = useState<AppConfig>({
    hotkey: "F9",
    auto_vote_mode: 0,
    auto_overtime_vote_mode: 0,
    auto_ff_enabled: false,
    auto_ff_round_5: false,
    auto_ff_round_13: false,
    auto_ff_round_14: false,
    auto_ff_custom_rounds: [],
    anti_afk_mode: 0,
    anti_afk_key: "Tab",
    anti_afk_slow_mode: false,
    chat_enabled: false,
    chat_target: 0,
    chat_interval: 180,
    chat_text: "With great Power comes great Responsibility",
    webhook_enabled: true,
    webhook_url: "",
    webhook_user_id: "",
    agents_enabled: true,
    instalock_enabled: false,
    lock_delay: 0,
    starter_fallback_enabled: false,
    selected_agents: [],
    music_volume: 80,
    auto_focus_game: false,
    always_on_top: false,
    auto_derank_enabled: false,
    auto_queue_enabled: false,
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] SageBot initialized.",
    "[SYSTEM] Settings loaded from config.ini.",
  ]);
  const [isRebindingMain, setIsRebindingMain] = useState<boolean>(false);
  const [isRebindingAfk, setIsRebindingAfk] = useState<boolean>(false);
  const [changelogContent, setChangelogContent] = useState<string>("");
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [webhookStatus, setWebhookStatus] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showInstalockModal, setShowInstalockModal] = useState<boolean>(false);
  const [showKillModal, setShowKillModal] = useState<boolean>(false);
  const [showChatWarningModal, setShowChatWarningModal] = useState<boolean>(false);
  const [showAutoDerankModal1, setShowAutoDerankModal1] = useState<boolean>(false);
  const [showAutoDerankModal2, setShowAutoDerankModal2] = useState<boolean>(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string; submessage?: string } | null>(null);

  const [lockDelayInput, setLockDelayInput] = useState<string>("10");
  const [chatIntervalInput, setChatIntervalInput] = useState<string>("180");

  // Gate Screen State
  const [gatePassed, setGatePassed] = useState<boolean>(false);
  const [isCrossfading, setIsCrossfading] = useState<boolean>(false);
  const [gateGameFound, setGateGameFound] = useState<boolean | null>(null);
  const isTransitioningRef = useRef<boolean>(false);

  // Pre Auto-Derank state storage (for reverting when turned off)
  const preAutoDerankStateRef = useRef<{
    auto_queue_enabled: boolean;
    starter_fallback_enabled: boolean;
  }>({
    auto_queue_enabled: false,
    starter_fallback_enabled: false,
  });

  // Suppression and synchronization refs
  const suppressDetectionUntilRef = useRef<number>(0);
  const lastScoreSumRef = useRef<number>(-1);
  const isSendingChatRef = useRef<boolean>(false);
  const lastQueueTimeRef = useRef<number>(0);

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [musicCurrentTime, setMusicCurrentTime] = useState<number>(0);
  const [musicDuration, setMusicDuration] = useState<number>(0);

  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const runningRef = useRef<boolean>(false);
  runningRef.current = isRunning;
  const configRef = useRef<AppConfig>(config);
  configRef.current = config;

  // Add Log Entry
  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const showToast = (text: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  };

  // Scroll logs to bottom
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // Initial Data Fetch
  useEffect(() => {
    invoke<AppConfig>("get_config")
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          if (!cfg.auto_derank_enabled) {
            preAutoDerankStateRef.current = {
              auto_queue_enabled: cfg.auto_queue_enabled,
              starter_fallback_enabled: cfg.starter_fallback_enabled,
            };
          }
          if (cfg.instalock_enabled) {
            setLockDelayInput("0");
          } else {
            const d = cfg.lock_delay >= 10 && cfg.lock_delay <= 70 ? cfg.lock_delay : 10;
            setLockDelayInput(String(d));
          }
          setChatIntervalInput(String(cfg.chat_interval ?? 180));
          if (cfg.always_on_top) {
            invoke("set_always_on_top", { alwaysOnTop: true }).catch(() => { });
          }
        }
      })
      .catch((err) => console.error("Error loading config:", err));

    invoke<AgentInfo[]>("get_agents")
      .then((agList) => setAgents(agList))
      .catch((err) => console.error("Error loading agents:", err));

    invoke<string>("get_changelog")
      .then((txt) => setChangelogContent(txt))
      .catch((err) => console.error("Error loading changelog:", err));

    // Silent update check
    invoke<string>("check_for_updates")
      .then((res) => setUpdateStatus(res))
      .catch(() => { });
  }, []);

  // Poll live status every 1.5 seconds
  useEffect(() => {
    const pollStatus = () => {
      if (Date.now() < suppressDetectionUntilRef.current) {
        setGateGameFound(false);
        return;
      }

      invoke<StatusResponse>("get_client_status")
        .then((res) => {
          setStatus(res);
          if (res.is_game_ready) {
            setGateGameFound(true);
            if (!gatePassed && !isTransitioningRef.current) {
              isTransitioningRef.current = true;
              // 1. Brief pause to show "VALORANT is Ready" badge clearly
              setTimeout(() => {
                // 2. Start smooth crossfade & resize window simultaneously
                setIsCrossfading(true);
                invoke("resize_to_dashboard").catch(() => { });

                // 3. Complete crossfade & fade in
                setTimeout(() => {
                  setGatePassed(true);
                  setIsCrossfading(false);
                  isTransitioningRef.current = false;
                }, 750);
              }, 600);
            }

            // Auto Matchmaking Queue (Active when auto_queue_enabled OR auto_derank_enabled)
            if (
              runningRef.current &&
              (configRef.current.auto_queue_enabled || configRef.current.auto_derank_enabled)
            ) {
              const stateUpper = res.match_state.toUpperCase();
              const isLobby =
                stateUpper.includes("LOBBY") ||
                stateUpper.includes("MENU") ||
                stateUpper.includes("POSTGAME") ||
                res.match_state === "In Lobby";
              if (isLobby) {
                if (Date.now() - lastQueueTimeRef.current > 10000) {
                  lastQueueTimeRef.current = Date.now();
                  addLog("[MATCHMAKING] In Lobby: Queuing Competitive match...");
                  invoke<boolean>("start_competitive_queue")
                    .then((ok) => {
                      if (ok) {
                        addLog("[MATCHMAKING] Matchmaking queue started successfully.");
                      }
                    })
                    .catch((err) => {
                      addLog(`[MATCHMAKING] Queue attempt: ${err}`);
                    });
                }
              }
            }

            // Check for round update for Auto Initiate Surrender (/ff)
            const isMatch =
              res.match_state.toUpperCase().includes("INGAME") ||
              res.match_state.toUpperCase().includes("IN GAME") ||
              res.match_state.toUpperCase().includes("GAME");
            if (isMatch) {
              const sum = res.score_ally + res.score_enemy;
              if (sum !== lastScoreSumRef.current) {
                lastScoreSumRef.current = sum;
                const currentRound = sum + 1;
                if (configRef.current.auto_ff_enabled) {
                  let shouldFf = false;
                  if (currentRound === 5 && configRef.current.auto_ff_round_5) {
                    shouldFf = true;
                  } else if (currentRound === 13 && configRef.current.auto_ff_round_13) {
                    shouldFf = true;
                  } else if (currentRound === 14 && configRef.current.auto_ff_round_14) {
                    shouldFf = true;
                  } else if (
                    (configRef.current.auto_ff_custom_rounds || []).includes(currentRound)
                  ) {
                    const blockedByR5 = configRef.current.auto_ff_round_5 && currentRound >= 6 && currentRound <= 12;
                    const blockedByR14 = configRef.current.auto_ff_round_14 && currentRound >= 15 && currentRound <= 24;
                    if (!blockedByR5 && !blockedByR14) {
                      shouldFf = true;
                    }
                  }

                  if (shouldFf) {
                    addLog(`[VOTING] Round ${currentRound} started. Auto-initiating surrender in 4 seconds...`);
                    setTimeout(() => {
                      if (!runningRef.current || !configRef.current.auto_ff_enabled) return;
                      isSendingChatRef.current = true;
                      invoke("trigger_chat_send", { channel: 0, text: "/ff" });
                      addLog(`[VOTING] Sent "/ff" in Team Chat for Round ${currentRound}.`);
                      setTimeout(() => {
                        isSendingChatRef.current = false;
                      }, 1500);
                    }, 4000);
                  }
                }

                // 2. Auto Vote (F5/F6 for Surrender and Overtime) 10 seconds after round starts
                const isOvertime = res.score_ally >= 12 && res.score_enemy >= 12;
                if (isOvertime) {
                  if (configRef.current.auto_overtime_vote_mode !== 0) {
                    setTimeout(() => {
                      if (!runningRef.current) return;
                      if (configRef.current.auto_overtime_vote_mode === 1) {
                        invoke("trigger_vote", { voteYes: true });
                        addLog(`[VOTING] Overtime Round: Auto-voted DRAW (F5) [10s mark].`);
                      } else if (configRef.current.auto_overtime_vote_mode === 2) {
                        invoke("trigger_vote", { voteYes: false });
                        addLog(`[VOTING] Overtime Round: Auto-voted CONTINUE (F6) [10s mark].`);
                      }
                    }, 10000);
                  }
                } else {
                  if (configRef.current.auto_vote_mode !== 0) {
                    setTimeout(() => {
                      if (!runningRef.current) return;
                      if (configRef.current.auto_vote_mode === 1) {
                        invoke("trigger_vote", { voteYes: true });
                        addLog(`[VOTING] Round ${currentRound}: Auto-voted YES (F5) [10s mark].`);
                      } else if (configRef.current.auto_vote_mode === 2) {
                        invoke("trigger_vote", { voteYes: false });
                        addLog(`[VOTING] Round ${currentRound}: Auto-voted NO (F6) [10s mark].`);
                      }
                    }, 10000);
                  }
                }
              }
            } else {
              lastScoreSumRef.current = -1;
            }
          } else {
            // VALORANT is either not running or still on loading screen
            if (res.game_live) {
              setGateGameFound(null); // loading screen
            } else {
              setGateGameFound(false); // not running
            }

            // As soon as VALORANT is not detected/found or closed, return immediately to the gate screen
            if (gatePassed && !isTransitioningRef.current) {
              isTransitioningRef.current = true;
              setGatePassed(false);
              setGateGameFound(false);
              invoke("resize_to_gate").catch(() => { });
              setTimeout(() => {
                isTransitioningRef.current = false;
              }, 400);
            }

            if (runningRef.current) {
              stopSagebot("VALORANT concluded.");
            }
          }
        })
        .catch(() => {
          setGateGameFound(false);
          if (gatePassed && !isTransitioningRef.current) {
            isTransitioningRef.current = true;
            setGatePassed(false);
            setGateGameFound(false);
            invoke("resize_to_gate").catch(() => { });
            setTimeout(() => {
              isTransitioningRef.current = false;
            }, 400);
          }
        });
    };
    pollStatus();
    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [gatePassed]);

  // Poll Global Hotkey (F9 / bound hotkey)
  useEffect(() => {
    let wasDown = false;
    const hotkeyInterval = setInterval(async () => {
      if (isRebindingMain || isRebindingAfk) return;
      try {
        const isDown = await invoke<boolean>("check_hotkey_pressed", {
          key: configRef.current.hotkey,
        });
        if (isDown && !wasDown) {
          if (runningRef.current) {
            stopSagebot();
          } else {
            startSagebot();
          }
        }
        wasDown = isDown;
      } catch (_) { }
    }, 80);

    return () => clearInterval(hotkeyInterval);
  }, [isRebindingMain, isRebindingAfk]);

  // Keyboard capture for rebinding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRebindingMain && !isRebindingAfk) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setIsRebindingMain(false);
        setIsRebindingAfk(false);
        return;
      }

      let keyName = e.key.toUpperCase();
      if (e.code.startsWith("F") && !isNaN(Number(e.code.substring(1)))) {
        keyName = e.code;
      } else if (e.code === "Tab") {
        keyName = "Tab";
      } else if (e.code === "Space") {
        keyName = "Space";
      } else if (e.code === "Enter") {
        keyName = "Enter";
      } else if (e.key.length === 1) {
        keyName = e.key.toUpperCase();
      }

      if (isRebindingMain) {
        if (keyName === "F5" || keyName === "F6") {
          addLog(
            "[SYSTEM] F5 and F6 are reserved for Auto-Vote and cannot be Play/Pause."
          );
          setIsRebindingMain(false);
          return;
        }
        const updated = { ...configRef.current, hotkey: keyName };
        setConfig(updated);
        invoke("save_config", { newConfig: updated });
        addLog(`[CONFIG] Start/Stop hotkey set to: ${keyName}`);
        setIsRebindingMain(false);
      } else if (isRebindingAfk) {
        if (keyName === configRef.current.hotkey) {
          addLog(
            "[CONFIG] Key conflicts with Start/Stop hotkey. Choose another key."
          );
          setIsRebindingAfk(false);
          return;
        }
        const updated = { ...configRef.current, anti_afk_key: keyName };
        setConfig(updated);
        invoke("save_config", { newConfig: updated });
        addLog(`[CONFIG] Anti-AFK clicking key set to: ${keyName}`);
        setIsRebindingAfk(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRebindingMain, isRebindingAfk]);

  // Save config helper
  const updateAndSaveConfig = (partial: Partial<AppConfig>) => {
    const updated = { ...config, ...partial };
    // Track previous values before auto_derank was activated
    if (!updated.auto_derank_enabled) {
      if (partial.auto_queue_enabled !== undefined || partial.starter_fallback_enabled !== undefined) {
        preAutoDerankStateRef.current = {
          auto_queue_enabled: updated.auto_queue_enabled,
          starter_fallback_enabled: updated.starter_fallback_enabled,
        };
      }
    }
    setConfig(updated);
    invoke("save_config", { newConfig: updated }).catch((err) =>
      console.error("Failed to save config:", err)
    );
  };

  // Start / Stop SageBot Logic
  const startSagebot = () => {
    if (isRunning) return;
    setLogs(["Logs cleared.", "SageBot started."]);
    setIsRunning(true);

    if (configRef.current.auto_focus_game) {
      invoke("focus_valorant_window").catch(() => { });
    }

    if (configRef.current.auto_derank_enabled && configRef.current.anti_afk_mode === 2) {
      showToast("You must choose an Anti-AFK Method!");
    }

    const key = configRef.current.anti_afk_key || "Tab";
    if (configRef.current.anti_afk_mode === 1) {
      // Hold Mode
      addLog(`Hold Mode: Holding down key ${key}`);
      invoke("trigger_key_down", { key });
    }
  };

  const stopSagebot = (reason?: string) => {
    if (!runningRef.current) return;
    setIsRunning(false);
    const key = configRef.current.anti_afk_key || "Tab";
    if (configRef.current.anti_afk_mode === 1) {
      invoke("trigger_key_up", { key });
    }
    addLog(reason ? `[SYSTEM] Stopped: ${reason}` : "Stopped SageBot");
  };

  // Active anti-AFK spammer loop
  useEffect(() => {
    if (!isRunning) return;

    let count = 0;
    let lastChatTime = 0;
    const isHoldMode = config.anti_afk_mode === 1;
    const isSlow = config.anti_afk_slow_mode;
    const key = config.anti_afk_key || "Tab";

    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!runningRef.current) return;

      const now = Date.now();

      // Click Mode Action (Only if mode is 0)
      if (config.anti_afk_mode === 0) {
        invoke("trigger_key_press", { key });
        addLog(`${key} #${count++}`);
      }

      // Auto-Chat Action (avoids colliding with /ff surrender initiate)
      if (config.chat_enabled && config.chat_text.trim() && !isSendingChatRef.current) {
        const intervalMs = Math.max(config.chat_interval, 0) * 1000;
        if (lastChatTime === 0 || now - lastChatTime >= intervalMs) {
          lastChatTime = now;
          if (isHoldMode) {
            invoke("trigger_key_up", { key });
          }
          invoke("trigger_chat_send", {
            channel: config.chat_target,
            text: config.chat_text,
          });
          addLog(`[CHAT] CHAT_MESSAGE`);
          if (isHoldMode) {
            setTimeout(() => {
              if (runningRef.current) {
                invoke("trigger_key_down", { key });
              }
            }, 100);
          }
        }
      }

      // Schedule next tick
      let nextDelay: number;
      if (isHoldMode) {
        nextDelay = 250;
      } else {
        if (isSlow) {
          nextDelay = 3700 + Math.floor(Math.random() * 500); // 3.7s - 4.2s
        } else {
          nextDelay = 900 + Math.floor(Math.random() * 400); // 900ms - 1300ms
        }
      }

      timer = setTimeout(tick, nextDelay);
    };

    const initialDelay = isHoldMode ? 250 : isSlow ? 3800 : 1000;
    timer = setTimeout(tick, initialDelay);

    return () => {
      clearTimeout(timer);
      if (isHoldMode) {
        invoke("trigger_key_up", { key });
      }
    };
  }, [
    isRunning,
    config.anti_afk_mode,
    config.anti_afk_key,
    config.anti_afk_slow_mode,
    config.auto_vote_mode,
    config.auto_overtime_vote_mode,
    config.chat_enabled,
    config.chat_target,
    config.chat_interval,
    config.chat_text,
    status.score_ally,
    status.score_enemy,
  ]);

  // Audio Sync
  const togglePlayMusic = () => {
    if (!audioRef.current) return;
    if (isPlayingMusic) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
    } else {
      audioRef.current.play().catch(() => { });
      setIsPlayingMusic(true);
    }
  };

  const handleSeekMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMusicCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value, 10);
    updateAndSaveConfig({ music_volume: vol });
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Agent Selection Helper
  const toggleAgent = (agentId: string) => {
    const cur = [...config.selected_agents];
    const idx = cur.indexOf(agentId);
    let updated: string[];
    if (idx >= 0) {
      updated = cur.filter((id) => id !== agentId);
    } else {
      updated = [...cur, agentId];
    }
    updateAndSaveConfig({ selected_agents: updated });
  };

  const clearAgents = () => {
    updateAndSaveConfig({ selected_agents: [] });
  };

  const commitLockDelay = () => {
    if (config.instalock_enabled) return;
    const trimmed = lockDelayInput.trim();
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 10 || val > 70) {
      setErrorModal({
        title: "Invalid Lock Delay",
        message: "Lock Delay must be between 10 and 70 seconds.",
        submessage: "The delay has been reset to the default of 10 seconds.",
      });
      setLockDelayInput("10");
      updateAndSaveConfig({ lock_delay: 10 });
    } else {
      setLockDelayInput(String(val));
      updateAndSaveConfig({ lock_delay: val });
    }
  };

  const commitChatInterval = () => {
    const trimmed = chatIntervalInput.trim();
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 0 || val > 3600) {
      setErrorModal({
        title: "Invalid Chat Interval",
        message: "Chat Interval must be between 0 and 3600 seconds.",
        submessage: "The interval has been reset to the default of 180 seconds.",
      });
      setChatIntervalInput("180");
      updateAndSaveConfig({ chat_interval: 180 });
    } else {
      setChatIntervalInput(String(val));
      updateAndSaveConfig({ chat_interval: val });
    }
  };

  // Color mappings matching sagebot_gui.c
  const getRankColor = (rank: string) => {
    if (!rank || rank === "-") return "#8b949e";
    if (rank.includes("Radiant")) return "#fff092";
    if (rank.includes("Immortal")) return "#de2762";
    if (rank.includes("Ascendant")) return "#22b584";
    if (rank.includes("Diamond")) return "#a85ce8";
    if (rank.includes("Platinum")) return "#48b1c8";
    if (rank.includes("Gold")) return "#f0b232";
    if (rank.includes("Silver")) return "#dfe4ea";
    if (rank.includes("Bronze")) return "#b87b4c";
    if (rank.includes("Iron")) return "#78828a";
    return "#8b949e";
  };

  const getMapColor = (map: string) => {
    if (!map || map === "-") return "#8b949e";
    if (map.includes("Ascent")) return "#e06d28";
    if (map.includes("Bind")) return "#e09f5a";
    if (map.includes("Haven")) return "#e55934";
    if (map.includes("Split")) return "#9d65d8";
    if (map.includes("Icebox")) return "#7ad1e8";
    if (map.includes("Breeze")) return "#2dd4bf";
    if (map.includes("Fracture")) return "#48bb78";
    if (map.includes("Pearl")) return "#2b78d4";
    if (map.includes("Lotus")) return "#ec4899";
    if (map.includes("Sunset")) return "#f472b6";
    if (map.includes("Abyss")) return "#3b5998";
    return "#34d399";
  };

  const getGamemodeColor = (gm: string) => {
    if (!gm || gm === "-") return "#8b949e";
    if (gm.startsWith("Custom")) return "#a855f7";
    if (gm.includes("Competitive")) return "#ff4655";
    if (gm.includes("Unrated")) return "#06b6d4";
    if (gm.includes("Swiftplay")) return "#3b82f6";
    if (gm.includes("Spike Rush")) return "#f97316";
    if (gm.includes("Deathmatch")) return "#ef4444";
    if (gm.includes("Premier")) return "#d4af37";
    if (gm.includes("Custom")) return "#a855f7";
    return "#60a5fa";
  };

  const getPhaseColor = (ph: string) => {
    if (!ph || ph === "-") return "#8b949e";
    if (ph.includes("Queue")) return "#f59e0b";
    if (ph.includes("Agent Select") || ph.includes("Pregame")) return "#8b5cf6";
    if (ph.includes("In Game") || ph.includes("Ingame")) return "#3b82f6";
    if (ph.includes("Lobby")) return "#8b949e";
    return "#f472b6";
  };

  const getAgentColor = (name: string) => {
    if (!name || name === "-") return "#8b949e";
    const lower = name.toLowerCase();
    if (lower.includes("brimstone")) return "#e36528";
    if (lower.includes("viper")) return "#2be66e";
    if (lower.includes("omen")) return "#1e50d8";
    if (lower.includes("astra")) return "#a34bd8";
    if (lower.includes("harbor")) return "#11a5b8";
    if (lower.includes("clove")) return "#ff7ab8";
    if (lower.includes("jett")) return "#ffffff";
    if (lower.includes("phoenix")) return "#ff4b2b";
    if (lower.includes("reyna")) return "#8a1c9e";
    if (lower.includes("raze")) return "#ff7c2a";
    if (lower.includes("yoru")) return "#285aeb";
    if (lower.includes("neon")) return "#00f0ff";
    if (lower.includes("iso")) return "#7650ec";
    if (lower.includes("sova")) return "#3598db";
    if (lower.includes("breach")) return "#b85526";
    if (lower.includes("skye")) return "#3bb75e";
    if (lower.includes("kay/o") || lower.includes("kayo")) return "#00d2d3";
    if (lower.includes("fade")) return "#6e69a0";
    if (lower.includes("gekko")) return "#c6f82a";
    if (lower.includes("sage")) return "#2fe5a8";
    if (lower.includes("killjoy")) return "#ffde00";
    if (lower.includes("cypher")) return "#cfd6e0";
    if (lower.includes("chamber")) return "#d1a545";
    if (lower.includes("deadlock")) return "#7698b3";
    if (lower.includes("vyse")) return "#9e74a2";
    return "#a78bfa";
  };

  // Formatting Round string: Round X (score_ally - score_enemy)
  const currentRoundNum = status.score_ally + status.score_enemy + 1;
  const isMatchInGame =
    status.match_state.toUpperCase().includes("INGAME") ||
    status.match_state.toUpperCase().includes("IN GAME") ||
    status.match_state.toUpperCase().includes("GAME");

  const roundDisplay = isMatchInGame
    ? `Round ${currentRoundNum} (${status.score_ally} - ${status.score_enemy})`
    : status.match_state && status.match_state !== "OFFLINE"
      ? status.match_state
      : "-";

  return (
    <div className="app-window">
      {/* Hidden Audio Player */}
      <audio
        ref={audioRef}
        src="/music.mp3"
        loop
        onTimeUpdate={() => {
          if (audioRef.current) {
            setMusicCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setMusicDuration(audioRef.current.duration);
            audioRef.current.volume = (config.music_volume || 80) / 100;
          }
        }}
      />

      {/* Intro Gate Screen (Active when VALORANT is not yet verified or while crossfading out) */}
      {(!gatePassed || isCrossfading) && (
        <div className={`gate-overlay ${isCrossfading ? "gate-crossfade-out" : ""}`}>
          <div
            className="titlebar gate-titlebar"
            data-tauri-drag-region
            onMouseDown={(e) => {
              if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
                invoke("start_dragging_window").catch(() => { });
              }
            }}
          >
            <div className="titlebar-left">
              <img src="/sage.ico" className="app-logo-icon" alt="SageBot" />
              <span className="app-title">SageBot</span>
              <span className="version-pill">3.0</span>
            </div>
            <div className="titlebar-right">
              <button
                className="win-btn"
                onClick={() => invoke("minimize_window")}
                title="Minimize"
              >
                <Minus size={13} />
              </button>
              <button
                className="win-btn close"
                onClick={() => invoke("close_window")}
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="gate-body">
            <div className="gate-card">
              <div className="gate-avatar-wrapper">
                <div className="gate-avatar-glow" />
                <img src="/sage.ico" className="gate-avatar-img" alt="SageBot" />
              </div>

              <h1 className="gate-title">SageBot</h1>
              <p className="gate-subtitle">VALORANT External & Utilities • v3.0</p>

              <div className="gate-status-card">
                {gateGameFound === null && (
                  <div className="gate-status-loading">
                    <RefreshCw size={18} className="spin" color="#f59e0b" />
                    <span>
                      {status.game_live
                        ? "Detected VALORANT. Waiting for lobby..."
                        : "Checking for VALORANT..."}
                    </span>
                  </div>
                )}

                {gateGameFound === false && (
                  <div className="gate-status-fail">
                    <div className="gate-status-badge red">
                      <AlertTriangle size={16} />
                      <span>VALORANT NOT FOUND</span>
                    </div>
                    <p className="gate-status-msg">
                      Please start VALORANT before proceeding to the app.
                    </p>
                  </div>
                )}

                {gateGameFound === true && (
                  <div className="gate-status-ready">
                    <CheckCircle2 size={18} color="#ffffff" />
                    <span>VALORANT is Ready</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard App Container */}
      <div className={`main-app-container ${gatePassed || isCrossfading ? "visible" : ""}`}>
        {/* Titlebar Window Frame */}
        <div
          className="titlebar"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
              invoke("start_dragging_window").catch(() => { });
            }
          }}
        >
          <div className="titlebar-left">
            <img src="/sage.ico" className="app-logo-icon" alt="SageBot" />
            <span className="app-title">SageBot</span>
            <span className="version-pill">3.0</span>
          </div>
          <div className="titlebar-right">
            <button
              className="win-btn"
              onClick={() => invoke("minimize_window")}
              title="Minimize"
            >
              <Minus size={13} />
            </button>
            <button
              className="win-btn close"
              onClick={() => invoke("close_window")}
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Main Body with Sidebar + Tab Content */}
        <div className="main-content">
          {/* Navigation Sidebar (8 core tabs; Settings & Changelog housed in footer) */}
          <div className="nav-sidebar">
            <button
              className={`nav-btn ${activeTab === "main" ? "active" : ""}`}
              onClick={() => setActiveTab("main")}
            >
              ▶&nbsp;&nbsp;Main
            </button>
            <button
              className={`nav-btn ${activeTab === "status" ? "active" : ""}`}
              onClick={() => setActiveTab("status")}
            >
              📊&nbsp;&nbsp;Status
            </button>
            <button
              className={`nav-btn ${activeTab === "config" ? "active" : ""}`}
              onClick={() => setActiveTab("config")}
            >
              🛠️&nbsp;&nbsp;Config
            </button>
            <button
              className={`nav-btn ${activeTab === "agents" ? "active" : ""}`}
              onClick={() => setActiveTab("agents")}
            >
              👥&nbsp;&nbsp;Agents
            </button>
            <button
              className={`nav-btn ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              💬&nbsp;&nbsp;Chat
            </button>
            <button
              className={`nav-btn ${activeTab === "autovote" ? "active" : ""}`}
              onClick={() => setActiveTab("autovote")}
            >
              🗳️&nbsp;&nbsp;Voting
            </button>
            <button
              className={`nav-btn ${activeTab === "music" ? "active" : ""}`}
              onClick={() => setActiveTab("music")}
            >
              🎵&nbsp;&nbsp;Music
            </button>
            <button
              className={`nav-btn ${activeTab === "webhook" ? "active" : ""}`}
              onClick={() => setActiveTab("webhook")}
            >
              🔔&nbsp;&nbsp;Webhook
            </button>
          </div>

          {/* Viewport Content Panel */}
          <div className="tab-viewport">
            {/* TAB 0: MAIN */}
            {activeTab === "main" && (
              <div className="tab-pane">
                <div className="card status-header-card">
                  <div className="status-row">
                    <span className="status-label">STATUS:</span>
                    <span
                      className={`status-value ${isRunning ? "val-running" : "val-stopped"
                        }`}
                    >
                      {isRunning ? "RUNNING" : "STOPPED"}
                    </span>
                  </div>
                  <div className="status-row" style={{ marginTop: "6px" }}>
                    <span className="status-label">HOTKEY:</span>
                    <span className="status-value val-hotkey">{config.hotkey}</span>
                  </div>
                </div>

                <button
                  className={`primary-action-btn ${isRunning ? "btn-stop" : "btn-start"
                    }`}
                  onClick={() => {
                    if (isRunning) stopSagebot();
                    else startSagebot();
                  }}
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
            )}

            {/* TAB 1: STATUS */}
            {activeTab === "status" && (
              <div className="tab-pane">
                <div className="card">
                  <div className="card-header">PLAYER PROFILE</div>
                  <div className="info-row">
                    <span className="info-title">Riot ID:</span>
                    <span className="info-val">
                      {status.player_name
                        ? `${status.player_name}#${status.player_tag}`
                        : "-"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-title">Rank:</span>
                    <span
                      className="info-val"
                      style={{ color: getRankColor(status.rank_name) }}
                    >
                      {status.rank_name || "-"}
                    </span>
                  </div>
                </div>

                <div className="card" style={{ marginTop: "12px" }}>
                  <div className="card-header">MATCH INFORMATION</div>
                  <div className="info-row">
                    <span className="info-title">Map:</span>
                    <span
                      className="info-val"
                      style={{ color: getMapColor(status.map_name) }}
                    >
                      {status.map_name || "-"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-title">Gamemode:</span>
                    <span
                      className="info-val"
                      style={{ color: getGamemodeColor(status.gamemode) }}
                    >
                      {status.gamemode || "-"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-title">Game Phase:</span>
                    <span
                      className="info-val"
                      style={{ color: getPhaseColor(status.match_state) }}
                    >
                      {status.match_state || "-"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-title">Agent:</span>
                    <span
                      className="info-val"
                      style={{ color: getAgentColor(status.current_agent) }}
                    >
                      {status.current_agent || "-"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-title">Round:</span>
                    <span className="info-val" style={{ color: "#a78bfa" }}>
                      {roundDisplay}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CONFIG */}
            {activeTab === "config" && (
              <div className="tab-pane">
                {/* 0. Auto Derank */}
                <div className="card" style={{ marginBottom: "12px" }}>
                  <div className="control-row">
                    <div>
                      <div className="control-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        Auto Derank (BETA)
                        {config.auto_derank_enabled && (
                          <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "1px 7px", borderRadius: "10px", fontWeight: 700 }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="pane-subtitle">
                        Automatically queues Competitive, locks agents, AFKs whole game, surrenders, and re-queues.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.auto_derank_enabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (config.anti_afk_mode === 2) {
                              showToast("Cannot enable Auto Derank: Anti-AFK Method is set to None!");
                              addLog("[CONFIG] Cannot enable Auto Derank: Anti-AFK Method is set to None.");
                              return;
                            }
                            setShowAutoDerankModal1(true);
                          } else {
                            const prev = preAutoDerankStateRef.current;
                            updateAndSaveConfig({
                              auto_derank_enabled: false,
                              auto_queue_enabled: prev.auto_queue_enabled,
                              starter_fallback_enabled: prev.starter_fallback_enabled,
                            });
                            addLog("[CONFIG] Auto Derank mode disabled. Reverted Auto Queue and Starter Fallback.");
                          }
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                {/* 1. Anti-AFK Method */}
                <div className="card">
                  <div className="pane-title">Anti-AFK Method</div>
                  <div className="pane-subtitle">
                    Choose the automation technique for anti-AFK.
                  </div>

                  <div className="radio-group" style={{ marginTop: "10px" }}>
                    <div
                      className={`radio-card ${config.anti_afk_mode === 0 ? "active" : ""
                        }`}
                      onClick={() => {
                        updateAndSaveConfig({ anti_afk_mode: 0 });
                        addLog("[CONFIG] Anti-AFK Method set to Click Mode.");
                      }}
                    >
                      <div className="radio-dot">
                        {config.anti_afk_mode === 0 && <div className="dot-inner" />}
                      </div>
                      <span className="radio-label">Click Mode</span>
                      {config.anti_afk_mode === 0 && (
                        <span className="active-badge">● ACTIVE</span>
                      )}
                    </div>

                    <div
                      className={`radio-card ${config.anti_afk_mode === 1 ? "active" : ""
                        }`}
                      onClick={() => {
                        updateAndSaveConfig({ anti_afk_mode: 1 });
                        addLog("[CONFIG] Anti-AFK Method set to Hold Mode.");
                      }}
                    >
                      <div className="radio-dot">
                        {config.anti_afk_mode === 1 && <div className="dot-inner" />}
                      </div>
                      <span className="radio-label">Hold Mode</span>
                      {config.anti_afk_mode === 1 && (
                        <span className="active-badge">● ACTIVE</span>
                      )}
                    </div>

                    <div
                      className={`radio-card ${config.anti_afk_mode === 2 ? "active" : ""}`}
                      onClick={() => {
                        const wasAutoDerank = config.auto_derank_enabled;
                        const prev = preAutoDerankStateRef.current;
                        updateAndSaveConfig({
                          anti_afk_mode: 2,
                          auto_derank_enabled: false,
                          ...(wasAutoDerank ? {
                            auto_queue_enabled: prev.auto_queue_enabled,
                            starter_fallback_enabled: prev.starter_fallback_enabled,
                          } : {})
                        });
                        if (wasAutoDerank) {
                          showToast("Auto Derank disabled: Anti-AFK Method is set to None");
                          addLog("[CONFIG] Auto Derank automatically disabled because Anti-AFK Method is set to None. Reverted Auto Queue and Starter Fallback.");
                        }
                        addLog("[CONFIG] Anti-AFK Method set to None.");
                      }}
                    >
                      <div className="radio-dot">
                        {config.anti_afk_mode === 2 && <div className="dot-inner" />}
                      </div>
                      <span className="radio-label">None</span>
                      {config.anti_afk_mode === 2 && (
                        <span className="active-badge">● ACTIVE</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginTop: "12px" }}>
                  <div className="pane-title">
                    {config.anti_afk_mode === 1
                      ? "Hold Mode Settings"
                      : config.anti_afk_mode === 2
                        ? "Anti - AFK Disabled."
                        : "Click Mode Settings"}
                  </div>
                  <div className="pane-subtitle">
                    {config.anti_afk_mode === 1
                      ? "Continuously holds down the selected key."
                      : config.anti_afk_mode === 2
                        ? "No keystrokes or mouse clicks simulated. Chat, voting, and Auto Derank remain active."
                        : "Randomly clicks the selected key."}
                  </div>

                  {config.anti_afk_mode === 2 ? (
                    <div className="control-note" style={{ marginTop: "14px", color: "#94a3b8" }}>
                      Anti-AFK input is set to None. No keys will be clicked or held.
                    </div>
                  ) : (
                    <>
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <span>
                          {config.anti_afk_mode === 1 ? "Holding Key" : "Clicking Key"}
                        </span>
                        <button
                          className={`key-badge-btn ${isRebindingAfk ? "rebinding" : ""
                            }`}
                          onClick={() => setIsRebindingAfk(!isRebindingAfk)}
                        >
                          {isRebindingAfk ? "Press..." : config.anti_afk_key || "Tab"}
                        </button>
                      </div>

                      {config.anti_afk_mode === 0 ? (
                        <>
                          <div className="control-row" style={{ marginTop: "12px" }}>
                            <span>Interval</span>
                            <span className="delay-badge">
                              {config.anti_afk_slow_mode
                                ? "3.7 – 4.2 s"
                                : "900 – 1300 ms"}
                            </span>
                          </div>
                          <div className="control-note">
                            Interval between clicks is randomized.
                          </div>

                          <div className="control-row" style={{ marginTop: "14px" }}>
                            <span>Slow Mode</span>
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={config.anti_afk_slow_mode}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  updateAndSaveConfig({ anti_afk_slow_mode: val });
                                  if (val) {
                                    addLog(
                                      "[CONFIG] Slow Mode activated: interval changed to 3.7s - 4.2s"
                                    );
                                  } else {
                                    addLog(
                                      "[CONFIG] Slow Mode deactivated: interval returned to normal (900 – 1300 ms)."
                                    );
                                  }
                                }}
                              />
                              <span className="slider round"></span>
                            </label>
                          </div>
                          <div className="control-note">
                            When active, sets click interval to 3.7s – 4.2s.
                          </div>
                        </>
                      ) : (
                        <div className="control-note" style={{ marginTop: "12px" }}>
                          Tips: The W key makes you move forward!
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: AGENTS */}
            {activeTab === "agents" && (
              <div className="tab-pane" style={{ padding: "14px 18px" }}>
                <div className="agents-layout-container">
                  {/* Left: 4-Column Agent Selection Grid */}
                  <div className="card agents-grid-column">
                    <div className="between-row" style={{ marginBottom: "10px" }}>
                      <div>
                        <div className="card-header" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>AGENT SELECTION</span>
                          {!config.agents_enabled && (
                            <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                              LOCKING PAUSED
                            </span>
                          )}
                        </div>
                        <div className="pane-subtitle">
                          {config.agents_enabled
                            ? `Click agents to queue in order of priority (${agents.length} available)`
                            : "Agent Locking is paused."}
                        </div>
                      </div>
                      <button className="clear-btn" onClick={clearAgents} title="Clear queue selection">
                        ✕ Clear
                      </button>
                    </div>

                    <div className="agents-grid-4col">
                      {agents.map((ag) => {
                        const prioIdx = config.selected_agents.indexOf(ag.id);
                        const isSelected = prioIdx >= 0;
                        const queueNum = isSelected ? String(prioIdx + 1).padStart(2, "0") : null;
                        const cleanName = ag.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                        const localImg = `/agents/${cleanName}.png`;

                        return (
                          <div
                            key={ag.id}
                            className={`agent-card ${isSelected ? "selected" : ""} ${!config.agents_enabled && !isSelected ? "disabled-agent-greyed" : ""}`}
                            onClick={() => toggleAgent(ag.id)}
                            title={`${ag.name} (${ag.role})${isSelected ? ` - Priority #${prioIdx + 1}` : ""}`}
                          >
                            <div className="agent-card-aspect">
                              <img
                                src={localImg}
                                alt={ag.name}
                                className="agent-card-img"
                                onError={(e) => {
                                  // Fallback to valorant-api CDN if local file is missing
                                  (e.currentTarget as HTMLImageElement).src = `https://media.valorant-api.com/agents/${ag.id}/displayicon.png`;
                                }}
                              />
                              <div className="agent-card-overlay">
                                <span className="agent-card-name">{ag.name}</span>
                              </div>
                              {isSelected && (
                                <div className="agent-queue-badge">
                                  {queueNum}
                                </div>
                              )}
                              {ag.is_starter && (
                                <div className="agent-starter-dot" title="Starter Agent" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Settings & Priority List */}
                  <div className="agents-settings-column">
                    {/* Queue Order Card */}
                    <div className="card agents-queue-card">
                      <div className="between-row">
                        <div className="card-header">QUEUE PRIORITY</div>
                        <span className="version-pill">
                          {config.selected_agents.length} queued
                        </span>
                      </div>
                      <div className="pane-subtitle" style={{ marginBottom: "4px" }}>
                        Auto-locks top available agent
                      </div>

                      <div className="queue-list-box">
                        {config.selected_agents.length === 0 ? (
                          <div className="empty-queue-msg">
                            <span>No agents queued</span>
                            <span className="empty-queue-sub">
                              Click any agent on the left to set locking priority
                            </span>
                          </div>
                        ) : (
                          <div className="queue-items-list">
                            {config.selected_agents.map((agId, idx) => {
                              const ag = agents.find((a) => a.id === agId);
                              const cleanName = ag?.name ? ag.name.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
                              const localImg = `/agents/${cleanName}.png`;
                              return (
                                <div key={agId} className="queue-item-row">
                                  <span className="queue-item-num">
                                    {String(idx + 1).padStart(2, "0")}
                                  </span>
                                  {cleanName && (
                                    <img
                                      src={localImg}
                                      alt={ag?.name}
                                      className="queue-item-img"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = `https://media.valorant-api.com/agents/${agId}/displayicon.png`;
                                      }}
                                    />
                                  )}
                                  <span
                                    className="queue-item-name"
                                    style={{ color: ag?.color || "#ffffff" }}
                                  >
                                    {ag?.name || agId}
                                  </span>
                                  {ag?.is_starter && (
                                    <span className="queue-starter-tag">STARTER</span>
                                  )}
                                  <button
                                    className="queue-remove-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAgent(agId);
                                    }}
                                    title="Remove from queue"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Settings Card */}
                    <div className="card">
                      <div className="card-header">SETTINGS</div>

                      {/* 1. Enable Master Toggle */}
                      <div className="control-row" style={{ marginTop: "10px" }}>
                        <div>
                          <div className="control-title">Enable</div>
                          <div className="pane-subtitle">
                            Enable agent selection and locking.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.agents_enabled ?? true}
                            onChange={(e) =>
                              updateAndSaveConfig({
                                agents_enabled: e.target.checked,
                              })
                            }
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {/* 2. Lock Delay (10 to 70 seconds, or frozen at 0s with Cyan border if Instalock is ON) */}
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title">Lock Delay</div>
                          <div className="pane-subtitle">
                            {config.instalock_enabled
                              ? "Instalock is active (locked to 0s)."
                              : "(10 – 70 seconds)."}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="text"
                            disabled={config.instalock_enabled}
                            value={config.instalock_enabled ? "0" : lockDelayInput}
                            onChange={(e) => {
                              if (config.instalock_enabled) return;
                              const clean = e.target.value.replace(/[^0-9]/g, "");
                              setLockDelayInput(clean);
                            }}
                            onBlur={commitLockDelay}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                commitLockDelay();
                                (e.target as HTMLElement).blur();
                              }
                            }}
                            style={
                              config.instalock_enabled
                                ? {
                                  width: "56px",
                                  padding: "4px 8px",
                                  background: "rgba(0, 242, 255, 0.12)",
                                  border: "2px solid #00f2ff",
                                  borderRadius: "6px",
                                  color: "#00f2ff",
                                  textAlign: "center",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  boxShadow:
                                    "0 0 14px rgba(0, 242, 255, 0.65), inset 0 0 6px rgba(0, 242, 255, 0.3)",
                                  cursor: "not-allowed",
                                }
                                : {
                                  width: "56px",
                                  padding: "4px 8px",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.2)",
                                  borderRadius: "6px",
                                  color: "#fff",
                                  textAlign: "center",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                }
                            }
                          />
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: config.instalock_enabled ? 700 : 400,
                              color: config.instalock_enabled
                                ? "#00f2ff"
                                : "rgba(255, 255, 255, 0.6)",
                            }}
                          >
                            sec
                          </span>
                        </div>
                      </div>

                      {/* 3. Instalock Toggle */}
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title">Instalock</div>
                          <div className="pane-subtitle">
                            Instantly locks selected Agent(s).
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.instalock_enabled}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setShowInstalockModal(true);
                              } else {
                                const restored =
                                  config.lock_delay >= 10 && config.lock_delay <= 70
                                    ? config.lock_delay
                                    : 10;
                                updateAndSaveConfig({
                                  instalock_enabled: false,
                                  lock_delay: restored,
                                });
                                setLockDelayInput(String(restored));
                              }
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {/* 4. Starter Fallback Toggle */}
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            Starter Fallback
                            {config.auto_derank_enabled && (
                              <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "1px 7px", borderRadius: "10px", fontWeight: 700 }}>
                                LOCKED BY AUTO DERANK
                              </span>
                            )}
                          </div>
                          <div className="pane-subtitle">
                            Automatically locks Starter Agents.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.starter_fallback_enabled || config.auto_derank_enabled}
                            disabled={config.auto_derank_enabled}
                            onChange={(e) => {
                              if (config.auto_derank_enabled) {
                                showToast("Starter Fallback cannot be disabled while Auto Derank is active.");
                                return;
                              }
                              updateAndSaveConfig({
                                starter_fallback_enabled: e.target.checked,
                              });
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CHAT */}
            {activeTab === "chat" && (
              <div className="tab-pane">
                <div className="card">
                  <div className="pane-title">Auto Chat</div>
                  <div className="pane-subtitle">
                    Send a message through in-game chat.
                  </div>

                  <div className="control-row" style={{ marginTop: "12px" }}>
                    <div>
                      <div className="control-title">Enable Chat</div>
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
                            addLog("[CHAT] Chat automation deactivated.");
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
                          addLog("[CHAT] Target set to Team chat.");
                        }}
                      >
                        Team Chat
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${config.chat_target === 1 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ chat_target: 1 });
                          addLog("[CHAT] Target set to All chat.");
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
                    onChange={(e) =>
                      updateAndSaveConfig({ chat_text: e.target.value })
                    }
                  />

                  <div className="preset-buttons-row">
                    <button
                      className="preset-btn"
                      onClick={() =>
                        updateAndSaveConfig({
                          chat_text:
                            "SageBot so broke :weary:",
                        })
                      }
                    >
                      SageBot so broke 😩
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
            )}

            {/* TAB 5: VOTING */}
            {activeTab === "autovote" && (
              <div className="tab-pane">
                {/* 1. Auto Surrender */}
                <div className="card">
                  <div className="pane-title">Auto Surrender</div>
                  <div className="pane-subtitle">
                    Automatically casts surrender vote (F5/F6) 10 seconds after round start.
                  </div>

                  <div className="control-row" style={{ marginTop: "14px" }}>
                    <div>
                      <div className="control-title">Surrender Vote</div>
                      <div className="pane-subtitle">Vote response key.</div>
                    </div>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segmented-btn ${config.auto_vote_mode === 0 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ auto_vote_mode: 0 });
                          addLog("[SETTINGS] Auto-Vote disabled.");
                        }}
                      >
                        Disabled
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn vote-yes ${config.auto_vote_mode === 1 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ auto_vote_mode: 1 });
                          addLog("[SETTINGS] Auto-Vote set to YES (F5).");
                        }}
                      >
                        Vote YES (F5)
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn vote-no ${config.auto_vote_mode === 2 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ auto_vote_mode: 2 });
                          addLog("[SETTINGS] Auto-Vote set to NO (F6).");
                        }}
                      >
                        Vote NO (F6)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Auto Overtime Voting */}
                <div className="card" style={{ marginTop: "12px" }}>
                  <div className="pane-title">Auto Overtime Voting</div>
                  <div className="pane-subtitle">
                    Automatically casts overtime vote (DRAW/CONTINUE) 10 seconds after overtime round start.
                  </div>

                  <div className="control-row" style={{ marginTop: "14px" }}>
                    <div>
                      <div className="control-title">Overtime Vote</div>
                      <div className="pane-subtitle">Overtime response key.</div>
                    </div>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segmented-btn ${config.auto_overtime_vote_mode === 0 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ auto_overtime_vote_mode: 0 });
                          addLog("[SETTINGS] Overtime Vote disabled.");
                        }}
                      >
                        Disabled
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn vote-draw ${config.auto_overtime_vote_mode === 1 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ auto_overtime_vote_mode: 1 });
                          addLog("[SETTINGS] Overtime Vote set to DRAW (F5).");
                        }}
                      >
                        Vote DRAW (F5)
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn vote-continue ${config.auto_overtime_vote_mode === 2 ? "active" : ""}`}
                        onClick={() => {
                          updateAndSaveConfig({ auto_overtime_vote_mode: 2 });
                          addLog("[SETTINGS] Overtime Vote set to CONTINUE (F6).");
                        }}
                      >
                        Vote CONTINUE (F6)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Auto Initiate Surrender */}
                <div className="card" style={{ marginTop: "12px" }}>
                  <div className="between-row">
                    <div>
                      <div className="pane-title">Auto Initiate Surrender</div>
                      <div className="pane-subtitle">
                        Attempts to send "/ff" in team chat at designated rounds.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.auto_ff_enabled}
                        onChange={(e) => {
                          updateAndSaveConfig({ auto_ff_enabled: e.target.checked });
                          addLog(
                            e.target.checked
                              ? "[VOTING] Auto Initiate Surrender enabled."
                              : "[VOTING] Auto Initiate Surrender disabled."
                          );
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  {/* Subsettings: Rounds */}
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
                      {/* Round 5 Toggle */}
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

                      {/* Round 13 Toggle */}
                      <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={config.auto_ff_round_13}
                          onChange={(e) => {
                            updateAndSaveConfig({ auto_ff_round_13: e.target.checked });
                          }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>Round 13 (Begin Second Half)</span>
                      </label>

                      {/* Round 14 Toggle */}
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

                    {/* Custom Rounds */}
                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "14px" }}>
                      <div className="pane-subtitle" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px" }}>
                        Custom Rounds:
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {/* First Half Group */}
                        {(() => {
                          const selFirstHalf = (config.auto_ff_custom_rounds || []).find((r) => r >= 6 && r <= 12);
                          const isLocked = config.auto_ff_round_5;
                          return (
                            <div className={`custom-round-group ${isLocked ? "group-locked" : ""}`}>
                              <div className="custom-round-group-header">
                                <span className="custom-round-group-title">First Half (R6 – R12)</span>
                                {isLocked && (
                                  <span className="custom-round-group-badge">Locked by Round 5</span>
                                )}
                              </div>
                              <div className="custom-round-pills-row">
                                {[6, 7, 8, 9, 10, 11, 12].map((r) => {
                                  const isBlocked = isLocked || (selFirstHalf !== undefined && selFirstHalf !== r);
                                  const isSelected = !isLocked && selFirstHalf === r;

                                  return (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => {
                                        if (isBlocked) {
                                          showToast("You can only surrender once per half");
                                          return;
                                        }
                                        const cur = config.auto_ff_custom_rounds || [];
                                        if (isSelected) {
                                          updateAndSaveConfig({
                                            auto_ff_custom_rounds: cur.filter((x) => x !== r),
                                          });
                                        } else {
                                          const filtered = cur.filter((x) => x < 6 || x > 12);
                                          updateAndSaveConfig({
                                            auto_ff_custom_rounds: [...filtered, r].sort((a, b) => a - b),
                                          });
                                        }
                                      }}
                                      className={`round-pill-btn ${isSelected ? "active" : ""} ${isBlocked ? "blocked" : ""}`}
                                      title={
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
                        })()}

                        {/* Second Half Group */}
                        {(() => {
                          const selSecondHalf = (config.auto_ff_custom_rounds || []).find((r) => r >= 15 && r <= 24);
                          const isLocked = config.auto_ff_round_14;
                          return (
                            <div className={`custom-round-group ${isLocked ? "group-locked" : ""}`}>
                              <div className="custom-round-group-header">
                                <span className="custom-round-group-title">Second Half (R15 – R24)</span>
                                {isLocked && (
                                  <span className="custom-round-group-badge">Locked by Round 14</span>
                                )}
                              </div>
                              <div className="custom-round-pills-row">
                                {[15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((r) => {
                                  const isBlocked = isLocked || (selSecondHalf !== undefined && selSecondHalf !== r);
                                  const isSelected = !isLocked && selSecondHalf === r;

                                  return (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => {
                                        if (isBlocked) {
                                          showToast("You can only surrender once per half");
                                          return;
                                        }
                                        const cur = config.auto_ff_custom_rounds || [];
                                        if (isSelected) {
                                          updateAndSaveConfig({
                                            auto_ff_custom_rounds: cur.filter((x) => x !== r),
                                          });
                                        } else {
                                          const filtered = cur.filter((x) => x < 15 || x > 24);
                                          updateAndSaveConfig({
                                            auto_ff_custom_rounds: [...filtered, r].sort((a, b) => a - b),
                                          });
                                        }
                                      }}
                                      className={`round-pill-btn ${isSelected ? "active" : ""} ${isBlocked ? "blocked" : ""}`}
                                      title={
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
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: MUSIC */}
            {activeTab === "music" && (
              <div className="tab-pane">
                <div className="card music-card">
                  <div className="music-title">
                    Stereo Madness x Lord Verity x Ice Ice Baby x Rap God x Time
                    of your Life x Eyes Without A Face x We Will Never Die x
                    Somebody's Watching Me x Shut Up and Dance x Beverly Hills x
                    Stayin' Alive x Dancing With Myself
                  </div>

                  <input
                    type="range"
                    className="music-slider"
                    min="0"
                    max={musicDuration || 180}
                    step="0.5"
                    value={musicCurrentTime}
                    onChange={handleSeekMusic}
                  />

                  <div className="music-timestamp">
                    {formatTime(musicCurrentTime)} / {formatTime(musicDuration)}
                  </div>

                  <div className="music-play-btn-wrapper">
                    <button className="music-play-btn" onClick={togglePlayMusic}>
                      {isPlayingMusic ? (
                        <div className="pause-bars">
                          <span></span>
                          <span></span>
                        </div>
                      ) : (
                        <Play size={20} fill="#8b5cf6" color="#8b5cf6" />
                      )}
                    </button>
                  </div>

                  <div className="volume-control-row">
                    <span className="volume-label">
                      Volume: {config.music_volume || 80}%
                    </span>
                    <input
                      type="range"
                      className="vol-slider"
                      min="0"
                      max="100"
                      value={config.music_volume || 80}
                      onChange={handleVolumeChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: WEBHOOK */}
            {activeTab === "webhook" && (
              <div className="tab-pane">
                <div className="card">
                  <div className="between-row">
                    <div className="pane-title">Discord Webhook</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>
                        Enable
                      </span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={config.webhook_enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            updateAndSaveConfig({ webhook_enabled: val });
                            showToast(val ? "Webhook Enabled" : "Webhook Disabled");
                          }}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>

                  <div className="pane-subtitle" style={{ marginTop: "4px" }}>
                    Get pinged on Discord when your match concludes.
                  </div>

                  <div style={{ marginTop: "14px" }}>
                    <div className="field-header">Channel URL</div>
                    <div className="pane-subtitle">
                      Discord Channel -&gt; Integrations -&gt; Webhooks
                    </div>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={config.webhook_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateAndSaveConfig({ webhook_url: val });
                      }}
                    />
                  </div>

                  <div style={{ marginTop: "14px" }}>
                    <div className="field-header">User ID</div>
                    <div className="pane-subtitle">
                      If User ID is invalid or empty, no @ping will be sent.
                    </div>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="e.g. 822863893692284948"
                      value={config.webhook_user_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateAndSaveConfig({ webhook_user_id: val });
                      }}
                    />
                  </div>

                  <div className="webhook-tip">
                    Tip: Right-click your profile in Discord -&gt; Copy User ID
                  </div>

                  <div className="webhook-actions">
                    <button
                      className="action-btn"
                      onClick={async () => {
                        if (!config.webhook_url.trim()) {
                          setWebhookStatus("Please enter a Webhook URL first.");
                          addLog("[WEBHOOK] Please enter a Webhook URL first.");
                        } else {
                          setWebhookStatus(
                            "Sending test notification to Discord..."
                          );
                          try {
                            await invoke("test_discord_webhook", {
                              url: config.webhook_url,
                              userId: config.webhook_user_id,
                            });
                            showToast("Test Sent");
                            setWebhookStatus("✓ Test notification sent!");
                          } catch (err: any) {
                            setWebhookStatus(`Failed: ${err}`);
                          }
                        }
                      }}
                    >
                      Test Webhook
                    </button>
                  </div>

                  {webhookStatus && (
                    <div className="status-feedback">{webhookStatus}</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 8: CHANGELOG */}
            {activeTab === "changelog" && (
              <div className="tab-pane">
                <div className="card full-height-card">
                  <pre className="changelog-pre">{changelogContent}</pre>
                </div>
              </div>
            )}

            {/* TAB 9: SETTINGS */}
            {activeTab === "settings" && (
              <div className="tab-pane">
                {/* 1. Updates on Top */}
                <div className="card">
                  <div className="pane-title">Updates</div>
                  <div className="pane-subtitle">Current Version: v3.0</div>

                  <div style={{ marginTop: "14px" }}>
                    <button
                      className="action-btn"
                      onClick={async () => {
                        setUpdateStatus("Checking for updates...");
                        try {
                          const res = await invoke<string>("check_for_updates");
                          setUpdateStatus(res);
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

                {/* 2. Hotkey & Window Behavior */}
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
                      <div className="control-title">Auto focus on game</div>
                      <div className="pane-subtitle">
                        Auto focus on VALORANT when SageBot is running.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.auto_focus_game}
                        onChange={(e) => {
                          updateAndSaveConfig({ auto_focus_game: e.target.checked });
                          addLog(
                            e.target.checked
                              ? "[SETTINGS] Auto Focus on Game enabled."
                              : "[SETTINGS] Auto Focus on Game disabled."
                          );
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="control-row" style={{ marginTop: "14px" }}>
                    <div>
                      <div className="control-title">Always on top</div>
                      <div className="pane-subtitle">
                        Make the app always on top (does not lose focus on VALORANT).
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
                          addLog(
                            val
                              ? "[SETTINGS] Always on top enabled."
                              : "[SETTINGS] Always on top disabled."
                          );
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="control-row" style={{ marginTop: "14px" }}>
                    <div>
                      <div className="control-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        Auto Queue
                        {config.auto_derank_enabled && (
                          <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "1px 7px", borderRadius: "10px", fontWeight: 700 }}>
                            LOCKED BY AUTO DERANK
                          </span>
                        )}
                      </div>
                      <div className="pane-subtitle">
                        Automatically enters Competitive matchmaking queue when in lobby or menu.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.auto_queue_enabled || config.auto_derank_enabled}
                        disabled={config.auto_derank_enabled}
                        onChange={(e) => {
                          if (config.auto_derank_enabled) {
                            showToast("Auto Queue cannot be disabled while Auto Derank is active.");
                            return;
                          }
                          const val = e.target.checked;
                          updateAndSaveConfig({ auto_queue_enabled: val });
                          addLog(
                            val
                              ? "[SETTINGS] Auto Queue enabled."
                              : "[SETTINGS] Auto Queue disabled."
                          );
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Persistent Bottom Footer */}
        <footer className="app-footer">
          <div className="footer-left">
            <button
              className={`footer-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
              title="Settings"
            >
              <SettingsIcon size={14} />
              <span>Settings</span>
            </button>
            <button
              className={`footer-btn ${activeTab === "changelog" ? "active" : ""}`}
              onClick={() => setActiveTab("changelog")}
              title="Changelogs"
            >
              <FileText size={14} />
              <span>Changelogs</span>
            </button>
          </div>

          <div className="footer-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className="footer-game-phase-badge"
              style={{ color: getPhaseColor(status.match_state) }}
              title="Current Game Phase"
            >
              {status.match_state || "-"}
            </span>
            <button
              className="footer-btn-kill"
              onClick={() => setShowKillModal(true)}
              title="Force terminate VALORANT"
            >
              <XOctagon size={14} />
              <span>Kill VALORANT</span>
            </button>
          </div>
        </footer>
      </div>

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
                onClick={() => {
                  suppressDetectionUntilRef.current = Date.now() + 10000;
                  setGatePassed(false);
                  setGateGameFound(false);
                  setIsCrossfading(false);
                  isTransitioningRef.current = false;
                  if (runningRef.current) {
                    stopSagebot("VALORANT terminated.");
                  }
                  invoke("resize_to_gate").catch(() => { });
                  setShowKillModal(false);
                  showToast("Closing VALORANT (10s delay before recheck)...");
                  addLog("[SYSTEM] Force terminated VALORANT processes. Suppressing detection for 10s.");
                  invoke("kill_valorant").catch((err: any) => {
                    showToast(`Error terminating VALORANT: ${err}`);
                  });
                }}
              >
                Kill VALORANT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast success">
            {t.text}
          </div>
        ))}
      </div>

      {/* Instalock Terms Modal */}
      {showInstalockModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <AlertTriangle color="#f59e0b" size={20} />
              <span>Notes</span>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, color: "#fbbf24" }}>
                ⚠️ Instalock Warning
              </p>
              <p style={{ fontWeight: 600 }}>This tool locks chosen Agent BEFORE the Agent Select screen loads.</p>
              <p style={{ marginTop: "8px" }}>
                This is not bannable (so far) unless you go around telling people that you are using it.
              </p>
              <p style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px" }}>
                Note: If multiple agents are selected, SageBot will attempt to
                lock them in order of priority.
              </p>
              <p style={{ marginTop: "8px", color: "#fbbf24" }}>
                Do you wish to proceed and enable Instalock?
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => {
                  setShowInstalockModal(false);
                }}
              >
                No
              </button>
              <button
                className="modal-btn danger"
                onClick={() => {
                  updateAndSaveConfig({ instalock_enabled: true, lock_delay: 0 });
                  setShowInstalockModal(false);
                }}
              >
                I know what I'm doing
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
                onClick={() => {
                  setShowChatWarningModal(false);
                }}
              >
                No
              </button>
              <button
                className="modal-btn danger"
                onClick={() => {
                  updateAndSaveConfig({ chat_enabled: true });
                  addLog("[CHAT] Chat automation activated.");
                  setShowChatWarningModal(false);
                }}
              >
                I know what I'm doing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Derank Warning Modal 1 */}
      {showAutoDerankModal1 && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <AlertTriangle color="#f59e0b" size={20} />
              <span>Notes</span>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, color: "#fbbf24" }}>
                ⚠️ Auto Derank Warning
              </p>
              <p style={{ marginTop: "8px" }}>
                Auto Derank automatically starts Competitive queues, selects/locks agents based on your Agents settings, executes your anti-AFK settings, handles forfeit votes, and automatically re-queues once matches conclude.
              </p>
              <div style={{ marginTop: "10px", padding: "8px 10px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                <p style={{ color: "#34d399", fontWeight: 600, fontSize: "12.5px" }}>
                  ✓ Auto Queue & Starter Fallback Agents are automatically forced ON.
                </p>
              </div>
              <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                <p style={{ color: "#f87171", fontWeight: 600, fontSize: "12.5px" }}>
                  ⚠️ Auto Derank will automatically disable if the 'None' Anti-AFK method is chosen.
                </p>
              </div>
              <p style={{ marginTop: "10px", color: "#94a3b8", fontSize: "12px" }}>
                This is designed for automated background cycling. Please ensure your configuration is prepared.
              </p>
              <p style={{ marginTop: "8px" }}>
                Do you wish to proceed?
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => {
                  setShowAutoDerankModal1(false);
                }}
              >
                Cancel
              </button>
              <button
                className="modal-btn danger"
                onClick={() => {
                  setShowAutoDerankModal1(false);
                  setShowAutoDerankModal2(true);
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Derank Warning Modal 2 (Low Damage Combat Participation Score) */}
      {showAutoDerankModal2 && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header kill-modal-header">
              <AlertTriangle color="#ef4444" size={20} />
              <span style={{ color: "#ef4444" }}>Important Notice</span>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 700, color: "#f87171" }}>
                ⚠️ Low Damage Combat Participation Score
              </p>
              <p style={{ marginTop: "8px" }}>
                If you AFK the whole game without dealing damage, even if you remain connected and do not disappear in-game, VALORANT's combat detection will still flag your account as AFK due to zero Combat Participation.
              </p>
              <p style={{ marginTop: "8px", color: "#ef4444", fontWeight: 600 }}>
                This can result in ranked queue restrictions, XP deduction, and harsh account penalties.
              </p>
              <p style={{ marginTop: "8px" }}>
                Do you understand the risks and still wish to enable Auto Derank?
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => {
                  setShowAutoDerankModal2(false);
                }}
              >
                Cancel
              </button>
              <button
                className="modal-btn danger"
                onClick={() => {
                  if (config.anti_afk_mode === 2) {
                    showToast("Cannot enable Auto Derank: Anti-AFK Method is set to None!");
                    setShowAutoDerankModal2(false);
                    return;
                  }
                  preAutoDerankStateRef.current = {
                    auto_queue_enabled: config.auto_queue_enabled,
                    starter_fallback_enabled: config.starter_fallback_enabled,
                  };
                  updateAndSaveConfig({
                    auto_derank_enabled: true,
                    auto_queue_enabled: true,
                    starter_fallback_enabled: true,
                  });
                  setShowAutoDerankModal2(false);
                  addLog("[CONFIG] Auto Derank mode activated.");
                  addLog("[CONFIG] Auto Queue and Starter Fallback locked ON.");
                }}
              >
                I Understand the Risks
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
    </div>
  );
}
