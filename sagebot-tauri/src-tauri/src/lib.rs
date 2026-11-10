mod valorant;
mod config;
mod webhook;
mod agents_data;
mod locker;
mod tracker;
mod storefront;
mod paths;

use config::AppConfig;
use valorant::{
    LockfileData, ValorantClient, is_valorant_process_running,
    decode_presence_data, simulate_anti_afk_action, simulate_vote_key
};
use agents_data::{AgentInfo, get_all_agents};
use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;

pub static IS_BOT_RUNNING: AtomicBool = AtomicBool::new(false);
pub static HAS_MANUALLY_LOCKED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PregameTeammate {
    pub puuid: String,
    pub player_name: String,
    pub character_id: String,
    pub character_name: String,
    pub role: String,
    pub is_locked: bool,
    pub is_self: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PregameState {
    pub match_id: String,
    pub map_name: String,
    pub map_id: String,
    pub gamemode: String,
    pub teammates: Vec<PregameTeammate>,
    pub locked_agent_id: Option<String>,
    pub missing_roles: Vec<String>,
}

#[derive(Serialize, Default)]
pub struct StatusResponse {
    pub is_connected: bool,
    pub game_live: bool,
    pub is_game_ready: bool,
    pub client_type: String,
    pub port: u16,
    pub pid: u32,
    pub error_message: Option<String>,
    pub player_name: Option<String>,
    pub player_tag: Option<String>,
    pub puuid: Option<String>,
    pub match_state: String,
    pub rank_name: String,
    pub rank_tier: u32,
    pub rank_rr: i64,
    pub map_name: String,
    pub gamemode: String,
    pub score_ally: i32,
    pub score_enemy: i32,
    pub current_agent: String,
    pub match_id: Option<String>,
    pub server_name: String,
    pub wallet: Option<tracker::WalletBalances>,
}

pub struct AppState {
    pub config: Arc<Mutex<AppConfig>>,
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let cfg = state.config.lock().map_err(|e| e.to_string())?;
    Ok(cfg.clone())
}

#[tauri::command]
fn save_config(new_config: AppConfig, state: State<'_, AppState>) -> Result<bool, String> {
    new_config.save()?;
    let mut cfg = state.config.lock().map_err(|e| e.to_string())?;
    *cfg = new_config;
    Ok(true)
}

#[tauri::command]
fn get_agents() -> Vec<AgentInfo> {
    get_all_agents()
}

#[tauri::command]
async fn get_client_status() -> Result<StatusResponse, String> {
    let game_live = is_valorant_process_running();

    match LockfileData::read_from_disk() {
        Ok(lockfile) => {
            let port = lockfile.port;
            let pid = lockfile.pid;
            let client_type = lockfile.process.clone();

            match ValorantClient::new(lockfile) {
                Ok(client) => {
                    let mut player_name = None;
                    let mut player_tag = None;
                    let mut puuid_val = None;
                    let mut rank_name = "Unranked".to_string();
                    let mut rank_tier = 0;
                    let mut map_name = "-".to_string();
                    let mut gamemode = "-".to_string();
                    let mut match_state = if game_live { "In Lobby".to_string() } else { "OFFLINE".to_string() };
                    let mut score_ally = 0;
                    let mut score_enemy = 0;
                    let mut current_agent = "-".to_string();
                    let mut current_match_id: Option<String> = None;
                    let mut server_name = String::new();

                    // 1. Fetch PUUID from /entitlements/v1/token (primary Riot Client endpoint)
                    if let Ok(ent) = client.get_entitlements().await {
                        if let Some(sub) = ent.get("subject").and_then(|v| v.as_str()) {
                            puuid_val = Some(sub.to_string());
                        }
                    }

                    // 2. Fetch player identity and session details from /chat/v1/session
                    if let Ok(session) = client.get_session().await {
                        if puuid_val.is_none() {
                            if let Some(p) = session.get("puuid").and_then(|v| v.as_str()) {
                                puuid_val = Some(p.to_string());
                            }
                        }
                        if let Some(name) = session.get("game_name").and_then(|v| v.as_str()) {
                            if !name.is_empty() {
                                player_name = Some(name.to_string());
                            }
                        }
                        if let Some(tag) = session.get("game_tag").and_then(|v| v.as_str()) {
                            if !tag.is_empty() {
                                player_tag = Some(tag.to_string());
                            }
                        }
                    }

                    // 3. Check pregame player state if PUUID available
                    if let Some(ref p) = puuid_val {
                        if let Ok(pregame) = client.get_pregame_player(p).await {
                            if let Some(mid) = pregame.get("MatchID").and_then(|v| v.as_str()) {
                                if !mid.is_empty() {
                                    current_match_id = Some(mid.to_string());
                                    match_state = "Agent Select".to_string();
                                    if let Ok(pmatch) = client.get_pregame_match(mid).await {
                                        if let Some(raw_map) = pmatch.get("MapID").and_then(|v| v.as_str()) {
                                            let resolved = valorant::resolve_map_name(raw_map);
                                            if resolved != "-" {
                                                map_name = resolved;
                                            }
                                        }
                                        if let Some(queue) = pmatch.get("QueueID").and_then(|v| v.as_str()) {
                                            let resolved_mode = valorant::resolve_gamemode(queue, "", false);
                                            if resolved_mode != "-" {
                                                gamemode = resolved_mode;
                                            }
                                        }
                                        if let Some(pod) = pmatch.get("GamePodID").and_then(|v| v.as_str()) {
                                            let s = tracker::parse_gamepod_to_server_name(pod);
                                            if !s.is_empty() {
                                                server_name = s;
                                            }
                                        }
                                        // Extract locked agent during Agent Select from pmatch
                                        if let Some(teams) = pmatch.get("Teams").and_then(|t| t.as_array()) {
                                            for team in teams {
                                                if let Some(players) = team.get("Players").and_then(|pl| pl.as_array()) {
                                                    for player in players {
                                                        if player.get("Subject").and_then(|s| s.as_str()) == Some(p.as_str()) {
                                                            if let Some(char_id) = player.get("CharacterID").and_then(|c| c.as_str()) {
                                                                if !char_id.is_empty() {
                                                                    let resolved_agent = valorant::resolve_agent_name_by_id(char_id);
                                                                    if resolved_agent != "-" && !resolved_agent.is_empty() {
                                                                        current_agent = resolved_agent;
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

                    // 4. Fetch live presences from /chat/v4/presences
                    if let Ok(presences) = client.get_presences().await {
                        let my_puuid = puuid_val.as_deref().unwrap_or("");
                        let details = decode_presence_data(&presences, my_puuid);
                        if details.player_name.is_some() {
                            player_name = details.player_name;
                        }
                        if details.player_tag.is_some() {
                            player_tag = details.player_tag;
                        }
                        if details.map_name != "-" {
                            map_name = details.map_name;
                        }
                        if details.gamemode != "-" {
                            gamemode = details.gamemode;
                        }
                        if !details.rank_name.is_empty() && details.rank_name != "-" {
                            rank_name = details.rank_name;
                            rank_tier = details.rank_tier;
                        }
                        if match_state != "Agent Select" && details.match_state != "LOBBY" {
                            match_state = details.match_state;
                        }
                        score_ally = details.score_ally;
                        score_enemy = details.score_enemy;
                        if match_state == "In Game" {
                            if details.agent_name != "-" {
                                current_agent = details.agent_name;
                            }
                        } else if match_state != "Agent Select" {
                            current_agent = "-".to_string();
                        }
                    }

                    // 4b. If still in lobby, check direct authoritative GLZ party state to detect In Queue
                    if match_state == "In Lobby" || match_state == "LOBBY" {
                        if let Some(ref p) = puuid_val {
                            if let Ok(p_state) = client.get_player_party_state(p).await {
                                let p_upper = p_state.0.to_uppercase();
                                if p_upper.contains("MATCHMAKING") || p_upper.contains("STARTING") || p_upper.contains("QUEUE") {
                                    match_state = "In Queue".to_string();
                                }
                            }
                        }
                    }

                    // 5. If match_id not yet resolved, check core-game player
                    if current_match_id.is_none() {
                        if let Some(ref p) = puuid_val {
                            if let Ok(coregame) = client.get_coregame_player(p).await {
                                if let Some(mid) = coregame.get("MatchID").and_then(|v| v.as_str()) {
                                    if !mid.is_empty() {
                                        current_match_id = Some(mid.to_string());
                                        if let Ok(cmatch) = client.get_coregame_match(mid).await {
                                            if let Some(pod) = cmatch.get("GamePodID").and_then(|v| v.as_str()) {
                                                let s = tracker::parse_gamepod_to_server_name(pod);
                                                if !s.is_empty() {
                                                    server_name = s;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let is_game_ready = game_live
                        && (player_name.is_some() || puuid_val.is_some() || match_state != "OFFLINE");

                    let wallet = if let Some(ref p) = puuid_val {
                        tracker::get_cached_or_fetch_wallet(p).await
                    } else {
                        None
                    };

                    if server_name.is_empty() {
                        if let Some(ref p) = puuid_val {
                            if let Ok((access_token, jwt)) = client.get_riot_tokens().await {
                                let glz_host = valorant::discover_glz_host();
                                let client_version = valorant::discover_client_version();
                                if let Ok(req_client) = reqwest::Client::builder().danger_accept_invalid_certs(true).build() {
                                    server_name = tracker::get_cached_or_fetch_lobby_server(
                                        &req_client,
                                        &access_token,
                                        &jwt,
                                        p,
                                        &glz_host,
                                        &client_version,
                                    ).await;
                                }
                            }
                        }
                    }

                    let mut rank_rr: i64 = -1;
                    if let Some(ref p) = puuid_val {
                        if let Some(rr) = tracker::get_cached_or_fetch_player_rr(p).await {
                            rank_rr = rr;
                        }
                    }

                    Ok(StatusResponse {
                        is_connected: true,
                        game_live,
                        is_game_ready,
                        client_type,
                        port,
                        pid,
                        error_message: None,
                        player_name,
                        player_tag,
                        puuid: puuid_val,
                        match_state,
                        rank_name,
                        rank_tier,
                        rank_rr,
                        map_name,
                        gamemode,
                        score_ally,
                        score_enemy,
                        current_agent,
                        match_id: current_match_id,
                        server_name,
                        wallet,
                    })
                }
                Err(e) => Ok(StatusResponse {
                    is_connected: false,
                    game_live,
                    client_type,
                    port,
                    pid,
                    error_message: Some(e),
                    ..Default::default()
                })
            }
        }
        Err(e) => Ok(StatusResponse {
            is_connected: false,
            game_live,
            client_type: "".to_string(),
            port: 0,
            pid: 0,
            error_message: Some(e),
            ..Default::default()
        })
    }
}

#[tauri::command]
async fn fetch_owned_agents() -> Result<Vec<String>, String> {
    let lockfile = LockfileData::read_from_disk()?;
    let client = ValorantClient::new(lockfile)?;
    let session = client.get_session().await?;
    let puuid = session.get("puuid").and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get local PUUID from session".to_string())?;

    client.get_owned_agents(puuid).await
}

#[tauri::command]
async fn test_discord_webhook(url: String, user_id: String, bot_token: Option<String>) -> Result<String, String> {
    webhook::send_discord_test(&url, bot_token.as_deref().unwrap_or(""), &user_id).await
}

#[tauri::command]
async fn send_webhook_event(
    message: Option<String>,
    title: Option<String>,
    description: Option<String>,
    _color: Option<u32>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let text = message
        .or(description)
        .or(title)
        .unwrap_or_default();
    if text.is_empty() {
        return Ok(());
    }
    let (url, user_id, enabled) = {
        if let Ok(cfg) = state.config.lock() {
            (cfg.webhook_url.clone(), cfg.webhook_user_id.clone(), cfg.webhook_enabled)
        } else {
            return Ok(());
        }
    };
    if enabled && !url.is_empty() {
        webhook::send_unified_discord_notification(&url, "", &user_id, &text).await?;
    }
    Ok(())
}

#[tauri::command]
async fn lock_agent_now(agent_id: Option<String>, agentId: Option<String>) -> Result<String, String> {
    let target_agent_id = agent_id.or(agentId).ok_or_else(|| "Missing agent parameter".to_string())?;
    let lockfile = LockfileData::read_from_disk()?;
    let client = ValorantClient::new(lockfile)?;
    let session = client.get_session().await?;
    let puuid = session.get("puuid").and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get PUUID".to_string())?;

    let (access_token, jwt) = client.get_riot_tokens().await?;
    let glz_host = valorant::discover_glz_host();
    let client_version = valorant::discover_client_version();

    let pregame = client.get_pregame_player_glz(puuid, &access_token, &jwt, &glz_host, &client_version).await
        .map_err(|e| format!("You are not currently in Agent Select ({})", e))?;
    let match_id = pregame.get("MatchID").and_then(|v| v.as_str())
        .ok_or_else(|| "You are not currently in Agent Select".to_string())?;

    let _ = client.select_agent_glz(match_id, &target_agent_id, &access_token, &jwt, &glz_host, &client_version).await;
    let locked = client.lock_agent_glz(match_id, &target_agent_id, &access_token, &jwt, &glz_host, &client_version).await?;

    if locked {
        HAS_MANUALLY_LOCKED.store(true, Ordering::SeqCst);
        Ok("Agent successfully locked!".to_string())
    } else {
        Err("Failed to lock agent".to_string())
    }
}

#[tauri::command]
async fn get_pregame_state() -> Result<Option<PregameState>, String> {
    if !is_valorant_process_running() {
        return Ok(None);
    }
    let lockfile = match LockfileData::read_from_disk() {
        Ok(l) => l,
        Err(_) => return Ok(None),
    };
    let client = match ValorantClient::new(lockfile) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };
    let session = match client.get_session().await {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    let my_puuid = match session.get("puuid").and_then(|v| v.as_str()) {
        Some(p) => p.to_string(),
        None => return Ok(None),
    };

    let (access_token, jwt) = match client.get_riot_tokens().await {
        Ok(t) => t,
        Err(_) => return Ok(None),
    };
    let glz_host = valorant::discover_glz_host();
    let client_version = valorant::discover_client_version();
    let parts: Vec<&str> = glz_host.split('.').collect();
    let shard = if parts.len() >= 2 { parts[1] } else { "ap" };
    let pd_host = format!("pd.{}.a.pvp.net", shard);

    let pregame_player = match client.get_pregame_player_glz(&my_puuid, &access_token, &jwt, &glz_host, &client_version).await {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    let match_id = match pregame_player.get("MatchID").and_then(|v| v.as_str()) {
        Some(mid) if !mid.is_empty() => mid.to_string(),
        _ => return Ok(None),
    };

    let match_url = format!("https://{}/pregame/v1/matches/{}", glz_host, match_id);
    let match_resp = match client.glz_client.get(&match_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Riot-Entitlements-JWT", &jwt)
        .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
        .header("X-Riot-ClientVersion", &client_version)
        .send().await {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    let pmatch: serde_json::Value = match match_resp.json().await {
        Ok(j) => j,
        Err(_) => return Ok(None),
    };

    let raw_map = pmatch.get("MapID").and_then(|v| v.as_str()).unwrap_or("");
    let map_name = valorant::resolve_map_name(raw_map);
    let queue = pmatch.get("QueueID").and_then(|v| v.as_str()).unwrap_or("");
    let gamemode = valorant::resolve_gamemode(queue, "", false);

    let all_agents = agents_data::get_all_agents();
    let find_role = |char_id: &str| -> String {
        for a in &all_agents {
            if a.id.eq_ignore_ascii_case(char_id) {
                return a.role.clone();
            }
        }
        "".to_string()
    };

    let mut teammates = Vec::new();
    let mut locked_agent_id = None;
    let mut picked_roles = std::collections::HashSet::new();

    let mut players_list = Vec::new();
    if let Some(ally) = pmatch.get("AllyTeam").and_then(|a| a.get("Players")).and_then(|p| p.as_array()) {
        players_list = ally.clone();
    } else if let Some(teams) = pmatch.get("Teams").and_then(|t| t.as_array()) {
        for team in teams {
            if let Some(pls) = team.get("Players").and_then(|p| p.as_array()) {
                let has_me = pls.iter().any(|pl| pl.get("Subject").and_then(|s| s.as_str()) == Some(&my_puuid));
                if has_me || teams.len() == 1 {
                    players_list = pls.clone();
                    break;
                }
            }
        }
    }

    // Collect all PUUIDs to fetch real player names
    let mut puuids = Vec::new();
    for pl in &players_list {
        if let Some(s) = pl.get("Subject").and_then(|v| v.as_str()) {
            if !s.is_empty() {
                puuids.push(s.to_string());
            }
        }
    }

    let names_map = tracker::fetch_unmasked_names(&client.glz_client, &pd_host, &puuids, &access_token, &jwt, &client_version).await;

    for pl in players_list {
        let subj = pl.get("Subject").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let char_id = pl.get("CharacterID").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let state = pl.get("CharacterSelectionState").and_then(|s| s.as_str()).unwrap_or("");
        let is_locked = state.eq_ignore_ascii_case("locked");
        let is_self = subj == my_puuid;
        let character_name = if !char_id.is_empty() {
            let n = valorant::resolve_agent_name_by_id(&char_id);
            if n != "-" { n } else { String::new() }
        } else {
            String::new()
        };
        let role = if !char_id.is_empty() { find_role(&char_id) } else { String::new() };

        let player_name = if is_self {
            "YOU".to_string()
        } else if let Some(n) = names_map.get(&subj) {
            n.clone()
        } else {
            "Teammate".to_string()
        };

        if !role.is_empty() && (is_locked || !char_id.is_empty()) {
            picked_roles.insert(role.clone());
        }

        if is_self && is_locked && !char_id.is_empty() {
            locked_agent_id = Some(char_id.clone());
        }

        teammates.push(PregameTeammate {
            puuid: subj,
            player_name,
            character_id: char_id,
            character_name,
            role,
            is_locked,
            is_self,
        });
    }

    let standard_roles = ["Duelist", "Initiator", "Controller", "Sentinel"];
    let mut missing_roles = Vec::new();
    for r in &standard_roles {
        if !picked_roles.contains(*r) {
            missing_roles.push(r.to_string());
        }
    }

    Ok(Some(PregameState {
        match_id,
        map_name,
        map_id: raw_map.to_string(),
        gamemode,
        teammates,
        locked_agent_id,
        missing_roles,
    }))
}

static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

pub fn remote_set_bot_running(running: bool) {
    IS_BOT_RUNNING.store(running, Ordering::SeqCst);
    if !running {
        valorant::IS_INGAME_WITH_AGENT.store(false, Ordering::SeqCst);
    }
    if let Some(app) = APP_HANDLE.get() {
        use tauri::Emitter;
        let _ = app.emit("bot-remote-toggle", serde_json::json!({ "running": running }));
    }
}

#[tauri::command]
fn set_bot_running(running: bool) {
    remote_set_bot_running(running);
}

#[tauri::command]
fn set_ingame_focus_state(in_game_with_agent: bool, _auto_focus: bool) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) {
        valorant::IS_INGAME_WITH_AGENT.store(false, Ordering::SeqCst);
        return;
    }
    valorant::IS_INGAME_WITH_AGENT.store(in_game_with_agent, Ordering::SeqCst);
    if in_game_with_agent && !valorant::is_valorant_focused() {
        valorant::focus_valorant_window();
    }
}

#[tauri::command]
fn trigger_anti_afk_action(mode: String) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) { return; }
    if !valorant::IS_INGAME_WITH_AGENT.load(Ordering::Relaxed) { return; }
    if !valorant::is_valorant_focused() { return; }
    simulate_anti_afk_action(&mode);
}

#[tauri::command]
fn trigger_vote(vote_yes: bool) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) { return; }
    if !valorant::IS_INGAME_WITH_AGENT.load(Ordering::Relaxed) { return; }
    if !valorant::is_valorant_focused() { return; }
    simulate_vote_key(vote_yes);
}

#[tauri::command]
fn trigger_key_press(key: String) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) { return; }
    if !valorant::IS_INGAME_WITH_AGENT.load(Ordering::Relaxed) { return; }
    if !valorant::is_valorant_focused() {
        valorant::focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    let vk = config::key_name_to_vk(&key);
    valorant::send_key_press(vk);
}

#[tauri::command]
fn trigger_key_down(key: String) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) { return; }
    if !valorant::IS_INGAME_WITH_AGENT.load(Ordering::Relaxed) { return; }
    if !valorant::is_valorant_focused() { return; }
    let vk = config::key_name_to_vk(&key);
    valorant::send_key_down(vk);
}

#[tauri::command]
fn trigger_key_up(key: String) {
    let vk = config::key_name_to_vk(&key);
    valorant::send_key_up(vk);
}

#[tauri::command]
fn trigger_chat_send(channel: u32, text: String) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) { return; }
    if !valorant::IS_INGAME_WITH_AGENT.load(Ordering::Relaxed) { return; }
    if !valorant::is_valorant_focused() { return; }
    valorant::send_chat_message(channel, &text);
}

#[tauri::command]
fn trigger_comms_sequence(hotkey: String, first_num: u32, second_num: u32) {
    if !IS_BOT_RUNNING.load(Ordering::Relaxed) { return; }
    if !valorant::IS_INGAME_WITH_AGENT.load(Ordering::Relaxed) { return; }
    if !valorant::is_valorant_focused() { return; }
    let hotkey_vk = config::key_name_to_vk(&hotkey);
    let first_vk = 0x30 + (first_num.clamp(1, 4) as u8);
    let second_vk = 0x30 + (second_num.clamp(1, 6) as u8);
    std::thread::spawn(move || {
        valorant::send_comms_sequence(hotkey_vk, first_vk, second_vk);
    });
}

#[tauri::command]
fn check_hotkey_pressed(key: String) -> bool {
    let vk = config::key_name_to_vk(&key);
    valorant::is_key_pressed(vk)
}

fn start_global_hotkey_listener(config_state: Arc<Mutex<AppConfig>>) {
    std::thread::spawn(move || {
        let mut was_down = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(60));
            let key = {
                if let Ok(cfg) = config_state.lock() {
                    cfg.hotkey.clone()
                } else {
                    "F9".to_string()
                }
            };
            let vk = config::key_name_to_vk(&key);
            let is_down = valorant::is_key_pressed(vk);
            if is_down && !was_down {
                if let Some(app) = APP_HANDLE.get() {
                    use tauri::Emitter;
                    let _ = app.emit("global-hotkey-press", ());
                }
            }
            was_down = is_down;
        }
    });
}

#[tauri::command]
fn check_valorant_focused() -> bool {
    valorant::is_valorant_focused()
}

#[tauri::command]
fn get_changelog() -> String {
    if let Ok(content) = std::fs::read_to_string("changelog.txt") {
        return content;
    }
    include_str!("../../../changelog.txt").to_string()
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: String,
    pub release_url: String,
    /// False when an automatic update to this exact release was already attempted recently
    /// (prevents endless re-download loops if the replacement failed or the asset is stale).
    pub auto_update_allowed: bool,
}

fn update_marker_path() -> std::path::PathBuf {
    std::env::temp_dir().join("sagebot_update_marker.txt")
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// True if `download_url` was auto-applied less than 30 minutes ago.
fn recently_attempted(download_url: &str) -> bool {
    if let Ok(text) = std::fs::read_to_string(update_marker_path()) {
        let mut parts = text.trim().splitn(2, '|');
        let ts = parts.next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let url = parts.next().unwrap_or("");
        return url == download_url && now_secs().saturating_sub(ts) < 30 * 60;
    }
    false
}

fn is_newer_version(cur: &str, latest: &str) -> bool {
    let cur = cur.trim_start_matches(|c| c == 'v' || c == 'V');
    let latest = latest.trim_start_matches(|c| c == 'v' || c == 'V');

    let parse_parts = |s: &str| -> Vec<u32> {
        s.split('.')
            .map(|p| p.chars().take_while(|c| c.is_ascii_digit()).collect::<String>())
            .filter_map(|p| p.parse::<u32>().ok())
            .collect()
    };

    let cur_parts = parse_parts(cur);
    let latest_parts = parse_parts(latest);

    for i in 0..std::cmp::max(cur_parts.len(), latest_parts.len()) {
        let c = cur_parts.get(i).copied().unwrap_or(0);
        let l = latest_parts.get(i).copied().unwrap_or(0);
        if l != c {
            return l > c;
        }
    }
    false
}

#[tauri::command]
async fn check_for_updates() -> Result<UpdateInfo, String> {
    // Single source of truth: version from Cargo.toml (never hard-code; a stale constant
    // makes every install think the latest release is newer and re-update forever).
    const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

    let client = reqwest::Client::builder()
        .user_agent(format!("SageBot/{}", CURRENT_VERSION))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://api.github.com/repos/18mzu/sagebot/releases/latest")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let tag = json.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body = json.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let release_url = json.get("html_url").and_then(|v| v.as_str()).unwrap_or("https://github.com/18mzu/sagebot/releases/latest").to_string();

    let mut download_url = String::new();
    if let Some(assets) = json.get("assets").and_then(|v| v.as_array()) {
        // 1. Exact match for sagebot.exe
        for a in assets {
            if let Some(name) = a.get("name").and_then(|v| v.as_str()) {
                if name.eq_ignore_ascii_case("sagebot.exe") {
                    if let Some(url) = a.get("browser_download_url").and_then(|v| v.as_str()) {
                        download_url = url.to_string();
                        break;
                    }
                }
            }
        }
        // 2. Fallback to any sagebot-named exe
        if download_url.is_empty() {
            for a in assets {
                if let Some(name) = a.get("name").and_then(|v| v.as_str()) {
                    if name.ends_with(".exe") && (name.contains("SageBot") || name.contains("sagebot")) {
                        if let Some(url) = a.get("browser_download_url").and_then(|v| v.as_str()) {
                            download_url = url.to_string();
                            break;
                        }
                    }
                }
            }
        }
        if download_url.is_empty() {
            for a in assets {
                if let Some(name) = a.get("name").and_then(|v| v.as_str()) {
                    if name.ends_with(".exe") {
                        if let Some(url) = a.get("browser_download_url").and_then(|v| v.as_str()) {
                            download_url = url.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }

    let is_newer = is_newer_version(CURRENT_VERSION, &tag);
    let auto_update_allowed = is_newer && !download_url.is_empty() && !recently_attempted(&download_url);

    Ok(UpdateInfo {
        available: is_newer,
        current_version: CURRENT_VERSION.to_string(),
        latest_version: tag,
        release_notes: body,
        download_url,
        release_url,
        auto_update_allowed,
    })
}

#[tauri::command]
async fn apply_update(app: tauri::AppHandle, download_url: String) -> Result<(), String> {
    use std::io::Write;
    use tauri::Emitter;

    if download_url.is_empty() {
        return Err("Download URL is empty".to_string());
    }

    // Record the attempt so a failed/stale update can't trigger an endless auto-update loop.
    let _ = std::fs::write(update_marker_path(), format!("{}|{}", now_secs(), download_url));

    let client = reqwest::Client::builder()
        .user_agent("SageBot-Updater")
        .build()
        .map_err(|e| e.to_string())?;

    let mut resp = client.get(&download_url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with HTTP status: {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let temp_exe = current_exe.with_extension("update_temp.exe");

    let mut file = std::fs::File::create(&temp_exe).map_err(|e| {
        format!(
            "Cannot write next to SageBot ({}). Move sagebot.exe to a writable folder (e.g. Desktop) or download the update manually.",
            e
        )
    })?;
    let mut downloaded: u64 = 0;

    let _ = app.emit("update-progress", 0u32);

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if total_size > 0 {
            let percent = (((downloaded as f64) / (total_size as f64)) * 100.0) as u32;
            let _ = app.emit("update-progress", percent.min(99));
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    if downloaded < 1_000_000 {
        let _ = std::fs::remove_file(&temp_exe);
        return Err("Downloaded update file is too small or incomplete".to_string());
    }

    let _ = app.emit("update-progress", 100u32);

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let current_clean = normalize_windows_path(&current_exe);
    let temp_clean = normalize_windows_path(&temp_exe);

    // Write a standalone updater batch file in TEMP directory
    let bat_file = std::env::temp_dir().join(format!("sagebot_updater_{}.bat", std::process::id()));
    let bat_clean = normalize_windows_path(&bat_file);

    // Bounded retries (~20s). If the exe can't be replaced (locked / read-only / frozen disk),
    // discard the download and relaunch the existing SageBot instead of looping forever.
    let bat_script = format!(
        "@echo off\r\n\
        set /a tries=0\r\n\
        ping -n 2 127.0.0.1 > nul\r\n\
        :retry\r\n\
        move /y \"{tmp}\" \"{cur}\" > nul 2>&1\r\n\
        if not errorlevel 1 goto launch\r\n\
        set /a tries+=1\r\n\
        if %tries% geq 20 goto fail\r\n\
        ping -n 2 127.0.0.1 > nul\r\n\
        goto retry\r\n\
        :fail\r\n\
        del /f /q \"{tmp}\" > nul 2>&1\r\n\
        :launch\r\n\
        start \"\" \"{cur}\"\r\n\
        del \"%~f0\"\r\n",
        tmp = temp_clean,
        cur = current_clean
    );

    let _ = std::fs::write(&bat_clean, bat_script);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("cmd.exe")
            .args(["/c", &bat_clean])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    std::process::exit(0);
}

fn normalize_windows_path(p: &std::path::Path) -> String {
    let s = p.to_string_lossy().to_string();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        s
    }
}

#[tauri::command]
async fn capture_screen_base64() -> Result<String, String> {
    let bytes = valorant::capture_valorant_screenshot()?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn start_dragging_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn kill_valorant() -> Result<bool, String> {
    valorant::terminate_valorant_processes()
}

#[cfg(target_os = "windows")]
unsafe fn send_unicode_char(c: u16) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    let mut inputs = [
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: 0,
                    wScan: c,
                    dwFlags: KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: 0,
                    wScan: c,
                    dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
    ];
    SendInput(inputs.len() as u32, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
}

#[cfg(target_os = "windows")]
unsafe fn send_key(vk: u16) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    let mut inputs = [
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
    ];
    SendInput(inputs.len() as u32, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
}

#[cfg(target_os = "windows")]
unsafe fn send_ctrl_a() {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    let mut inputs = [
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: VK_CONTROL, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: 'A' as u16, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: 'A' as u16, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: VK_CONTROL, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 },
            },
        },
    ];
    SendInput(inputs.len() as u32, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
}

#[tauri::command]
async fn launch_valorant() -> Result<bool, String> {
    // Used by Auto Reconnect. Works with any install location (see paths.rs).
    if valorant::is_valorant_process_running() {
        return Ok(true);
    }
    tauri::async_runtime::spawn_blocking(paths::spawn_valorant_via_riot_client)
        .await
        .map_err(|e| e.to_string())??;
    Ok(true)
}

#[tauri::command]
async fn launch_riot_client() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(paths::spawn_riot_client_for_login)
        .await
        .map_err(|e| e.to_string())??;
    Ok(true)
}

#[tauri::command]
fn is_riot_signed_in() -> bool {
    paths::is_riot_stay_signed_in()
}

#[tauri::command]
async fn login_riot_account(username: String, password: Option<String>) -> Result<bool, String> {
    // 0. Safeguard: if VALORANT is running, do not attempt account switch
    if valorant::is_valorant_process_running() {
        return Err("VALORANT is currently running. Please exit VALORANT before switching accounts.".to_string());
    }

    // 1. Terminate existing Riot Client processes to ensure fresh login state
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "Riot Client.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RiotClientUx.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RiotClientServices.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

    // 2. Discover Riot Client executable path (running process, installs json, registry, drive scan)
    let rc_exe = paths::find_riot_client_services()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not locate RiotClientServices.exe on system".to_string())?;

    // 3. Launch Riot Client into VALORANT
    #[cfg(target_os = "windows")]
    {
        let rc_dir = std::path::Path::new(&rc_exe)
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let mut cmd = std::process::Command::new(&rc_exe);
        cmd.args(["--launch-product=valorant", "--launch-patchline=live"])
            .current_dir(&rc_dir);
        cmd.spawn().map_err(|e| format!("Failed to spawn Riot Client: {}", e))?;
    }

    // 4. Poll for Riot Client window & perform native keystrokes in blocking worker
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            use windows_sys::Win32::UI::WindowsAndMessaging::*;
            use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

            unsafe extern "system" fn enum_riot_window(
                hwnd: windows_sys::Win32::Foundation::HWND,
                lparam: windows_sys::Win32::Foundation::LPARAM,
            ) -> windows_sys::Win32::Foundation::BOOL {
                if IsWindowVisible(hwnd) == 0 {
                    return 1;
                }
                let mut buf = [0u16; 512];
                let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), 512);
                if len > 0 {
                    let title = String::from_utf16_lossy(&buf[..len as usize]);
                    if title == "Riot Client" || title.contains("Riot Client") {
                        let mut rect = windows_sys::Win32::Foundation::RECT { left: 0, top: 0, right: 0, bottom: 0 };
                        GetWindowRect(hwnd, &mut rect);
                        let width = rect.right - rect.left;
                        let height = rect.bottom - rect.top;
                        if width > 350 && height > 350 {
                            let out = lparam as *mut windows_sys::Win32::Foundation::HWND;
                            *out = hwnd;
                            return 0; // stop enumeration
                        }
                    }
                }
                1
            }

            let mut target_hwnd: windows_sys::Win32::Foundation::HWND = std::ptr::null_mut();
            for _ in 0..60 {
                std::thread::sleep(std::time::Duration::from_millis(500));
                unsafe {
                    EnumWindows(Some(enum_riot_window), &mut target_hwnd as *mut _ as isize);
                }
                if !target_hwnd.is_null() {
                    break;
                }
            }

            if target_hwnd.is_null() {
                return Err("Timed out waiting for Riot Client window to open".to_string());
            }

            // Riot Client starts with a blank CEF window while web assets and auth initialize.
            // Give CEF 6.0 seconds to finish loading and rendering the login form.
            std::thread::sleep(std::time::Duration::from_millis(6000));

            unsafe {
                ShowWindow(target_hwnd, SW_RESTORE);
                BringWindowToTop(target_hwnd);
                SetForegroundWindow(target_hwnd);
            }

            std::thread::sleep(std::time::Duration::from_millis(600));

            unsafe {
                // Focus username field in Riot Client (left column)
                let mut rect = windows_sys::Win32::Foundation::RECT { left: 0, top: 0, right: 0, bottom: 0 };
                GetWindowRect(target_hwnd, &mut rect);
                let width = rect.right - rect.left;
                let height = rect.bottom - rect.top;
                let click_x = rect.left + (width as f32 * 0.16) as i32;
                let click_y = rect.top + (height as f32 * 0.38) as i32;

                SetCursorPos(click_x, click_y);
                std::thread::sleep(std::time::Duration::from_millis(150));
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(50));
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(150));

                // Click again to ensure focus on the text field
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(50));
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(300));

                // Clear username field
                send_ctrl_a();
                std::thread::sleep(std::time::Duration::from_millis(80));
                send_key(VK_BACK);
                std::thread::sleep(std::time::Duration::from_millis(100));

                // Type username with natural cadence
                for ch in username.encode_utf16() {
                    send_unicode_char(ch);
                    std::thread::sleep(std::time::Duration::from_millis(30));
                }

                // Tab to password
                std::thread::sleep(std::time::Duration::from_millis(250));
                send_key(VK_TAB);
                std::thread::sleep(std::time::Duration::from_millis(250));

                if let Some(pass) = password {
                    if !pass.is_empty() {
                        send_ctrl_a();
                        std::thread::sleep(std::time::Duration::from_millis(80));
                        send_key(VK_BACK);
                        std::thread::sleep(std::time::Duration::from_millis(100));

                        // Type password with natural cadence
                        for ch in pass.encode_utf16() {
                            send_unicode_char(ch);
                            std::thread::sleep(std::time::Duration::from_millis(30));
                        }

                        std::thread::sleep(std::time::Duration::from_millis(400));
                        send_key(VK_RETURN);
                    }
                }
            }

            Ok(())
        })
        .await
        .map_err(|e| format!("Task panicked: {}", e))??;
    }

    Ok(true)
}

#[tauri::command]
async fn resize_to_gate(window: tauri::Window) {
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 440.0 })));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 440.0, height: 510.0 }));
    let _ = window.center();
}

#[tauri::command]
async fn resize_to_dashboard(window: tauri::Window) {
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 920.0, height: 620.0 })));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1020.0, height: 700.0 }));
    let _ = window.center();
}

#[tauri::command]
async fn start_matchmaking_queue(
    queue_mode: Option<String>,
    #[allow(non_snake_case)] queueMode: Option<String>,
) -> Result<bool, String> {
    let mode = queue_mode.or(queueMode).unwrap_or_else(|| "competitive".to_string());
    println!("[Matchmaking] start_matchmaking_queue called with mode: {}", mode);
    if let Ok(lockfile) = LockfileData::read_from_disk() {
        if let Ok(client) = ValorantClient::new(lockfile) {
            return client.start_queue(&mode).await;
        }
    }
    Err("VALORANT client not available".to_string())
}

#[tauri::command]
async fn cancel_matchmaking_queue() -> Result<bool, String> {
    if let Ok(lockfile) = LockfileData::read_from_disk() {
        if let Ok(client) = ValorantClient::new(lockfile) {
            return client.leave_queue().await;
        }
    }
    Err("VALORANT client not available".to_string())
}

#[tauri::command]
async fn start_competitive_queue() -> Result<bool, String> {
    start_matchmaking_queue(Some("competitive".to_string()), None).await
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, always_on_top: bool) {
    let _ = window.set_always_on_top(always_on_top);
}

#[tauri::command]
fn focus_valorant_window() {
    valorant::focus_valorant_window();
}

#[tauri::command]
async fn get_live_match_roster() -> Result<tracker::LiveMatchRoster, String> {
    let lockfile = LockfileData::read_from_disk()?;
    let client = ValorantClient::new(lockfile)?;
    let (access_token, jwt) = client.get_riot_tokens().await?;
    let ent = client.get_entitlements().await?;
    let puuid = ent.get("subject")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to obtain PUUID from entitlements".to_string())?;

    let glz_host = valorant::discover_glz_host();
    let client_version = valorant::discover_client_version();

    let presences = client.get_presences().await.ok();

    let http_client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    tracker::get_live_match_roster_internal(
        &http_client,
        &access_token,
        &jwt,
        puuid,
        &glz_host,
        &client_version,
        presences.as_ref(),
    ).await
}

#[tauri::command]
async fn get_latest_completed_match_score() -> Result<tracker::LatestMatchResult, String> {
    let lockfile = LockfileData::read_from_disk()?;
    let client = ValorantClient::new(lockfile)?;
    let (access_token, jwt) = client.get_riot_tokens().await?;
    let ent = client.get_entitlements().await?;
    let puuid = ent.get("subject")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to obtain PUUID from entitlements".to_string())?;

    let glz_host = valorant::discover_glz_host();
    let client_version = valorant::discover_client_version();

    let http_client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    tracker::fetch_latest_completed_match_internal(
        &http_client,
        &access_token,
        &jwt,
        puuid,
        &glz_host,
        &client_version,
    ).await
}

#[tauri::command]
async fn fetch_player_match_kdas(matches: Vec<tracker::RecentMatchDetail>, puuid: String) -> Result<Vec<tracker::RecentMatchDetail>, String> {
    let lockfile = LockfileData::read_from_disk()?;
    let client = ValorantClient::new(lockfile)?;
    let (access_token, jwt) = client.get_riot_tokens().await?;
    let glz_host = valorant::discover_glz_host();
    let client_version = valorant::discover_client_version();

    let http_client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    tracker::fetch_matches_kda_internal(
        &http_client,
        &access_token,
        &jwt,
        &puuid,
        &glz_host,
        &client_version,
        matches,
    ).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn SetLastError(dw_err_code: u32);
            fn CreateMutexW(
                lp_mutex_attributes: *mut std::ffi::c_void,
                b_initial_owner: i32,
                lp_name: *const u16,
            ) -> *mut std::ffi::c_void;
            fn GetLastError() -> u32;
            fn EnumWindows(
                lp_enum_func: unsafe extern "system" fn(*mut std::ffi::c_void, isize) -> i32,
                l_param: isize,
            ) -> i32;
            fn GetWindowTextW(h_wnd: *mut std::ffi::c_void, lp_string: *mut u16, n_max_count: i32) -> i32;
            fn ShowWindow(h_wnd: *mut std::ffi::c_void, n_cmd_show: i32) -> i32;
            fn BringWindowToTop(h_wnd: *mut std::ffi::c_void) -> i32;
            fn SetForegroundWindow(h_wnd: *mut std::ffi::c_void) -> i32;
        }
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let mutex_name: Vec<u16> = OsStr::new("Local\\SageBot_SingleInstance_Mutex")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        SetLastError(0);
        let h_mutex = CreateMutexW(std::ptr::null_mut(), 1, mutex_name.as_ptr());
        let err = GetLastError();

        if !h_mutex.is_null() && err == 183 {
            // ERROR_ALREADY_EXISTS: Another SageBot instance is already active
            unsafe extern "system" fn enum_wnd(h_wnd: *mut std::ffi::c_void, l_param: isize) -> i32 {
                let mut buf = [0u16; 512];
                let len = GetWindowTextW(h_wnd, buf.as_mut_ptr(), 512);
                if len > 0 {
                    let title = String::from_utf16_lossy(&buf[..len as usize]);
                    if title.contains("SageBot") {
                        let out = l_param as *mut *mut std::ffi::c_void;
                        *out = h_wnd;
                        return 0; // stop enumeration
                    }
                }
                1 // continue
            }

            let mut existing_hwnd: *mut std::ffi::c_void = std::ptr::null_mut();
            EnumWindows(enum_wnd, &mut existing_hwnd as *mut _ as isize);

            if !existing_hwnd.is_null() {
                ShowWindow(existing_hwnd, 9); // SW_RESTORE
                BringWindowToTop(existing_hwnd);
                SetForegroundWindow(existing_hwnd);
            }
            std::process::exit(0);
        }
        let _ = h_mutex;
    }

    let initial_config = Arc::new(Mutex::new(AppConfig::load()));

    // Launch background locker worker
    locker::start_background_locker(Arc::clone(&initial_config));

    // Launch continuous VALORANT window focus monitor
    valorant::start_focus_monitor();

    // Launch native global hotkey listener (eliminates JS IPC polling overhead)
    start_global_hotkey_listener(Arc::clone(&initial_config));

    tauri::Builder::default()
        .setup(|app| {
            let _ = APP_HANDLE.set(app.handle().clone());
            Ok(())
        })
        .manage(AppState {
            config: initial_config,
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            get_agents,
            get_client_status,
            fetch_owned_agents,
            test_discord_webhook,
            set_bot_running,
            set_ingame_focus_state,
            lock_agent_now,
            get_pregame_state,
            trigger_anti_afk_action,
            trigger_vote,
            trigger_key_press,
            trigger_key_down,
            trigger_key_up,
            trigger_chat_send,
            check_hotkey_pressed,
            get_changelog,
            check_for_updates,
            apply_update,
            minimize_window,
            close_window,
            start_dragging_window,
            kill_valorant,
            launch_valorant,
            launch_riot_client,
            is_riot_signed_in,
            login_riot_account,
            resize_to_gate,
            resize_to_dashboard,
            set_always_on_top,
            focus_valorant_window,
            check_valorant_focused,
            trigger_comms_sequence,
            start_competitive_queue,
            start_matchmaking_queue,
            cancel_matchmaking_queue,
            send_webhook_event,
            get_live_match_roster,
            get_latest_completed_match_score,
            fetch_player_match_kdas,
            storefront::get_storefront,
            capture_screen_base64
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
