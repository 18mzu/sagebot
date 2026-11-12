use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// In-memory cache for weapon skin UUIDs to clean display names
static SKIN_MAP: std::sync::OnceLock<Arc<RwLock<HashMap<String, String>>>> = std::sync::OnceLock::new();
static ACTIVE_SEASON_ID: std::sync::OnceLock<Arc<RwLock<String>>> = std::sync::OnceLock::new();

fn get_skin_map() -> &'static Arc<RwLock<HashMap<String, String>>> {
    SKIN_MAP.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

fn get_active_season_id() -> &'static Arc<RwLock<String>> {
    // Default to known active Act: V26 // ACT VI
    ACTIVE_SEASON_ID.get_or_init(|| Arc::new(RwLock::new("d816f426-48ea-f052-117f-9697a155b319".to_string())))
}

static SEASON_MAP: std::sync::OnceLock<Arc<RwLock<HashMap<String, String>>>> = std::sync::OnceLock::new();

fn get_season_map() -> &'static Arc<RwLock<HashMap<String, String>>> {
    SEASON_MAP.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

static ORDERED_SEASONS: std::sync::OnceLock<Arc<RwLock<Vec<(String, String, u64)>>>> = std::sync::OnceLock::new();

fn get_ordered_seasons() -> &'static Arc<RwLock<Vec<(String, String, u64)>>> {
    ORDERED_SEASONS.get_or_init(|| Arc::new(RwLock::new(Vec::new())))
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WalletBalances {
    pub vp: u32,
    pub rp: u32,
    pub kc: u32,
    pub agent_tokens: u32,
}

static WALLET_CACHE: std::sync::OnceLock<Arc<RwLock<Option<(std::time::Instant, WalletBalances)>>>> = std::sync::OnceLock::new();

fn get_wallet_cache() -> &'static Arc<RwLock<Option<(std::time::Instant, WalletBalances)>>> {
    WALLET_CACHE.get_or_init(|| Arc::new(RwLock::new(None)))
}

static LAST_ACTIVE_ROSTER: std::sync::OnceLock<Arc<RwLock<Option<LiveMatchRoster>>>> = std::sync::OnceLock::new();

pub fn get_last_active_roster_holder() -> &'static Arc<RwLock<Option<LiveMatchRoster>>> {
    LAST_ACTIVE_ROSTER.get_or_init(|| Arc::new(RwLock::new(None)))
}

pub async fn get_cached_or_fetch_wallet(puuid: &str) -> Option<WalletBalances> {
    {
        let r = get_wallet_cache().read().await;
        if let Some((instant, ref w)) = *r {
            if instant.elapsed() < std::time::Duration::from_secs(20) {
                return Some(w.clone());
            }
        }
    }

    let lockfile = crate::valorant::LockfileData::read_from_disk().ok()?;
    let client = reqwest::Client::builder().danger_accept_invalid_certs(true).build().ok()?;
    use base64::Engine;
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{}", lockfile.password));
    let token_resp = client.get(format!("https://127.0.0.1:{}/entitlements/v1/token", lockfile.port))
        .header("Authorization", format!("Basic {}", auth))
        .send().await.ok()?;
    let token_json = token_resp.json::<serde_json::Value>().await.ok()?;
    let access_token = token_json.get("accessToken").and_then(|s| s.as_str())?;
    let jwt = token_json.get("token").and_then(|s| s.as_str())?;

    let client_version = crate::valorant::discover_client_version();
    let glz_host = crate::valorant::discover_glz_host();
    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    let url = format!("https://{}/store/v1/wallet/{}", pd_host, puuid);
    let req = client.get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await.ok()?;

    if req.status().is_success() {
        if let Ok(json) = req.json::<serde_json::Value>().await {
            if let Some(balances) = json.get("Balances").and_then(|b| b.as_object()) {
                let vp = balances.get("85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let kc = balances.get("85ca954a-41f2-ce94-9b45-8ca3dd39a00d").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let rp = balances.get("e59aa87c-4cbf-517a-5983-6e81511be9b7").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let agent_tokens = balances.get("f08d4ae3-939c-4576-ab26-09ce1f23bb37").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

                let wb = WalletBalances { vp, rp, kc, agent_tokens };
                let mut w = get_wallet_cache().write().await;
                *w = Some((std::time::Instant::now(), wb.clone()));
                return Some(wb);
            }
        }
    }
    None
}

static RR_CACHE: std::sync::OnceLock<Arc<RwLock<Option<(std::time::Instant, String, i64)>>>> = std::sync::OnceLock::new();

fn get_rr_cache() -> &'static Arc<RwLock<Option<(std::time::Instant, String, i64)>>> {
    RR_CACHE.get_or_init(|| Arc::new(RwLock::new(None)))
}

pub async fn get_cached_or_fetch_player_rr(puuid: &str) -> Option<i64> {
    {
        let r = get_rr_cache().read().await;
        if let Some((instant, ref p, rr)) = *r {
            if p == puuid && instant.elapsed() < std::time::Duration::from_secs(30) {
                return Some(rr);
            }
        }
    }

    let lockfile = crate::valorant::LockfileData::read_from_disk().ok()?;
    let client = reqwest::Client::builder().danger_accept_invalid_certs(true).build().ok()?;
    use base64::Engine;
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{}", lockfile.password));
    let token_resp = client.get(format!("https://127.0.0.1:{}/entitlements/v1/token", lockfile.port))
        .header("Authorization", format!("Basic {}", auth))
        .send().await.ok()?;
    let token_json = token_resp.json::<serde_json::Value>().await.ok()?;
    let access_token = token_json.get("accessToken").and_then(|s| s.as_str())?;
    let jwt = token_json.get("token").and_then(|s| s.as_str())?;

    let client_version = crate::valorant::discover_client_version();
    let glz_host = crate::valorant::discover_glz_host();
    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    let mmr_url = format!("https://{}/mmr/v1/players/{}", pd_host, puuid);
    let req = client.get(&mmr_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .header("User-Agent", "ShooterGame/22 Windows/10.0.19042.1.256.64bit")
        .send().await.ok()?;

    if req.status().is_success() {
        if let Ok(json) = req.json::<serde_json::Value>().await {
            let mut resolved_rr: Option<i64> = None;
            if let Some(latest) = json.get("LatestCompetitiveUpdate") {
                if let Some(rr) = latest.get("RankedRatingAfterUpdate").and_then(|r| r.as_i64()) {
                    resolved_rr = Some(rr);
                }
            }
            if resolved_rr.is_none() {
                if let Some(comp) = json.get("QueueSkills").and_then(|q| q.get("competitive")) {
                    if let Some(seasonal) = comp.get("SeasonalInfoBySeasonID").and_then(|s| s.as_object()) {
                        for (_, sdata) in seasonal {
                            if let Some(rr) = sdata.get("RankedRating").and_then(|r| r.as_i64()) {
                                if sdata.get("CompetitiveTier").and_then(|t| t.as_u64()).unwrap_or(0) > 0 {
                                    resolved_rr = Some(rr);
                                }
                            }
                        }
                    }
                }
            }
            if let Some(rr) = resolved_rr {
                let mut w = get_rr_cache().write().await;
                *w = Some((std::time::Instant::now(), puuid.to_string(), rr));
                return Some(rr);
            }
        }
    }
    None
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RecentMatchDetail {
    pub result: String,           // "W", "L", "D"
    pub rr_change: i64,           // e.g. 21, -14, 0
    pub map_name: String,         // e.g. "Lotus", "Sunset", "Abyss"
    pub tier_before: u32,
    pub tier_after: u32,
    pub tier_name: String,        // e.g. "Silver 2"
    pub rr_after: i64,
    pub performance_bonus: i64,
    pub match_id: String,
    pub timestamp: u64,           // unix timestamp in ms (MatchStartTime)
    pub is_rank_up: bool,
    pub is_derank: bool,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub kd_ratio: f64,
    pub has_kda: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedPlayer {
    pub puuid: String,
    pub name: String,               // Real GameName#TagLine
    pub team: String,               // "Blue" (Ally) or "Red" (Enemy)
    pub agent_id: String,           // Agent GUID
    pub agent_name: String,         // Resolved agent name (e.g. "Sage", "Jett", "Reyna")
    pub level: u32,                 // Account level
    pub current_tier: u32,          // 0..27 (e.g. 4 = Iron 2, 6 = Bronze 1)
    pub current_rank_name: String,  // "Bronze 1", "Iron 2", etc.
    pub current_rr: i64,            // Ranked Rating (e.g. 23 RR)
    pub peak_tier: u32,             // Peak rank tier (0..27)
    pub peak_rank_name: String,     // Peak rank name
    pub peak_season: String,        // e.g. "E7: A2"
    pub last_season_tier: u32,      // Rank tier in previous season
    pub last_season_rank_name: String,
    pub last_season_name: String,   // e.g. "V26: A5"
    pub win_rate: f64,              // Win rate %
    pub total_games: u32,           // Total competitive games recorded
    pub recent_games: Vec<String>,  // Up to 5 recent games: "W", "L", "D"
    pub recent_matches: Vec<RecentMatchDetail>, // Detailed recent matches
    pub kd_ratio: f64,              // Calculated recent K/D rate
    pub total_kills: u32,
    pub total_deaths: u32,
    pub total_assists: u32,
    pub primary_skin: String,       // Primary weapon skin
    pub weapon_skins: HashMap<String, String>, // All 21 weapon skins
    pub all_skins: Vec<String>,     // Equipped major skins
    pub is_incognito: bool,         // True if player was hiding name in-game
    pub is_self: bool,              // True if this is the local user
    pub party_tag: String,          // e.g. "Party 1" if in a duo/party, else ""
    #[serde(default)]
    pub encounter: Option<crate::encounter_memory::PlayerEncounter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveMatchRoster {
    pub state: String,              // "PREGAME" | "COREGAME" | "NO_MATCH"
    pub match_id: String,
    pub map_name: String,
    pub gamemode: String,
    pub server_name: String,
    pub ally_team: Vec<TrackedPlayer>,
    pub enemy_team: Vec<TrackedPlayer>,
    pub updated_at: String,
    pub rate_limit_seconds: Option<u64>,
}

pub fn get_rank_name(tier: u32) -> &'static str {
    match tier {
        0 => "Unranked",
        1..=2 => "Unranked",
        3 => "Iron 1",
        4 => "Iron 2",
        5 => "Iron 3",
        6 => "Bronze 1",
        7 => "Bronze 2",
        8 => "Bronze 3",
        9 => "Silver 1",
        10 => "Silver 2",
        11 => "Silver 3",
        12 => "Gold 1",
        13 => "Gold 2",
        14 => "Gold 3",
        15 => "Platinum 1",
        16 => "Platinum 2",
        17 => "Platinum 3",
        18 => "Diamond 1",
        19 => "Diamond 2",
        20 => "Diamond 3",
        21 => "Ascendant 1",
        22 => "Ascendant 2",
        23 => "Ascendant 3",
        24 => "Immortal 1",
        25 => "Immortal 2",
        26 => "Immortal 3",
        27 => "Radiant",
        _ => "Unranked",
    }
}

// Fetch and cache skin names and active season from valorant-api.com
pub async fn ensure_skin_cache(client: &reqwest::Client) {
    {
        let reader = get_skin_map().read().await;
        if !reader.is_empty() {
            return;
        }
    }

    // 1. Fetch weapon skins
    let url = "https://valorant-api.com/v1/weapons/skins";
    if let Ok(resp) = client.get(url).send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                let mut map = HashMap::new();
                for skin in data {
                    let skin_name = skin.get("displayName").and_then(|n| n.as_str()).unwrap_or("").to_string();
                    if skin_name.is_empty() || skin_name == "Standard" || skin_name.starts_with("Random") {
                        continue;
                    }

                    if let Some(uuid) = skin.get("uuid").and_then(|u| u.as_str()) {
                        map.insert(uuid.to_lowercase(), skin_name.clone());
                    }

                    if let Some(levels) = skin.get("levels").and_then(|l| l.as_array()) {
                        for lvl in levels {
                            if let Some(lvl_uuid) = lvl.get("uuid").and_then(|u| u.as_str()) {
                                map.insert(lvl_uuid.to_lowercase(), skin_name.clone());
                            }
                        }
                    }

                    if let Some(chromas) = skin.get("chromas").and_then(|c| c.as_array()) {
                        for ch in chromas {
                            if let Some(ch_uuid) = ch.get("uuid").and_then(|u| u.as_str()) {
                                map.insert(ch_uuid.to_lowercase(), skin_name.clone());
                            }
                        }
                    }
                }

                let mut writer = get_skin_map().write().await;
                *writer = map;
            }
        }
    }

    // 2. Fetch seasons, populate season code map, and identify the active Act Season ID
    let s_url = "https://valorant-api.com/v1/seasons";
    if let Ok(resp) = client.get(s_url).send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                let now = std::time::SystemTime::now();
                let now_secs = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

                let mut ep_names: HashMap<String, String> = HashMap::new();
                for season in data {
                    let parent = season.get("parentUuid").and_then(|p| p.as_str()).unwrap_or("");
                    let stype = season.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    // Root seasons/episodes have null or empty parentUuid, or stype is Episode
                    if parent.is_empty() || stype == "EAresSeasonType::Episode" {
                        if let (Some(uuid), Some(name)) = (
                            season.get("uuid").and_then(|u| u.as_str()),
                            season.get("displayName").and_then(|d| d.as_str()),
                        ) {
                            let upper = name.trim().to_uppercase();
                            let ep_code = if upper.starts_with("EPISODE ") {
                                upper.replace("EPISODE ", "E")
                            } else {
                                upper
                            };
                            ep_names.insert(uuid.to_string(), ep_code);
                        }
                    }
                }

                let mut s_map: HashMap<String, String> = HashMap::new();
                let mut matched_act: Option<String> = None;
                let mut ordered_acts = Vec::new();

                for season in data {
                    let parent_uuid = season.get("parentUuid").and_then(|p| p.as_str()).unwrap_or("");
                    // Acts are children of an episode/season (parentUuid is not empty)
                    if !parent_uuid.is_empty() {
                        if let (Some(start_str), Some(end_str), Some(uuid), Some(name)) = (
                            season.get("startTime").and_then(|s| s.as_str()),
                            season.get("endTime").and_then(|s| s.as_str()),
                            season.get("uuid").and_then(|u| u.as_str()),
                            season.get("displayName").and_then(|d| d.as_str()),
                        ) {
                            let ep_code = ep_names.get(parent_uuid).cloned().unwrap_or_else(|| "E?".to_string());
                            let act_code = match name.trim() {
                                "ACT I" => "A1".to_string(),
                                "ACT II" => "A2".to_string(),
                                "ACT III" => "A3".to_string(),
                                "ACT IV" => "A4".to_string(),
                                "ACT V" => "A5".to_string(),
                                "ACT VI" => "A6".to_string(),
                                other => other.replace("ACT ", "A"),
                            };
                            let label = format!("{}: {}", ep_code, act_code);
                            s_map.insert(uuid.to_lowercase(), label.clone());

                            let start_ts = parse_iso_ts(start_str);
                            let end_ts = parse_iso_ts(end_str);
                            ordered_acts.push((uuid.to_lowercase(), label, start_ts));
                            if now_secs >= start_ts && now_secs <= end_ts {
                                matched_act = Some(uuid.to_string());
                            }
                        }
                    }
                }

                ordered_acts.sort_by_key(|k| k.2);
                {
                    let mut o_writer = get_ordered_seasons().write().await;
                    *o_writer = ordered_acts;
                }

                {
                    let mut s_writer = get_season_map().write().await;
                    *s_writer = s_map;
                }

                if let Some(act_id) = matched_act {
                    let mut writer = get_active_season_id().write().await;
                    *writer = act_id;
                }
            }
        }
    }
}

fn parse_iso_ts(s: &str) -> u64 {
    if s.len() < 19 {
        return 0;
    }
    let year: u64 = s[0..4].parse().unwrap_or(1970);
    let month: usize = s[5..7].parse().unwrap_or(1);
    let day: u64 = s[8..10].parse().unwrap_or(1);
    let hour: u64 = s[11..13].parse().unwrap_or(0);
    let min: u64 = s[14..16].parse().unwrap_or(0);
    let sec: u64 = s[17..19].parse().unwrap_or(0);

    let days_before_month = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let m_idx = month.clamp(1, 12);
    let mut total_days = (year.saturating_sub(1970)) * 365;
    for y in 1970..year {
        if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) {
            total_days += 1;
        }
    }
    total_days += days_before_month[m_idx] as u64;
    if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) && month > 2 {
        total_days += 1;
    }
    total_days += day.saturating_sub(1);

    total_days * 86400 + hour * 3600 + min * 60 + sec
}

// Extract skins from player loadout item map for all 21 weapons in VALORANT
pub async fn extract_player_skins(loadout_items: &serde_json::Value) -> (String, HashMap<String, String>, Vec<String>) {
    if loadout_items.is_null() || loadout_items.as_object().map(|o| o.is_empty()).unwrap_or(true) {
        return ("TBD".to_string(), HashMap::new(), Vec::new());
    }

    let mut weapon_skins: HashMap<String, String> = HashMap::new();
    let mut all_skins: Vec<String> = Vec::new();

    // All 21 VALORANT Weapons across all 6 categories (from Buy Menu)
    let weapons = [
        // Rifles
        ("vandal", "9c82e19d-4575-0200-1a81-3eacf00cf872", "Vandal"),
        ("phantom", "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", "Phantom"),
        ("operator", "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", "Operator"),
        ("warden", "8db0a1bf-4a50-832a-4566-faaaa6d250ca", "Warden"),
        ("bulldog", "ae3de142-4d85-2547-dd26-4e90bed35cf7", "Bulldog"),
        ("guardian", "4ade7faa-4cf1-8376-95ef-39884480959b", "Guardian"),
        // Sidearms
        ("classic", "29a0cfab-485b-f5d5-779a-b59f85e204a8", "Classic"),
        ("ghost", "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", "Ghost"),
        ("sheriff", "e336c6b8-418d-9340-d77f-7a9e4cfe0702", "Sheriff"),
        ("bandit", "410b2e0b-4ceb-1321-1727-20858f7f3477", "Bandit"),
        ("frenzy", "44d4e95c-4157-0037-81b2-17841bf2e8e3", "Frenzy"),
        ("shorty", "42da8ccc-40d5-affc-beec-15aa47b42eda", "Shorty"),
        // SMGs
        ("spectre", "462080d1-4035-2937-7c09-27aa2a5c27a7", "Spectre"),
        ("stinger", "f7e1b454-4ad4-1063-ec0a-159e56b58941", "Stinger"),
        // Shotguns
        ("judge", "ec845bf4-4f79-ddda-a3da-0db3774b2794", "Judge"),
        ("bucky", "910be174-449b-c412-ab22-d0873436b21b", "Bucky"),
        // Heavy & Snipers
        ("outlaw", "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c", "Outlaw"),
        ("marshal", "c4883e50-4494-202c-3ec3-6b8a9284f00b", "Marshal"),
        ("ares", "55d8a0f4-4274-ca67-fe2c-06ab45efdf58", "Ares"),
        ("odin", "63e6c2b6-4a8e-869c-3d4c-e38355226584", "Odin"),
        // Melee
        ("melee", "2f59173c-4bed-b6c3-2191-dea9b58be9c7", "Knife"),
    ];

    let inspect_weapon = |weapon_id: &str| -> Option<String> {
        if let Some(w) = loadout_items.get(weapon_id) {
            let mut candidate_ids = Vec::new();
            if let Some(id) = w.get("ID").and_then(|v| v.as_str()) {
                candidate_ids.push(id);
            }
            if let Some(sockets) = w.get("Sockets").and_then(|s| s.as_object()) {
                for (_, sock) in sockets {
                    if let Some(item) = sock.get("Item").and_then(|i| i.as_object()) {
                        if let Some(id) = item.get("ID").and_then(|v| v.as_str()) {
                            candidate_ids.push(id);
                        }
                    }
                    if let Some(id) = sock.get("ID").and_then(|v| v.as_str()) {
                        candidate_ids.push(id);
                    }
                }
            }

            for cid in candidate_ids {
                if let Ok(reader) = get_skin_map().try_read() {
                    if let Some(name) = reader.get(&cid.to_lowercase()) {
                        return Some(name.clone());
                    }
                }
            }
        }
        None
    };

    for (key, uuid, label) in weapons {
        if let Some(skin_name) = inspect_weapon(uuid) {
            weapon_skins.insert(key.to_string(), skin_name.clone());
            all_skins.push(format!("{}: {}", label, skin_name));
        } else {
            weapon_skins.insert(key.to_string(), format!("Standard {}", label));
        }
    }

    // Determine primary skin (Vandal -> Phantom -> Operator -> default)
    let primary_skin = if let Some(v) = weapon_skins.get("vandal") {
        if !v.starts_with("Standard") {
            v.clone()
        } else if let Some(p) = weapon_skins.get("phantom") {
            if !p.starts_with("Standard") {
                p.clone()
            } else {
                v.clone()
            }
        } else {
            v.clone()
        }
    } else {
        "Standard Vandal".to_string()
    };

    weapon_skins.insert("primary".to_string(), primary_skin.clone());

    (primary_skin, weapon_skins, all_skins)
}

#[derive(Clone, Default)]
pub struct CachedPlayerData {
    pub level: u32,
    pub match_ids: Vec<String>,
    pub current_tier: u32,
    pub current_rr: i64,
    pub peak_tier: u32,
    pub peak_season: String,
    pub last_season_tier: u32,
    pub last_season_rank_name: String,
    pub last_season_name: String,
    pub win_rate: f64,
    pub total_games: u32,
    pub recent_games: Vec<String>,
    pub recent_matches: Vec<RecentMatchDetail>,
    pub kd_ratio: f64,
    pub total_kills: u32,
    pub total_deaths: u32,
    pub total_assists: u32,
}

static MATCH_DETAILS_CACHE: std::sync::OnceLock<Arc<RwLock<HashMap<String, serde_json::Value>>>> = std::sync::OnceLock::new();

fn get_match_cache() -> &'static Arc<RwLock<HashMap<String, serde_json::Value>>> {
    MATCH_DETAILS_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

pub async fn fetch_match_kda(
    client: &reqwest::Client,
    pd_host: &str,
    match_id: &str,
    puuid: &str,
    access_token: &str,
    jwt: &str,
    client_version: &str,
) -> Option<(u32, u32, u32)> {
    if match_id.is_empty() {
        return None;
    }

    // Check cache
    let cached = {
        let cache = get_match_cache().read().await;
        cache.get(match_id).cloned()
    };

    let m_json = if let Some(j) = cached {
        j
    } else {
        let match_url = format!("https://{}/match-details/v1/matches/{}", pd_host, match_id);
        let resp = client.get(&match_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", client_version)
            .send().await.ok()?;

        if !resp.status().is_success() {
            return None;
        }

        let parsed: serde_json::Value = resp.json().await.ok()?;
        let mut cache = get_match_cache().write().await;
        cache.insert(match_id.to_string(), parsed.clone());
        parsed
    };

    if let Some(players) = m_json.get("players").and_then(|p| p.as_array()) {
        for p in players {
            if p.get("subject").and_then(|s| s.as_str()) == Some(puuid) {
                if let Some(stats) = p.get("stats") {
                    let k = stats.get("kills").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    let d = stats.get("deaths").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    let a = stats.get("assists").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    return Some((k, d, a));
                }
            }
        }
    }
    None
}

pub async fn fetch_matches_kda_internal(
    client: &reqwest::Client,
    access_token: &str,
    jwt: &str,
    puuid: &str,
    glz_host: &str,
    client_version: &str,
    mut matches: Vec<RecentMatchDetail>,
) -> Result<Vec<RecentMatchDetail>, String> {
    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    for m in &mut matches {
        if m.has_kda {
            continue;
        }
        if let Some((k, d, a)) = fetch_match_kda(client, &pd_host, &m.match_id, puuid, access_token, jwt, client_version).await {
            m.kills = k;
            m.deaths = d;
            m.assists = a;
            m.kd_ratio = if d == 0 { k as f64 } else { ((k as f64 / d as f64) * 100.0).round() / 100.0 };
            m.has_kda = true;
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
    }
    Ok(matches)
}

static PLAYER_DATA_CACHE: std::sync::OnceLock<Arc<RwLock<HashMap<String, (CachedPlayerData, std::time::Instant)>>>> = std::sync::OnceLock::new();

fn get_player_cache() -> &'static Arc<RwLock<HashMap<String, (CachedPlayerData, std::time::Instant)>>> {
    PLAYER_DATA_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

static API_SEMAPHORE: std::sync::OnceLock<Arc<tokio::sync::Semaphore>> = std::sync::OnceLock::new();

fn get_api_semaphore() -> &'static Arc<tokio::sync::Semaphore> {
    API_SEMAPHORE.get_or_init(|| Arc::new(tokio::sync::Semaphore::new(2)))
}

static RATE_LIMIT_EXPIRY: std::sync::OnceLock<Arc<RwLock<Option<(std::time::Instant, u64)>>>> = std::sync::OnceLock::new();

fn get_rate_limit_expiry() -> &'static Arc<RwLock<Option<(std::time::Instant, u64)>>> {
    RATE_LIMIT_EXPIRY.get_or_init(|| Arc::new(RwLock::new(None)))
}

async fn get_current_rate_limit_secs() -> Option<u64> {
    let r = get_rate_limit_expiry().read().await;
    if let Some((instant, _)) = *r {
        let now = std::time::Instant::now();
        if instant > now {
            Some(instant.duration_since(now).as_secs().max(1))
        } else {
            None
        }
    } else {
        None
    }
}

// Fetch complete player stats: Account level, Match IDs, MMR (Current/Peak Rank), and 5 Recent Games
// Protected by in-memory caching (10 min TTL), semaphore concurrency limiting (max 2), and 429 backoff retry
async fn fetch_player_full_stats(
    client: &reqwest::Client,
    pd_host: &str,
    puuid: &str,
    access_token: &str,
    jwt: &str,
    client_version: &str,
    active_season_id: &str,
    given_level: u32,
) -> CachedPlayerData {
    // 1. Check in-memory cache
    {
        let reader = get_player_cache().read().await;
        if let Some((cached, instant)) = reader.get(puuid) {
            let has_data = cached.current_tier > 0 || cached.peak_tier > 0 || cached.last_season_tier > 0 || !cached.recent_games.is_empty();
            if (has_data && instant.elapsed().as_secs() < 600) || (!has_data && instant.elapsed().as_secs() < 8) {
                let mut c = cached.clone();
                if given_level > 0 {
                    c.level = given_level;
                }
                return c;
            }
        }
    }

    // 2. Throttle concurrency via Semaphore (at most 2 requests active to Riot's PD servers)
    let _permit = get_api_semaphore().acquire().await.ok();
    tokio::time::sleep(std::time::Duration::from_millis(40)).await;

    let mut eff_level = given_level;
    let mut match_ids = Vec::new();

    // 3. Only fetch match history if account level is unknown (saves 10+ calls per match!)
    if eff_level == 0 {
        let hist_url = format!("https://{}/match-history/v1/history/{}?startIndex=0&endIndex=5", pd_host, puuid);
        if let Ok(hist_resp) = client.get(&hist_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", client_version)
            .send().await {
            if let Ok(hist_json) = hist_resp.json::<serde_json::Value>().await {
                if let Some(history) = hist_json.get("History").and_then(|h| h.as_array()) {
                    for item in history {
                        if let Some(m_id) = item.get("MatchID").and_then(|m| m.as_str()) {
                            match_ids.push(m_id.to_string());
                        }
                    }

                    if let Some(first_match) = history.first() {
                        if let Some(match_id) = first_match.get("MatchID").and_then(|m| m.as_str()) {
                            let match_url = format!("https://{}/match-details/v1/matches/{}", pd_host, match_id);
                            if let Ok(match_resp) = client.get(&match_url)
                                .header("Authorization", format!("Bearer {}", access_token))
                                .header("X-Riot-Entitlements-JWT", jwt)
                                .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
                                .header("X-Riot-ClientVersion", client_version)
                                .send().await {
                                if let Ok(m_json) = match_resp.json::<serde_json::Value>().await {
                                    if let Some(players) = m_json.get("players").and_then(|p| p.as_array()) {
                                        for p in players {
                                            if p.get("subject").and_then(|s| s.as_str()) == Some(puuid) {
                                                if let Some(lvl) = p.get("accountLevel").and_then(|l| l.as_u64()) {
                                                    if lvl > 0 {
                                                        eff_level = lvl as u32;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    tokio::time::sleep(std::time::Duration::from_millis(40)).await;

    // 4. Fetch MMR details
    let mmr_url = format!("https://{}/mmr/v1/players/{}", pd_host, puuid);
    let mut mmr_req = client.get(&mmr_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await;

    if let Ok(ref resp) = mmr_req {
        if resp.status().as_u16() == 429 {
            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
            mmr_req = client.get(&mmr_url)
                .header("Authorization", format!("Bearer {}", access_token))
                .header("X-Riot-Entitlements-JWT", jwt)
                .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
                .header("X-Riot-ClientVersion", client_version)
                .send().await;
        }
    }

    let season_map = { get_season_map().read().await.clone() };
    let ordered_seasons = { get_ordered_seasons().read().await.clone() };

    let (prev_season_id, prev_season_label) = if let Some(pos) = ordered_seasons.iter().position(|(id, _, _)| id.eq_ignore_ascii_case(&active_season_id)) {
        if pos > 0 {
            let (id, label, _) = &ordered_seasons[pos - 1];
            (id.clone(), label.clone())
        } else {
            ("".to_string(), "".to_string())
        }
    } else if ordered_seasons.len() >= 2 {
        let (id, label, _) = &ordered_seasons[ordered_seasons.len() - 2];
        (id.clone(), label.clone())
    } else {
        ("".to_string(), "".to_string())
    };

    let mut current_tier = 0u32;
    let mut current_rr = 0i64;
    let mut peak_tier = 0u32;
    let mut peak_season_uuid = String::new();
    let mut last_season_tier = 0u32;
    let mut last_season_rank_name = "Unranked".to_string();
    let mut last_season_name = prev_season_label.clone();
    let mut total_wins = 0u32;
    let mut total_games = 0u32;

    if let Ok(resp) = mmr_req {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(comp) = json.get("QueueSkills").and_then(|q| q.get("competitive")) {
                if let Some(seasonal) = comp.get("SeasonalInfoBySeasonID").and_then(|s| s.as_object()) {
                    for (season_id, sdata) in seasonal {
                        let tier = sdata.get("CompetitiveTier").and_then(|t| t.as_u64()).unwrap_or(0) as u32;
                        let wins = sdata.get("NumberOfWins").and_then(|w| w.as_u64()).unwrap_or(0) as u32;
                        let games = sdata.get("NumberOfGames").and_then(|g| g.as_u64()).unwrap_or(0) as u32;

                        total_wins += wins;
                        total_games += games;

                        if tier > peak_tier {
                            peak_tier = tier;
                            peak_season_uuid = season_id.clone();
                        }
                    }

                    if let Some(sdata) = seasonal.get(active_season_id) {
                        let games_needed = sdata.get("GamesNeededForRating").and_then(|g| g.as_u64()).unwrap_or(0);
                        let tier = sdata.get("CompetitiveTier").and_then(|t| t.as_u64()).unwrap_or(0) as u32;
                        let rr = sdata.get("RankedRating").and_then(|r| r.as_i64()).unwrap_or(0);

                        if games_needed == 0 && tier > 0 {
                            current_tier = tier;
                            current_rr = rr;
                        }
                    }

                    // Extract rank from previous season
                    if !prev_season_id.is_empty() {
                        if let Some(sdata) = seasonal.get(&prev_season_id) {
                            let tier = sdata.get("CompetitiveTier").and_then(|t| t.as_u64()).unwrap_or(0) as u32;
                            if tier > 0 {
                                last_season_tier = tier;
                                last_season_rank_name = get_rank_name(tier).to_string();
                            }
                        }
                    }

                    // Fallback to latest past season player played in if prev_season was not played
                    if last_season_tier == 0 {
                        if let Some(pos) = ordered_seasons.iter().position(|(id, _, _)| id.eq_ignore_ascii_case(&active_season_id)) {
                            for (id, label, _) in ordered_seasons[..pos].iter().rev() {
                                if let Some(sdata) = seasonal.get(id) {
                                    let tier = sdata.get("CompetitiveTier").and_then(|t| t.as_u64()).unwrap_or(0) as u32;
                                    if tier > 0 {
                                        last_season_tier = tier;
                                        last_season_rank_name = get_rank_name(tier).to_string();
                                        last_season_name = label.clone();
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if let Some(latest) = json.get("LatestCompetitiveUpdate") {
                let latest_season = latest.get("SeasonID").and_then(|s| s.as_str()).unwrap_or("");
                let latest_tier = latest.get("TierAfterUpdate").and_then(|t| t.as_u64()).unwrap_or(0) as u32;
                let latest_rr = latest.get("RankedRatingAfterUpdate").and_then(|r| r.as_i64()).unwrap_or(0);

                if latest_tier > peak_tier {
                    peak_tier = latest_tier;
                    peak_season_uuid = latest_season.to_string();
                }

                if latest_season == active_season_id && latest_tier > 0 {
                    current_tier = latest_tier;
                    current_rr = latest_rr;
                }
            }
        }
    }

    let win_rate = if total_games > 0 {
        ((total_wins as f64 / total_games as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    let peak_season = season_map.get(&peak_season_uuid.to_lowercase()).cloned().unwrap_or_default();

    tokio::time::sleep(std::time::Duration::from_millis(40)).await;

    // 5. Fetch Recent Competitive Games (query up to 20 competitive games)
    let mut recent_games = Vec::new();
    let mut recent_matches = Vec::new();
    let comp_url = format!("https://{}/mmr/v1/players/{}/competitiveupdates?startIndex=0&endIndex=20", pd_host, puuid);
    let mut comp_req = client.get(&comp_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await;

    if let Ok(ref resp) = comp_req {
        if resp.status().as_u16() == 429 {
            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
            comp_req = client.get(&comp_url)
                .header("Authorization", format!("Bearer {}", access_token))
                .header("X-Riot-Entitlements-JWT", jwt)
                .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
                .header("X-Riot-ClientVersion", client_version)
                .send().await;
        }
    }

    if let Ok(c_resp) = comp_req {
        if c_resp.status().is_success() {
            if let Ok(c_json) = c_resp.json::<serde_json::Value>().await {
                if let Some(matches) = c_json.get("Matches").and_then(|m| m.as_array()) {
                for m in matches {
                    let queue_id = m.get("QueueID").and_then(|s| s.as_str()).unwrap_or("");
                    let tier_after = m.get("TierAfterUpdate").and_then(|r| r.as_u64()).unwrap_or(0) as u32;
                    let tier_before = m.get("TierBeforeUpdate").and_then(|r| r.as_u64()).unwrap_or(0) as u32;
                    let is_placement = m.get("IsPlacementMatch").and_then(|b| b.as_bool()).unwrap_or(false);

                    if !queue_id.is_empty() && !queue_id.eq_ignore_ascii_case("competitive") {
                        continue;
                    }
                    if queue_id.is_empty() && tier_after == 0 && !is_placement {
                        continue;
                    }

                    let rr_earned = m.get("RankedRatingEarned").and_then(|r| r.as_i64()).unwrap_or(0);
                    let movement = m.get("CompetitiveMovement").and_then(|s| s.as_str()).unwrap_or("");
                    let result = if rr_earned > 0 || movement == "INCREASE" {
                        "W".to_string()
                    } else if rr_earned < 0 || movement == "DECREASE" {
                        "L".to_string()
                    } else {
                        "D".to_string()
                    };

                    let is_rank_up = tier_after > tier_before && tier_before > 0;
                    let is_derank = tier_after < tier_before && tier_before > 0;
                    let perf_bonus = m.get("RankedRatingPerformanceBonus").and_then(|r| r.as_i64()).unwrap_or(0);
                    let rr_after = m.get("RankedRatingAfterUpdate").and_then(|r| r.as_i64()).unwrap_or(0);
                    let map_id = m.get("MapID").and_then(|s| s.as_str()).unwrap_or("");
                    let map_name = crate::valorant::resolve_map_name(map_id);
                    let match_id = m.get("MatchID").and_then(|s| s.as_str()).unwrap_or("").to_string();
                    let timestamp = m.get("MatchStartTime").and_then(|r| r.as_u64()).unwrap_or(0);

                    recent_games.push(result.clone());
                    recent_matches.push(RecentMatchDetail {
                        result,
                        rr_change: rr_earned,
                        map_name,
                        tier_before,
                        tier_after,
                        tier_name: get_rank_name(tier_after).to_string(),
                        rr_after,
                        performance_bonus: perf_bonus,
                        match_id,
                        timestamp,
                        is_rank_up,
                        is_derank,
                        kills: 0,
                        deaths: 0,
                        assists: 0,
                        kd_ratio: 0.0,
                        has_kda: false,
                    });

                    if recent_matches.len() >= 20 {
                        break;
                    }
                }
            }
        }
    }
    }

    // Fetch KDA for the top 5 matches to compute immediate K/D Rate
    let mut total_kills = 0u32;
    let mut total_deaths = 0u32;
    let mut total_assists = 0u32;
    let mut matches_with_kda = 0u32;

    for m in recent_matches.iter_mut().take(5) {
        if let Some((k, d, a)) = fetch_match_kda(client, pd_host, &m.match_id, puuid, access_token, jwt, client_version).await {
            m.kills = k;
            m.deaths = d;
            m.assists = a;
            m.kd_ratio = if d == 0 { k as f64 } else { ((k as f64 / d as f64) * 100.0).round() / 100.0 };
            m.has_kda = true;

            total_kills += k;
            total_deaths += d;
            total_assists += a;
            matches_with_kda += 1;
            tokio::time::sleep(std::time::Duration::from_millis(40)).await;
        }
    }

    let kd_ratio = if matches_with_kda > 0 {
        if total_deaths == 0 {
            total_kills as f64
        } else {
            ((total_kills as f64 / total_deaths as f64) * 100.0).round() / 100.0
        }
    } else {
        0.0
    };

    // Ensure all recent matches are tracked for party detection
    for m in &recent_matches {
        if !m.match_id.is_empty() && !match_ids.contains(&m.match_id) {
            match_ids.push(m.match_id.clone());
        }
    }

    let data = CachedPlayerData {
        level: eff_level,
        match_ids,
        current_tier,
        current_rr,
        peak_tier,
        peak_season,
        last_season_tier,
        last_season_rank_name,
        last_season_name,
        win_rate,
        total_games,
        recent_games,
        recent_matches,
        kd_ratio,
        total_kills,
        total_deaths,
        total_assists,
    };

    // Store in cache (preserve existing valid data if new fetch returned zeroes)
    {
        let mut writer = get_player_cache().write().await;
        if let Some((old, _)) = writer.get(puuid) {
            let has_old = old.current_tier > 0 || old.peak_tier > 0 || old.last_season_tier > 0 || !old.recent_games.is_empty();
            let has_new = data.current_tier > 0 || data.peak_tier > 0 || data.last_season_tier > 0 || !data.recent_games.is_empty();
            if has_old && !has_new {
                return old.clone();
            }
        }
        writer.insert(puuid.to_string(), (data.clone(), std::time::Instant::now()));
    }

    data
}

// Fetch unmasked player names via PUT /name-service/v2/players
pub(crate) async fn fetch_unmasked_names(
    client: &reqwest::Client,
    pd_host: &str,
    puuids: &[String],
    access_token: &str,
    jwt: &str,
    client_version: &str,
) -> HashMap<String, String> {
    let mut names = HashMap::new();
    if puuids.is_empty() {
        return names;
    }

    let url = format!("https://{}/name-service/v2/players", pd_host);
    let body = serde_json::to_string(puuids).unwrap_or_else(|_| "[]".to_string());

    let req = client.put(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .header("Content-Type", "application/json")
        .body(body)
        .send().await;

    if let Ok(resp) = req {
        if let Ok(arr) = resp.json::<serde_json::Value>().await {
            if let Some(list) = arr.as_array() {
                for item in list {
                    if let (Some(sub), Some(game_name), Some(tag_line)) = (
                        item.get("Subject").and_then(|v| v.as_str()),
                        item.get("GameName").and_then(|v| v.as_str()),
                        item.get("TagLine").and_then(|v| v.as_str()),
                    ) {
                        if !game_name.trim().is_empty() {
                            let full_name = if tag_line.trim().is_empty() {
                                game_name.trim().to_string()
                            } else {
                                format!("{}#{}", game_name.trim(), tag_line.trim())
                            };
                            names.insert(sub.to_string(), full_name);
                        }
                    }
                }
            }
        }
    }

    names
}

// Parse party members from /chat/v4/presences
fn parse_party_members(presences: Option<&serde_json::Value>) -> HashMap<String, String> {
    use base64::Engine;
    let mut puuid_to_raw_party: HashMap<String, String> = HashMap::new();
    let mut party_counts: HashMap<String, usize> = HashMap::new();

    if let Some(pres) = presences.and_then(|p| p.get("presences")).and_then(|p| p.as_array()) {
        for p in pres {
            if let Some(puuid) = p.get("puuid").and_then(|v| v.as_str()) {
                if let Some(b64) = p.get("private").and_then(|v| v.as_str()) {
                    if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(b64) {
                        if let Ok(priv_json) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                            if let Some(party_id) = priv_json.get("partyId").and_then(|v| v.as_str()) {
                                if !party_id.is_empty() {
                                    puuid_to_raw_party.insert(puuid.to_string(), party_id.to_string());
                                    *party_counts.entry(party_id.to_string()).or_insert(0) += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Assign clean party tags ("Party 1", "Party 2"...) only to groups with >= 2 members
    let mut party_labels: HashMap<String, String> = HashMap::new();
    let mut next_id = 1;
    for (party_id, count) in &party_counts {
        if *count >= 2 {
            party_labels.insert(party_id.clone(), format!("Party {}", next_id));
            next_id += 1;
        }
    }

    let mut result: HashMap<String, String> = HashMap::new();
    for (puuid, party_id) in puuid_to_raw_party {
        if let Some(label) = party_labels.get(&party_id) {
            result.insert(puuid, label.clone());
        }
    }

    result
}

fn find_root(parent: &mut [usize], mut i: usize) -> usize {
    while parent[i] != i {
        parent[i] = parent[parent[i]];
        i = parent[i];
    }
    i
}

// Detect if two players share 2+ games in a row with the SAME TIME (timestamp) and same map
fn has_consecutive_same_time_and_map_matches(p1: &TrackedPlayer, p2: &TrackedPlayer) -> bool {
    let m1 = &p1.recent_matches;
    let m2 = &p2.recent_matches;
    if m1.len() < 2 || m2.len() < 2 {
        return false;
    }

    let mut consecutive = 0;
    for match1 in m1 {
        if match1.timestamp == 0 || match1.map_name.is_empty() {
            consecutive = 0;
            continue;
        }

        let match_found = m2.iter().any(|match2| {
            if match2.timestamp == 0 || match2.map_name.is_empty() {
                return false;
            }
            let time_diff = (match1.timestamp as i64 - match2.timestamp as i64).abs();
            time_diff <= 5000 && match1.map_name.eq_ignore_ascii_case(&match2.map_name)
        });

        if match_found {
            consecutive += 1;
            if consecutive >= 2 {
                return true;
            }
        } else {
            consecutive = 0;
        }
    }
    false
}

// Detect parties by cross-referencing recent match history (duos/trios/stacks)
fn detect_parties_from_histories(
    team: &mut [TrackedPlayer],
    player_matches: &HashMap<String, Vec<String>>,
    current_match_id: &str,
    next_party_id: &mut usize,
) {
    let n = team.len();
    if n < 2 {
        return;
    }

    let mut parent: Vec<usize> = (0..n).collect();

    // 1. Inverted index: match_id -> player indices
    // If 3 or more players in the current team share ANY previous match, they are unambiguously a party (trio/full stack)
    let mut match_to_players: HashMap<String, Vec<usize>> = HashMap::new();
    for i in 0..n {
        if team[i].is_self {
            continue;
        }
        if let Some(matches) = player_matches.get(&team[i].puuid) {
            for m in matches {
                if !m.is_empty() && m != current_match_id {
                    match_to_players.entry(m.clone()).or_default().push(i);
                }
            }
        }
    }

    for (_m, players) in &match_to_players {
        if players.len() >= 3 {
            let first = players[0];
            for &p in &players[1..] {
                let r1 = find_root(&mut parent, first);
                let r2 = find_root(&mut parent, p);
                if r1 != r2 {
                    parent[r1] = r2;
                }
            }
        }
    }

    // 2. Pairwise check:
    for i in 0..n {
        if team[i].is_self {
            continue;
        }

        let matches_i = match player_matches.get(&team[i].puuid) {
            Some(m) => m,
            None => continue,
        };
        for j in (i + 1)..n {
            if team[j].is_self {
                continue;
            }

            // If both players already have distinct verified party tags from Presence, do not merge them
            if !team[i].party_tag.is_empty() && !team[j].party_tag.is_empty() && team[i].party_tag != team[j].party_tag {
                continue;
            }

            let matches_j = match player_matches.get(&team[j].puuid) {
                Some(m) => m,
                None => continue,
            };

            let shared_count = matches_i.iter().filter(|m1| {
                !m1.is_empty() && *m1 != current_match_id && matches_j.iter().any(|m2| *m1 == m2)
            }).count();

            let consecutive_time_map = has_consecutive_same_time_and_map_matches(&team[i], &team[j]);

            let root_i = find_root(&mut parent, i);
            let root_j = find_root(&mut parent, j);
            let already_grouped = root_i != i || root_j != j || !team[i].party_tag.is_empty() || !team[j].party_tag.is_empty();

            // Link if:
            // - Shared >= 2 matches in common
            // - OR Shared >= 1 match and at least one is already part of a detected party (extending duo to trio)
            // - OR 2+ games in a row with SAME TIME and same map
            if shared_count >= 2 || (shared_count >= 1 && already_grouped) || consecutive_time_map {
                if root_i != root_j {
                    parent[root_i] = root_j;
                }
            }
        }
    }

    // Group players by root
    let mut groups: HashMap<usize, Vec<usize>> = HashMap::new();
    for i in 0..n {
        if team[i].is_self {
            continue;
        }
        let root = find_root(&mut parent, i);
        groups.entry(root).or_default().push(i);
    }

    for (_root, members) in groups {
        if members.len() >= 2 {
            // In VALORANT Competitive, 4-stacks are strictly forbidden by matchmaking rules.
            // If 4 players are connected, it represents 2 separate duos with a transitive overlap.
            // Split into two distinct 2-player parties with different IDs and colors.
            let sub_parties: Vec<Vec<usize>> = if members.len() == 4 {
                vec![vec![members[0], members[1]], vec![members[2], members[3]]]
            } else {
                vec![members]
            };

            for sub_group in sub_parties {
                let existing_tag = sub_group.iter()
                    .find_map(|&idx| {
                        if !team[idx].party_tag.is_empty() {
                            Some(team[idx].party_tag.clone())
                        } else {
                            None
                        }
                    });

                let party_tag = match existing_tag {
                    Some(tag) => tag,
                    None => {
                        let tag = format!("Party {}", *next_party_id);
                        *next_party_id += 1;
                        tag
                    }
                };

                for idx in sub_group {
                    if !team[idx].is_self {
                        team[idx].party_tag = party_tag.clone();
                    }
                }
            }
        }
    }
}

// Fetch direct authoritative party members from Riot's GLZ service
async fn fetch_glz_party_members(
    client: &reqwest::Client,
    glz_host: &str,
    my_puuid: &str,
    access_token: &str,
    jwt: &str,
    client_version: &str,
) -> Vec<String> {
    let party_player_url = format!("https://{}/parties/v1/players/{}", glz_host, my_puuid);
    let Ok(resp) = client.get(&party_player_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await else {
        return Vec::new();
    };

    if !resp.status().is_success() {
        return Vec::new();
    }

    let Ok(player_party) = resp.json::<serde_json::Value>().await else {
        return Vec::new();
    };

    let Some(party_id) = player_party.get("CurrentPartyID").and_then(|v| v.as_str()) else {
        return Vec::new();
    };

    let party_url = format!("https://{}/parties/v1/parties/{}", glz_host, party_id);
    let Ok(party_resp) = client.get(&party_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await else {
        return Vec::new();
    };

    if !party_resp.status().is_success() {
        return Vec::new();
    }

    let Ok(party_json) = party_resp.json::<serde_json::Value>().await else {
        return Vec::new();
    };

    let mut members = Vec::new();
    if let Some(arr) = party_json.get("Members").and_then(|m| m.as_array()) {
        for m in arr {
            if let Some(sub) = m.get("Subject").and_then(|s| s.as_str()) {
                members.push(sub.to_string());
            }
        }
    }
    members
}

// Main live match tracker function
pub async fn get_live_match_roster_internal(
    client: &reqwest::Client,
    access_token: &str,
    jwt: &str,
    my_puuid: &str,
    glz_host: &str,
    client_version: &str,
    presences: Option<&serde_json::Value>,
) -> Result<LiveMatchRoster, String> {
    // Make sure weapon skin database and active season are cached
    ensure_skin_cache(client).await;

    let (glz_party, party_map) = tokio::join!(
        fetch_glz_party_members(client, glz_host, my_puuid, access_token, jwt, client_version),
        async { parse_party_members(presences) }
    );

    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    // 1. Check Coregame First
    let coregame_url = format!("https://{}/core-game/v1/players/{}", glz_host, my_puuid);
    let core_check = client.get(&coregame_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await;

    if let Ok(resp) = core_check {
        if resp.status().is_success() {
            if let Ok(player_data) = resp.json::<serde_json::Value>().await {
                if let Some(match_id) = player_data.get("MatchID").and_then(|m| m.as_str()) {
                    return parse_coregame_roster(
                        client,
                        access_token,
                        jwt,
                        my_puuid,
                        glz_host,
                        &pd_host,
                        client_version,
                        match_id,
                        &party_map,
                        &glz_party,
                    ).await;
                }
            }
        }
    }

    // 2. Check Pregame (Agent Select)
    let pregame_url = format!("https://{}/pregame/v1/players/{}", glz_host, my_puuid);
    let pregame_check = client.get(&pregame_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await;

    if let Ok(resp) = pregame_check {
        if resp.status().is_success() {
            if let Ok(player_data) = resp.json::<serde_json::Value>().await {
                if let Some(match_id) = player_data.get("MatchID").and_then(|m| m.as_str()) {
                    return parse_pregame_roster(
                        client,
                        access_token,
                        jwt,
                        my_puuid,
                        glz_host,
                        &pd_host,
                        client_version,
                        match_id,
                        &party_map,
                        &glz_party,
                    ).await;
                }
            }
        }
    }

    // 3. No match active
    let lobby_server = get_cached_or_fetch_lobby_server(
        client,
        access_token,
        jwt,
        my_puuid,
        glz_host,
        client_version,
    ).await;

    Ok(LiveMatchRoster {
        state: "NO_MATCH".to_string(),
        match_id: "".to_string(),
        map_name: "-".to_string(),
        gamemode: "-".to_string(),
        server_name: lobby_server,
        ally_team: Vec::new(),
        enemy_team: Vec::new(),
        updated_at: chrono_like_now(),
        rate_limit_seconds: get_current_rate_limit_secs().await,
    })
}

pub fn parse_gamepod_to_server_name(gamepod: &str) -> String {
    let lower = gamepod.to_lowercase();
    // 1. Specific city / location name checks first to avoid region overlap
    if lower.contains("hongkong") || lower.contains("hong-kong") || lower.contains("hkg") {
        "Hong Kong".to_string()
    } else if lower.contains("singapore") || lower.contains("sin") {
        "Singapore".to_string()
    } else if lower.contains("mumbai") || lower.contains("bom") {
        "Mumbai".to_string()
    } else if lower.contains("tokyo") || lower.contains("tyo") {
        "Tokyo".to_string()
    } else if lower.contains("sydney") || lower.contains("syd") {
        "Sydney".to_string()
    } else if lower.contains("manila") || lower.contains("mnl") {
        "Manila".to_string()
    } else if lower.contains("seoul") || lower.contains("icn") {
        "Seoul".to_string()
    } else if lower.contains("frankfurt") || lower.contains("fra") {
        "Frankfurt".to_string()
    } else if lower.contains("london") || lower.contains("lon") {
        "London".to_string()
    } else if lower.contains("paris") || lower.contains("cdg") {
        "Paris".to_string()
    } else if lower.contains("madrid") || lower.contains("mad") {
        "Madrid".to_string()
    } else if lower.contains("warsaw") || lower.contains("waw") {
        "Warsaw".to_string()
    } else if lower.contains("stockholm") || lower.contains("arn") {
        "Stockholm".to_string()
    } else if lower.contains("istanbul") || lower.contains("ist") {
        "Istanbul".to_string()
    } else if lower.contains("bahrain") || lower.contains("bhr") {
        "Bahrain".to_string()
    } else if lower.contains("ashburn") || lower.contains("virginia") || lower.contains("iad") {
        "N. Virginia".to_string()
    } else if lower.contains("chicago") || lower.contains("ord") {
        "Chicago".to_string()
    } else if lower.contains("dallas") || lower.contains("dfw") {
        "Dallas".to_string()
    } else if lower.contains("atlanta") || lower.contains("atl") {
        "Atlanta".to_string()
    } else if lower.contains("california") || lower.contains("sanjose") || lower.contains("sjc") || lower.contains("lax") {
        "N. California".to_string()
    } else if lower.contains("oregon") || lower.contains("pdx") {
        "Oregon".to_string()
    } else if lower.contains("sao_paulo") || lower.contains("saopaulo") || lower.contains("gru") {
        "São Paulo".to_string()
    } else if lower.contains("santiago") || lower.contains("scl") {
        "Santiago".to_string()
    } else if lower.contains("bogota") || lower.contains("bog") {
        "Bogotá".to_string()
    } else if lower.contains("mexico") || lower.contains("qro") {
        "Mexico City".to_string()
    } else if lower.contains("buenos") || lower.contains("eze") {
        "Buenos Aires".to_string()
    } else if lower.contains("miami") || lower.contains("mia") {
        "Miami".to_string()
    // 2. Regional pod cluster codes fallback
    } else if lower.contains("aps1") {
        "Mumbai".to_string()
    } else if lower.contains("apse1") {
        "Singapore".to_string()
    } else if lower.contains("ape1") {
        "Hong Kong".to_string()
    } else if lower.contains("apne1") {
        "Tokyo".to_string()
    } else if lower.contains("apse2") {
        "Sydney".to_string()
    } else if !gamepod.is_empty() {
        let parts: Vec<&str> = gamepod.split('.').collect();
        if let Some(last) = parts.last() {
            last.replace("ap-gp-", "").replace("na-gp-", "").replace("eu-gp-", "").replace("latam-gp-", "").replace("kr-gp-", "").replace("gp-", "").replace("-1", "").replace("-2", "").to_uppercase()
        } else {
            gamepod.to_string()
        }
    } else {
        String::new()
    }
}

static LOBBY_SERVER_CACHE: std::sync::OnceLock<Arc<RwLock<Option<(std::time::Instant, String)>>>> = std::sync::OnceLock::new();

fn get_lobby_server_cache() -> &'static Arc<RwLock<Option<(std::time::Instant, String)>>> {
    LOBBY_SERVER_CACHE.get_or_init(|| Arc::new(RwLock::new(None)))
}

pub fn discover_lowest_ping_server() -> Option<String> {
    if let Some(path) = crate::paths::find_shooter_game_log() {
        #[cfg(target_os = "windows")]
        use std::os::windows::fs::OpenOptionsExt;
        let file_res = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(7)
            .open(&path);

        if let Ok(mut file) = file_res {
            use std::io::Read;
            let mut text = String::new();
            if file.read_to_string(&mut text).is_ok() {
                let pattern = "Party_FetchPlayer";
                if let Some(pos) = text.rfind(pattern) {
                    let sub = &text[pos..];
                    if let Some(q_pos) = sub.find('?') {
                        let query = &sub[q_pos + 1..];
                        let query_end = query.find(|c: char| c.is_whitespace() || c == ']').unwrap_or(query.len());
                        let query_str = &query[..query_end];
                        let mut min_ping = u32::MAX;
                        let mut best_pod = String::new();
                        for pair in query_str.split('&') {
                            let mut kv = pair.split('=');
                            if let (Some(pod), Some(ping_str)) = (kv.next(), kv.next()) {
                                if let Ok(ping) = ping_str.parse::<u32>() {
                                    if ping < min_ping {
                                        min_ping = ping;
                                        best_pod = pod.to_string();
                                    }
                                }
                            }
                        }
                        if !best_pod.is_empty() {
                            let s = parse_gamepod_to_server_name(&best_pod);
                            if !s.is_empty() {
                                return Some(s);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

pub async fn get_cached_or_fetch_lobby_server(
    client: &reqwest::Client,
    access_token: &str,
    jwt: &str,
    my_puuid: &str,
    glz_host: &str,
    client_version: &str,
) -> String {
    {
        let r = get_lobby_server_cache().read().await;
        if let Some((instant, ref name)) = *r {
            if instant.elapsed() < std::time::Duration::from_secs(15) {
                return name.clone();
            }
        }
    }

    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let mut resolved = if let Some(best) = discover_lowest_ping_server() {
        best
    } else {
        format!("{} Shard", shard.to_uppercase())
    };

    let party_player_url = format!("https://{}/parties/v1/players/{}", glz_host, my_puuid);
    if let Ok(resp) = client.get(&party_player_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(party_id) = json.get("CurrentPartyID").and_then(|v| v.as_str()) {
                let party_url = format!("https://{}/parties/v1/parties/{}", glz_host, party_id);
                if let Ok(presp) = client.get(&party_url)
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("X-Riot-Entitlements-JWT", jwt)
                    .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
                    .header("X-Riot-ClientVersion", client_version)
                    .send().await {
                    if let Ok(pjson) = presp.json::<serde_json::Value>().await {
                        if let Some(pods) = pjson.get("MatchmakingData")
                            .and_then(|m| m.get("PreferredGamePods"))
                            .and_then(|p| p.as_array()) {
                            let mut servers = Vec::new();
                            for pod_val in pods {
                                if let Some(pod_str) = pod_val.as_str() {
                                    let s = parse_gamepod_to_server_name(pod_str);
                                    if !s.is_empty() && !servers.contains(&s) {
                                        servers.push(s);
                                    }
                                }
                            }
                            if !servers.is_empty() {
                                resolved = servers.join(", ");
                            }
                        }
                    }
                }
            }
        }
    }

    let mut w = get_lobby_server_cache().write().await;
    *w = Some((std::time::Instant::now(), resolved.clone()));
    resolved
}

// Parse Core-Game Match
async fn parse_coregame_roster(
    client: &reqwest::Client,
    access_token: &str,
    jwt: &str,
    my_puuid: &str,
    glz_host: &str,
    pd_host: &str,
    client_version: &str,
    match_id: &str,
    party_map: &HashMap<String, String>,
    glz_party: &[String],
) -> Result<LiveMatchRoster, String> {
    let match_url = format!("https://{}/core-game/v1/matches/{}", glz_host, match_id);
    let match_resp = client.get(&match_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await
        .map_err(|e| format!("Failed to fetch coregame match: {}", e))?;

    let match_json: serde_json::Value = match_resp.json().await
        .map_err(|e| format!("Failed to parse coregame match json: {}", e))?;

    let map_id = match_json.get("MapID").and_then(|m| m.as_str()).unwrap_or("");
    let map_name = crate::valorant::resolve_map_name(map_id);
    let queue_id = match_json.get("MatchmakingData")
        .and_then(|m| m.get("QueueID"))
        .and_then(|q| q.as_str())
        .or_else(|| match_json.get("QueueID").and_then(|q| q.as_str()))
        .unwrap_or("");
    let mode_id = match_json.get("ModeID").and_then(|m| m.as_str()).unwrap_or("");
    let gamemode = crate::valorant::resolve_gamemode(queue_id, mode_id, false);

    let game_pod = match_json.get("GamePodID").and_then(|g| g.as_str()).unwrap_or("");
    let server_name = parse_gamepod_to_server_name(game_pod);

    // Fetch loadouts
    let loadouts_url = format!("https://{}/core-game/v1/matches/{}/loadouts", glz_host, match_id);
    let mut loadouts_by_sub = HashMap::new();
    let mut loadouts_by_char = HashMap::new();

    if let Ok(lresp) = client.get(&loadouts_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await {
        if let Ok(ljson) = lresp.json::<serde_json::Value>().await {
            if let Some(loadouts) = ljson.get("Loadouts").and_then(|l| l.as_array()) {
                for item in loadouts {
                    if let Some(items) = item.get("Loadout").and_then(|l| l.get("Items")) {
                        if let Some(sub) = item.get("Subject").and_then(|s| s.as_str()) {
                            loadouts_by_sub.insert(sub.to_string(), items.clone());
                        }
                        if let Some(cid) = item.get("CharacterID").and_then(|c| c.as_str()) {
                            loadouts_by_char.insert(cid.to_string(), items.clone());
                        }
                    }
                }
            }
        }
    }

    // Find local player team
    let players = match_json.get("Players").and_then(|p| p.as_array()).cloned().unwrap_or_default();
    let mut my_team_id = "Blue".to_string();
    for p in &players {
        if p.get("Subject").and_then(|s| s.as_str()) == Some(my_puuid) {
            if let Some(team) = p.get("TeamID").and_then(|t| t.as_str()) {
                my_team_id = team.to_string();
            }
        }
    }

    // Determine target active season ID
    let cached_season = { get_active_season_id().read().await.clone() };
    let active_season_id = match_json.get("SeasonID").and_then(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or(cached_season);

    // Collect all PUUIDs
    let puuids: Vec<String> = players.iter()
        .filter_map(|p| p.get("Subject").and_then(|s| s.as_str()).map(|s| s.to_string()))
        .collect();

    // Fetch unmasked names
    let names_map = fetch_unmasked_names(client, pd_host, &puuids, access_token, jwt, client_version).await;

    // Concurrently fetch MMR & stats for each player
    let mut futures = Vec::new();
    for p in &players {
        let puuid = p.get("Subject").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let team_id = p.get("TeamID").and_then(|t| t.as_str()).unwrap_or("Blue").to_string();
        let char_id = p.get("CharacterID").and_then(|c| c.as_str()).unwrap_or("").to_string();
        let agent_name = crate::valorant::resolve_agent_name_by_id(&char_id);
        let level = p.get("PlayerIdentity").and_then(|pi| pi.get("AccountLevel")).and_then(|l| l.as_u64()).unwrap_or(0) as u32;
        let incognito = p.get("PlayerIdentity").and_then(|pi| pi.get("Incognito")).and_then(|i| i.as_bool()).unwrap_or(false);
        let is_self = puuid == my_puuid;

        // Resolve clean display name
        let player_name = match names_map.get(&puuid) {
            Some(n) if !n.trim().is_empty() && n.trim() != "#" && !n.starts_with('#') => n.clone(),
            _ => {
                if incognito {
                    agent_name.clone()
                } else {
                    format!("Player#{}", &puuid[..puuid.len().min(4)])
                }
            }
        };

        let is_my_party = glz_party.len() >= 2 && glz_party.contains(&puuid);
        let party_tag = if is_my_party {
            "Party 1".to_string()
        } else {
            party_map.get(&puuid).cloned().unwrap_or_default()
        };

        // Skins
        let loadout_items = loadouts_by_sub.get(&puuid)
            .or_else(|| loadouts_by_char.get(&char_id))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        let c = client.clone();
        let pd = pd_host.to_string();
        let tok = access_token.to_string();
        let j = jwt.to_string();
        let ver = client_version.to_string();
        let act_season = active_season_id.clone();

        futures.push(async move {
            let (primary_skin, weapon_skins, all_skins) = extract_player_skins(&loadout_items).await;
            let pdata = fetch_player_full_stats(&c, &pd, &puuid, &tok, &j, &ver, &act_season, level).await;

            let tracked = TrackedPlayer {
                puuid: puuid.clone(),
                name: player_name,
                team: team_id,
                agent_id: char_id,
                agent_name,
                level: pdata.level,
                current_tier: pdata.current_tier,
                current_rank_name: get_rank_name(pdata.current_tier).to_string(),
                current_rr: pdata.current_rr,
                peak_tier: pdata.peak_tier,
                peak_rank_name: get_rank_name(pdata.peak_tier).to_string(),
                peak_season: pdata.peak_season,
                last_season_tier: pdata.last_season_tier,
                last_season_rank_name: pdata.last_season_rank_name,
                last_season_name: pdata.last_season_name,
                win_rate: pdata.win_rate,
                total_games: pdata.total_games,
                recent_games: pdata.recent_games,
                recent_matches: pdata.recent_matches,
                kd_ratio: pdata.kd_ratio,
                total_kills: pdata.total_kills,
                total_deaths: pdata.total_deaths,
                total_assists: pdata.total_assists,
                primary_skin,
                weapon_skins,
                all_skins,
                is_incognito: incognito,
                is_self,
                party_tag,
                encounter: if !is_self && !puuid.is_empty() {
                    crate::encounter_memory::get_encounter(&puuid)
                } else {
                    None
                },
            };

            (tracked, pdata.match_ids)
        });
    }

    let results = futures::future::join_all(futures).await;

    let mut ally_team = Vec::new();
    let mut enemy_team = Vec::new();
    let mut ally_matches: HashMap<String, Vec<String>> = HashMap::new();
    let mut enemy_matches: HashMap<String, Vec<String>> = HashMap::new();

    let is_ffa = gamemode.eq_ignore_ascii_case("deathmatch") || (gamemode.to_lowercase().contains("deathmatch") && !gamemode.to_lowercase().contains("team"));
    for (player, m_ids) in results {
        if is_ffa {
            if player.is_self {
                ally_matches.insert(player.puuid.clone(), m_ids);
                ally_team.push(player);
            } else {
                enemy_matches.insert(player.puuid.clone(), m_ids);
                enemy_team.push(player);
            }
        } else if player.team == my_team_id {
            ally_matches.insert(player.puuid.clone(), m_ids);
            ally_team.push(player);
        } else {
            enemy_matches.insert(player.puuid.clone(), m_ids);
            enemy_team.push(player);
        }
    }

    let mut next_party_id = 1;
    for p in ally_team.iter().chain(enemy_team.iter()) {
        if p.party_tag.starts_with("Party ") {
            if let Ok(num) = p.party_tag.replace("Party ", "").trim().parse::<usize>() {
                if num >= next_party_id {
                    next_party_id = num + 1;
                }
            }
        }
    }

    let is_competitive = gamemode.to_lowercase().contains("competitive") || queue_id.to_lowercase().contains("competitive");
    let ally_is_authoritative_5_stack = ally_team.len() == 5 && (
        glz_party.len() == 5 ||
        ally_team.iter().all(|p| glz_party.contains(&p.puuid)) ||
        (!ally_team[0].party_tag.is_empty() && ally_team.iter().all(|p| p.party_tag == ally_team[0].party_tag))
    );

    if ally_is_authoritative_5_stack {
        for p in &mut ally_team {
            p.party_tag = "Party 1".to_string();
        }
    } else {
        detect_parties_from_histories(&mut ally_team, &ally_matches, match_id, &mut next_party_id);
    }

    detect_parties_from_histories(&mut enemy_team, &enemy_matches, match_id, &mut next_party_id);

    // If Competitive and ally team is strictly a 5-stack, enemy team MUST be a 5-stack as well
    if is_competitive && ally_team.len() == 5 && enemy_team.len() == 5 {
        let first_party = ally_team[0].party_tag.clone();
        let ally_is_5_stack = !first_party.is_empty() && ally_team.iter().all(|p| p.party_tag == first_party);
        if ally_is_5_stack {
            let enemy_party_tag = if first_party == "Party 1" {
                "Party 2".to_string()
            } else {
                format!("Party {}", next_party_id)
            };
            for p in &mut enemy_team {
                p.party_tag = enemy_party_tag.clone();
            }
        }
    }

    let roster = LiveMatchRoster {
        state: "COREGAME".to_string(),
        match_id: match_id.to_string(),
        map_name,
        gamemode,
        server_name,
        ally_team,
        enemy_team,
        updated_at: chrono_like_now(),
        rate_limit_seconds: get_current_rate_limit_secs().await,
    };
    {
        let mut lock = get_last_active_roster_holder().write().await;
        *lock = Some(roster.clone());
    }
    if let Ok(json_str) = serde_json::to_string(&roster) {
        let p = crate::config::data_dir().join("last_roster.json");
        let _ = std::fs::write(p, json_str);
    }
    Ok(roster)
}

// Parse Pre-Game (Agent Select) Match
async fn parse_pregame_roster(
    client: &reqwest::Client,
    access_token: &str,
    jwt: &str,
    my_puuid: &str,
    glz_host: &str,
    pd_host: &str,
    client_version: &str,
    match_id: &str,
    party_map: &HashMap<String, String>,
    glz_party: &[String],
) -> Result<LiveMatchRoster, String> {
    let match_url = format!("https://{}/pregame/v1/matches/{}", glz_host, match_id);
    let match_resp = client.get(&match_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await
        .map_err(|e| format!("Failed to fetch pregame match: {}", e))?;

    let match_json: serde_json::Value = match_resp.json().await
        .map_err(|e| format!("Failed to parse pregame match json: {}", e))?;

    let map_id = match_json.get("MapID").and_then(|m| m.as_str()).unwrap_or("");
    let map_name = crate::valorant::resolve_map_name(map_id);
    let queue_id = match_json.get("QueueID").and_then(|q| q.as_str()).unwrap_or("competitive");
    let mode_id = match_json.get("ModeID").and_then(|m| m.as_str()).unwrap_or("");
    let gamemode = crate::valorant::resolve_gamemode(queue_id, mode_id, false);

    let game_pod = match_json.get("GamePodID").and_then(|g| g.as_str()).unwrap_or("");
    let server_name = parse_gamepod_to_server_name(game_pod);

    let cached_season = { get_active_season_id().read().await.clone() };
    let active_season_id = match_json.get("SeasonID").and_then(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or(cached_season);

    // Fetch pregame loadouts
    let loadouts_url = format!("https://{}/pregame/v1/matches/{}/loadouts", glz_host, match_id);
    let mut loadouts_by_sub = HashMap::new();
    let mut loadouts_by_char = HashMap::new();

    if let Ok(lresp) = client.get(&loadouts_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await {
        if let Ok(ljson) = lresp.json::<serde_json::Value>().await {
            if let Some(loadouts) = ljson.get("Loadouts").and_then(|l| l.as_array()) {
                for item in loadouts {
                    if let Some(items) = item.get("Loadout").and_then(|l| l.get("Items")) {
                        if let Some(sub) = item.get("Subject").and_then(|s| s.as_str()) {
                            loadouts_by_sub.insert(sub.to_string(), items.clone());
                        }
                        if let Some(cid) = item.get("CharacterID").and_then(|c| c.as_str()) {
                            loadouts_by_char.insert(cid.to_string(), items.clone());
                        }
                    }
                }
            }
        }
    }

    let mut teams = match_json.get("Teams").and_then(|t| t.as_array()).cloned().unwrap_or_default();
    let ally_players_list = match_json.get("AllyTeam").and_then(|a| a.get("Players")).and_then(|p| p.as_array());

    let mut ally_team = Vec::new();
    let mut enemy_team = Vec::new();
    let mut puuids = Vec::new();

    struct RawPregamePlayer {
        puuid: String,
        team_id: String,
        char_id: String,
        level: u32,
        incognito: bool,
    }
    let mut raw_players = Vec::new();

    if let Some(apl) = ally_players_list {
        for p in apl {
            let puuid = p.get("Subject").and_then(|s| s.as_str()).unwrap_or("").to_string();
            let char_id = p.get("CharacterID").and_then(|c| c.as_str()).unwrap_or("").to_string();
            let level = p.get("PlayerIdentity").and_then(|pi| pi.get("AccountLevel")).and_then(|l| l.as_u64()).unwrap_or(0) as u32;
            let incognito = p.get("PlayerIdentity").and_then(|pi| pi.get("Incognito")).and_then(|i| i.as_bool()).unwrap_or(false);
            if !puuid.is_empty() {
                puuids.push(puuid.clone());
                raw_players.push(RawPregamePlayer {
                    puuid,
                    team_id: "Ally".to_string(),
                    char_id,
                    level,
                    incognito,
                });
            }
        }
    } else {
        for team in &mut teams {
            let team_id = team.get("TeamID").and_then(|t| t.as_str()).unwrap_or("Blue").to_string();
            if let Some(players) = team.get("Players").and_then(|p| p.as_array()) {
                for p in players {
                    let puuid = p.get("Subject").and_then(|s| s.as_str()).unwrap_or("").to_string();
                    let char_id = p.get("CharacterID").and_then(|c| c.as_str()).unwrap_or("").to_string();
                    let level = p.get("PlayerIdentity").and_then(|pi| pi.get("AccountLevel")).and_then(|l| l.as_u64()).unwrap_or(0) as u32;
                    let incognito = p.get("PlayerIdentity").and_then(|pi| pi.get("Incognito")).and_then(|i| i.as_bool()).unwrap_or(false);
                    if !puuid.is_empty() {
                        puuids.push(puuid.clone());
                        raw_players.push(RawPregamePlayer {
                            puuid,
                            team_id: team_id.clone(),
                            char_id,
                            level,
                            incognito,
                        });
                    }
                }
            }
        }
    }

    // Fetch unmasked real names
    let names_map = fetch_unmasked_names(client, pd_host, &puuids, access_token, jwt, client_version).await;

    // Concurrently fetch MMR & stats
    let mut futures = Vec::new();
    for (idx, p) in raw_players.into_iter().enumerate() {
        let puuid = p.puuid;
        let team_id = p.team_id;
        let char_id = p.char_id;
        let agent_name = if char_id.is_empty() { "Selecting...".to_string() } else { crate::valorant::resolve_agent_name_by_id(&char_id) };
        let level = p.level;
        let incognito = p.incognito;
        let is_self = puuid == my_puuid;

        let player_name = match names_map.get(&puuid) {
            Some(n) if !n.trim().is_empty() && n.trim() != "#" && !n.starts_with('#') => n.clone(),
            _ => {
                if incognito {
                    if !agent_name.is_empty() && agent_name != "Selecting..." {
                        agent_name.clone()
                    } else {
                        format!("Player {}", idx + 1)
                    }
                } else {
                    format!("Player#{}", &puuid[..puuid.len().min(4)])
                }
            }
        };

        let is_my_party = glz_party.len() >= 2 && glz_party.contains(&puuid);
        let party_tag = if is_my_party {
            "Party 1".to_string()
        } else {
            party_map.get(&puuid).cloned().unwrap_or_default()
        };

        let _loadout_items = loadouts_by_sub.get(&puuid)
            .or_else(|| loadouts_by_char.get(&char_id))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        let c = client.clone();
        let pd = pd_host.to_string();
        let tok = access_token.to_string();
        let j = jwt.to_string();
        let ver = client_version.to_string();
        let act_season = active_season_id.clone();

        futures.push(async move {
            // Weapon skins cannot be fetched during Agent Select (Pregame) -> display "TBD"
            let (primary_skin, weapon_skins, all_skins) = ("TBD".to_string(), HashMap::new(), Vec::new());
            let pdata = fetch_player_full_stats(&c, &pd, &puuid, &tok, &j, &ver, &act_season, level).await;

            let tracked = TrackedPlayer {
                puuid: puuid.clone(),
                name: player_name,
                team: team_id,
                agent_id: char_id,
                agent_name,
                level: pdata.level,
                current_tier: pdata.current_tier,
                current_rank_name: get_rank_name(pdata.current_tier).to_string(),
                current_rr: pdata.current_rr,
                peak_tier: pdata.peak_tier,
                peak_rank_name: get_rank_name(pdata.peak_tier).to_string(),
                peak_season: pdata.peak_season,
                last_season_tier: pdata.last_season_tier,
                last_season_rank_name: pdata.last_season_rank_name,
                last_season_name: pdata.last_season_name,
                win_rate: pdata.win_rate,
                total_games: pdata.total_games,
                recent_games: pdata.recent_games,
                recent_matches: pdata.recent_matches,
                kd_ratio: pdata.kd_ratio,
                total_kills: pdata.total_kills,
                total_deaths: pdata.total_deaths,
                total_assists: pdata.total_assists,
                primary_skin,
                weapon_skins,
                all_skins,
                is_incognito: incognito,
                is_self,
                party_tag,
                encounter: if !is_self && !puuid.is_empty() {
                    crate::encounter_memory::get_encounter(&puuid)
                } else {
                    None
                },
            };

            (tracked, pdata.match_ids)
        });
    }

    let results = futures::future::join_all(futures).await;
    let mut ally_matches: HashMap<String, Vec<String>> = HashMap::new();
    let mut enemy_matches: HashMap<String, Vec<String>> = HashMap::new();

    let is_ffa = gamemode.eq_ignore_ascii_case("deathmatch") || (gamemode.to_lowercase().contains("deathmatch") && !gamemode.to_lowercase().contains("team"));
    for (player, m_ids) in results {
        if is_ffa {
            if player.is_self {
                ally_matches.insert(player.puuid.clone(), m_ids);
                ally_team.push(player);
            } else {
                enemy_matches.insert(player.puuid.clone(), m_ids);
                enemy_team.push(player);
            }
        } else if player.team == "Ally" || player.team == "Blue" || player.is_self {
            ally_matches.insert(player.puuid.clone(), m_ids);
            ally_team.push(player);
        } else {
            enemy_matches.insert(player.puuid.clone(), m_ids);
            enemy_team.push(player);
        }
    }

    let mut next_party_id = 1;
    for p in ally_team.iter().chain(enemy_team.iter()) {
        if p.party_tag.starts_with("Party ") {
            if let Ok(num) = p.party_tag.replace("Party ", "").trim().parse::<usize>() {
                if num >= next_party_id {
                    next_party_id = num + 1;
                }
            }
        }
    }

    let is_competitive = gamemode.to_lowercase().contains("competitive") || queue_id.to_lowercase().contains("competitive");
    let ally_is_authoritative_5_stack = ally_team.len() == 5 && (
        glz_party.len() == 5 ||
        ally_team.iter().all(|p| glz_party.contains(&p.puuid)) ||
        (!ally_team[0].party_tag.is_empty() && ally_team.iter().all(|p| p.party_tag == ally_team[0].party_tag))
    );

    if ally_is_authoritative_5_stack {
        for p in &mut ally_team {
            p.party_tag = "Party 1".to_string();
        }
    } else {
        detect_parties_from_histories(&mut ally_team, &ally_matches, match_id, &mut next_party_id);
    }

    detect_parties_from_histories(&mut enemy_team, &enemy_matches, match_id, &mut next_party_id);

    // If Competitive and ally team is strictly a 5-stack, enemy team MUST be a 5-stack as well
    if is_competitive && ally_team.len() == 5 && enemy_team.len() == 5 {
        let first_party = ally_team[0].party_tag.clone();
        let ally_is_5_stack = !first_party.is_empty() && ally_team.iter().all(|p| p.party_tag == first_party);
        if ally_is_5_stack {
            let enemy_party_tag = if first_party == "Party 1" {
                "Party 2".to_string()
            } else {
                format!("Party {}", next_party_id)
            };
            for p in &mut enemy_team {
                p.party_tag = enemy_party_tag.clone();
            }
        }
    }

    let roster = LiveMatchRoster {
        state: "PREGAME".to_string(),
        match_id: match_id.to_string(),
        map_name,
        gamemode,
        server_name,
        ally_team,
        enemy_team,
        updated_at: chrono_like_now(),
        rate_limit_seconds: get_current_rate_limit_secs().await,
    };
    {
        let mut lock = get_last_active_roster_holder().write().await;
        *lock = Some(roster.clone());
    }
    if let Ok(json_str) = serde_json::to_string(&roster) {
        let p = crate::config::data_dir().join("last_roster.json");
        let _ = std::fs::write(p, json_str);
    }
    Ok(roster)
}

fn chrono_like_now() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let hours = (secs / 3600) % 24;
    let mins = (secs / 60) % 60;
    let s = secs % 60;
    format!("{:02}:{:02}:{:02} UTC", hours, mins, s)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestMatchResult {
    pub map_name: String,
    pub gamemode: String,
    pub score_ally: i32,
    pub score_enemy: i32,
    pub won: bool,
}

pub async fn fetch_latest_completed_match_internal(
    client: &reqwest::Client,
    access_token: &str,
    jwt: &str,
    my_puuid: &str,
    glz_host: &str,
    client_version: &str,
) -> Result<LatestMatchResult, String> {
    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    let hist_url = format!("https://{}/match-history/v1/history/{}?startIndex=0&endIndex=1", pd_host, my_puuid);
    let hist_resp = client.get(&hist_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await
        .map_err(|e| format!("Failed to fetch match history: {}", e))?;

    let hist_json = hist_resp.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse match history json: {}", e))?;

    let first_match = hist_json.get("History")
        .and_then(|h| h.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| "No matches found in history".to_string())?;

    let match_id = first_match.get("MatchID")
        .and_then(|m| m.as_str())
        .ok_or_else(|| "No MatchID in history entry".to_string())?;

    let match_url = format!("https://{}/match-details/v1/matches/{}", pd_host, match_id);
    let match_resp = client.get(&match_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", client_version)
        .send().await
        .map_err(|e| format!("Failed to fetch match details: {}", e))?;

    let m_json = match_resp.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse match details json: {}", e))?;

    // Find local player's teamId
    let mut my_team_id = "Blue".to_string();
    if let Some(players) = m_json.get("players").and_then(|p| p.as_array()) {
        for p in players {
            if p.get("subject").and_then(|s| s.as_str()) == Some(my_puuid) {
                if let Some(t) = p.get("teamId").and_then(|t| t.as_str()) {
                    my_team_id = t.to_string();
                }
                break;
            }
        }
    }

    // Determine map name and gamemode
    let match_info = m_json.get("matchInfo");
    let map_id = match_info.and_then(|m| m.get("mapId")).and_then(|v| v.as_str()).unwrap_or("");
    let queue_id = match_info.and_then(|m| m.get("queueID")).and_then(|v| v.as_str()).unwrap_or("");
    let mode_id = match_info.and_then(|m| m.get("gameMode")).and_then(|v| v.as_str()).unwrap_or("");
    let is_custom = match_info.and_then(|m| m.get("isCustomGame")).and_then(|v| v.as_bool()).unwrap_or(false);

    let map_name = crate::valorant::resolve_map_name(map_id);
    let gamemode = crate::valorant::resolve_gamemode(queue_id, mode_id, is_custom);

    let mut score_ally = 0i32;
    let mut score_enemy = 0i32;
    let mut won = false;

    if let Some(teams) = m_json.get("teams").and_then(|t| t.as_array()) {
        for t in teams {
            let team_id = t.get("teamId").and_then(|v| v.as_str()).unwrap_or("");
            let rounds_won = t.get("roundsWon").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let num_points = t.get("numPoints").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let team_score = if num_points > 0 { num_points } else { rounds_won };
            let is_won = t.get("won").and_then(|v| v.as_bool()).unwrap_or(false);

            if team_id.eq_ignore_ascii_case(&my_team_id) {
                score_ally = team_score;
                won = is_won;
            } else {
                score_enemy = team_score;
            }
        }
    }

    // Auto-record completed match to local Career history
    let last_roster = {
        let lock = get_last_active_roster_holder().read().await;
        if lock.is_some() {
            lock.clone()
        } else {
            let p = crate::config::data_dir().join("last_roster.json");
            if let Ok(data) = std::fs::read_to_string(p) {
                serde_json::from_str::<LiveMatchRoster>(&data).ok()
            } else {
                None
            }
        }
    };
    if let Some(cm) = crate::career::parse_match_details(&m_json, my_puuid, last_roster.as_ref()) {
        let _ = crate::career::save_career_match(cm);
    }

    Ok(LatestMatchResult {
        map_name,
        gamemode,
        score_ally,
        score_enemy,
        won,
    })
}

