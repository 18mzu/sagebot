mod valorant;
mod config;
mod webhook;
mod agents_data;
mod locker;

use config::AppConfig;
use valorant::{
    LockfileData, ValorantClient, is_valorant_process_running,
    decode_presence_data, simulate_anti_afk_action, simulate_vote_key
};
use agents_data::{AgentInfo, get_all_agents};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;

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
    pub map_name: String,
    pub gamemode: String,
    pub score_ally: i32,
    pub score_enemy: i32,
    pub current_agent: String,
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
                    let mut map_name = "-".to_string();
                    let mut gamemode = "-".to_string();
                    let mut match_state = if game_live { "In Lobby".to_string() } else { "OFFLINE".to_string() };
                    let mut score_ally = 0;
                    let mut score_enemy = 0;
                    let mut current_agent = valorant::resolve_agent_from_log();

                    // 1. Fetch PUUID from /entitlements/v1/token (primary Riot Client endpoint)
                    if let Ok(ent) = client.get_entitlements().await {
                        if let Some(sub) = ent.get("subject").and_then(|v| v.as_str()) {
                            puuid_val = Some(sub.to_string());
                        }
                    }

                    // 2. Fallback to /chat/v1/session if entitlements had no subject
                    if puuid_val.is_none() {
                        if let Ok(session) = client.get_session().await {
                            if let Some(p) = session.get("puuid").and_then(|v| v.as_str()) {
                                puuid_val = Some(p.to_string());
                            }
                            if let Some(name) = session.get("game_name").and_then(|v| v.as_str()) {
                                player_name = Some(name.to_string());
                            }
                            if let Some(tag) = session.get("game_tag").and_then(|v| v.as_str()) {
                                player_tag = Some(tag.to_string());
                            }
                        }
                    }

                    // 3. Check pregame player state if PUUID available
                    if let Some(ref p) = puuid_val {
                        if let Ok(pregame) = client.get_pregame_player(p).await {
                            if let Some(mid) = pregame.get("MatchID").and_then(|v| v.as_str()) {
                                if !mid.is_empty() {
                                    match_state = "Agent Select".to_string();
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
                        if details.rank_name != "Unranked" {
                            rank_name = details.rank_name;
                        }
                        if match_state != "Agent Select" && details.match_state != "LOBBY" {
                            match_state = details.match_state;
                        }
                        score_ally = details.score_ally;
                        score_enemy = details.score_enemy;
                        if details.agent_name != "-" {
                            current_agent = details.agent_name;
                        }
                    }

                    let is_game_ready = game_live
                        && player_name.is_some()
                        && gamemode != "-"
                        && rank_name != "-";

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
                        map_name,
                        gamemode,
                        score_ally,
                        score_enemy,
                        current_agent,
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
async fn test_discord_webhook(url: String, user_id: String) -> Result<String, String> {
    webhook::send_discord_test(&url, &user_id).await
}

#[tauri::command]
async fn lock_agent_now(agent_id: String) -> Result<String, String> {
    let lockfile = LockfileData::read_from_disk()?;
    let client = ValorantClient::new(lockfile)?;
    let session = client.get_session().await?;
    let puuid = session.get("puuid").and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get PUUID".to_string())?;

    let (access_token, jwt) = client.get_riot_tokens().await?;
    let glz_host = valorant::discover_glz_host();
    let client_version = valorant::discover_client_version();

    let pregame = client.get_pregame_player_glz(puuid, &access_token, &jwt, &glz_host, &client_version).await
        .map_err(|e| format!("You are not currently in Agent Select / Pre-Game ({})", e))?;
    let match_id = pregame.get("MatchID").and_then(|v| v.as_str())
        .ok_or_else(|| "You are not currently in Agent Select / Pre-Game".to_string())?;

    let _ = client.select_agent_glz(match_id, &agent_id, &access_token, &jwt, &glz_host, &client_version).await;
    let locked = client.lock_agent_glz(match_id, &agent_id, &access_token, &jwt, &glz_host, &client_version).await?;

    if locked {
        Ok("Agent successfully locked!".to_string())
    } else {
        Err("Failed to lock agent".to_string())
    }
}

#[tauri::command]
fn trigger_anti_afk_action(mode: String) {
    simulate_anti_afk_action(&mode);
}

#[tauri::command]
fn trigger_vote(vote_yes: bool) {
    simulate_vote_key(vote_yes);
}

#[tauri::command]
fn trigger_key_press(key: String) {
    let vk = config::key_name_to_vk(&key);
    valorant::send_key_press(vk);
}

#[tauri::command]
fn trigger_key_down(key: String) {
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
    valorant::send_chat_message(channel, &text);
}

#[tauri::command]
fn check_hotkey_pressed(key: String) -> bool {
    let vk = config::key_name_to_vk(&key);
    valorant::is_key_pressed(vk)
}

#[tauri::command]
fn get_changelog() -> String {
    if let Ok(content) = std::fs::read_to_string("changelog.txt") {
        return content;
    }
    "[v3.0]\r\n- Upgraded to modern desktop architecture (SageBot 3.0).\r\n- Accurate real-time VALORANT process detection.\r\n- Single-instance enforcement (brings existing instance to focus).\r\n- Smooth window dragging on custom titlebar.\r\n- Redesigned sidebar with quick-access icon buttons for Settings and Changelogs.\r\n- Custom icons support.\r\n\r\n[v2.5]\r\n- added Agents tab.\r\n- added Agent Select, Instalock and Fallback.\r\n- SageBot now auto stops when the game concludes (has been added in v2.4 but forgor to mentioned)\r\n- added Webhook toggle.\r\n\r\nProbably needs an UI revamp.".to_string()
}

#[tauri::command]
async fn check_for_updates() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("SageBot/3.0")
        .build()
        .map_err(|e| e.to_string())?;

    match client.get("https://api.github.com/repos/18mzu/sagebot/releases/latest").send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(tag) = json.get("tag_name").and_then(|v| v.as_str()) {
                    if tag == "v3.0" || tag == "3.0" {
                        return Ok("You are running the latest version: v3.0".to_string());
                    } else {
                        return Ok(format!("A newer version is available: {}", tag));
                    }
                }
            }
            Ok("You are running the latest version: v3.0".to_string())
        }
        Err(_) => Ok("Could not connect to update server. You are on v3.0".to_string())
    }
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

#[tauri::command]
async fn resize_to_gate(window: tauri::Window) {
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 440.0 })));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 440.0, height: 510.0 }));
    let _ = window.center();
}

#[tauri::command]
async fn resize_to_dashboard(window: tauri::Window) {
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 860.0, height: 600.0 })));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 960.0, height: 680.0 }));
    let _ = window.center();
}

#[tauri::command]
async fn start_competitive_queue() -> Result<bool, String> {
    if let Ok(lockfile) = LockfileData::read_from_disk() {
        if let Ok(client) = ValorantClient::new(lockfile) {
            return client.start_competitive_queue().await;
        }
    }
    Err("VALORANT client not available".to_string())
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, always_on_top: bool) {
    let _ = window.set_always_on_top(always_on_top);
}

#[tauri::command]
fn focus_valorant_window() {
    valorant::focus_valorant_window();
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

    tauri::Builder::default()
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
            lock_agent_now,
            trigger_anti_afk_action,
            trigger_vote,
            trigger_key_press,
            trigger_key_down,
            trigger_key_up,
            trigger_chat_send,
            check_hotkey_pressed,
            get_changelog,
            check_for_updates,
            minimize_window,
            close_window,
            start_dragging_window,
            kill_valorant,
            resize_to_gate,
            resize_to_dashboard,
            set_always_on_top,
            focus_valorant_window,
            start_competitive_queue
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
