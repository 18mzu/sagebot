export interface MacroAction {
  key: string;
  start_ms: number;
  duration_ms: number;
}

export interface MacroData {
  total_loop_ms: number;
  actions: MacroAction[];
}

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string;
  release_url: string;
  auto_update_allowed?: boolean;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  color: string;
  is_starter: boolean;
}

export interface AppConfig {
  hotkey: string;
  auto_vote_mode: number;
  auto_overtime_vote_mode: number;
  vote_yes_key?: string;
  vote_no_key?: string;
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
  agent_lock_mode?: string;
  fill_roles?: string[];
  fill_fallback_mode?: string;
  fill_timing_mode?: string;
  fill_delay?: number;
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

export interface StatusResponse {
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

export interface RecentMatchDetail {
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

export interface TrackedPlayer {
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
  encounter?: PlayerEncounter | null;
}

export interface LiveMatchRoster {
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

export type TabType =
  | "main"
  | "tracker"
  | "career"
  | "players"
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

export interface EncounterMatchHistory {
  match_id: string;
  timestamp: number;
  date_str: string;
  time_str: string;
  map_name: string;
  gamemode: string;
  relationship: string; // "PLAYED WITH" or "PLAYED AGAINST"
  result: string;       // "VICTORY", "DEFEAT", "DRAW"
  score_ally: number;
  score_enemy: number;
  agent_id: string;
  agent_name: string;
  rank_tier: number;
  rank_name: string;
  rr: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  is_win: boolean;
}

export interface PlayerEncounter {
  puuid: string;
  name: string;
  tag: string;
  is_hidden: boolean;
  encounters_count: number;
  matches_as_ally: number;
  wins_as_ally: number;
  losses_as_ally: number;
  matches_as_enemy: number;
  wins_against: number;
  losses_against: number;
  last_seen_timestamp: number;
  last_seen_date_str: string;
  last_seen_time_str: string;
  last_seen_map: string;
  last_seen_agent_id: string;
  last_seen_agent_name: string;
  last_rank_tier: number;
  last_rank_name: string;
  last_rr: number;
  last_score_ally: number;
  last_score_enemy: number;
  last_result: string;
  last_relationship: string;
  history?: EncounterMatchHistory[];
}

export interface CareerHeadToHead {
  enemy_puuid: string;
  enemy_name: string;
  enemy_tag: string;
  enemy_agent_id: string;
  enemy_agent_name: string;
  enemy_rank_tier: number;
  enemy_rank_name: string;
  enemy_rr: number;
  kills_on_enemy: number;
  deaths_to_enemy: number;
  damage_dealt: number;
  damage_taken: number;
  headshots_on_enemy: number;
  first_kill_duels_won: number;
  first_kill_duels_lost: number;
}

export interface CareerKillEvent {
  time_in_round: number;
  time_str: string;
  killer_puuid: string;
  killer_agent_id: string;
  killer_name: string;
  killer_is_ally: boolean;
  victim_puuid: string;
  victim_agent_id: string;
  victim_name: string;
  victim_is_ally: boolean;
  weapon_name: string;
  is_headshot: boolean;
  event_type: "kill" | "plant" | "defuse" | string;
  kill_distance_meters?: number;
}

export interface CareerRoundPlayerEconomy {
  puuid: string;
  name: string;
  agent_id: string;
  agent_name: string;
  is_ally: boolean;
  kills: number;
  assists: number;
  loadout_value: number;
  remaining_bank: number;
  weapon_name: string;
  armor_name: string;
}

export interface CareerRoundResult {
  round_num: number;
  winning_team: string; // "Ally" | "Enemy"
  round_result_type: string;
  win_icon: string; // "elim" | "defuse" | "detonate" | "time"
  events: CareerKillEvent[];
  player_economies: CareerRoundPlayerEconomy[];
  avg_loadout_ally: number;
  avg_loadout_enemy: number;
  avg_bank_ally: number;
  avg_bank_enemy: number;
}

export interface CareerPlayer {
  puuid: string;
  name: string;
  tag: string;
  team: string; // "Ally" | "Enemy"
  is_self: boolean;
  agent_id: string;
  agent_name: string;
  rank_tier: number;
  rank_name: string;
  rr: number;
  party_tag: string;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  kd_ratio: number;
  headshot_percent: number;
  first_bloods: number;
  multi_kills: number;
  plants: number;
  defuses: number;
  trades: number;
  encounter?: PlayerEncounter | null;
}

export interface CareerMatch {
  match_id: string;
  timestamp: number;
  date_str: string;
  time_str: string;
  duration_seconds: number;
  gamemode: string;
  map_name: string;
  result: "VICTORY" | "DEFEAT" | "DRAW" | string;
  score_ally: number;
  score_enemy: number;
  my_agent_id: string;
  my_agent_name: string;
  my_rank_tier: number;
  my_rank_name: string;
  my_rr_change: number;
  my_kills: number;
  my_deaths: number;
  my_assists: number;
  my_score: number;
  my_hs_percent: number;
  players: CareerPlayer[];
  head_to_head?: CareerHeadToHead[];
  round_results?: CareerRoundResult[];
}

export interface ToastMsg {
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
