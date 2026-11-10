import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Play,
  Square,
  Minus,
  X,
  AlertTriangle,
  Settings as SettingsIcon,
  RefreshCw,
  XOctagon,
  Download,
  Lock,
  RotateCcw,
  Upload,
  Copy,
  Trash2,
  FileCode,
  Wrench,
  Users,
  MessageSquare,
  Vote,
  Music,
  Info,
  Radar,
  EyeOff,
  ShoppingBag,
  Clock,
  Sparkles,
  GripVertical,
  History,
  Smartphone,
  Shield,
} from "lucide-react";
import { RemoteHost, type PairRequest } from "./remoteHost";
import { formatCodeDisplay, generatePairCode, randomHex } from "./secureChannel";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";
import tauriConf from "../src-tauri/tauri.conf.json";

// Single source of truth for the displayed version (bump tauri.conf.json + Cargo.toml only)
const APP_VERSION = String(tauriConf.version).replace(/\.0$/, "");

const COMMS_CATEGORIES = [
  {
    id: 1,
    name: "Combat",
    options: [
      { id: 1, text: "Need Support" },
      { id: 2, text: "Caution here!" },
      { id: 3, text: "Need Healing!" },
      { id: 4, text: "On My Way" },
      { id: 5, text: "Ultimate Status" },
    ],
  },
  {
    id: 2,
    name: "Tactics",
    options: [
      { id: 1, text: "I'll Take Point" },
      { id: 2, text: "Let's rush them!" },
      { id: 3, text: "Be Quiet" },
      { id: 4, text: "Fall Back!" },
      { id: 5, text: "Play For Picks" },
    ],
  },
  {
    id: 3,
    name: "Social",
    options: [
      { id: 1, text: "Thanks" },
      { id: 2, text: "Commend" },
      { id: 3, text: "Yes" },
      { id: 4, text: "No" },
      { id: 5, text: "Sorry" },
      { id: 6, text: "Hello" },
    ],
  },
  {
    id: 4,
    name: "Strategy",
    options: [
      { id: 1, text: "Going A" },
      { id: 2, text: "Going B" },
      { id: 3, text: "Going C" },
      { id: 4, text: "Going Mid" },
    ],
  },
];

const GAMEMODE_NAMES: Record<string, string> = {
  competitive: "Competitive",
  unrated: "Unrated",
  swiftplay: "Swiftplay",
  spikerush: "Spike Rush",
  hurm: "Team Deathmatch",
  deathmatch: "Deathmatch",
  ggteam: "Escalation",
  onefa: "Replication",
  snowball: "Snowball Fight",
};

const WEAPON_SKIN_GROUPS = [
  {
    category: "Sidearms",
    weapons: [
      { id: "classic", label: "Classic" },
      { id: "shorty", label: "Shorty" },
      { id: "frenzy", label: "Frenzy" },
      { id: "ghost", label: "Ghost" },
      { id: "bandit", label: "Bandit" },
      { id: "sheriff", label: "Sheriff" },
    ],
  },
  {
    category: "SMGs & Shotguns",
    weapons: [
      { id: "stinger", label: "Stinger" },
      { id: "spectre", label: "Spectre" },
      { id: "bucky", label: "Bucky" },
      { id: "judge", label: "Judge" },
    ],
  },
  {
    category: "Snipers & Heavy",
    weapons: [
      { id: "marshal", label: "Marshal" },
      { id: "outlaw", label: "Outlaw" },
      { id: "operator", label: "Operator" },
      { id: "ares", label: "Ares" },
      { id: "odin", label: "Odin" },
    ],
  },
  {
    category: "Rifles",
    weapons: [
      { id: "bulldog", label: "Bulldog" },
      { id: "guardian", label: "Guardian" },
      { id: "warden", label: "Warden" },
      { id: "phantom", label: "Phantom" },
      { id: "vandal", label: "Vandal" },
    ],
  },
  {
    category: "Melee",
    weapons: [
      { id: "melee", label: "Melee" },
    ],
  },
];

interface MacroAction {
  key: string;
  start_ms: number;
  duration_ms: number;
}

interface MacroData {
  total_loop_ms: number;
  actions: MacroAction[];
}

interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string;
  release_url: string;
  auto_update_allowed?: boolean;
}

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
  webhook_notify_disconnect?: boolean;
  webhook_notify_status?: boolean;
  webhook_notify_agent_select?: boolean;
  webhook_notify_queue?: boolean;
  webhook_notify_match_start?: boolean;
  webhook_notify_match_concludes?: boolean;
  webhook_notify_rank_change?: boolean;
  remote_notify_disconnect?: boolean;
  remote_notify_status?: boolean;
  remote_notify_rank_change?: boolean;
  low_detail?: boolean;
  agents_enabled: boolean;
  instalock_enabled: boolean;
  lock_delay: number;
  lock_random_agent?: boolean;
  selected_agents: string[];
  music_volume: number;
  auto_focus_game?: boolean;
  always_on_top: boolean;
  auto_derank_enabled: boolean;
  auto_derank_target_rank?: string;
  auto_derank_match_limit?: number;
  auto_queue_enabled: boolean;
  auto_queue_mode?: string;
  comms_hotkey?: string;
  comms_first_num?: number;
  comms_second_num?: number;
  comms_random?: boolean;
  comms_delay?: number;
  custom_macro_json?: string;
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
  rank_tier?: number;
  map_name: string;
  gamemode: string;
  score_ally: number;
  score_enemy: number;
  current_agent: string;
  match_id?: string;
  server_name?: string;
  wallet?: {
    vp: number;
    rp: number;
    kc: number;
    agent_tokens: number;
  };
}

interface RecentMatchDetail {
  result: string;
  rr_change: number;
  map_name: string;
  tier_before?: number;
  tier_after: number;
  tier_name: string;
  rr_after: number;
  performance_bonus: number;
  match_id: string;
  timestamp: number;
  is_rank_up?: boolean;
  is_derank?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  kd_ratio?: number;
  has_kda?: boolean;
}

interface TrackedPlayer {
  puuid: string;
  name: string;
  team: string;
  agent_id: string;
  agent_name: string;
  level: number;
  current_tier: number;
  current_rank_name: string;
  current_rr: number;
  peak_tier: number;
  peak_rank_name: string;
  peak_season: string;
  last_season_tier?: number;
  last_season_rank_name?: string;
  last_season_name?: string;
  leaderboard_pos?: number;
  headshot_percent?: number;
  win_rate: number;
  total_games: number;
  primary_skin: string;
  weapon_skins?: Record<string, string>;
  all_skins: string[];
  recent_games?: string[];
  recent_matches?: RecentMatchDetail[];
  kd_ratio?: number;
  total_kills?: number;
  total_deaths?: number;
  total_assists?: number;
  party_tag?: string;
  is_incognito: boolean;
  is_self: boolean;
}

interface LiveMatchRoster {
  state: string;
  match_id: string;
  map_name: string;
  gamemode: string;
  server_name?: string;
  ally_team: TrackedPlayer[];
  enemy_team: TrackedPlayer[];
  updated_at: string;
  rate_limit_seconds?: number;
}

export interface StoreDailyOffer {
  offer_id: string;
  skin_name: string;
  weapon_name: string;
  icon_url: string;
  cost_vp: number;
}

export interface StoreBundleItem {
  item_id: string;
  name: string;
  icon_url: string;
  base_price: number;
  discounted_price: number;
}

export interface StoreFeaturedBundle {
  bundle_id: string;
  name: string;
  display_icon: string;
  total_cost_vp: number;
  seconds_remaining: number;
  items: StoreBundleItem[];
}

export interface StoreNightMarketOffer {
  offer_id: string;
  skin_name: string;
  icon_url: string;
  discount_percent: number;
  original_cost_vp: number;
  discounted_cost_vp: number;
  is_purchased: boolean;
}

export interface StoreAccessoryOffer {
  offer_id: string;
  item_id: string;
  name: string;
  item_type: string;
  icon_url: string;
  cost_kc: number;
}

export interface StorefrontData {
  daily_offers: StoreDailyOffer[];
  daily_seconds_remaining: number;
  featured_bundles: StoreFeaturedBundle[];
  night_market_active: boolean;
  night_market_offers: StoreNightMarketOffer[];
  night_market_seconds_remaining: number;
  accessory_offers: StoreAccessoryOffer[];
  accessory_seconds_remaining: number;
}

type TabType =
  | "main"
  | "tracker"
  | "shop"
  | "config"
  | "agents"
  | "chat"
  | "autovote"
  | "music"
  | "media"
  | "remote"
  | "webhook"
  | "changelog"
  | "settings"
  | "info";

interface ToastMsg {
  id: number;
  text: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  paired_at: string;
  /** Per-device AES-256 session key (base64). Deleting it revokes the device. */
  key: string;
}

const loadOrCreate = (storageKey: string, isValid: (v: string) => boolean, create: () => string): string => {
  const saved = localStorage.getItem(storageKey);
  if (saved && isValid(saved)) return saved;
  const generated = create();
  localStorage.setItem(storageKey, generated);
  return generated;
};

export default function App() {
  // Remote: 8-character code (pairing address), QR token (skips approval) and this PC's private channel id
  const [remoteRoomCode, setRemoteRoomCode] = useState<string>(() =>
    loadOrCreate("sagebot_remote_code", (v) => v.length === 8, generatePairCode)
  );

  const [secretToken, setSecretToken] = useState<string>(() =>
    loadOrCreate("sagebot_remote_secret", (v) => v.length >= 32, () => randomHex(32))
  );

  const [remoteChannelId, setRemoteChannelId] = useState<string>(() =>
    loadOrCreate("sagebot_remote_channel", (v) => v.length === 32, () => randomHex(16))
  );

  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>(() => {
    try {
      const saved = localStorage.getItem("sagebot_paired_devices");
      const list: PairedDevice[] = saved ? JSON.parse(saved) : [];
      // Devices paired with the old insecure protocol have no key and must pair again.
      return list.filter((d) => d && typeof d.key === "string" && d.key.length > 0);
    } catch {
      return [];
    }
  });

  const [remoteUniqueControl, setRemoteUniqueControl] = useState<boolean>(
    () => localStorage.getItem("sagebot_remote_unique") === "true"
  );

  const [pendingPairRequest, setPendingPairRequest] = useState<PairRequest | null>(null);
  const [deviceNicknameInput, setDeviceNicknameInput] = useState<string>("");
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  const [remoteClientConnected, setRemoteClientConnected] = useState<boolean>(false);
  const remoteBridgeRef = useRef<RemoteHost | null>(null);
  const pairedDevicesRef = useRef<PairedDevice[]>(pairedDevices);
  const secretTokenRef = useRef<string>(secretToken);
  const remoteUniqueControlRef = useRef<boolean>(remoteUniqueControl);
  const remoteLastSeenRef = useRef<number>(0);
  const pendingPairRequestRef = useRef<PairRequest | null>(null);

  useEffect(() => {
    pairedDevicesRef.current = pairedDevices;
  }, [pairedDevices]);
  useEffect(() => {
    secretTokenRef.current = secretToken;
  }, [secretToken]);
  useEffect(() => {
    remoteUniqueControlRef.current = remoteUniqueControl;
  }, [remoteUniqueControl]);
  useEffect(() => {
    pendingPairRequestRef.current = pendingPairRequest;
  }, [pendingPairRequest]);

  const [activeTab, setActiveTab] = useState<TabType>("main");
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  // Storefront tab state
  const [storefront, setStorefront] = useState<StorefrontData | null>(null);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(false);
  const [selectedBundleIdx, setSelectedBundleIdx] = useState<number>(0);

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
    webhook_notify_disconnect: true,
    webhook_notify_status: true,
    webhook_notify_agent_select: true,
    webhook_notify_queue: true,
    webhook_notify_match_start: true,
    webhook_notify_match_concludes: true,
    webhook_notify_rank_change: true,
    remote_notify_disconnect: true,
    remote_notify_status: true,
    remote_notify_rank_change: true,
    low_detail: false,
    agents_enabled: true,
    instalock_enabled: false,
    lock_delay: 20,
    selected_agents: [],
    music_volume: 80,
    auto_focus_game: false,
    always_on_top: false,
    auto_derank_enabled: false,
    auto_derank_target_rank: "",
    auto_derank_match_limit: 0,
    auto_queue_enabled: false,
    auto_queue_mode: "competitive",
    comms_hotkey: ".",
    comms_first_num: 3,
    comms_second_num: 6,
    comms_random: false,
    comms_delay: 5,
    custom_macro_json: "",
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] SageBot initialized.",
    "[SYSTEM] Settings loaded from config.ini.",
  ]);
  const [isRebindingMain, setIsRebindingMain] = useState<boolean>(false);
  const [isRebindingAfk, setIsRebindingAfk] = useState<boolean>(false);
  const [isRebindingComms, setIsRebindingComms] = useState<boolean>(false);
  const [isRecordingMacro, setIsRecordingMacro] = useState<boolean>(false);
  const [macroLiveActions, setMacroLiveActions] = useState<MacroAction[]>([]);
  const [activeHoldingKeys, setActiveHoldingKeys] = useState<string[]>([]);
  const [showMacroImportModal, setShowMacroImportModal] = useState<boolean>(false);
  const [macroImportText, setMacroImportText] = useState<string>("");
  const [macroCompilerError, setMacroCompilerError] = useState<string | null>(null);

  // Macro recording & playback refs
  const macroRecordStartRef = useRef<number>(0);
  const activeKeysDownRef = useRef<Map<string, number>>(new Map());
  const recordedActionsRef = useRef<MacroAction[]>([]);
  const macroScheduledTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const macroActiveDownKeysRef = useRef<Set<string>>(new Set());
  const isRecordingMacroRef = useRef<boolean>(false);
  isRecordingMacroRef.current = isRecordingMacro;
  const [changelogContent, setChangelogContent] = useState<string>("");
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showKillModal, setShowKillModal] = useState<boolean>(false);
  const [showChatWarningModal, setShowChatWarningModal] = useState<boolean>(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string; submessage?: string } | null>(null);

  // In-App Auto Updater State
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateError, setUpdateError] = useState<string>("");

  // Live Match Tracker State
  const [roster, setRoster] = useState<LiveMatchRoster | null>(null);
  const [isTrackerLoading, setIsTrackerLoading] = useState<boolean>(false);
  const [selectedPlayerMatches, setSelectedPlayerMatches] = useState<{
    player: TrackedPlayer;
    matches: RecentMatchDetail[];
  } | null>(null);

  useEffect(() => {
    if (!selectedPlayerMatches || !selectedPlayerMatches.player?.puuid) return;
    const missing = selectedPlayerMatches.matches.some((m) => !m.has_kda);
    if (!missing) return;

    let active = true;
    invoke<RecentMatchDetail[]>("fetch_player_match_kdas", {
      matches: selectedPlayerMatches.matches,
      puuid: selectedPlayerMatches.player.puuid,
    })
      .then((updated) => {
        if (!active) return;
        setSelectedPlayerMatches((prev) => {
          if (!prev || prev.player.puuid !== selectedPlayerMatches.player.puuid) return prev;
          return { ...prev, matches: updated };
        });
      })
      .catch((e) => {
        console.warn("fetch_player_match_kdas failed:", e);
      });

    return () => {
      active = false;
    };
  }, [selectedPlayerMatches?.player?.puuid]);

  const formatMatchTime = (timestampMs: number): string => {
    if (!timestampMs || timestampMs === 0) return "";
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - timestampMs) / 1000));
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestampMs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const [selectedWeaponSkin, setSelectedWeaponSkin] = useState<string>("vandal");
  const [showSkinDropdown, setShowSkinDropdown] = useState<boolean>(false);
  const [draggedAgentIdx, setDraggedAgentIdx] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const activeDragIdxRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number>(0);
  const queueItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevQueueTopsRef = useRef<Map<string, number>>(new Map());
  const skinDropdownRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRosterRef = useRef<boolean>(false);
  const trackerFetchedStagesRef = useRef<{ matchId: string; pregame: boolean; coregame: boolean }>({
    matchId: "",
    pregame: false,
    coregame: false,
  });
  const hasDoneInitialTrackerFetchRef = useRef<boolean>(false);
  const prevRankRef = useRef<string>("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (skinDropdownRef.current && !skinDropdownRef.current.contains(e.target as Node)) {
        setShowSkinDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchRoster = async () => {
    if (isFetchingRosterRef.current) return;
    isFetchingRosterRef.current = true;
    setIsTrackerLoading(true);
    try {
      const res = await invoke<LiveMatchRoster>("get_live_match_roster");
      if (res) {
        if (res.rate_limit_seconds && res.rate_limit_seconds > 0) {
          showToast(`Too many requests. Try again in ${res.rate_limit_seconds}s.`);
        }
        if (res.ally_team.length > 0 || res.enemy_team.length > 0 || res.state !== "NO_MATCH") {
          const isComp = (res.gamemode || status.gamemode || "").toLowerCase().includes("competitive");
          if (isComp && res.ally_team.length === 5 && res.enemy_team.length === 5) {
            const allyTag = res.ally_team[0]?.party_tag;
            if (allyTag && res.ally_team.every((p) => p.party_tag === allyTag)) {
              const enemyTag = allyTag === "Party 1" ? "Party 2" : "Party 1";
              res.enemy_team.forEach((p) => {
                p.party_tag = enemyTag;
              });
            }
          }
          setRoster(res);
          rosterRef.current = res;
          if (remoteBridgeRef.current) {
            remoteBridgeRef.current.send({
              type: "roster",
              payload: res,
            });
          }
        } else if (res.state === "NO_MATCH") {
          setRoster((prev) => {
            const next = prev && (prev.state === "COREGAME" || prev.state === "PREGAME") ? { ...prev, state: "CONCLUDED" } : prev;
            rosterRef.current = next;
            return next;
          });
        }
        // Webhook notification on rank change
        const self = res.ally_team.find((p) => p.is_self);
        if (self && self.current_rank_name && self.current_rank_name !== "Unranked" && self.current_rank_name !== "-") {
          if (prevRankRef.current && prevRankRef.current !== self.current_rank_name) {
            triggerWebhookEvent(`Current Rank: **${self.current_rank_name}**`, "rank_change");
          }
          prevRankRef.current = self.current_rank_name;
        }
      }
    } catch (err: any) {
      console.warn("Tracker query returned error:", err);
      const errStr = String(err || "");
      if (errStr.includes("429") || errStr.toLowerCase().includes("too many requests")) {
        showToast("Too many requests. Try again in 20s.");
      }
    } finally {
      setIsTrackerLoading(false);
      isFetchingRosterRef.current = false;
    }
  };

  const fetchStorefront = async () => {
    setIsStoreLoading(true);
    try {
      const data = await invoke<StorefrontData>("get_storefront");
      setStorefront(data);
      storefrontRef.current = data;
      if (remoteBridgeRef.current) {
        remoteBridgeRef.current.send({
          type: "storefront",
          payload: data,
        });
      }
    } catch (e) {
      console.error("Failed to fetch storefront:", e);
    } finally {
      setIsStoreLoading(false);
    }
  };

  const formatDuration = (totalSeconds: number): string => {
    if (!totalSeconds || totalSeconds <= 0) return "00:00:00";
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (days > 0) {
      return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getSkinRarity = (costVp: number, skinName?: string) => {
    const isKnife = skinName
      ? /blade|knife|kunai|bat|karambit|sword|dagger|axe|claw|mace|scythe|fan|melee|hammer|katana|wand|cane|scepter|anchor|whip|butterfly|harvester|relentless|hack|cleaver|fang|needle|splitter|pickaxe|poker|staff|torch|comb|glove|power|switchblade|bident|misericórdia|misericordia|no yaiba|cord|gauntlet|fist/i.test(skinName)
      : false;

    // ALL knife / melee skins are Exclusive Edition (Orange, 4350+ VP or standard melee rarity in VALORANT store)
    if (isKnife || (costVp >= 2500 && costVp !== 2475)) {
      return {
        name: "Exclusive Edition",
        color: "#f5955b",
        glow: "rgba(245, 149, 91, 0.45)",
        icon: "https://media.valorant-api.com/contenttiers/e046854e-406c-37f4-6607-19a9ba8426fc/displayicon.png",
      };
    }

    // Ultra Edition: guns >= 2475 VP
    if (costVp >= 2475) {
      return {
        name: "Ultra Edition",
        color: "#fad663",
        glow: "rgba(250, 214, 99, 0.45)",
        icon: "https://media.valorant-api.com/contenttiers/411e4a55-4e59-7757-41f0-86a53f101bb5/displayicon.png",
      };
    }
    // Exclusive Edition: guns 2175 VP
    if (costVp === 2175) {
      return {
        name: "Exclusive Edition",
        color: "#f5955b",
        glow: "rgba(245, 149, 91, 0.45)",
        icon: "https://media.valorant-api.com/contenttiers/e046854e-406c-37f4-6607-19a9ba8426fc/displayicon.png",
      };
    }
    // Premium Edition: guns 1775 VP
    if (costVp === 1775) {
      return {
        name: "Premium Edition",
        color: "#d1548d",
        glow: "rgba(209, 84, 141, 0.45)",
        icon: "https://media.valorant-api.com/contenttiers/60bca009-4182-7998-dee7-b8a2558dc369/displayicon.png",
      };
    }
    // Deluxe Edition: guns 1275 VP
    if (costVp === 1275) {
      return {
        name: "Deluxe Edition",
        color: "#00bfa5",
        glow: "rgba(0, 191, 165, 0.45)",
        icon: "https://media.valorant-api.com/contenttiers/0cebb8be-46d7-c12a-d306-e9907bfc5a25/displayicon.png",
      };
    }
    // Select Edition: 875 VP
    return {
      name: "Select Edition",
      color: "#5a9fe2",
      glow: "rgba(90, 159, 226, 0.45)",
      icon: "https://media.valorant-api.com/contenttiers/12683d76-48d7-84a3-4e09-6985794f0445/displayicon.png",
    };
  };

  const [lockDelayInput, setLockDelayInput] = useState<string>("20");
  const [chatIntervalInput, setChatIntervalInput] = useState<string>("180");
  const [commsDelayInput, setCommsDelayInput] = useState<string>("3");

  // Screen State
  const [gatePassed] = useState<boolean>(true);
  const devBypassRef = useRef<boolean>(false);
  const botStartTimeRef = useRef<number>(0);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authInput, setAuthInput] = useState<string>("");
  const [showLaunchModal, setShowLaunchModal] = useState<boolean>(false);
  const [isRiotSignedIn, setIsRiotSignedIn] = useState<boolean>(false);

  // Pre Fully Auto Play state storage (for reverting when turned off)
  const preAutoDerankStateRef = useRef<{
    auto_queue_enabled: boolean;
    lock_random_agent?: boolean;
    auto_focus_game: boolean;
  }>({
    auto_queue_enabled: false,
    auto_focus_game: false,
  });

  // Suppression and synchronization refs
  const suppressDetectionUntilRef = useRef<number>(0);
  const lastScoreSumRef = useRef<number>(-1);
  const roundStartTimestampRef = useRef<number>(0);
  const lastQueueTimeRef = useRef<number>(0);
  const isHoldingKeyRef = useRef<boolean>(false);
  const statusRef = useRef<StatusResponse>(status);
  const isPollingRef = useRef<boolean>(false);

  // Universal action concurrency lock to ensure no overlapping inputs/comms/chat
  const isActionBusyRef = useRef<boolean>(false);
  const tryAcquireActionLock = (): boolean => {
    if (isActionBusyRef.current) return false;
    isActionBusyRef.current = true;
    return true;
  };
  const releaseActionLock = (delayMs: number = 80) => {
    setTimeout(() => {
      isActionBusyRef.current = false;
    }, delayMs);
  };

  // Match and event tracking refs
  const wasInMatchRef = useRef<boolean>(false);
  const hasFocusedCurrentMatchRef = useRef<boolean>(false);
  const prevMatchStateRef = useRef<string>("");
  const wasGameReadyRef = useRef<boolean>(false);
  const isQueueingRef = useRef<boolean>(false);
  const hasSentAgentSelectWebhookRef = useRef<boolean>(false);
  const hasSentMatchStartWebhookRef = useRef<boolean>(false);
  const lastSentMatchStartKeyRef = useRef<string>("");
  const surrenderSpamUntilRef = useRef<number>(0);
  const lockedAgentRef = useRef<string>("");
  const hasLoggedClickAfkRef = useRef<boolean>(false);
  const hasLoggedCommsRef = useRef<boolean>(false);
  const hasLoggedChatRef = useRef<boolean>(false);
  const logsRef = useRef<string[]>([]);
  const rosterRef = useRef<LiveMatchRoster | null>(null);
  const storefrontRef = useRef<StorefrontData | null>(null);
  const pregameRef = useRef<any>(null);
  const lastScoreRef = useRef<{ ally: number; enemy: number; map: string; gamemode: string }>({
    ally: 0,
    enemy: 0,
    map: "-",
    gamemode: "-",
  });
  const disconnectCountRef = useRef<number>(0);
  const lobbyCountRef = useRef<number>(0);

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [musicCurrentTime, setMusicCurrentTime] = useState<number>(0);
  const [musicDuration, setMusicDuration] = useState<number>(0);
  const [musicBlobUrl, setMusicBlobUrl] = useState<string>("");
  const isDraggingMusicRef = useRef<boolean>(false);
  const musicCurrentTimeRef = useRef<number>(0);
  musicCurrentTimeRef.current = musicCurrentTime;

  useEffect(() => {
    let url = "";
    fetch("/music.mp3")
      .then((r) => r.blob())
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setMusicBlobUrl(url);
      })
      .catch((err) => console.warn("Failed to load music blob:", err));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const runningRef = useRef<boolean>(false);
  runningRef.current = isRunning;
  const configRef = useRef<AppConfig>(config);
  configRef.current = config;

  // Notification Dispatcher (Remote Phone + Discord Webhook)
  const triggerWebhookEvent = (
    message: string,
    eventType: "disconnect" | "agent_select" | "queue" | "match_start" | "match_concludes" | "bot_status" | "rank_change" | "status"
  ) => {
    const cfg = configRef.current;

    // 1. Dispatch notification to connected Mobile Phone
    if (remoteBridgeRef.current) {
      let allowRemote = true;
      if (eventType === "disconnect" && (cfg.remote_notify_disconnect ?? cfg.webhook_notify_disconnect) === false) {
        allowRemote = false;
      }
      if (
        (eventType === "agent_select" || eventType === "queue" || eventType === "match_start" || eventType === "match_concludes" || eventType === "status") &&
        (cfg.remote_notify_status ?? cfg.webhook_notify_status) === false
      ) {
        allowRemote = false;
      }
      if (eventType === "rank_change" && (cfg.remote_notify_rank_change ?? cfg.webhook_notify_rank_change) === false) {
        allowRemote = false;
      }

      if (allowRemote) {
        const cleanMessage = message.replace(/\*\*/g, "").trim();
        remoteBridgeRef.current.send({
          type: "notification",
          payload: {
            title: "SageBot",
            message: cleanMessage,
            eventType,
            timestamp: Date.now(),
          },
        });
      }
    }

    // 2. Dispatch to Discord webhook if configured
    const isEnabled = cfg.webhook_enabled ?? false;
    const hasTarget = Boolean(cfg.webhook_url?.trim());
    if (!isEnabled || !hasTarget) return;

    if (eventType === "disconnect" && cfg.webhook_notify_disconnect === false) return;
    if ((eventType === "agent_select" || eventType === "queue" || eventType === "match_start" || eventType === "match_concludes" || eventType === "status") && cfg.webhook_notify_status === false) return;
    if (eventType === "rank_change" && cfg.webhook_notify_rank_change === false) return;

    invoke("send_webhook_event", { message }).catch(() => { });
  };

  // Add Log Entry
  const addLog = (msg: string) => {
    setLogs((prev) => {
      const next = [...prev, msg];
      logsRef.current = next;
      return next;
    });
    if (remoteBridgeRef.current) {
      remoteBridgeRef.current.send({
        type: "log",
        payload: msg,
      });
    }
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
          if (cfg.anti_afk_mode > 3) {
            cfg.anti_afk_mode = 3;
          }
          setConfig(cfg);
          if (!cfg.auto_derank_enabled) {
            preAutoDerankStateRef.current = {
              auto_queue_enabled: cfg.auto_queue_enabled,
              auto_focus_game: !!cfg.auto_focus_game,
            };
          }
          if (cfg.instalock_enabled) {
            setLockDelayInput("0");
          } else {
            const d = cfg.lock_delay >= 5 && cfg.lock_delay <= 70 ? cfg.lock_delay : 20;
            setLockDelayInput(String(d));
          }
          setChatIntervalInput(String(cfg.chat_interval ?? 180));
          setCommsDelayInput(String(Math.max(3, cfg.comms_delay ?? 3)));
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

    // Auto update handler
    const performAutoUpdate = async (downloadUrl: string) => {
      setShowUpdateModal(true);
      setUpdateProgress(0);
      setUpdateError("");
      try {
        await invoke("apply_update", { downloadUrl });
      } catch (err: any) {
        setUpdateError(typeof err === "string" ? err : err?.message || "Failed to download update");
      }
    };

    // Check for updates on startup immediately (whether VALORANT is running or not)
    invoke<UpdateInfo>("check_for_updates")
      .then((info) => {
        setUpdateInfo(info);
        if (info.available && info.download_url && info.auto_update_allowed !== false) {
          performAutoUpdate(info.download_url);
        } else if (info.available) {
          setUpdateStatus(`A newer version is available: ${info.latest_version}`);
        } else {
          setUpdateStatus(`You are running the latest version: v${info.current_version}`);
        }
      })
      .catch((err) => {
        console.error("Auto update check failed:", err);
      });
  }, []);

  // Remote host lifecycle (restarts cleanly when the code or channel is reset)
  useEffect(() => {
    const sendStatusUpdate = (bridgeInstance?: RemoteHost | null) => {
      const b = bridgeInstance ?? remoteBridgeRef.current;
      if (!b) return;
      b.send({
        type: "sync",
        status: statusRef.current,
        bot_running: runningRef.current,
        roster: rosterRef.current,
        storefront: storefrontRef.current,
        pregame: pregameRef.current,
        logs: logsRef.current.slice(-8),
        config: {
          anti_afk_mode: configRef.current.anti_afk_mode,
          anti_afk_key: configRef.current.anti_afk_key,
          anti_afk_slow_mode: configRef.current.anti_afk_slow_mode,
          auto_queue_mode: configRef.current.auto_queue_mode,
          auto_queue_enabled: configRef.current.auto_queue_enabled,
        },
      });
    };

    const bridge = new RemoteHost({
      code: remoteRoomCode,
      channelId: remoteChannelId,
      getToken: () => secretTokenRef.current,
      getDevices: () => pairedDevicesRef.current,
      canAcceptDevice: (cid) =>
        !remoteUniqueControlRef.current || pairedDevicesRef.current.every((d) => d.id === cid),
      onReady: () => sendStatusUpdate(bridge),
      onPairRequest: (req) => {
        setDeviceNicknameInput(req.proposed_name);
        setPendingPairRequest(req);
      },
      onPairCancelled: (cid) => {
        if (pendingPairRequestRef.current?.client_id === cid) setPendingPairRequest(null);
      },
      onDevicePaired: (dev) => {
        const newDev: PairedDevice = {
          ...dev,
          paired_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        const next = [...pairedDevicesRef.current.filter((d) => d.id !== dev.id), newDev];
        pairedDevicesRef.current = next;
        setPairedDevices(next);
        localStorage.setItem("sagebot_paired_devices", JSON.stringify(next));
        remoteLastSeenRef.current = Date.now();
        setRemoteClientConnected(true);
        setTimeout(() => sendStatusUpdate(bridge), 250);
        showToast(`Paired: ${dev.name}`);
      },
      onCommand: async (_cid, data) => {
        remoteLastSeenRef.current = Date.now();
        setRemoteClientConnected((prev) => {
          if (!prev) {
            showToast("Mobile Remote connected");
          }
          return true;
        });

        const action = typeof data.action === "string" ? data.action : "";
        switch (action) {
          case "hello":
          case "request_sync":
            sendStatusUpdate(bridge);
            break;
          case "ping":
            break;
          case "toggle_bot":
            if (runningRef.current) {
              stopSagebot("Mobile remote trigger");
            } else {
              startSagebot();
            }
            setTimeout(() => sendStatusUpdate(bridge), 80);
            break;
          case "take_screenshot": {
            try {
              const b64 = await invoke<string>("capture_screen_base64");
              bridge.send({
                type: "screenshot",
                payload: b64,
              });
            } catch (err) {
              bridge.send({
                type: "toast",
                payload: `Screenshot failed: ${err}`,
              });
            }
            break;
          }
          case "refresh_roster": {
            if (rosterRef.current) {
              bridge.send({
                type: "roster",
                payload: rosterRef.current,
              });
            } else {
              try {
                const r = await invoke<LiveMatchRoster>("get_live_match_roster");
                setRoster(r);
                rosterRef.current = r;
                bridge.send({
                  type: "roster",
                  payload: r,
                });
              } catch {
                bridge.send({
                  type: "roster",
                  payload: null,
                });
              }
            }
            break;
          }
          case "kill_valorant": {
            try {
              await invoke("kill_valorant");
              showToast("VALORANT terminated via Mobile Remote");
              bridge.send({ type: "toast", payload: "VALORANT terminated successfully." });
            } catch (err: any) {
              bridge.send({ type: "toast", payload: `Failed to terminate: ${err}` });
            }
            break;
          }
          case "request_storefront": {
            if (storefrontRef.current) {
              bridge.send({
                type: "storefront",
                payload: storefrontRef.current,
              });
            } else {
              try {
                const sf = await invoke<StorefrontData>("get_storefront");
                setStorefront(sf);
                storefrontRef.current = sf;
                bridge.send({
                  type: "storefront",
                  payload: sf,
                });
              } catch (err) {
                bridge.send({
                  type: "storefront",
                  payload: null,
                });
              }
            }
            break;
          }
          case "remote_lock_agent": {
            const id = data.agentId || data.payload?.agentId || data.agent_id || data.payload?.agent_id;
            const agentName = data.agentName || data.payload?.agentName || "Agent";
            try {
              const resMsg = await invoke<string>("lock_agent_now", {
                agent_id: id,
                agentId: id,
              });
              showToast(`Remote locked: ${agentName}`);
              bridge.send({
                type: "lock_result",
                success: true,
                agentId: id,
                message: resMsg || `Locked ${agentName}`
              });
              try {
                const pg = await invoke<any>("get_pregame_state");
                if (pg) {
                  pregameRef.current = pg;
                  bridge.send({ type: "pregame", payload: pg });
                }
              } catch { }
            } catch (err: any) {
              showToast(`Remote lock failed: ${err}`);
              bridge.send({
                type: "lock_result",
                success: false,
                agentId: id,
                message: String(err)
              });
            }
            break;
          }
          case "start_matchmaking": {
            const queueMode =
              data.queueId ||
              data.payload?.queueId ||
              data.queue_id ||
              data.payload?.queue_id ||
              data.queueMode ||
              data.payload?.queueMode ||
              "competitive";
            const modeName = GAMEMODE_NAMES[queueMode.toLowerCase()] || queueMode;
            // Synchronize with PC config so PC auto-queue loop uses the selected mode
            updateAndSaveConfig({ auto_queue_mode: queueMode });
            configRef.current.auto_queue_mode = queueMode;
            try {
              await invoke("start_matchmaking_queue", { queue_mode: queueMode, queueMode });
              showToast(`Matchmaking started (${modeName})`);
              bridge.send({ type: "toast", payload: `Queue started: ${modeName}` });
            } catch (err: any) {
              showToast(`Matchmaking error: ${err}`);
              bridge.send({ type: "toast", payload: `Cannot start queue: ${err}` });
            }
            break;
          }
          case "cancel_matchmaking": {
            try {
              await invoke("cancel_matchmaking_queue");
              showToast("Matchmaking canceled");
              bridge.send({ type: "toast", payload: "Matchmaking canceled." });
            } catch (err: any) {
              showToast(`Cancel queue failed: ${err}`);
              bridge.send({ type: "toast", payload: `Failed to cancel queue: ${err}` });
            }
            break;
          }
          case "request_pregame": {
            try {
              const pg = await invoke<any>("get_pregame_state");
              pregameRef.current = pg;
              bridge.send({ type: "pregame", payload: pg });
            } catch {
              bridge.send({ type: "pregame", payload: null });
            }
            break;
          }
        }
      },
    });
    remoteBridgeRef.current = bridge;

    let syncTimeout: any = null;
    let isBridgeDestroyed = false;

    const scheduleSync = () => {
      if (isBridgeDestroyed) return;
      const ms = (statusRef.current.match_state || "").toUpperCase();
      const isLobbyOrQueue =
        ms.includes("LOBBY") ||
        ms.includes("MENU") ||
        ms.includes("QUEUE") ||
        statusRef.current.match_state === "In Lobby" ||
        statusRef.current.match_state === "In Queue";
      const delay = isLobbyOrQueue ? 1000 : 2500;
      syncTimeout = setTimeout(() => {
        sendStatusUpdate(bridge);
        scheduleSync();
      }, delay);
    };
    scheduleSync();

    // The phone pings every 5s; consider it gone after 15s of silence
    const presenceTimer = setInterval(() => {
      if (Date.now() - remoteLastSeenRef.current > 15000) {
        setRemoteClientConnected(false);
      }
    }, 3000);

    return () => {
      isBridgeDestroyed = true;
      if (syncTimeout) clearTimeout(syncTimeout);
      clearInterval(presenceTimer);
      bridge.destroy();
      remoteBridgeRef.current = null;
      setRemoteClientConnected(false);
    };
  }, [remoteRoomCode, remoteChannelId]);

  // Disable default browser/WebView context menu on right-click
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Prevent WebView2 app reload on F5 or Ctrl+R so SageBot never resets accidentally
  useEffect(() => {
    const handlePreventReload = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.ctrlKey && (e.key === "r" || e.key === "R"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handlePreventReload, true);
    return () => window.removeEventListener("keydown", handlePreventReload, true);
  }, []);

  // Notify connected mobile remote immediately when SageBot PC closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (remoteBridgeRef.current) {
        remoteBridgeRef.current.send({ type: "pc_disconnected" });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Listen for background download progress events
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    listen<number>("update-progress", (event) => {
      setUpdateProgress(event.payload);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Remote Device Pairing Handlers
  const handleApproveDevice = async () => {
    const req = pendingPairRequest;
    if (!req) return;
    setPendingPairRequest(null);
    pendingPairRequestRef.current = null;
    const name = deviceNicknameInput.trim() || req.proposed_name || "Phone";
    const dev = await remoteBridgeRef.current?.approve(req.client_id, name);
    if (!dev) {
      showToast(remoteUniqueControlRef.current ? "Unique Control: remove the current device first." : "Pairing request expired.");
    }
  };

  const handleDenyDevice = () => {
    const req = pendingPairRequest;
    if (!req) return;
    remoteBridgeRef.current?.deny(req.client_id);
    setPendingPairRequest(null);
    pendingPairRequestRef.current = null;
    showToast("Device pairing denied");
  };

  const handleRemoveDevice = async (devId: string) => {
    // Tell the phone first (while its key still exists), then delete the key: it can never get back in.
    await remoteBridgeRef.current?.sendTo(devId, { type: "revoked" });
    const next = pairedDevicesRef.current.filter((d) => d.id !== devId);
    pairedDevicesRef.current = next;
    setPairedDevices(next);
    localStorage.setItem("sagebot_paired_devices", JSON.stringify(next));
    showToast("Device removed and disconnected.");
  };

  const handleToggleUniqueControl = async () => {
    const next = !remoteUniqueControl;
    if (next && pairedDevicesRef.current.length > 1) {
      // Keep only the first paired device and revoke any extra ones
      const [keep, ...extra] = pairedDevicesRef.current;
      for (const dev of extra) {
        await remoteBridgeRef.current?.sendTo(dev.id, { type: "revoked" });
      }
      const trimmed = [keep];
      pairedDevicesRef.current = trimmed;
      setPairedDevices(trimmed);
      localStorage.setItem("sagebot_paired_devices", JSON.stringify(trimmed));
    }
    remoteUniqueControlRef.current = next;
    setRemoteUniqueControl(next);
    localStorage.setItem("sagebot_remote_unique", String(next));
    showToast(next ? "Unique Control enabled: one device only." : "Unique Control disabled.");
  };

  const handleResetRemoteCode = async () => {
    setShowResetConfirmModal(false);
    await remoteBridgeRef.current?.send({ type: "force_logout" });
    const newCode = generatePairCode();
    const newToken = randomHex(32);
    const newChannel = randomHex(16);
    secretTokenRef.current = newToken;
    pairedDevicesRef.current = [];
    pendingPairRequestRef.current = null;
    setRemoteRoomCode(newCode);
    setSecretToken(newToken);
    setRemoteChannelId(newChannel);
    setPairedDevices([]);
    setPendingPairRequest(null);
    localStorage.setItem("sagebot_remote_code", newCode);
    localStorage.setItem("sagebot_remote_secret", newToken);
    localStorage.setItem("sagebot_remote_channel", newChannel);
    localStorage.setItem("sagebot_paired_devices", JSON.stringify([]));
    showToast("Code reset. All devices logged out.");
  };

  // Hidden developer authentication listener (Ctrl + Shift + P)
  useEffect(() => {
    const handleDevShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setShowAuthModal(true);
        setAuthInput("");
      }
    };
    window.addEventListener("keydown", handleDevShortcut);
    return () => window.removeEventListener("keydown", handleDevShortcut);
  }, []);

  const handleDevAuthSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (authInput === "mizu") {
      devBypassRef.current = true;
      wasGameReadyRef.current = true;
      showToast("Developer mode active");
    }
    setShowAuthModal(false);
    setAuthInput("");
  };

  // Poll live status: 1 second when In Lobby or In Queue, 1.5 seconds otherwise
  useEffect(() => {
    let pollTimeout: any = null;
    let isCancelled = false;

    const scheduleNextPoll = () => {
      if (isCancelled) return;
      const ms = (statusRef.current.match_state || "").toUpperCase();
      const isLobbyOrQueue =
        ms.includes("LOBBY") ||
        ms.includes("MENU") ||
        ms.includes("QUEUE") ||
        statusRef.current.match_state === "In Lobby" ||
        statusRef.current.match_state === "In Queue";
      const delay = isLobbyOrQueue ? 1000 : 1500;
      pollTimeout = setTimeout(() => {
        pollStatus();
      }, delay);
    };

    const pollStatus = () => {
      if (isCancelled) return;
      if (isPollingRef.current) {
        scheduleNextPoll();
        return;
      }
      if (Date.now() < suppressDetectionUntilRef.current) {
        scheduleNextPoll();
        return;
      }
      isPollingRef.current = true;

      invoke<StatusResponse>("get_client_status")
        .then((res) => {
          if (isCancelled) return;
          // Optimized deep-comparison to prevent unnecessary React re-renders when state hasn't changed
          setStatus((prev) => {
            if (
              prev.is_connected === res.is_connected &&
              prev.game_live === res.game_live &&
              prev.match_state === res.match_state &&
              prev.score_ally === res.score_ally &&
              prev.score_enemy === res.score_enemy &&
              prev.current_agent === res.current_agent &&
              prev.map_name === res.map_name &&
              prev.gamemode === res.gamemode &&
              prev.rank_name === res.rank_name &&
              prev.rank_tier === res.rank_tier &&
              prev.player_name === res.player_name &&
              prev.player_tag === res.player_tag &&
              prev.wallet?.vp === res.wallet?.vp &&
              prev.wallet?.rp === res.wallet?.rp &&
              prev.wallet?.kc === res.wallet?.kc &&
              prev.wallet?.agent_tokens === res.wallet?.agent_tokens
            ) {
              return prev;
            }
            return res;
          });
          statusRef.current = res;

          // Push immediate sync to mobile remote
          if (remoteBridgeRef.current) {
            remoteBridgeRef.current.send({
              type: "sync",
              status: res,
              bot_running: runningRef.current,
              roster: rosterRef.current,
              storefront: storefrontRef.current,
              pregame: pregameRef.current,
              logs: logsRef.current.slice(-8),
              config: {
                anti_afk_mode: configRef.current.anti_afk_mode,
                anti_afk_key: configRef.current.anti_afk_key,
                anti_afk_slow_mode: configRef.current.anti_afk_slow_mode,
                auto_queue_mode: configRef.current.auto_queue_mode,
                auto_queue_enabled: configRef.current.auto_queue_enabled,
              },
            });
          }

          // Sync rank change to webhook if rank updated in live presence
          if (res.rank_name && res.rank_name !== "Unranked" && res.rank_name !== "-" && res.rank_name !== "") {
            if (prevRankRef.current && prevRankRef.current !== res.rank_name) {
              triggerWebhookEvent(`Current Rank: **${res.rank_name}**`, "rank_change");
            }
            prevRankRef.current = res.rank_name;
          }

          const isIngame =
            (res.is_game_ready || res.game_live) &&
            res.match_state === "In Game";

          // Sync in-game focus state to backend monitor: mandatory whenever bot is running and in game
          invoke("set_ingame_focus_state", {
            inGameWithAgent: Boolean(runningRef.current && isIngame),
            autoFocus: true,
          }).catch(() => { });

          // If running, ensure held key is released if game concludes or enters lobby/agent select
          if (runningRef.current) {
            if (!isIngame && isHoldingKeyRef.current) {
              const key = configRef.current.anti_afk_key || "Tab";
              invoke("trigger_key_up", { key });
              isHoldingKeyRef.current = false;
            }
          }

          // In-game tracking & Mandatory Automatic Focus
          if (isIngame) {
            if (!wasInMatchRef.current) {
              wasInMatchRef.current = true;
              isQueueingRef.current = false;
              lastScoreRef.current = {
                ally: res.score_ally,
                enemy: res.score_enemy,
                map: res.map_name !== "-" ? res.map_name : lastScoreRef.current.map,
                gamemode: res.gamemode !== "-" ? res.gamemode : lastScoreRef.current.gamemode,
              };
            } else {
              if (res.map_name && res.map_name !== "-") {
                lastScoreRef.current.map = res.map_name;
              }
              if (res.gamemode && res.gamemode !== "-") {
                lastScoreRef.current.gamemode = res.gamemode;
              }
              if (res.score_ally > 0 || res.score_enemy > 0) {
                lastScoreRef.current.ally = Math.max(lastScoreRef.current.ally, res.score_ally);
                lastScoreRef.current.enemy = Math.max(lastScoreRef.current.enemy, res.score_enemy);
              }
            }

            // Immediately force focus on VALORANT window upon entering loading screen / in-game
            if (runningRef.current && isIngame) {
              if (!hasFocusedCurrentMatchRef.current) {
                invoke("focus_valorant_window").catch(() => { });
                hasFocusedCurrentMatchRef.current = true;
              }
            }
          }

          const stateUpper = res.match_state.toUpperCase();
          const isLobby =
            stateUpper.includes("LOBBY") ||
            stateUpper.includes("MENU") ||
            stateUpper.includes("POSTGAME") ||
            res.match_state === "In Lobby";

          // Lifecycle-driven Live Tracker Trigger:
          // 1. Agent Select (PREGAME)
          // 2. Screen Loading / In-Game (COREGAME - fetches enemies as soon as loading screen begins)
          const currentMatchId = res.match_id || `${res.map_name}_${res.gamemode}`;
          if (res.match_state === "Agent Select") {
            // First time entering Agent Select: notify mobile phone!
            if (prevMatchStateRef.current !== "Agent Select") {
              const b = remoteBridgeRef.current;
              if (b) {
                b.send({
                  type: "notification",
                  title: "SageBot",
                  message: "Match found! Open SageBot to manually choose your agent.",
                  eventType: "match_found",
                });
              }
            }
            // Stream pregame roster updates to mobile phone
            invoke<any>("get_pregame_state")
              .then((pg) => {
                if (pg) {
                  pregameRef.current = pg;
                  const b = remoteBridgeRef.current;
                  if (b) {
                    b.send({
                      type: "pregame",
                      payload: pg,
                    });
                  }
                }
              })
              .catch(() => { });

            if (trackerFetchedStagesRef.current.matchId !== currentMatchId || !trackerFetchedStagesRef.current.pregame) {
              trackerFetchedStagesRef.current = {
                matchId: currentMatchId,
                pregame: true,
                coregame: false,
              };
              fetchRoster();
            }
          } else {
            if (pregameRef.current) {
              pregameRef.current = null;
              const b = remoteBridgeRef.current;
              if (b) {
                b.send({
                  type: "pregame",
                  payload: null,
                });
              }
            }
            if (res.match_state === "In Game") {
              // Trigger as soon as loading screen begins (Riot sets sessionLoopState to INGAME during map loading)
              if (trackerFetchedStagesRef.current.matchId !== currentMatchId || !trackerFetchedStagesRef.current.coregame) {
                trackerFetchedStagesRef.current.matchId = currentMatchId;
                trackerFetchedStagesRef.current.coregame = true;
                fetchRoster();

                // Single safety retry 3 seconds later during screen loading in case enemy roster takes a moment to connect
                setTimeout(() => {
                  fetchRoster();
                }, 3000);
              }
            } else if (isLobby || res.match_state === "In Lobby" || res.match_state === "In Queue" || res.match_state === "OFFLINE") {
              trackerFetchedStagesRef.current = { matchId: "", pregame: false, coregame: false };
            }
          }
          prevMatchStateRef.current = res.match_state;

          // 1. Match Concluded Detection: Triggers when transitioning from In Game back to Lobby
          if (wasInMatchRef.current && isLobby) {
            lobbyCountRef.current += 1;
            if (lobbyCountRef.current >= 3) {
              wasInMatchRef.current = false;
              lobbyCountRef.current = 0;
              hasFocusedCurrentMatchRef.current = false;
              hasSentMatchStartWebhookRef.current = false;
              lastSentMatchStartKeyRef.current = "";
              lockedAgentRef.current = "";
              isQueueingRef.current = false;
              surrenderSpamUntilRef.current = 0;
              roundStartTimestampRef.current = 0;
              lastScoreSumRef.current = -1;

              let allyFinal = Math.max(lastScoreRef.current.ally, res.score_ally);
              let enemyFinal = Math.max(lastScoreRef.current.enemy, res.score_enemy);
              let finalMap = lastScoreRef.current.map !== "-" ? lastScoreRef.current.map : (res.map_name !== "-" ? res.map_name : "Unknown Map");
              let rawMode = lastScoreRef.current.gamemode !== "-" ? lastScoreRef.current.gamemode : (res.gamemode !== "-" ? res.gamemode : "Competitive");

              const dispatchConclude = (allyScore: number, enemyScore: number, mapName: string, modeName: string) => {
                const gmLower = modeName.toLowerCase();
                const isSwiftplay = gmLower.includes("swift");
                const isSpikeRush = gmLower.includes("spikerush") || gmLower.includes("spike");
                const isTDM = gmLower.includes("deathmatch") || gmLower.includes("tdm") || gmLower.includes("hurm");

                let safeAlly = allyScore;
                let safeEnemy = enemyScore;

                if (isTDM) {
                  // In TDM, matches conclude at 100 kills unless time expired
                  if (safeAlly < 100 && safeEnemy < 100 && (safeAlly > 0 || safeEnemy > 0)) {
                    if (safeAlly > safeEnemy) safeAlly = 100;
                    else if (safeEnemy > safeAlly) safeEnemy = 100;
                  }
                } else if (isSwiftplay) {
                  if (safeAlly === 4 && safeEnemy < 4) safeAlly = 5;
                  else if (safeEnemy === 4 && safeAlly < 4) safeEnemy = 5;
                } else if (isSpikeRush) {
                  if (safeAlly === 3 && safeEnemy < 3) safeAlly = 4;
                  else if (safeEnemy === 3 && safeAlly < 3) safeEnemy = 4;
                } else {
                  // Standard Competitive / Unrated (reach 13 to win)
                  if (safeAlly === 12 && safeEnemy < 12) safeAlly = 13;
                  else if (safeEnemy === 12 && safeAlly < 12) safeEnemy = 13;
                  else if (safeAlly >= 12 && safeEnemy >= 12) {
                    if (safeAlly > safeEnemy && safeAlly - safeEnemy < 2) safeAlly = safeEnemy + 2;
                    else if (safeEnemy > safeAlly && safeEnemy - safeAlly < 2) safeEnemy = safeAlly + 2;
                  }
                }

                lastScoreRef.current.ally = safeAlly;
                lastScoreRef.current.enemy = safeEnemy;
                const finalMode = modeName.charAt(0).toUpperCase() + modeName.slice(1);
                const scoreStr = `${safeAlly} - ${safeEnemy}`;

                triggerWebhookEvent(
                  `Match concluded on **${mapName}** (**${finalMode}**). Final score: *${scoreStr}*`,
                  "match_concludes"
                );
              };

              // Query exact completed match details directly from Riot API (ensures true scores like 100-91 in TDM)
              invoke<{
                map_name: string;
                gamemode: string;
                score_ally: number;
                score_enemy: number;
                won: boolean;
              }>("get_latest_completed_match_score")
                .then((latest) => {
                  if (latest && (latest.score_ally > 0 || latest.score_enemy > 0)) {
                    dispatchConclude(
                      latest.score_ally,
                      latest.score_enemy,
                      latest.map_name && latest.map_name !== "-" ? latest.map_name : finalMap,
                      latest.gamemode && latest.gamemode !== "-" ? latest.gamemode : rawMode
                    );
                  } else {
                    dispatchConclude(allyFinal, enemyFinal, finalMap, rawMode);
                  }
                })
                .catch(() => {
                  dispatchConclude(allyFinal, enemyFinal, finalMap, rawMode);
                });

              // STOP SageBot when game concludes UNLESS Fully Auto Play is on
              if (!configRef.current.auto_derank_enabled) {
                if (runningRef.current) {
                  stopSagebot("Match concluded.");
                }
              } else {
                // Fully Auto Play is active
                addLog("[FULLY AUTO PLAY] Match concluded. Continuing queue pipeline...");

                // Check Target Rank (only if competitive)
                const qMode = (configRef.current.auto_queue_mode || "competitive").toLowerCase();
                if (qMode === "competitive") {
                  const targetRank = (configRef.current.auto_derank_target_rank || "").trim().toLowerCase();
                  if (targetRank && res.rank_name && res.rank_name !== "Unranked" && res.rank_name !== "-") {
                    if (res.rank_name.toLowerCase() === targetRank) {
                      stopSagebot(`Reached target rank (${res.rank_name}).`);
                      updateAndSaveConfig({ auto_derank_enabled: false });
                      addLog(`[FULLY AUTO PLAY] Reached target rank (${res.rank_name}). Fully Auto Play disabled.`);
                    }
                  }
                }
              }
            }
          } else {
            lobbyCountRef.current = 0;
          }

          // 2. Webhook Event State Transitions
          if (res.match_state === "In Queue") {
            if (prevMatchStateRef.current !== "In Queue") {
              prevMatchStateRef.current = "In Queue";
              const rawMode = (res.gamemode && res.gamemode !== "-" && res.gamemode !== "")
                ? res.gamemode
                : (configRef.current.auto_queue_mode || "competitive");
              const formattedMode = rawMode.toLowerCase() === "hurm" || rawMode.toLowerCase() === "team deathmatch"
                ? "Team Deathmatch"
                : rawMode.toLowerCase() === "spikerush" || rawMode.toLowerCase() === "spike rush"
                  ? "Spike Rush"
                  : rawMode.toLowerCase() === "deathmatch"
                    ? "Deathmatch"
                    : rawMode.toLowerCase() === "ggteam" || rawMode.toLowerCase() === "escalation"
                      ? "Escalation"
                      : rawMode.toLowerCase() === "competitive"
                        ? "Competitive"
                        : rawMode.charAt(0).toUpperCase() + rawMode.slice(1);
              triggerWebhookEvent(
                `Finding **${formattedMode}** Match...`,
                "queue"
              );
            }
          } else if (res.match_state === "Agent Select") {
            if (res.current_agent && res.current_agent !== "-") {
              lockedAgentRef.current = res.current_agent;
            }
            if (!hasSentAgentSelectWebhookRef.current && res.map_name && res.map_name !== "-") {
              hasSentAgentSelectWebhookRef.current = true;
              prevMatchStateRef.current = "Agent Select";
              triggerWebhookEvent(
                `Match found. Map: **${res.map_name}**`,
                "agent_select"
              );
            }
          } else if (res.match_state === "In Game" && isIngame) {
            hasSentAgentSelectWebhookRef.current = false;
            const activeAgent =
              res.current_agent && res.current_agent !== "-"
                ? res.current_agent
                : lockedAgentRef.current;

            const mapStr = res.map_name !== "-" ? res.map_name : (lastScoreRef.current.map !== "-" ? lastScoreRef.current.map : "Unknown Map");
            const gmRaw = res.gamemode !== "-" ? res.gamemode : (configRef.current.auto_queue_mode || "Competitive");
            const gmStr = gmRaw.charAt(0).toUpperCase() + gmRaw.slice(1);
            const matchKey = `${mapStr}_${activeAgent}_${gmStr}`;

            if (!hasSentMatchStartWebhookRef.current && lastSentMatchStartKeyRef.current !== matchKey && activeAgent && activeAgent !== "-") {
              hasSentMatchStartWebhookRef.current = true;
              lastSentMatchStartKeyRef.current = matchKey;
              prevMatchStateRef.current = "In Game";
              triggerWebhookEvent(
                `Playing as **${activeAgent}** on **${mapStr}** (**${gmStr}**)`,
                "match_start"
              );
            }
          } else {
            prevMatchStateRef.current = res.match_state;
            if (isLobby) {
              hasSentAgentSelectWebhookRef.current = false;
              lastSentMatchStartKeyRef.current = "";
              lockedAgentRef.current = "";
            }
          }

          const isDisconnected = !res.is_connected || !res.game_live;
          if (isDisconnected) {
            disconnectCountRef.current += 1;
            // When disconnected, game is no longer in a match lobby - prevent false concluded trigger
            wasInMatchRef.current = false;
            lobbyCountRef.current = 0;
            if (disconnectCountRef.current < 4 && wasGameReadyRef.current) {
              return;
            }
            if (devBypassRef.current) {
              return;
            }
            // VALORANT is not running or lockfiles lost
            if (wasGameReadyRef.current) {
              wasGameReadyRef.current = false;
              suppressDetectionUntilRef.current = Date.now() + 10000;
              if (runningRef.current) {
                stopSagebot("VALORANT closed.");
              }
              triggerWebhookEvent(
                "VALORANT disconnected.",
                "disconnect"
              );
            }
          } else {
            disconnectCountRef.current = 0;
            wasGameReadyRef.current = true;

            // Auto Matchmaking Queue (Active when auto_queue_enabled OR auto_derank_enabled)
            if (
              runningRef.current &&
              (configRef.current.auto_queue_enabled || configRef.current.auto_derank_enabled)
            ) {
              if (res.match_state === "In Queue") {
                isQueueingRef.current = true;
              } else if (isLobby) {
                if (!isQueueingRef.current && Date.now() - lastQueueTimeRef.current > 10000) {
                  lastQueueTimeRef.current = Date.now();
                  const targetMode = configRef.current.auto_queue_mode || "competitive";
                  invoke<boolean>("start_matchmaking_queue", { queue_mode: targetMode, queueMode: targetMode })
                    .then((ok) => {
                      if (ok) {
                        isQueueingRef.current = true;
                        addLog(`[MATCHMAKING] In Queue for ${targetMode}.`);
                      }
                    })
                    .catch((err) => {
                      addLog(`[MATCHMAKING] ${err}`);
                    });
                }
              } else if (res.match_state === "Agent Select" || res.match_state === "In Game") {
                isQueueingRef.current = false;
              }
            }

            // In-match: round tracking & Auto Vote / Surrender (strictly only when live in game with agent)
            if (runningRef.current && isIngame) {
              const sum = res.score_ally + res.score_enemy;
              if (sum !== lastScoreSumRef.current) {
                lastScoreSumRef.current = sum;
                const currentRound = sum + 1;
                roundStartTimestampRef.current = Date.now();

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
                    surrenderSpamUntilRef.current = Date.now() + 10000;
                    addLog(`[AUTO SURRENDER] Round ${currentRound} detected. Spamming /ff for 10s.`);
                  }
                }
              }
            } else {
              lastScoreSumRef.current = -1;
              roundStartTimestampRef.current = 0;
            }
          }
        })
        .catch(() => {
          if (devBypassRef.current) {
            return;
          }
          if (wasGameReadyRef.current) {
            wasInMatchRef.current = false;
            lobbyCountRef.current = 0;
            wasGameReadyRef.current = false;
            suppressDetectionUntilRef.current = Date.now() + 10000;
            if (runningRef.current) {
              stopSagebot("VALORANT closed.");
            }
            triggerWebhookEvent(
              "VALORANT disconnected.",
              "disconnect"
            );
          }
        })
        .finally(() => {
          isPollingRef.current = false;
          scheduleNextPoll();
        });
    };
    pollStatus();
    return () => {
      isCancelled = true;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [gatePassed]);

  // Listen for Global Hotkey (F9 / bound hotkey) via native Rust listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isToggling = false;

    listen("global-hotkey-press", () => {
      if (isRebindingMain || isRebindingAfk || isToggling) return;
      isToggling = true;
      if (runningRef.current) {
        stopSagebot();
      } else {
        startSagebot();
      }
      setTimeout(() => {
        isToggling = false;
      }, 350);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [isRebindingMain, isRebindingAfk]);

  // Live Match Tracker initial fetch if empty when switching to tracker tab
  useEffect(() => {
    if (activeTab === "tracker" && !roster) {
      fetchRoster();
    }
  }, [activeTab]);

  // Live Storefront countdown ticker (disabled in Low Detail mode or when not viewing shop)
  useEffect(() => {
    if (!storefront || config.low_detail || activeTab !== "shop") return;
    const ticker = setInterval(() => {
      setStorefront((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          daily_seconds_remaining: Math.max(0, prev.daily_seconds_remaining - 1),
          night_market_seconds_remaining: Math.max(0, prev.night_market_seconds_remaining - 1),
          accessory_seconds_remaining: Math.max(0, prev.accessory_seconds_remaining - 1),
          featured_bundles: prev.featured_bundles.map((b) => ({
            ...b,
            seconds_remaining: Math.max(0, b.seconds_remaining - 1),
          })),
        };
      });
    }, 1000);
    return () => clearInterval(ticker);
  }, [Boolean(storefront), config.low_detail, activeTab]);

  // Live Match Tracker startup trigger: runs once when game gate passes or VALORANT connects
  useEffect(() => {
    if (gatePassed && !hasDoneInitialTrackerFetchRef.current) {
      hasDoneInitialTrackerFetchRef.current = true;
      fetchRoster();
    }
  }, [gatePassed]);

  // Keyboard capture for rebinding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRebindingMain && !isRebindingAfk && !isRebindingComms) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setIsRebindingMain(false);
        setIsRebindingAfk(false);
        setIsRebindingComms(false);
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
      } else if (isRebindingComms) {
        if (keyName === configRef.current.hotkey) {
          addLog(
            "[CONFIG] Key conflicts with Start/Stop hotkey. Choose another key."
          );
          setIsRebindingComms(false);
          return;
        }
        const updated = { ...configRef.current, comms_hotkey: keyName };
        setConfig(updated);
        invoke("save_config", { newConfig: updated });
        addLog(`[CONFIG] Comms hotkey set to: ${keyName}`);
        setIsRebindingComms(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRebindingMain, isRebindingAfk, isRebindingComms]);

  // Save config helper
  const updateAndSaveConfig = (partial: Partial<AppConfig>) => {
    const updated = { ...config, ...partial };
    // Track previous values before auto_derank was activated
    if (!updated.auto_derank_enabled) {
      if (
        partial.auto_queue_enabled !== undefined ||
        partial.auto_focus_game !== undefined
      ) {
        preAutoDerankStateRef.current = {
          auto_queue_enabled: updated.auto_queue_enabled,
          auto_focus_game: !!updated.auto_focus_game,
        };
      }
    }
    setConfig(updated);
    invoke("save_config", { newConfig: updated }).catch((err) =>
      console.error("Failed to save config:", err)
    );
  };

  // Macro Recording Effect
  useEffect(() => {
    if (!isRecordingMacro) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Enter stops recording automatically and saves (Enter is strictly never recorded)
      if (e.key === "Enter") {
        stopRecordingMacro();
        return;
      }

      // Backspace deletes the newest recorded key
      if (e.key === "Backspace") {
        if (recordedActionsRef.current.length > 0) {
          recordedActionsRef.current.pop();
          setMacroLiveActions([...recordedActionsRef.current]);
        }
        return;
      }

      // Ignore OS auto-repeat events while key is held down
      if (e.repeat) return;

      let keyName = e.key;
      if (e.code === "Space") keyName = "Space";
      else if (e.code === "Tab") keyName = "Tab";
      else if (e.key.length === 1) keyName = e.key.toUpperCase();
      else if (e.code.startsWith("Key")) keyName = e.code.replace("Key", "").toUpperCase();
      else if (e.code.startsWith("Digit")) keyName = e.code.replace("Digit", "");
      else keyName = e.key;

      const now = Date.now();
      activeKeysDownRef.current.set(keyName, now);
      setActiveHoldingKeys(Array.from(activeKeysDownRef.current.keys()));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Enter" || e.key === "Backspace") return;

      let keyName = e.key;
      if (e.code === "Space") keyName = "Space";
      else if (e.code === "Tab") keyName = "Tab";
      else if (e.key.length === 1) keyName = e.key.toUpperCase();
      else if (e.code.startsWith("Key")) keyName = e.code.replace("Key", "").toUpperCase();
      else if (e.code.startsWith("Digit")) keyName = e.code.replace("Digit", "");
      else keyName = e.key;

      if (activeKeysDownRef.current.has(keyName)) {
        const pressTime = activeKeysDownRef.current.get(keyName)!;
        const now = Date.now();
        const startRaw = pressTime - macroRecordStartRef.current;
        const durRaw = now - pressTime;

        // OCD-friendly: clean snapping to 50ms intervals
        const start_ms = Math.round(startRaw / 50) * 50;
        const duration_ms = Math.max(50, Math.round(durRaw / 50) * 50);

        const newAction = { key: keyName, start_ms, duration_ms };
        recordedActionsRef.current.push(newAction);
        setMacroLiveActions([...recordedActionsRef.current]);

        activeKeysDownRef.current.delete(keyName);
        setActiveHoldingKeys(Array.from(activeKeysDownRef.current.keys()));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecordingMacro]);

  const startRecordingMacro = () => {
    macroRecordStartRef.current = Date.now();
    activeKeysDownRef.current.clear();
    recordedActionsRef.current = [];
    setMacroLiveActions([]);
    setActiveHoldingKeys([]);
    setIsRecordingMacro(true);
  };

  const stopRecordingMacro = () => {
    setIsRecordingMacro(false);
    const now = Date.now();
    // Finalize any keys that are still being held down at the moment of stop
    activeKeysDownRef.current.forEach((pressTime, keyName) => {
      const start_ms = Math.round((pressTime - macroRecordStartRef.current) / 50) * 50;
      const duration_ms = Math.max(50, Math.round((now - pressTime) / 50) * 50);
      recordedActionsRef.current.push({ key: keyName, start_ms, duration_ms });
    });
    activeKeysDownRef.current.clear();
    setActiveHoldingKeys([]);

    // Calculate total loop duration
    const actions = [...recordedActionsRef.current];
    let maxEnd = 0;
    actions.forEach((a) => {
      if (a.start_ms + a.duration_ms > maxEnd) {
        maxEnd = a.start_ms + a.duration_ms;
      }
    });
    const totalRaw = now - macroRecordStartRef.current;
    const total_loop_ms = Math.max(maxEnd, Math.round(totalRaw / 50) * 50);

    const macroData = {
      total_loop_ms: Math.max(total_loop_ms, 500),
      actions,
    };
    const jsonStr = JSON.stringify(macroData, null, 2);
    updateAndSaveConfig({ custom_macro_json: jsonStr });
    setMacroLiveActions(actions);
    addLog(`[CONFIG] Macro saved (${actions.length} action${actions.length === 1 ? "" : "s"}, loop: ${(macroData.total_loop_ms / 1000).toFixed(2)}s).`);
  };

  const clearMacro = () => {
    recordedActionsRef.current = [];
    setMacroLiveActions([]);
    setActiveHoldingKeys([]);
    updateAndSaveConfig({ custom_macro_json: "" });
    addLog("[CONFIG] Custom macro cleared.");
  };

  const exportMacro = () => {
    let jsonStr = config.custom_macro_json;
    if (!jsonStr) {
      jsonStr = JSON.stringify({ total_loop_ms: 0, actions: [] }, null, 2);
    }
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast("Copied to clipboard.");
    });
  };

  const handleValidateAndApplyMacro = () => {
    setMacroCompilerError(null);
    const raw = macroImportText.trim();
    if (!raw) {
      setMacroCompilerError("[CompilerError] Cannot import empty macro JSON.");
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      const msg = e.message || "Invalid JSON format";
      let lineNum = 1;
      let colNum = 1;
      const match = msg.match(/at position (\d+)/) || msg.match(/line (\d+) column (\d+)/);
      if (match && match.length === 3) {
        lineNum = parseInt(match[1]);
        colNum = parseInt(match[2]);
      } else if (match && match.length === 2) {
        const pos = parseInt(match[1]);
        const lines = raw.substring(0, pos).split("\n");
        lineNum = lines.length;
        colNum = lines[lines.length - 1].length + 1;
      }
      const rawLines = raw.split("\n");
      const errLine = rawLines[lineNum - 1] || "";
      const pointer = " ".repeat(Math.max(0, colNum - 1)) + "^";

      const formatted = `[SyntaxError] ${msg} (line ${lineNum}, col ${colNum})\n\n  ${lineNum} | ${errLine}\n    | ${pointer}\n\nHint: Verify that keys and strings use double quotes and there are no trailing commas.`;
      setMacroCompilerError(formatted);
      return;
    }

    const actions: any[] = Array.isArray(parsed) ? parsed : parsed.actions;
    if (!Array.isArray(actions)) {
      setMacroCompilerError(`[ValidationError] Root JSON must contain an "actions" array or be an array of actions.\n\nReceived: ${typeof parsed}\nExpected: { "total_loop_ms": 3000, "actions": [ ... ] }`);
      return;
    }

    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (typeof a !== "object" || a === null) {
        setMacroCompilerError(`[ValidationError] Action #${i + 1} must be an object { "key": string, "start_ms": number, "duration_ms": number }`);
        return;
      }
      if (typeof a.key !== "string" || !a.key.trim()) {
        setMacroCompilerError(`[ValidationError] Action #${i + 1} is missing a valid string property "key".\n\nSnippet: ${JSON.stringify(a)}`);
        return;
      }
      if (typeof a.start_ms !== "number" || isNaN(a.start_ms) || a.start_ms < 0) {
        setMacroCompilerError(`[ValidationError] Action #${i + 1} ("${a.key}") must have "start_ms" as a positive integer (e.g. 0, 500).\n\nSnippet: ${JSON.stringify(a)}`);
        return;
      }
      if (typeof a.duration_ms !== "number" || isNaN(a.duration_ms) || a.duration_ms <= 0) {
        setMacroCompilerError(`[ValidationError] Action #${i + 1} ("${a.key}") must have "duration_ms" as a positive integer in milliseconds (minimum 50ms).\n\nSnippet: ${JSON.stringify(a)}`);
        return;
      }
    }

    const cleanActions = actions.map((a) => ({
      key: a.key.trim(),
      start_ms: Math.round(a.start_ms / 50) * 50,
      duration_ms: Math.max(50, Math.round(a.duration_ms / 50) * 50),
    }));

    let maxEnd = 0;
    cleanActions.forEach((a) => {
      if (a.start_ms + a.duration_ms > maxEnd) maxEnd = a.start_ms + a.duration_ms;
    });

    const total_loop_ms = typeof parsed.total_loop_ms === "number" && parsed.total_loop_ms >= maxEnd
      ? Math.round(parsed.total_loop_ms / 50) * 50
      : maxEnd;

    const finalObj = { total_loop_ms, actions: cleanActions };
    const savedJson = JSON.stringify(finalObj, null, 2);

    updateAndSaveConfig({ custom_macro_json: savedJson });
    setMacroLiveActions(cleanActions);
    setShowMacroImportModal(false);
    showToast("Macro imported successfully.");
    addLog(`[CONFIG] Imported custom macro (${cleanActions.length} actions, loop: ${(total_loop_ms / 1000).toFixed(2)}s).`);
  };

  // Start / Stop SageBot Logic
  const startSagebot = (fromRemote = false) => {
    if (runningRef.current) return;

    // If VALORANT is not detected, popup modal asking if user wants to launch it
    const isDetected = devBypassRef.current || statusRef.current.game_live || statusRef.current.is_connected;
    if (!isDetected) {
      invoke<boolean>("is_riot_signed_in")
        .then((signedIn) => {
          setIsRiotSignedIn(Boolean(signedIn));
          setShowLaunchModal(true);
        })
        .catch(() => {
          setIsRiotSignedIn(false);
          setShowLaunchModal(true);
        });
      return;
    }

    runningRef.current = true;
    botStartTimeRef.current = Date.now();
    setLogs(["Logs cleared.", "SageBot started."]);
    setIsRunning(true);
    invoke("set_bot_running", { running: true }).catch(() => { });

    // Mandatory Auto Focus handling on start if already in match
    const st = statusRef.current;
    const isIngame =
      devBypassRef.current ||
      ((st.is_game_ready || st.game_live) && st.match_state === "In Game");
    if (isIngame) {
      invoke("focus_valorant_window").catch(() => { });
      hasFocusedCurrentMatchRef.current = true;
      invoke("set_ingame_focus_state", { inGameWithAgent: true, autoFocus: true }).catch(() => { });
    }

    if (!fromRemote) {
      triggerWebhookEvent(
        "SageBot started.",
        "bot_status"
      );
    }
  };

  const stopSagebot = (reason?: string, fromRemote = false) => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setIsRunning(false);
    invoke("set_bot_running", { running: false }).catch(() => { });
    invoke("set_ingame_focus_state", { inGameWithAgent: false, autoFocus: false }).catch(() => { });
    const key = configRef.current.anti_afk_key || "Tab";
    invoke("trigger_key_up", { key });
    isHoldingKeyRef.current = false;
    hasFocusedCurrentMatchRef.current = false;
    isQueueingRef.current = false;
    hasLoggedClickAfkRef.current = false;
    hasLoggedCommsRef.current = false;
    hasLoggedChatRef.current = false;
    hasSentAgentSelectWebhookRef.current = false;

    // Clear macro timeouts and release active keys
    macroScheduledTimeoutsRef.current.forEach(t => clearTimeout(t));
    macroScheduledTimeoutsRef.current = [];
    macroActiveDownKeysRef.current.forEach(k => {
      invoke("trigger_key_up", { key: k }).catch(() => { });
    });
    macroActiveDownKeysRef.current.clear();

    // Keep hasSentMatchStartWebhookRef and lastSentMatchStartKeyRef across stops/starts during the same game
    roundStartTimestampRef.current = 0;
    lastScoreSumRef.current = -1;
    surrenderSpamUntilRef.current = 0;
    isActionBusyRef.current = false;
    addLog(reason ? `[SYSTEM] Stopped: ${reason}` : "Stopped SageBot");

    if (!fromRemote) {
      triggerWebhookEvent(
        "SageBot stopped.",
        "bot_status"
      );
    }
  };

  // Listen for remote bot start/stop toggles from Discord commands
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    listen<{ running: boolean }>("bot-remote-toggle", (event) => {
      if (event.payload.running) {
        if (!runningRef.current) {
          startSagebot(true);
        }
      } else {
        if (runningRef.current) {
          stopSagebot("Discord Command", true);
        }
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Active Auto Surrender spammer loop (spams /ff for 10s since designated round detected, using 900ms - 1300ms randomized interval)
  useEffect(() => {
    if (!isRunning) return;
    let timer: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const tickFf = async () => {
      if (isCancelled || !runningRef.current) return;
      const currentSt = statusRef.current;
      const isIngameWithAgent =
        (currentSt.is_game_ready || currentSt.game_live) &&
        currentSt.match_state === "In Game" &&
        Boolean(currentSt.current_agent) &&
        currentSt.current_agent !== "-";

      const randomDelay = 900 + Math.floor(Math.random() * 401); // 900ms - 1300ms

      if (!isIngameWithAgent || !configRef.current.auto_ff_enabled || surrenderSpamUntilRef.current === 0) {
        timer = setTimeout(tickFf, randomDelay);
        return;
      }

      if (Date.now() > surrenderSpamUntilRef.current) {
        surrenderSpamUntilRef.current = 0;
        addLog("[AUTO SURRENDER] Surrender spam window completed (10s). Anti-AFK resumed.");
        timer = setTimeout(tickFf, randomDelay);
        return;
      }

      const isFocused = await invoke<boolean>("check_valorant_focused").catch(() => false);
      if (!isFocused) {
        timer = setTimeout(tickFf, randomDelay);
        return;
      }

      // Ensure any held key from Anti-AFK is released before typing /ff to prevent input collapse
      const key = configRef.current.anti_afk_key || "Tab";
      if (isHoldingKeyRef.current) {
        invoke("trigger_key_up", { key }).catch(() => { });
        isHoldingKeyRef.current = false;
      }

      if (tryAcquireActionLock()) {
        invoke("trigger_chat_send", { channel: 0, text: "/ff" })
          .catch(() => { })
          .finally(() => releaseActionLock(450));
      }

      timer = setTimeout(tickFf, randomDelay);
    };

    timer = setTimeout(tickFf, 900 + Math.floor(Math.random() * 401));
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isRunning, config.auto_ff_enabled, config.auto_focus_game]);

  // Active Auto Vote spammer loop (spams F5 or F6 for the first 10s of each round, using 900ms - 1300ms randomized interval)
  useEffect(() => {
    if (!isRunning) return;
    let timer: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const tickVote = async () => {
      if (isCancelled || !runningRef.current) return;
      const currentSt = statusRef.current;
      const isIngameWithAgent =
        (currentSt.is_game_ready || currentSt.game_live) &&
        currentSt.match_state === "In Game" &&
        Boolean(currentSt.current_agent) &&
        currentSt.current_agent !== "-";

      const randomDelay = 900 + Math.floor(Math.random() * 401); // 900ms - 1300ms

      if (!isIngameWithAgent || roundStartTimestampRef.current === 0) {
        timer = setTimeout(tickVote, randomDelay);
        return;
      }

      // Yield to Auto Surrender if currently spamming /ff
      if (surrenderSpamUntilRef.current > Date.now()) {
        timer = setTimeout(tickVote, 300);
        return;
      }

      const elapsed = Date.now() - roundStartTimestampRef.current;
      if (elapsed > 10000) {
        timer = setTimeout(tickVote, randomDelay);
        return;
      }

      const isFocused = await invoke<boolean>("check_valorant_focused").catch(() => false);
      if (!isFocused) {
        timer = setTimeout(tickVote, randomDelay);
        return;
      }

      executeVote();

      function executeVote() {
        if (!tryAcquireActionLock()) return;
        const isOvertime = lastScoreRef.current.ally >= 12 && lastScoreRef.current.enemy >= 12;
        if (isOvertime) {
          if (configRef.current.auto_overtime_vote_mode === 1) {
            invoke("trigger_vote", { voteYes: true }).catch(() => { }).finally(() => releaseActionLock(150));
          } else if (configRef.current.auto_overtime_vote_mode === 2) {
            invoke("trigger_vote", { voteYes: false }).catch(() => { }).finally(() => releaseActionLock(150));
          } else {
            releaseActionLock(0);
          }
        } else {
          if (configRef.current.auto_vote_mode === 1) {
            invoke("trigger_vote", { voteYes: true }).catch(() => { }).finally(() => releaseActionLock(150));
          } else if (configRef.current.auto_vote_mode === 2) {
            invoke("trigger_vote", { voteYes: false }).catch(() => { }).finally(() => releaseActionLock(150));
          } else {
            releaseActionLock(0);
          }
        }
      }

      timer = setTimeout(tickVote, randomDelay);
    };

    timer = setTimeout(tickVote, 900 + Math.floor(Math.random() * 401));
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isRunning, config.auto_vote_mode, config.auto_overtime_vote_mode, config.auto_focus_game]);

  // Active anti-AFK spammer loop (Click Mode 0 and Hold Mode 1)
  useEffect(() => {
    if (!isRunning || (config.anti_afk_mode !== 0 && config.anti_afk_mode !== 1)) return;

    const isHoldMode = config.anti_afk_mode === 1;
    const isSlow = config.anti_afk_slow_mode;
    const key = config.anti_afk_key || "Tab";

    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!runningRef.current) return;

      const currentSt = statusRef.current;
      const isIngame =
        devBypassRef.current ||
        ((currentSt.is_game_ready || currentSt.game_live) &&
          currentSt.match_state === "In Game");

      // Strictly gate by in-game state: ALL actions only run in-game
      if (!isIngame) {
        if (isHoldingKeyRef.current) {
          invoke("trigger_key_up", { key }).catch(() => { });
          isHoldingKeyRef.current = false;
        }
        hasLoggedClickAfkRef.current = false;
        hasLoggedCommsRef.current = false;
        hasLoggedChatRef.current = false;
        timer = setTimeout(tick, 1000);
        return;
      }

      // Strictly pause Anti-AFK and release held keys while Auto Surrender is actively spamming /ff
      if (surrenderSpamUntilRef.current > Date.now()) {
        if (isHoldingKeyRef.current) {
          invoke("trigger_key_up", { key }).catch(() => { });
          isHoldingKeyRef.current = false;
        }
        timer = setTimeout(tick, 400);
        return;
      }

      const isFocused = await invoke<boolean>("check_valorant_focused").catch(() => false);
      if (!isFocused) {
        if (isHoldingKeyRef.current) {
          invoke("trigger_key_up", { key }).catch(() => { });
          isHoldingKeyRef.current = false;
        }
        timer = setTimeout(tick, 1000);
        return;
      }

      const executeAction = () => {
        if (!runningRef.current) return;

        // If an action (comms, vote, chat, /ff) is currently running, do not overlap
        if (isActionBusyRef.current) {
          timer = setTimeout(tick, 200);
          return;
        }

        // Hold Mode: ensure key is held down
        if (isHoldMode) {
          if (!isHoldingKeyRef.current) {
            invoke("trigger_key_down", { key }).catch(() => { });
            isHoldingKeyRef.current = true;
            addLog(`[ANTI-AFK] Anti-AFK Hold Mode on (${key}).`);
          }
        }

        // Click Mode Action (Only if mode is 0)
        if (config.anti_afk_mode === 0) {
          if (!hasLoggedClickAfkRef.current) {
            hasLoggedClickAfkRef.current = true;
            addLog(`[ANTI-AFK] Anti-AFK Click Mode on (${key}).`);
          }
          invoke("trigger_key_press", { key }).catch((err) => {
            addLog(`[ANTI-AFK] Click action error: ${err}`);
          });
        }

        // Schedule next tick
        let nextDelay: number;
        if (isHoldMode) {
          nextDelay = 500;
        } else {
          if (isSlow) {
            nextDelay = 3700 + Math.floor(Math.random() * 500); // 3.7s - 4.2s
          } else {
            nextDelay = 900 + Math.floor(Math.random() * 400); // 900ms - 1300ms
          }
        }

        timer = setTimeout(tick, nextDelay);
      };

      executeAction();
    };

    const initialDelay = isHoldMode ? 500 : isSlow ? 3800 : 1000;
    timer = setTimeout(tick, initialDelay);

    return () => {
      clearTimeout(timer);
      if (isHoldingKeyRef.current) {
        invoke("trigger_key_up", { key }).catch(() => { });
        isHoldingKeyRef.current = false;
      }
    };
  }, [
    isRunning,
    config.anti_afk_mode,
    config.anti_afk_key,
    config.anti_afk_slow_mode,
    config.auto_focus_game,
  ]);

  // Active Chat Spam loop (Independent of Anti-AFK mode, coordinated via action lock)
  useEffect(() => {
    if (!isRunning || !config.chat_enabled || !config.chat_text.trim()) return;

    let timer: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const tickChat = async () => {
      if (isCancelled || !runningRef.current) return;
      const currentSt = statusRef.current;
      const isIngame =
        devBypassRef.current ||
        ((currentSt.is_game_ready || currentSt.game_live) &&
          currentSt.match_state === "In Game");

      const intervalMs = Math.max(config.chat_interval || 3, 3) * 1000;

      if (!isIngame) {
        timer = setTimeout(tickChat, 1000);
        return;
      }

      // Yield to Auto Surrender if currently spamming /ff
      if (surrenderSpamUntilRef.current > Date.now()) {
        timer = setTimeout(tickChat, 500);
        return;
      }

      const isFocused = await invoke<boolean>("check_valorant_focused").catch(() => false);
      if (!isFocused) {
        timer = setTimeout(tickChat, 1000);
        return;
      }

      // Mutual exclusion lock: do not fire if another action (comms, vote, /ff) is running
      if (!tryAcquireActionLock()) {
        timer = setTimeout(tickChat, 300);
        return;
      }

      // If hold mode is active, release held key before chatting
      const isHoldMode = config.anti_afk_mode === 1;
      const key = config.anti_afk_key || "Tab";
      if (isHoldMode && isHoldingKeyRef.current) {
        invoke("trigger_key_up", { key });
      }

      invoke("trigger_chat_send", {
        channel: config.chat_target,
        text: config.chat_text,
      })
        .catch(() => { })
        .finally(() => {
          if (isHoldMode && isHoldingKeyRef.current) {
            setTimeout(() => {
              if (runningRef.current && isHoldingKeyRef.current) {
                invoke("trigger_key_down", { key });
              }
            }, 100);
          }
          releaseActionLock(450);
        });

      if (!hasLoggedChatRef.current) {
        hasLoggedChatRef.current = true;
        addLog(`[CHAT] Auto chat active (${config.chat_target === 0 ? "All" : config.chat_target === 1 ? "Team" : "Party"})`);
      }
      timer = setTimeout(tickChat, intervalMs);
    };

    const initialDelay = Math.max(config.chat_interval || 3, 3) * 1000;
    timer = setTimeout(tickChat, initialDelay);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    isRunning,
    config.chat_enabled,
    config.chat_target,
    config.chat_interval,
    config.chat_text,
    config.anti_afk_mode,
    config.anti_afk_key,
    config.auto_focus_game,
  ]);

  // Active Comms Mode spammer loop (Mode 2)
  useEffect(() => {
    if (!isRunning || config.anti_afk_mode !== 2) return;

    let timer: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const tickComms = async () => {
      if (isCancelled || !runningRef.current) return;
      const currentSt = statusRef.current;
      const isIngame =
        devBypassRef.current ||
        ((currentSt.is_game_ready || currentSt.game_live) &&
          currentSt.match_state === "In Game");

      if (!isIngame) {
        timer = setTimeout(tickComms, 1000);
        return;
      }

      // Yield to Auto Surrender if currently spamming /ff
      if (surrenderSpamUntilRef.current > Date.now()) {
        timer = setTimeout(tickComms, 500);
        return;
      }

      const isFocused = await invoke<boolean>("check_valorant_focused").catch(() => false);
      if (!isFocused) {
        timer = setTimeout(tickComms, 1000);
        return;
      }

      // Mutual exclusion lock: do not fire if another action (vote/chat/etc.) is running
      if (!tryAcquireActionLock()) {
        timer = setTimeout(tickComms, 250);
        return;
      }

      const commsHotkey = config.comms_hotkey || ".";
      let firstNum = config.comms_first_num || 3;
      if (config.comms_random) {
        firstNum = Math.floor(Math.random() * 4) + 1; // 1 to 4
      }
      const maxSecond = (firstNum === 1 || firstNum === 2) ? 5 : (firstNum === 3) ? 6 : 4;
      let secondNum = config.comms_second_num || 6;
      if (config.comms_random) {
        secondNum = Math.floor(Math.random() * maxSecond) + 1;
      } else {
        secondNum = Math.min(Math.max(secondNum, 1), maxSecond);
      }

      const catObj = COMMS_CATEGORIES.find((c) => c.id === firstNum);
      const optObj = catObj?.options.find((o) => o.id === secondNum);
      const catName = catObj ? catObj.name : `Category ${firstNum}`;
      const optName = optObj ? optObj.text : `Option ${secondNum}`;

      if (!hasLoggedCommsRef.current) {
        hasLoggedCommsRef.current = true;
        addLog(`[COMMS] Speaking: "${catName} > ${optName}" (${commsHotkey} -> ${firstNum} -> ${secondNum})`);
      }

      // 3 Steps executed via native thread in Rust with minimal delay
      invoke("trigger_comms_sequence", {
        hotkey: commsHotkey,
        firstNum,
        secondNum,
      }).catch((err) => {
        addLog(`[COMMS] Error executing comms sequence: ${err}`);
      }).finally(() => {
        releaseActionLock(200);
      });

      const delayMs = Math.max(config.comms_delay || 3, 3) * 1000;
      timer = setTimeout(tickComms, delayMs);
    };

    // First comms call triggers 1.5s after bot starts
    const initialDelay = 1500;
    timer = setTimeout(tickComms, initialDelay);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    isRunning,
    config.anti_afk_mode,
    config.comms_hotkey,
    config.comms_first_num,
    config.comms_second_num,
    config.comms_random,
    config.comms_delay,
    config.auto_focus_game,
  ]);

  // Active Macros Mode playback loop (Mode 3)
  useEffect(() => {
    if (!isRunning || config.anti_afk_mode !== 3) {
      macroScheduledTimeoutsRef.current.forEach((t) => clearTimeout(t));
      macroScheduledTimeoutsRef.current = [];
      macroActiveDownKeysRef.current.forEach((k) => {
        invoke("trigger_key_up", { key: k }).catch(() => { });
      });
      macroActiveDownKeysRef.current.clear();
      return;
    }

    let parsed: MacroData | null = null;
    try {
      if (config.custom_macro_json) {
        parsed = JSON.parse(config.custom_macro_json);
      }
    } catch (_) { }

    if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      return;
    }

    const macroData = parsed;
    let isCancelled = false;

    const scheduleCycle = async () => {
      if (isCancelled || !runningRef.current) return;
      const currentSt = statusRef.current;
      const isIngame =
        devBypassRef.current ||
        ((currentSt.is_game_ready || currentSt.game_live) &&
          currentSt.match_state === "In Game");

      if (!isIngame) {
        macroActiveDownKeysRef.current.forEach((k) => {
          invoke("trigger_key_up", { key: k }).catch(() => { });
        });
        macroActiveDownKeysRef.current.clear();
        const t = setTimeout(scheduleCycle, 1000);
        macroScheduledTimeoutsRef.current.push(t);
        return;
      }

      // Yield to Auto Surrender and release keys if currently spamming /ff
      if (surrenderSpamUntilRef.current > Date.now()) {
        macroActiveDownKeysRef.current.forEach((k) => {
          invoke("trigger_key_up", { key: k }).catch(() => { });
        });
        macroActiveDownKeysRef.current.clear();
        const t = setTimeout(scheduleCycle, 500);
        macroScheduledTimeoutsRef.current.push(t);
        return;
      }

      const isFocused = await invoke<boolean>("check_valorant_focused").catch(() => false);
      if (!isFocused) {
        macroActiveDownKeysRef.current.forEach((k) => {
          invoke("trigger_key_up", { key: k }).catch(() => { });
        });
        macroActiveDownKeysRef.current.clear();
        const t = setTimeout(scheduleCycle, 1000);
        macroScheduledTimeoutsRef.current.push(t);
        return;
      }

      const loopDuration = Math.max(macroData.total_loop_ms || 1000, 500);

      macroData.actions.forEach((act) => {
        const tDown = setTimeout(() => {
          if (isCancelled || !runningRef.current) return;
          invoke("trigger_key_down", { key: act.key }).catch(() => { });
          macroActiveDownKeysRef.current.add(act.key);
        }, act.start_ms);
        macroScheduledTimeoutsRef.current.push(tDown);

        const tUp = setTimeout(() => {
          invoke("trigger_key_up", { key: act.key }).catch(() => { });
          macroActiveDownKeysRef.current.delete(act.key);
        }, act.start_ms + act.duration_ms);
        macroScheduledTimeoutsRef.current.push(tUp);
      });

      const tLoop = setTimeout(() => {
        macroActiveDownKeysRef.current.forEach((k) => {
          invoke("trigger_key_up", { key: k }).catch(() => { });
        });
        macroActiveDownKeysRef.current.clear();
        scheduleCycle();
      }, loopDuration);
      macroScheduledTimeoutsRef.current.push(tLoop);
    };

    scheduleCycle();

    return () => {
      isCancelled = true;
      macroScheduledTimeoutsRef.current.forEach((t) => clearTimeout(t));
      macroScheduledTimeoutsRef.current = [];
      macroActiveDownKeysRef.current.forEach((k) => {
        invoke("trigger_key_up", { key: k }).catch(() => { });
      });
      macroActiveDownKeysRef.current.clear();
    };
  }, [isRunning, config.anti_afk_mode, config.custom_macro_json]);

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

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && isFinite(val)) {
      setMusicCurrentTime(val);
      musicCurrentTimeRef.current = val;
    }
  };

  const handleSeekCommit = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget as HTMLInputElement;
    const raw = parseFloat(target.value);
    const val = !isNaN(raw) && isFinite(raw) ? raw : musicCurrentTimeRef.current;
    if (!isNaN(val) && isFinite(val)) {
      setMusicCurrentTime(val);
      musicCurrentTimeRef.current = val;
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = val;
        } catch { }
      }
    }
    isDraggingMusicRef.current = false;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    const vol = isNaN(raw) ? 0 : Math.max(0, Math.min(100, raw));
    updateAndSaveConfig({ music_volume: vol });
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingMusicRef.current) {
        if (audioRef.current && !isNaN(musicCurrentTimeRef.current) && isFinite(musicCurrentTimeRef.current)) {
          try {
            audioRef.current.currentTime = musicCurrentTimeRef.current;
          } catch { }
        }
        isDraggingMusicRef.current = false;
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchend", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalMouseUp);
    };
  }, []);

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
    const hasAny = updated.length > 0;
    updateAndSaveConfig({ selected_agents: updated, agents_enabled: hasAny });
  };

  const clearAgents = () => {
    updateAndSaveConfig({ selected_agents: [], agents_enabled: false });
  };

  const moveAgent = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const cur = [...configRef.current.selected_agents];
    if (fromIdx >= cur.length || toIdx >= cur.length) return;
    const [moved] = cur.splice(fromIdx, 1);
    cur.splice(toIdx, 0, moved);
    updateAndSaveConfig({ selected_agents: cur });
  };

  useLayoutEffect(() => {
    const prevTops = prevQueueTopsRef.current;
    const currentTops = new Map<string, number>();

    queueItemRefs.current.forEach((el, id) => {
      if (el) {
        currentTops.set(id, el.offsetTop);
      }
    });

    queueItemRefs.current.forEach((el, id) => {
      if (!el) return;
      // Skip the currently dragged element so it directly tracks cursor without FLIP interference
      if (draggedAgentIdx !== null && id === config.selected_agents[draggedAgentIdx]) return;

      const oldTop = prevTops.get(id);
      const newTop = currentTops.get(id);

      if (oldTop !== undefined && newTop !== undefined) {
        const deltaY = oldTop - newTop;
        if (Math.abs(deltaY) > 0.5) {
          el.style.transition = "none";
          el.style.transform = `translateY(${deltaY}px)`;
          void el.offsetHeight; // trigger reflow

          requestAnimationFrame(() => {
            el.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1)";
            el.style.transform = "translateY(0px)";
          });
        }
      }
    });

    prevQueueTopsRef.current = currentTops;
  }, [config.selected_agents, draggedAgentIdx]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const fromIdx = activeDragIdxRef.current;
      if (fromIdx === null) return;
      if (e.buttons === 0) {
        activeDragIdxRef.current = null;
        setDraggedAgentIdx(null);
        setDragOffsetY(0);
        return;
      }

      const delta = e.clientY - dragStartYRef.current;
      setDragOffsetY(delta);

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest(".queue-item-row") as HTMLElement | null;
      if (row) {
        const targetIdxStr = row.getAttribute("data-agent-index");
        if (targetIdxStr !== null) {
          const toIdx = parseInt(targetIdxStr, 10);
          if (!isNaN(toIdx) && toIdx !== fromIdx) {
            const nextRow = row.nextElementSibling as HTMLElement | null;
            const prevRow = row.previousElementSibling as HTMLElement | null;
            const step = nextRow
              ? (nextRow.offsetTop - row.offsetTop)
              : prevRow
                ? (row.offsetTop - prevRow.offsetTop)
                : (row.offsetHeight + 5);
            const diff = toIdx - fromIdx;
            dragStartYRef.current += diff * step;
            setDragOffsetY(e.clientY - dragStartYRef.current);

            moveAgent(fromIdx, toIdx);
            activeDragIdxRef.current = toIdx;
            setDraggedAgentIdx(toIdx);
          }
        }
      }
    };

    const handleGlobalPointerUp = () => {
      if (activeDragIdxRef.current !== null) {
        activeDragIdxRef.current = null;
        setDraggedAgentIdx(null);
        setDragOffsetY(0);
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, []);

  const commitLockDelay = () => {
    if (config.instalock_enabled) return;
    const trimmed = lockDelayInput.trim();
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 5 || val > 70) {
      setErrorModal({
        title: "Invalid Lock Delay",
        message: "Lock Delay must be between 5 and 70 seconds.",
        submessage: "The delay has been reset to the default of 20 seconds.",
      });
      setLockDelayInput("20");
      updateAndSaveConfig({ lock_delay: 20 });
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

  const commitCommsDelay = () => {
    const trimmed = commsDelayInput.trim();
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 3) {
      setErrorModal({
        title: "Invalid Comms Delay",
        message: "Comms Delay must be at least 3 seconds.",
        submessage: "The delay has been reset to the minimum of 3 seconds.",
      });
      setCommsDelayInput("3");
      updateAndSaveConfig({ comms_delay: 3 });
    } else {
      setCommsDelayInput(String(val));
      updateAndSaveConfig({ comms_delay: val });
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

  const getRankNameFromTier = (tier: number): string => {
    switch (tier) {
      case 0: return "Unranked";
      case 3: return "Iron 1";
      case 4: return "Iron 2";
      case 5: return "Iron 3";
      case 6: return "Bronze 1";
      case 7: return "Bronze 2";
      case 8: return "Bronze 3";
      case 9: return "Silver 1";
      case 10: return "Silver 2";
      case 11: return "Silver 3";
      case 12: return "Gold 1";
      case 13: return "Gold 2";
      case 14: return "Gold 3";
      case 15: return "Platinum 1";
      case 16: return "Platinum 2";
      case 17: return "Platinum 3";
      case 18: return "Diamond 1";
      case 19: return "Diamond 2";
      case 20: return "Diamond 3";
      case 21: return "Ascendant 1";
      case 22: return "Ascendant 2";
      case 23: return "Ascendant 3";
      case 24: return "Immortal 1";
      case 25: return "Immortal 2";
      case 26: return "Immortal 3";
      case 27: return "Radiant";
      default: return tier > 27 ? "Radiant" : "Unranked";
    }
  };

  const getRankIconUrl = (tier: number): string => {
    const validTier = tier >= 0 && tier <= 27 ? tier : 0;
    return `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${validTier}/smallicon.png`;
  };

  const calculateTeamAvgRank = (players: TrackedPlayer[]): { tier: number; name: string } => {
    if (!players || players.length === 0) return { tier: 0, name: "Unranked" };
    const rankedTiers = players
      .map((p) => (p.current_tier >= 3 ? p.current_tier : p.peak_tier >= 3 ? p.peak_tier : 0))
      .filter((t) => t >= 3);
    if (rankedTiers.length === 0) return { tier: 0, name: "Unranked" };
    const avgTier = Math.round(rankedTiers.reduce((a, b) => a + b, 0) / rankedTiers.length);
    return { tier: avgTier, name: getRankNameFromTier(avgTier) };
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
    if (ph.includes("Queue")) return "#22c55e";
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
    if (lower.includes("deadlock")) return "#7698b3";
    if (lower.includes("vyse")) return "#9e74a2";
    if (lower.includes("hush")) return "#e056fd";
    if (lower.includes("waylay")) return "#e74c3c";
    if (lower.includes("tejo")) return "#e58e26";
    if (lower.includes("veto")) return "#6c5ce7";
    if (lower.includes("miks")) return "#3498db";
    return "#a78bfa";
  };

  // Strip weapon suffixes from skin display names (e.g. "Evori Dreamwings Vandal" -> "Evori Dreamwings", "Standard Vandal" -> "Standard")
  const cleanSkinName = (skin: string): string => {
    if (!skin) return "-";
    if (skin.toLowerCase().startsWith("standard")) return "Standard";
    const weaponSuffixes = [
      "Vandal", "Phantom", "Operator", "Sheriff", "Ghost", "Classic", "Spectre",
      "Ares", "Odin", "Guardian", "Bulldog", "Marshal", "Marshall", "Outlaw", "Judge", "Bucky",
      "Stinger", "Frenzy", "Shorty", "Melee"
    ];
    let res = skin;
    for (const w of weaponSuffixes) {
      const rx = new RegExp(`\\s+${w}$`, "i");
      if (rx.test(res)) {
        res = res.replace(rx, "");
        break;
      }
    }
    return res.trim();
  };

  // 3-tier win rate color threshold: >50% green, 40-50% sleek neutral, <40% red
  const getWinRateColor = (wr: number): string => {
    if (wr > 50.0) return "#10b981"; // Emerald green (>50%)
    if (wr >= 40.0) return "#e2e8f0"; // Sleek white/slate neutral (40-50%)
    if (wr > 0.0) return "#f87171";  // Rose red (<40%)
    return "#64748b";                // Neutral gray (0 games)
  };

  // Formatting Round string: Round X (score_ally - score_enemy)
  const currentRoundNum = status.score_ally + status.score_enemy + 1;
  const isMatchInGame =
    status.match_state.toUpperCase().includes("INGAME") ||
    status.match_state.toUpperCase().includes("IN GAME") ||
    status.match_state.toUpperCase().includes("GAME");

  const isDeathmatchOrTdm =
    (status.gamemode && (status.gamemode.toLowerCase().includes("deathmatch") || status.gamemode.toLowerCase().includes("hurm") || status.gamemode.toLowerCase().includes("tdm"))) ||
    (roster?.gamemode && (roster.gamemode.toLowerCase().includes("deathmatch") || roster.gamemode.toLowerCase().includes("hurm") || roster.gamemode.toLowerCase().includes("tdm")));

  const roundDisplay = isMatchInGame
    ? isDeathmatchOrTdm
      ? `Score: ${status.score_ally} - ${status.score_enemy}`
      : `Round ${currentRoundNum} (${status.score_ally} - ${status.score_enemy})`
    : status.match_state && status.match_state !== "OFFLINE"
      ? status.match_state
      : "-";

  const renderPlayerRow = (player: TrackedPlayer, isAlly: boolean) => {
    // Clean player name - remove any "(Hidden)" suffix since incognito badge is shown
    const cleanRawName = (player.name || "").replace(/\s*\(Hidden\)/gi, "").trim();
    const parts = cleanRawName.split("#");
    const hasTag = parts.length > 1 && parts[1].trim() !== "" && parts[1].trim() !== "#";
    const gameName = parts[0] || cleanRawName || "Player";
    const tagLine = hasTag ? parts[1] : "";

    const getDisplayedSkin = (p: TrackedPlayer) => {
      if (p.weapon_skins && p.weapon_skins[selectedWeaponSkin]) {
        return p.weapon_skins[selectedWeaponSkin];
      }
      const cap = selectedWeaponSkin.charAt(0).toUpperCase() + selectedWeaponSkin.slice(1);
      return `Standard ${cap}`;
    };
    const displayedSkin = getDisplayedSkin(player);

    const partyClass = player.party_tag
      ? `party-${player.party_tag.toLowerCase().replace(/[^a-z0-9]/g, "")}`
      : "";

    return (
      <tr
        key={player.puuid || Math.random()}
        className={`tracker-row ${isAlly ? "ally-row" : "enemy-row"} ${player.is_self ? "self-row" : ""
          } ${player.party_tag ? `has-party ${partyClass}` : ""}`}
      >
        {/* MERGED PLAYER COLUMN: Agent logo + Name & Lvl (Left capsule indicates party) */}
        <td>
          <div className="tracker-player-merged-col">
            {player.party_tag ? (
              <div
                className={`party-indicator-capsule ${partyClass}`}
              />
            ) : (
              <div className="party-indicator-capsule-spacer" />
            )}
            <div
              className="tracker-agent-avatar-wrap"
              data-tooltip={player.agent_name || "Agent"}
            >
              {player.agent_id ? (
                <img
                  className="tracker-agent-img"
                  src={`https://media.valorant-api.com/agents/${player.agent_id}/displayicon.png`}
                  alt={player.agent_name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="tracker-agent-placeholder">?</div>
              )}
              {player.level > 0 && (
                <span className="tracker-avatar-level-badge">{player.level}</span>
              )}
            </div>
            <div className="tracker-player-details">
              <div className="tracker-player-top-line">
                <span className="tracker-player-name" data-tooltip={cleanRawName}>
                  <span className="tracker-gamename">{gameName}</span>
                  {tagLine && <span className="tracker-tagline">#{tagLine}</span>}
                </span>
                <div className="tracker-player-badges">
                  {player.is_incognito && (cleanRawName.startsWith("Player ") || cleanRawName === "Player" || !hasTag) && (
                    <span
                      className="tracker-badge-incognito"
                      data-tooltip="Player hides their name"
                    >
                      <EyeOff size={10} />
                      <span>Hidden</span>
                    </span>
                  )}
                </div>
              </div>
              <div
                className="tracker-player-rank-subline"
                data-tooltip={
                  player.current_tier > 0
                    ? `${player.current_rank_name} • ${player.current_rr} RR`
                    : "Unranked"
                }
              >
                <img
                  className="tracker-rank-img-mini"
                  src={getRankIconUrl(player.current_tier)}
                  alt=""
                />
                <span
                  className="tracker-rank-text-mini"
                  style={{ color: getRankColor(player.current_rank_name) }}
                >
                  {player.current_rank_name || "Unranked"}
                </span>
                {player.current_tier > 0 && (
                  <>
                    <span className="tracker-rank-dot-mini">•</span>
                    <span className="tracker-rank-rr-mini">{player.current_rr} RR</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* PEAK RANK (Moved to column 2) */}
        <td style={{ textAlign: "center" }}>
          <div
            className="tracker-peak-col aligned"
            data-tooltip={`${player.peak_rank_name}${player.peak_season ? ` (${player.peak_season})` : ""}`}
          >
            <img
              src={getRankIconUrl(player.peak_tier)}
              className="tracker-rank-icon"
              alt=""
            />
            <div className="tracker-peak-meta">
              <span
                className="tracker-peak-name"
                style={{ color: getRankColor(player.peak_rank_name) }}
              >
                {player.peak_rank_name}
              </span>
              {player.peak_season && (
                <span className="tracker-peak-season">{player.peak_season}</span>
              )}
            </div>
          </div>
        </td>

        {/* K/D RATE (Column 3) */}
        <td style={{ textAlign: "center" }}>
          <div
            className="tracker-wr-col centered"
            data-tooltip={
              (player.total_kills || 0) > 0 || (player.total_deaths || 0) > 0
                ? `${player.total_kills || 0} K / ${player.total_deaths || 0} D (${(player.kd_ratio ?? 0).toFixed(2)} K/D)`
                : "Recent K/D Rate"
            }
          >
            {(player.kd_ratio ?? 0) > 0 || (player.total_deaths ?? 0) > 0 ? (
              <span
                className="tracker-wr-val"
                style={{
                  fontWeight: 700,
                  color:
                    (player.kd_ratio ?? 0) >= 1.05
                      ? "#34d399"
                      : (player.kd_ratio ?? 0) < 0.95
                        ? "#fb7185"
                        : "#f8fafc"
                }}
              >
                {(player.kd_ratio ?? 0).toFixed(2)}
              </span>
            ) : (
              <span className="tracker-val-muted">—</span>
            )}
          </div>
        </td>

        {/* WIN RATE (Centered) */}
        <td style={{ textAlign: "center" }}>
          <div className="tracker-wr-col centered">
            {player.total_games > 0 ? (
              <>
                <span
                  className="tracker-wr-val"
                  style={{ color: getWinRateColor(player.win_rate) }}
                >
                  {player.win_rate}%
                </span>
                <span className="tracker-games-count">({player.total_games}g)</span>
              </>
            ) : (
              <span className="tracker-val-muted">—</span>
            )}
          </div>
        </td>

        {/* 5 RECENT GAMES TREND (Centered & Clickable for full details) */}
        <td style={{ textAlign: "center" }}>
          <div
            className="tracker-recent-games-col centered"
            style={{ cursor: player.recent_matches && player.recent_matches.length > 0 ? "pointer" : "default" }}
            onClick={() => {
              if (player.recent_matches && player.recent_matches.length > 0) {
                setSelectedPlayerMatches({ player, matches: player.recent_matches });
              }
            }}
          >
            {player.recent_games && player.recent_games.length > 0 ? (
              player.recent_games.slice(0, 5).map((res, idx) => {
                const detail = player.recent_matches?.[idx];
                const rrStr = detail ? (detail.rr_change > 0 ? `+${detail.rr_change}` : `${detail.rr_change}`) : "";
                const tooltipText = detail
                  ? `${detail.map_name || "Competitive"} ${rrStr} RR`
                  : (res === "W" ? "Victory" : res === "L" ? "Defeat" : "Draw");

                const pillClass = detail?.is_rank_up
                  ? "pill-rankup"
                  : detail?.is_derank
                    ? "pill-derank"
                    : `pill-${res.toLowerCase()}`;

                return (
                  <span
                    key={idx}
                    className={`recent-game-pill ${pillClass}`}
                    data-tooltip={tooltipText}
                  >
                    {res}
                  </span>
                );
              })
            ) : (
              <span className="tracker-val-muted">—</span>
            )}
          </div>
        </td>

        {/* SKIN (Centered & stripped of weapon name) */}
        <td style={{ textAlign: "center" }}>
          <div
            className="tracker-skin-col centered"
            data-tooltip={displayedSkin}
          >
            <span className="tracker-skin-name">{cleanSkinName(displayedSkin)}</span>
          </div>
        </td>
      </tr>
    );
  };

  const selectedWeaponLabel =
    WEAPON_SKIN_GROUPS.flatMap((g) => g.weapons).find((w) => w.id === selectedWeaponSkin)?.label ||
    "Vandal";

  const renderSkinDropdown = () => (
    <div className="tracker-skin-header" ref={skinDropdownRef}>
      <span>SKIN</span>
      <div className="custom-skin-dropdown-wrapper">
        <button
          type="button"
          className={`custom-skin-dropdown-btn ${showSkinDropdown ? "open" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowSkinDropdown((prev) => !prev);
          }}
        >
          <span>{selectedWeaponLabel}</span>
          <svg
            className="skin-dropdown-arrow"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {showSkinDropdown && (
          <div className="custom-skin-menu">
            {WEAPON_SKIN_GROUPS.map((group) => (
              <div key={group.category} className="skin-menu-group">
                <div className="skin-menu-group-header">{group.category}</div>
                <div className="skin-menu-group-items">
                  {group.weapons.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={`skin-menu-item ${selectedWeaponSkin === w.id ? "selected" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWeaponSkin(w.id);
                        setShowSkinDropdown(false);
                      }}
                    >
                      <span>{w.label}</span>
                      {selectedWeaponSkin === w.id && <span className="skin-menu-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`app-window ${config.low_detail ? "low-detail" : ""}`} onContextMenu={(e) => e.preventDefault()}>
      {/* Hidden Audio Player */}
      <audio
        ref={audioRef}
        src={musicBlobUrl || "/music.mp3"}
        preload="auto"
        loop
        onTimeUpdate={() => {
          if (!isDraggingMusicRef.current && audioRef.current) {
            setMusicCurrentTime(audioRef.current.currentTime);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (!isNaN(d) && isFinite(d) && d > 0) {
              setMusicDuration(d);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (!isNaN(d) && isFinite(d) && d > 0) {
              setMusicDuration(d);
            }
            audioRef.current.volume = (config.music_volume ?? 80) / 100;
          }
        }}
        onCanPlay={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (!isNaN(d) && isFinite(d) && d > 0) {
              setMusicDuration(d);
            }
          }
        }}
      />

      {/* Main Dashboard App Container */}
      <div className="main-app-container visible">
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
            <span
              className={`version-pill ${updateInfo?.available ? "outdated" : ""}`}
              data-tooltip={updateInfo?.available ? `Update available: ${updateInfo.latest_version}` : "Latest version"}
              data-tooltip-pos="bottom"
            >
              v{APP_VERSION}
            </span>
          </div>

          {/* Middle Aligning: VP, RP, KC and Free Agent Tokens with Logos & Tooltips */}
          {status.wallet && (
            <div className="titlebar-center-wallet">
              <div
                className="titlebar-currency-badge"
                data-tooltip={`VALORANT Points: ${status.wallet.vp.toLocaleString()}`}
                data-tooltip-pos="bottom"
              >
                <img
                  src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                  alt="VP"
                  className="currency-logo"
                />
                <span className="currency-amount">{status.wallet.vp.toLocaleString()}</span>
              </div>

              <div
                className="titlebar-currency-badge"
                data-tooltip={`Radianite Points: ${status.wallet.rp.toLocaleString()}`}
                data-tooltip-pos="bottom"
              >
                <img
                  src="https://media.valorant-api.com/currencies/e59aa87c-4cbf-517a-5983-6e81511be9b7/displayicon.png"
                  alt="RP"
                  className="currency-logo"
                />
                <span className="currency-amount">{status.wallet.rp.toLocaleString()}</span>
              </div>

              <div
                className="titlebar-currency-badge"
                data-tooltip={`Kingdom Credits: ${status.wallet.kc.toLocaleString()}`}
                data-tooltip-pos="bottom"
              >
                <img
                  src="https://media.valorant-api.com/currencies/85ca954a-41f2-ce94-9b45-8ca3dd39a00d/displayicon.png"
                  alt="KC"
                  className="currency-logo"
                />
                <span className="currency-amount">{status.wallet.kc.toLocaleString()}</span>
              </div>

              <div
                className="titlebar-currency-badge"
                data-tooltip={`Free Agent Tokens: ${status.wallet.agent_tokens.toLocaleString()}`}
                data-tooltip-pos="bottom"
              >
                <img
                  src="https://media.valorant-api.com/currencies/f08d4ae3-939c-4576-ab26-09ce1f23bb37/displayicon.png"
                  alt="Tokens"
                  className="currency-logo"
                />
                <span className="currency-amount">{status.wallet.agent_tokens.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="titlebar-right">
            <button
              className="win-btn"
              onClick={() => invoke("minimize_window")}
              data-tooltip="Minimize"
              data-tooltip-pos="bottom"
            >
              <Minus size={13} />
            </button>
            <button
              className="win-btn close"
              onClick={() => invoke("close_window")}
              data-tooltip="Close"
              data-tooltip-pos="bottom"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Main Body with Sidebar + Tab Content */}
        <div className="main-content">
          {/* Navigation Sidebar */}
          <div className="nav-sidebar">
            {/* Top group: Tracker, Shop */}
            <button
              className={`nav-btn ${activeTab === "tracker" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("tracker");
                fetchRoster();
              }}
            >
              <Radar size={14} />
              <span>Tracker</span>
              {(() => {
                const isLobby =
                  status.match_state === "In Lobby" ||
                  status.match_state.toUpperCase().includes("LOBBY") ||
                  status.match_state.toUpperCase().includes("MENU");

                if (roster && isLobby && (roster.ally_team.length > 0 || roster.enemy_team.length > 0)) {
                  return <span className="nav-live-dot dot-concluded" data-tooltip="Match Concluded" />;
                }
                if (roster?.state === "COREGAME" || status.match_state === "In Game") {
                  return <span className="nav-live-dot dot-ingame" data-tooltip="In Match" />;
                }
                if (roster?.state === "PREGAME" || status.match_state === "Agent Select") {
                  return <span className="nav-live-dot dot-pregame" data-tooltip="Agent Select" />;
                }
                return null;
              })()}
            </button>
            <button
              className={`nav-btn ${activeTab === "shop" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("shop");
                fetchStorefront();
              }}
            >
              <ShoppingBag size={14} />
              <span>Shop</span>
            </button>

            {/* Divider */}
            <div className="sidebar-divider" style={{ margin: "6px 4px" }} />

            {/* Core Tools: Main, Config, Agents, Chat, Voting, Discord */}
            <button
              className={`nav-btn ${activeTab === "main" ? "active" : ""}`}
              onClick={() => setActiveTab("main")}
            >
              <Play size={14} fill={activeTab === "main" ? "currentColor" : "none"} />
              <span>Main</span>
            </button>
            <button
              className={`nav-btn ${activeTab === "config" ? "active" : ""}`}
              onClick={() => setActiveTab("config")}
            >
              <Wrench size={14} />
              <span>Config</span>
            </button>
            <button
              className={`nav-btn ${activeTab === "agents" ? "active" : ""}`}
              onClick={() => setActiveTab("agents")}
            >
              <Users size={14} />
              <span>Agents</span>
            </button>
            <button
              className={`nav-btn ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </button>
            <button
              className={`nav-btn ${activeTab === "autovote" ? "active" : ""}`}
              onClick={() => setActiveTab("autovote")}
            >
              <Vote size={14} />
              <span>Voting</span>
            </button>
            <button
              className={`nav-btn ${activeTab === "remote" ? "active" : ""}`}
              onClick={() => setActiveTab("remote")}
            >
              <Smartphone size={14} />
              <span>Remote</span>
            </button>

            {/* Bottom group: Media & Info (no divider line between them) */}
            <button
              className={`nav-btn ${activeTab === "media" || activeTab === "music" ? "active" : ""}`}
              style={{ marginTop: "auto" }}
              onClick={() => setActiveTab("media")}
            >
              <Music size={14} />
              <span>Media</span>
            </button>
            <button
              className={`nav-btn ${activeTab === "info" ? "active" : ""}`}
              onClick={() => setActiveTab("info")}
            >
              <Info size={14} />
              <span>Info</span>
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
                      className={`status-value ${isRunning ? "val-running" : "val-stopped"}`}
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
                  className={`primary-action-btn ${isRunning ? "btn-stop" : "btn-start"}`}
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

            {/* TAB: TRACKER (LIVE MATCH ROSTER) */}
            {activeTab === "tracker" && (
              <div className="tab-pane tracker-tab-pane">
                <div className="tracker-header-card">
                  <div className="tracker-header-left">
                    <div className="tracker-title-row">
                      <Radar size={15} className="tracker-radar-icon" />
                      <span className="tracker-title">Match Tracker</span>
                      {roster && (roster.state === "CONCLUDED" || status.match_state === "In Lobby" || status.match_state.toUpperCase().includes("LOBBY") || status.match_state.toUpperCase().includes("MENU") || status.match_state === "In Queue") ? (
                        <span className="tracker-status-tag tag-concluded">MATCH CONCLUDED</span>
                      ) : roster?.state === "COREGAME" ? (
                        <span className="tracker-status-tag tag-coregame">IN MATCH</span>
                      ) : roster?.state === "PREGAME" ? (
                        <span className="tracker-status-tag tag-pregame">AGENT SELECT</span>
                      ) : (
                        <span className="tracker-status-tag tag-offline">WAITING FOR MATCH</span>
                      )}
                    </div>
                    <div className="tracker-meta-row">
                      <span className="tracker-meta-item">
                        <span className="tracker-meta-label">Map:</span>{" "}
                        <span
                          className="tracker-meta-val"
                          style={{ color: getMapColor(roster?.map_name && roster.map_name !== "-" ? roster.map_name : status.map_name) }}
                        >
                          {roster?.map_name && roster.map_name !== "-" ? roster.map_name : (status.map_name || "-")}
                        </span>
                      </span>
                      <span className="tracker-meta-divider">•</span>
                      <span className="tracker-meta-item">
                        <span className="tracker-meta-label">Mode:</span>{" "}
                        <span
                          className="tracker-meta-val"
                          style={{ color: getGamemodeColor(roster?.gamemode && roster.gamemode !== "-" ? roster.gamemode : status.gamemode) }}
                        >
                          {roster?.gamemode && roster.gamemode !== "-" ? roster.gamemode : (status.gamemode || "-")}
                        </span>
                      </span>
                      <span className="tracker-meta-divider">•</span>
                      <span className="tracker-meta-item">
                        <span className="tracker-meta-label">Agent:</span>{" "}
                        <span
                          className="tracker-meta-val"
                          style={{ color: getAgentColor(status.current_agent) }}
                        >
                          {status.current_agent || "-"}
                        </span>
                      </span>
                      <span className="tracker-meta-divider">•</span>
                      <span className="tracker-meta-item">
                        <span className="tracker-meta-label">Round:</span>{" "}
                        <span className="tracker-meta-val" style={{ color: "#a78bfa" }}>
                          {roundDisplay}
                        </span>
                      </span>
                      {(roster?.server_name || status.server_name) && (
                        <>
                          <span className="tracker-meta-divider">•</span>
                          <span className="tracker-meta-item">
                            <span className="tracker-meta-label">Server:</span>{" "}
                            <span className="tracker-meta-val" style={{ color: "#38bdf8" }}>
                              {roster?.server_name || status.server_name}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="tracker-refresh-btn"
                    onClick={() => fetchRoster()}
                    disabled={isTrackerLoading}
                    data-tooltip="Refresh tracker."
                  >
                    <RefreshCw size={12} className={isTrackerLoading ? "spin" : ""} />
                    <span>{isTrackerLoading ? "Updating..." : "Refresh"}</span>
                  </button>
                </div>

                {(!roster ||
                  roster.state === "NO_MATCH" ||
                  (roster.ally_team.length === 0 && roster.enemy_team.length === 0)) ? (
                  <div className="tracker-empty-card">
                    <div className="tracker-empty-radar">
                      <Radar size={38} className={isTrackerLoading ? "spin" : "pulse-subtle"} />
                    </div>
                    <div className="tracker-empty-title">
                      {isTrackerLoading ? "Updating..." : "Currently in Lobby"}
                    </div>
                    <div className="tracker-empty-desc">
                      Start a game to begin tracking.
                    </div>
                  </div>
                ) : (
                  <div className="tracker-unified-card">
                    <div className="tracker-table-container">
                      <table className="tracker-table">
                        <thead>
                          <tr>
                            <th style={{ width: "24%", textAlign: "left" }}>PLAYER</th>
                            <th style={{ width: "16%", textAlign: "center" }}>PEAK RANK</th>
                            <th style={{ width: "16%", textAlign: "center" }}>K/D</th>
                            <th style={{ width: "12%", textAlign: "center" }}>WIN RATE</th>
                            <th style={{ width: "13%", textAlign: "center" }}>RECENT COMPS</th>
                            <th style={{ width: "19%", textAlign: "center" }}>
                              {renderSkinDropdown()}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* YOUR TEAM Header Row */}
                          <tr className="tracker-team-divider-row ally-divider">
                            <td colSpan={6}>
                              <div className="tracker-team-divider-content">
                                <span className="team-indicator ally-dot" />
                                <span className="team-divider-title">YOUR TEAM</span>
                                <span className="team-count">({roster.ally_team.length})</span>
                                {(() => {
                                  const avg = calculateTeamAvgRank(roster.ally_team);
                                  return avg.tier > 0 ? (
                                    <span
                                      className="team-avg-badge"
                                      data-tooltip="Average Rank"
                                    >
                                      <img
                                        src={getRankIconUrl(avg.tier)}
                                        alt={avg.name}
                                        className="team-avg-icon"
                                      />
                                      <span className="team-avg-label">Avg:</span>
                                      <span
                                        className="team-avg-val"
                                        style={{ color: getRankColor(avg.name) }}
                                      >
                                        {avg.name}
                                      </span>
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </td>
                          </tr>
                          {roster.ally_team.map((player) => renderPlayerRow(player, true))}

                          {/* ENEMY TEAM Header Row */}
                          <tr className="tracker-team-divider-row enemy-divider">
                            <td colSpan={6}>
                              <div className="tracker-team-divider-content">
                                <span className="team-indicator enemy-dot" />
                                <span className="team-divider-title">ENEMY TEAM</span>
                                <span className="team-count">({roster.enemy_team.length})</span>
                                {(() => {
                                  const avg = calculateTeamAvgRank(roster.enemy_team);
                                  return avg.tier > 0 ? (
                                    <span
                                      className="team-avg-badge"
                                      data-tooltip="Average Rank"
                                    >
                                      <img
                                        src={getRankIconUrl(avg.tier)}
                                        alt={avg.name}
                                        className="team-avg-icon"
                                      />
                                      <span className="team-avg-label">Avg:</span>
                                      <span
                                        className="team-avg-val"
                                        style={{ color: getRankColor(avg.name) }}
                                      >
                                        {avg.name}
                                      </span>
                                    </span>
                                  ) : null;
                                })()}
                                {roster.state === "PREGAME" && roster.enemy_team.length === 0 && (
                                  <span className="tracker-enemy-hidden-notice">
                                    Hidden
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {roster.enemy_team.length > 0 ? (
                            roster.enemy_team.map((player) => renderPlayerRow(player, false))
                          ) : (
                            <tr className="tracker-enemy-empty-row">
                              <td colSpan={6}>
                                <div className="tracker-enemy-pregame-box">
                                  <EyeOff size={15} />
                                  <span>Cannot show enemy identities during Agent Select.</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SHOP (VALORANT STOREFRONT) */}
            {activeTab === "shop" && (
              <div className="tab-pane shop-tab-pane">
                {isStoreLoading && !storefront ? (
                  <div className="shop-loading-card">
                    <RefreshCw size={24} className="spin" style={{ color: "#a855f7" }} />
                    <span>Taking a look at the shop...</span>
                  </div>
                ) : storefront ? (
                  <div className="shop-container">
                    {/* 1. FEATURED BUNDLE */}
                    {storefront.featured_bundles.length > 0 && (() => {
                      const currentBundle = storefront.featured_bundles[selectedBundleIdx] || storefront.featured_bundles[0];
                      return (
                        <div className="shop-featured-wrapper">
                          {/* Carousel Tabs OUTSIDE the banner, always 100% visible */}
                          {storefront.featured_bundles.length > 1 && (
                            <div className="featured-bundle-tabs-bar">
                              <span className="featured-tabs-heading">FEATURED COLLECTIONS</span>
                              <div className="featured-bundle-tabs-outside">
                                {storefront.featured_bundles.map((b, idx) => (
                                  <button
                                    key={b.bundle_id || idx}
                                    className={`bundle-tab-btn-outside ${idx === selectedBundleIdx ? "active" : ""}`}
                                    onClick={() => setSelectedBundleIdx(idx)}
                                  >
                                    {b.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="shop-featured-card">
                            <div className="featured-banner-wrap">
                              {/* Stacked Images for True Seamless Cross-Fade without Disappearing */}
                              {storefront.featured_bundles.map((b, idx) => (
                                <img
                                  key={b.bundle_id || idx}
                                  src={b.display_icon}
                                  className={`featured-banner-img ${idx === selectedBundleIdx ? "active" : ""}`}
                                  alt={b.name}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ))}

                              <div className="featured-banner-overlay" />

                              {/* TOP-LEFT: Featured Info */}
                              <div className="featured-content-top-left">
                                <div className="featured-timer-badge">
                                  <Clock size={12} />
                                  <span>FEATURED | {formatDuration(currentBundle.seconds_remaining)}</span>
                                </div>
                                <h1 className="featured-title">{currentBundle.name}</h1>
                                <div className="featured-collection-tag">COLLECTION</div>
                              </div>

                              {/* BOTTOM-RIGHT: Price Badge */}
                              <div
                                className="featured-price-badge featured-price-bottom-right"
                                data-tooltip={`Bundle Price: ${currentBundle.total_cost_vp.toLocaleString()} VP`}
                              >
                                <img
                                  src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                                  className="currency-logo-sm"
                                  alt="VP"
                                />
                                <span>{currentBundle.total_cost_vp.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. DAILY 4-GUN ROTATING OFFERS */}
                    <div className="shop-section">
                      <div className="shop-section-header">
                        <div className="section-title-line" />
                        <div className="section-title-center">
                          <span className="section-title-text">DAILY OFFERS</span>
                          <span className="section-timer-badge">
                            <Clock size={12} />
                            <span>{formatDuration(storefront.daily_seconds_remaining)}</span>
                          </span>
                        </div>
                        <div className="section-title-line" />
                      </div>

                      <div className="daily-offers-grid">
                        {storefront.daily_offers.map((offer) => {
                          const rarity = getSkinRarity(offer.cost_vp, offer.skin_name);
                          return (
                            <div
                              key={offer.offer_id}
                              className="daily-offer-card"
                              style={{
                                borderColor: `${rarity.color}66`,
                                boxShadow: `0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px ${rarity.glow}`,
                              }}
                              data-tooltip={`${offer.skin_name} • ${rarity.name}`}
                            >
                              {/* Glowing ambient rarity aura flowing up */}
                              <div
                                className="daily-offer-ambient-aura"
                                style={{
                                  background: `radial-gradient(circle at 50% 120%, ${rarity.glow} 0%, transparent 72%)`,
                                }}
                              />
                              <div className="daily-offer-img-wrap">
                                {offer.icon_url ? (
                                  <img
                                    src={offer.icon_url}
                                    className="daily-offer-img"
                                    alt={offer.skin_name}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="skin-placeholder">Weapon Skin</div>
                                )}
                              </div>
                              <div className="daily-offer-footer">
                                <div className="daily-offer-name-wrap">
                                  <img
                                    src={rarity.icon}
                                    className="daily-offer-tier-icon"
                                    alt={rarity.name}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                  <span
                                    className="daily-offer-name"
                                    data-tooltip={offer.skin_name}
                                  >
                                    {offer.skin_name}
                                  </span>
                                </div>
                                <div className="daily-offer-price" data-tooltip={`${offer.cost_vp.toLocaleString()} VP`}>
                                  <img
                                    src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                                    className="currency-logo-xs"
                                    alt="VP"
                                  />
                                  <span>{offer.cost_vp.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. NIGHT.MARKET (BONUS STORE) */}
                    <div className="shop-section">
                      <div className="shop-section-header">
                        <div className="section-title-line" />
                        <div className="section-title-center">
                          <span className="section-title-text">NIGHT.MARKET</span>
                          {storefront.night_market_active && (
                            <span className="section-timer-badge">
                              <Clock size={12} />
                              <span>{formatDuration(storefront.night_market_seconds_remaining)}</span>
                            </span>
                          )}
                        </div>
                        <div className="section-title-line" />
                      </div>

                      {storefront.night_market_active && storefront.night_market_offers.length > 0 ? (
                        <div className="night-market-grid">
                          {storefront.night_market_offers.map((nm) => (
                            <div key={nm.offer_id} className="night-market-card" data-tooltip={nm.skin_name}>
                              <div className="nm-discount-tag">-{nm.discount_percent}%</div>
                              <div className="nm-img-wrap">
                                <img src={nm.icon_url} className="nm-img" alt={nm.skin_name} />
                              </div>
                              <div className="nm-info">
                                <span className="nm-skin-name">{nm.skin_name}</span>
                                <div className="nm-prices">
                                  <span className="nm-orig-price">{nm.original_cost_vp.toLocaleString()}</span>
                                  <div className="nm-disc-price">
                                    <img
                                      src="https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png"
                                      className="currency-logo-xs"
                                      alt="VP"
                                    />
                                    <span>{nm.discounted_cost_vp.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="shop-night-market-closed">
                          <Sparkles size={20} className="nm-sparkle-icon" />
                          <div className="nm-closed-content">
                            <span className="nm-closed-title">Night.Market is Closed</span>
                            <span className="nm-closed-sub">The Night.Market will return towards the conclusion of the Act.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. ACCESSORY STORE */}
                    {storefront.accessory_offers.length > 0 && (
                      <div className="shop-section">
                        <div className="shop-section-header">
                          <div className="section-title-line" />
                          <div className="section-title-center">
                            <span className="section-title-text">ACCESSORY STORE</span>
                            <span className="section-timer-badge">
                              <Clock size={12} />
                              <span>{formatDuration(storefront.accessory_seconds_remaining)}</span>
                            </span>
                          </div>
                          <div className="section-title-line" />
                        </div>

                        <div className="accessory-offers-grid">
                          {storefront.accessory_offers.map((acc, idx) => (
                            <div key={acc.offer_id || idx} className="accessory-offer-card" data-tooltip={`${acc.name} • ${acc.item_type}`}>
                              <div className="accessory-img-wrap">
                                {acc.icon_url ? (
                                  <img
                                    src={acc.icon_url}
                                    className={`accessory-img ${acc.item_type === "Player Card" ? "is-card" : acc.item_type === "Spray" ? "is-spray" : ""}`}
                                    alt={acc.name}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="accessory-title-preview">
                                    <div className="accessory-title-accent" />
                                    <span className="accessory-title-text">"{acc.name}"</span>
                                    <span className="accessory-title-tag">PLAYER TITLE</span>
                                  </div>
                                )}
                              </div>
                              <div className="accessory-footer">
                                <span className="accessory-name-label" data-tooltip={acc.name}>{acc.name}</span>
                                <div className="accessory-price" data-tooltip={`${acc.cost_kc.toLocaleString()} KC`}>
                                  <img
                                    src="https://media.valorant-api.com/currencies/85ca954a-41f2-ce94-9b45-8ca3dd39a00d/displayicon.png"
                                    className="currency-logo-xs"
                                    alt="KC"
                                  />
                                  <span>{acc.cost_kc.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="shop-empty-card">
                    <span>VALORANT Client is offline. Launch VALORANT to view your live store.</span>
                    <button className="shop-retry-btn" onClick={() => fetchStorefront()}>
                      <RefreshCw size={13} />
                      <span>Retry</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CONFIG */}
            {activeTab === "config" && (
              <div className="tab-pane">
                {/* 0. Auto Queue */}
                <div className="card" style={{ marginBottom: "12px" }}>
                  <div className="control-row">
                    <div>
                      <div className="control-title">Auto Queue</div>
                      <div className="pane-subtitle">
                        Auto Queue into new game.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.auto_derank_enabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          if (enabled) {
                            preAutoDerankStateRef.current = {
                              auto_queue_enabled: config.auto_queue_enabled,
                              auto_focus_game: false,
                            };
                            updateAndSaveConfig({
                              auto_derank_enabled: true,
                              auto_queue_enabled: true,
                            });
                            addLog("[CONFIG] Auto Queue enabled.");
                          } else {
                            const prev = preAutoDerankStateRef.current;
                            updateAndSaveConfig({
                              auto_derank_enabled: false,
                              auto_queue_enabled: prev.auto_queue_enabled,
                            });
                            addLog("[CONFIG] Auto Queue disabled.");
                          }
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  {/* Auto Queue Subfunctions (Greyed out when disabled) */}
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                      opacity: config.auto_derank_enabled ? 1 : 0.45,
                      pointerEvents: config.auto_derank_enabled ? "auto" : "none",
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    {/* Queue Selection (All except Custom and Premier) */}
                    <div className="control-row">
                      <div>
                        <div className="control-title">Queue Mode</div>
                        <div className="pane-subtitle">
                          Choose matchmaking game mode.
                        </div>
                      </div>
                      <select
                        style={{
                          background: "var(--bg-secondary, #1e293b)",
                          color: "#f8fafc",
                          border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "13px",
                          outline: "none",
                          cursor: config.auto_derank_enabled ? "pointer" : "not-allowed",
                        }}
                        disabled={!config.auto_derank_enabled}
                        value={config.auto_queue_mode || "competitive"}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateAndSaveConfig({ auto_queue_mode: val });
                          addLog(`[CONFIG] Auto Queue mode set to ${val}.`);
                        }}
                      >
                        <option value="competitive">Competitive</option>
                        <option value="unrated">Unrated</option>
                        <option value="swiftplay">Swiftplay</option>
                        <option value="spikerush">Spike Rush</option>
                        <option value="deathmatch">Deathmatch</option>
                        <option value="hurm">Team Deathmatch</option>
                        <option value="ggteam">Escalation</option>
                      </select>
                    </div>

                    {/* Rank Target (Exclusive subfunction when Queue is Competitive) */}
                    {(config.auto_queue_mode || "competitive") === "competitive" && (
                      <div className="control-row" style={{ marginTop: "12px" }}>
                        <div>
                          <div className="control-title">Rank Target</div>
                          <div className="pane-subtitle">
                            Auto turns off Auto Queue upon reaching target rank.
                          </div>
                        </div>
                        <select
                          style={{
                            background: "var(--bg-secondary, #1e293b)",
                            color: "#f8fafc",
                            border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "13px",
                            outline: "none",
                            cursor: config.auto_derank_enabled ? "pointer" : "not-allowed",
                          }}
                          disabled={!config.auto_derank_enabled}
                          value={config.auto_derank_target_rank || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateAndSaveConfig({ auto_derank_target_rank: val });
                            addLog(val ? `[AUTO QUEUE] Target rank set to ${val}.` : `[AUTO QUEUE] Target rank disabled.`);
                          }}
                        >
                          <option value="">Disabled</option>
                          <optgroup label="Iron">
                            <option value="Iron 1">Iron 1</option>
                            <option value="Iron 2">Iron 2</option>
                            <option value="Iron 3">Iron 3</option>
                          </optgroup>
                          <optgroup label="Bronze">
                            <option value="Bronze 1">Bronze 1</option>
                            <option value="Bronze 2">Bronze 2</option>
                            <option value="Bronze 3">Bronze 3</option>
                          </optgroup>
                          <optgroup label="Silver">
                            <option value="Silver 1">Silver 1</option>
                            <option value="Silver 2">Silver 2</option>
                            <option value="Silver 3">Silver 3</option>
                          </optgroup>
                          <optgroup label="Gold">
                            <option value="Gold 1">Gold 1</option>
                            <option value="Gold 2">Gold 2</option>
                            <option value="Gold 3">Gold 3</option>
                          </optgroup>
                          <optgroup label="Platinum">
                            <option value="Platinum 1">Platinum 1</option>
                            <option value="Platinum 2">Platinum 2</option>
                            <option value="Platinum 3">Platinum 3</option>
                          </optgroup>
                          <optgroup label="Diamond">
                            <option value="Diamond 1">Diamond 1</option>
                            <option value="Diamond 2">Diamond 2</option>
                            <option value="Diamond 3">Diamond 3</option>
                          </optgroup>
                          <optgroup label="Ascendant">
                            <option value="Ascendant 1">Ascendant 1</option>
                            <option value="Ascendant 2">Ascendant 2</option>
                            <option value="Ascendant 3">Ascendant 3</option>
                          </optgroup>
                          <optgroup label="Immortal">
                            <option value="Immortal 1">Immortal 1</option>
                            <option value="Immortal 2">Immortal 2</option>
                            <option value="Immortal 3">Immortal 3</option>
                          </optgroup>
                        </select>
                      </div>
                    )}
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
                        updateAndSaveConfig({ anti_afk_mode: 2 });
                        addLog("[CONFIG] Anti-AFK Method set to Comms.");
                      }}
                    >
                      <div className="radio-dot">
                        {config.anti_afk_mode === 2 && <div className="dot-inner" />}
                      </div>
                      <span className="radio-label">Comms</span>
                      {config.anti_afk_mode === 2 && (
                        <span className="active-badge">● ACTIVE</span>
                      )}
                    </div>

                    <div
                      className={`radio-card ${config.anti_afk_mode === 3 ? "active" : ""}`}
                      onClick={() => {
                        updateAndSaveConfig({ anti_afk_mode: 3 });
                        addLog("[CONFIG] Anti-AFK Method set to Macros.");
                      }}
                    >
                      <div className="radio-dot">
                        {config.anti_afk_mode === 3 && <div className="dot-inner" />}
                      </div>
                      <span className="radio-label">Macros</span>
                      {config.anti_afk_mode === 3 && (
                        <span className="active-badge">● ACTIVE</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginTop: "12px" }}>
                  <div className="pane-title">
                    {config.anti_afk_mode === 0
                      ? "Click Mode Settings"
                      : config.anti_afk_mode === 1
                        ? "Hold Mode Settings"
                        : config.anti_afk_mode === 2
                          ? "Comms Settings"
                          : "Macros Settings"}
                  </div>
                  <div className="pane-subtitle">
                    {config.anti_afk_mode === 0
                      ? "Randomly clicks the selected key."
                      : config.anti_afk_mode === 1
                        ? "Continuously holds down the selected key."
                        : config.anti_afk_mode === 2
                          ? "Auto spam Communications."
                          : "Custom recorded multi-key macro sequence with natural timing."}
                  </div>

                  {config.anti_afk_mode === 2 ? (
                    /* COMMS MODE SETTINGS */
                    <>
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title">Comms Hotkey</div>
                          <div className="pane-subtitle">
                            VALORANT in-game communication wheel key (Default: Period '.')
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className={`key-badge-btn ${isRebindingComms ? "rebinding" : ""}`}
                            onClick={() => setIsRebindingComms(!isRebindingComms)}
                          >
                            {isRebindingComms ? "Press..." : config.comms_hotkey || "."}
                          </button>
                          <button
                            className="reset-icon-btn"
                            onClick={() => {
                              updateAndSaveConfig({ comms_hotkey: "." });
                              addLog("[CONFIG] Comms hotkey reset to default ('.').");
                            }}
                            data-tooltip="Reset to default (.)"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title">Random Voice Lines</div>
                          <div className="pane-subtitle">
                            Random everything.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.comms_random || false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              updateAndSaveConfig({ comms_random: val });
                              addLog(val ? "[CONFIG] Comms set to Random voice lines." : "[CONFIG] Comms set to specific voice line.");
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {!config.comms_random && (
                        <>
                          <div className="control-row" style={{ marginTop: "14px" }}>
                            <div>
                              <div className="control-title">Category (Step 1)</div>
                              <div className="pane-subtitle">Select communication category.</div>
                            </div>
                            <select
                              style={{
                                background: "var(--bg-secondary, #1e293b)",
                                color: "#f8fafc",
                                border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                                borderRadius: "6px",
                                padding: "6px 10px",
                                fontSize: "13px",
                                outline: "none",
                              }}
                              value={config.comms_first_num || 3}
                              onChange={(e) => {
                                const catId = parseInt(e.target.value);
                                const catObj = COMMS_CATEGORIES.find((c) => c.id === catId);
                                const maxSec = catObj ? catObj.options.length : 4;
                                const sec = Math.min(config.comms_second_num || 1, maxSec);
                                updateAndSaveConfig({ comms_first_num: catId, comms_second_num: sec });
                                addLog(`[CONFIG] Comms Category set to ${catObj?.name || catId}.`);
                              }}
                            >
                              {COMMS_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.id}: {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="control-row" style={{ marginTop: "14px" }}>
                            <div>
                              <div className="control-title">Voice Line (Step 2)</div>
                              <div className="pane-subtitle">Select specific agent line to speak.</div>
                            </div>
                            <select
                              style={{
                                background: "var(--bg-secondary, #1e293b)",
                                color: "#f8fafc",
                                border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                                borderRadius: "6px",
                                padding: "6px 10px",
                                fontSize: "13px",
                                outline: "none",
                              }}
                              value={config.comms_second_num || 1}
                              onChange={(e) => {
                                const secId = parseInt(e.target.value);
                                updateAndSaveConfig({ comms_second_num: secId });
                                const curCat = COMMS_CATEGORIES.find((c) => c.id === (config.comms_first_num || 3));
                                const opt = curCat?.options.find((o) => o.id === secId);
                                addLog(`[CONFIG] Comms Line set to ${opt?.text || secId}.`);
                              }}
                            >
                              {(COMMS_CATEGORIES.find((c) => c.id === (config.comms_first_num || 3))?.options || []).map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.id}: {o.text}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title">Loop Delay</div>
                          <div className="pane-subtitle">
                            Seconds between each communication loop (Minimum: 3s).
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="text"
                            value={commsDelayInput}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, "");
                              setCommsDelayInput(clean);
                            }}
                            onBlur={commitCommsDelay}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                commitCommsDelay();
                                (e.target as HTMLElement).blur();
                              }
                            }}
                            style={{
                              width: "56px",
                              padding: "4px 8px",
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              borderRadius: "6px",
                              color: "#fff",
                              textAlign: "center",
                              fontSize: "13px",
                              fontWeight: 600,
                              outline: "none",
                            }}
                          />
                          <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>sec</span>
                        </div>
                      </div>
                    </>
                  ) : config.anti_afk_mode === 3 ? (
                    /* MACROS MODE SETTINGS */
                    <>
                      <div className="control-note" style={{ marginTop: "8px", marginBottom: "8px" }}>
                        Sequence viewer (uneditable). Click <strong>Record Macro</strong> to record keys with natural timings.
                      </div>

                      <div className={`macro-viewer-box ${isRecordingMacro ? "recording" : ""}`}>
                        {isRecordingMacro ? (
                          <>
                            <div className="macro-recording-badge">
                              ● Recording... (Backspace: Delete, Enter or Stop: Save)
                            </div>
                            {activeHoldingKeys.map((k) => (
                              <div key={k} className="macro-action-pill holding">
                                <span className="macro-pill-key">{k}</span>
                                <span className="macro-pill-time">(holding...)</span>
                              </div>
                            ))}
                            {macroLiveActions.map((act, idx) => (
                              <div key={idx} className="macro-action-pill">
                                <span className="macro-pill-key">{act.key}</span>
                                <span className="macro-pill-time">@{(act.start_ms / 1000).toFixed(2)}s ({(act.duration_ms / 1000).toFixed(2)}s)</span>
                              </div>
                            ))}
                          </>
                        ) : macroLiveActions.length === 0 ? (
                          <div className="macro-viewer-placeholder">
                            No macro recorded. Click [Record Macro] to start.
                          </div>
                        ) : (
                          macroLiveActions.map((act, idx) => (
                            <div key={idx} className="macro-action-pill">
                              <span className="macro-pill-key">{act.key}</span>
                              <span className="macro-pill-time">@{(act.start_ms / 1000).toFixed(2)}s ({(act.duration_ms / 1000).toFixed(2)}s)</span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="macro-btn-row">
                        <button
                          className={`macro-btn ${isRecordingMacro ? "record-active" : ""}`}
                          onClick={() => {
                            if (isRecordingMacro) {
                              stopRecordingMacro();
                            } else {
                              startRecordingMacro();
                            }
                          }}
                        >
                          {isRecordingMacro ? (
                            <>
                              <Square size={13} fill="#ef4444" />
                              <span>Stop Recording</span>
                            </>
                          ) : (
                            <>
                              <Play size={13} fill="#10b981" />
                              <span>Record Macro</span>
                            </>
                          )}
                        </button>

                        <button
                          className="macro-btn"
                          onClick={clearMacro}
                          disabled={isRecordingMacro}
                          data-tooltip="Clear macro"
                        >
                          <Trash2 size={13} />
                          <span>Clear</span>
                        </button>

                        <button
                          className="macro-btn"
                          onClick={exportMacro}
                          disabled={isRecordingMacro}
                          data-tooltip="Copy JSON to clipboard"
                        >
                          <Copy size={13} />
                          <span>Export JSON</span>
                        </button>

                        <button
                          className="macro-btn"
                          onClick={() => {
                            setMacroImportText(config.custom_macro_json || "");
                            setMacroCompilerError(null);
                            setShowMacroImportModal(true);
                          }}
                          disabled={isRecordingMacro}
                          data-tooltip="Import JSON from file or clipboard"
                        >
                          <Upload size={13} />
                          <span>Import JSON</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* CLICK MODE OR HOLD MODE SETTINGS */
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
                        <div className="card-header">
                          <span>AGENT SELECTION</span>
                        </div>
                        <div className="pane-subtitle">
                          Click agents to queue in order of priority ({agents.length} available)
                        </div>
                      </div>
                      <button className="clear-btn" onClick={clearAgents} data-tooltip="Clear queue selection">
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
                            className={`agent-card ${isSelected ? "selected" : "disabled-agent-greyed"}`}
                            onClick={() => toggleAgent(ag.id)}
                            data-tooltip={`${ag.name} (${ag.role})${isSelected ? ` - Priority #${prioIdx + 1}` : ""}`}
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
                                <div className="agent-starter-dot" data-tooltip="Starter Agent" />
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
                        <div className="card-header">QUEUE</div>
                        <span className="version-pill">
                          {config.selected_agents.length} queued
                        </span>
                      </div>
                      <div className="pane-subtitle" style={{ marginBottom: "4px" }}>
                        Drag to change priority.
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
                                <div
                                  key={agId}
                                  ref={(el) => {
                                    if (el) queueItemRefs.current.set(agId, el);
                                    else queueItemRefs.current.delete(agId);
                                  }}
                                  data-agent-index={idx}
                                  className={`queue-item-row ${draggedAgentIdx === idx ? "dragging" : ""}`}
                                  draggable={false}
                                  onPointerDown={(e) => {
                                    if ((e.target as HTMLElement).closest("button")) return;
                                    e.preventDefault();
                                    activeDragIdxRef.current = idx;
                                    dragStartYRef.current = e.clientY;
                                    setDraggedAgentIdx(idx);
                                    setDragOffsetY(0);
                                  }}
                                  style={{
                                    cursor: draggedAgentIdx === idx ? "grabbing" : "grab",
                                    transform:
                                      draggedAgentIdx === idx
                                        ? `translateY(${dragOffsetY}px) scale(1.03)`
                                        : undefined,
                                    userSelect: "none",
                                    touchAction: "none",
                                  }}
                                >
                                  <GripVertical
                                    size={14}
                                    style={{ color: "var(--text-muted)", cursor: "grab", flexShrink: 0, marginRight: "-2px" }}
                                  />
                                  <span className="queue-item-num">
                                    {String(idx + 1).padStart(2, "0")}
                                  </span>
                                  {cleanName && (
                                    <img
                                      src={localImg}
                                      alt={ag?.name}
                                      draggable={false}
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

                      {/* 1. Lock Delay (5 to 70 seconds, or frozen at 0s with Cyan border if Instalock is ON) */}
                      <div className="control-row" style={{ marginTop: "10px" }}>
                        <div>
                          <div className="control-title">Lock Delay</div>
                          <div className="pane-subtitle">
                            {config.instalock_enabled
                              ? "Instalock is active."
                              : "Delay before locking (req. 20s)."}
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

                      {/* 2. Instalock Toggle */}
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            Instalock
                            <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "1px 7px", borderRadius: "10px", fontWeight: 700 }}>
                              RISKY
                            </span>
                          </div>
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
                                updateAndSaveConfig({ instalock_enabled: true, lock_delay: 0 });
                                setLockDelayInput("0");
                                addLog("[CONFIG] Instalock enabled (0s delay).");
                              } else {
                                const restored =
                                  config.lock_delay >= 5 && config.lock_delay <= 70
                                    ? config.lock_delay
                                    : 20;
                                updateAndSaveConfig({
                                  instalock_enabled: false,
                                  lock_delay: restored,
                                });
                                setLockDelayInput(String(restored));
                                addLog(`[CONFIG] Instalock disabled (restored to ${restored}s).`);
                              }
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {/* 3. Random Agent Toggle */}
                      <div className="control-row" style={{ marginTop: "14px" }}>
                        <div>
                          <div className="control-title">Random</div>
                          <div className="pane-subtitle">
                            Locks a random in-queue agent.
                          </div>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={config.lock_random_agent ?? false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              if (val && (!config.selected_agents || config.selected_agents.length === 0)) {
                                showToast("You must add at least one agent in queue.");
                                return;
                              }
                              updateAndSaveConfig({ lock_random_agent: val });
                              addLog(val ? "[CONFIG] Random agent lock enabled." : "[CONFIG] Random agent lock disabled.");
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
                    Automatically casts surrender vote.
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
                    Automatically casts overtime vote.
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
                        Attempts to initiate Surrender at designated rounds.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.auto_ff_enabled}
                        onChange={(e) => {
                          updateAndSaveConfig({ auto_ff_enabled: e.target.checked });
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
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: MEDIA / MUSIC */}
            {(activeTab === "media" || activeTab === "music") && (
              <div className="tab-pane">
                <div className="card music-card">
                  <div className="music-title">
                    Moog City x Ordinary x End of Beginning x Back to Friends x Bye Bye Bye x Babydoll x Shape of You x See You Again x Caramelldansen  x Somewhere I Belong x Smells Like Teen Spirit x I Like The Way You Kiss Me x I Thought I Saw Your Face Today
                  </div>

                  <input
                    type="range"
                    className="music-slider"
                    min="0"
                    max={musicDuration > 0 ? musicDuration : 100}
                    step="0.1"
                    value={musicCurrentTime}
                    onMouseDown={() => {
                      isDraggingMusicRef.current = true;
                    }}
                    onTouchStart={() => {
                      isDraggingMusicRef.current = true;
                    }}
                    onChange={handleSeekInput}
                    onMouseUp={handleSeekCommit}
                    onTouchEnd={handleSeekCommit}
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
                      Volume: {config.music_volume ?? 80}%
                    </span>
                    <input
                      type="range"
                      className="vol-slider"
                      min="0"
                      max="100"
                      value={config.music_volume ?? 80}
                      onChange={handleVolumeChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MOBILE REMOTE */}
            {activeTab === "remote" && (
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
                            onClick={() => setShowResetConfirmModal(true)}
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

                    {/* Unique Control Toggle */}
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
                          onChange={handleToggleUniqueControl}
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
                              onClick={() => handleRemoveDevice(dev.id)}
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
            )}

            {/* TAB: INFO */}
            {(activeTab === "info" || activeTab === "changelog") && (
              <div className="tab-pane">
                {/* 1. Header Card */}
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

                {/* How to use SageBot */}
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
                      <span>Hit the hotkey (<strong style={{ color: "#10b981" }}>{config.hotkey}</strong>) to start/stop.</span>
                    </div>
                  </div>
                </div>

                {/* 4. What is Risky */}
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

                {/* 6. Changelog */}
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
            )}

            {/* TAB 9: SETTINGS */}
            {activeTab === "settings" && (
              <div className="tab-pane">
                {/* 1. Updates on Top */}
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
                            showToast(`You are on the latest version (v${info.current_version})`);
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
                          addLog(
                            val
                              ? "[SETTINGS] Low Detail Mode enabled."
                              : "[SETTINGS] Low Detail Mode disabled."
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
              className="footer-btn footer-btn-discord"
              onClick={() => {
                openUrl("https://discord.gg/5443EerzgQ").catch(() => {
                  window.open("https://discord.gg/5443EerzgQ", "_blank");
                });
              }}
              data-tooltip="Join Discord Server"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Discord</span>
            </button>
            <button
              className={`footer-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
              data-tooltip="Settings"
            >
              <SettingsIcon size={14} />
              <span>Settings</span>
            </button>
          </div>

          {/* Center Profile: Riot ID + bullet dot + Rank Logo with tooltip */}
          <div className="footer-center-profile">
            {(() => {
              const self = roster?.ally_team.find((p) => p.is_self);
              const riotId =
                status.player_name && status.player_tag
                  ? `${status.player_name}#${status.player_tag}`
                  : self?.name || "Player";
              const tier = self?.current_tier ?? status.rank_tier ?? 0;
              const rankName = self?.current_rank_name || status.rank_name || "Unranked";
              const rr = self?.current_rr ?? 0;
              const rankTooltip = `${rankName}${rr > 0 ? ` (${rr} RR)` : ""}`;

              return (
                <div className="footer-player-profile">
                  <span className="footer-player-name">{riotId}</span>
                  <span className="footer-bullet">•</span>
                  <div className="footer-rank-badge" data-tooltip={rankTooltip}>
                    <img
                      src={getRankIconUrl(tier)}
                      className="footer-rank-icon"
                      alt={rankName}
                    />
                    <span className="footer-rank-name">{rankName}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="footer-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className={`footer-game-phase-badge ${status.match_state?.includes("Queue") ? "in-queue" : ""}`}
              style={{ color: getPhaseColor(status.match_state) }}
              data-tooltip="Current Game Phase"
            >
              {status.match_state || "-"}
            </span>
            <button
              className="footer-btn-kill"
              onClick={() => setShowKillModal(true)}
              data-tooltip="Terminate VALORANT"
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
                  if (runningRef.current) {
                    stopSagebot("VALORANT terminated.");
                  }
                  setShowKillModal(false);
                  invoke("kill_valorant").catch(() => { });
                }}
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
                    addLog("[LAUNCH] Starting VALORANT via Riot Client...");
                    showToast("Launching VALORANT...");
                    invoke("launch_valorant")
                      .then(() => addLog("[LAUNCH] VALORANT launch command sent successfully."))
                      .catch((err) => addLog(`[LAUNCH] Failed: ${err}`));
                  } else {
                    addLog("[LAUNCH] Opening Riot Client for login...");
                    showToast("Opening Riot Client for login...");
                    invoke("launch_riot_client")
                      .then(() => addLog("[LAUNCH] Riot Client started for login."))
                      .catch((err) => addLog(`[LAUNCH] Failed: ${err}`));
                  }
                }}
              >
                {isRiotSignedIn ? "Launch VALORANT" : "Open Riot Client"}
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

      {/* Auto Update Modal (Darkened background, auto downloads & restarts) */}
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
                  onClick={() => {
                    document.getElementById("macro-file-input")?.click();
                  }}
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
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                        }}
                      >
                        {/* Result badge + Map name */}
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
                                    letterSpacing: "0.4px"
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
                                    letterSpacing: "0.4px"
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
                                    gap: "3px"
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

                        {/* RR Delta */}
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
                            textAlign: "center"
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
                    fontSize: "13px"
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button
                className="modal-btn secondary"
                onClick={handleDenyDevice}
              >
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
    </div>
  );
}
