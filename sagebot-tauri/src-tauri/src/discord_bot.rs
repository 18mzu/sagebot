use std::sync::{Arc, Mutex};
use std::time::Duration;
use futures::{SinkExt, StreamExt};
use serde_json::Value;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::config::AppConfig;

static USE_BASIC_INTENTS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// Win32 GDI Screenshot of VALORANT window
pub fn capture_valorant_screenshot() -> Result<Vec<u8>, String> {
    // 1. Focus VALORANT before taking screenshot
    crate::valorant::focus_valorant_window();
    std::thread::sleep(std::time::Duration::from_millis(350));

    unsafe {
        use windows_sys::Win32::Foundation::RECT;
        use windows_sys::Win32::Graphics::Gdi::*;
        use windows_sys::Win32::UI::WindowsAndMessaging::*;

        // 2. Try to find VALORANT window
        let hwnd = if let Some(h) = crate::valorant::find_valorant_window() {
            h as _
        } else {
            let window_title: Vec<u16> = "VALORANT".encode_utf16().chain(Some(0)).collect();
            let mut h = FindWindowW(std::ptr::null(), window_title.as_ptr());
            if h == std::ptr::null_mut() {
                let class_name: Vec<u16> = "UnrealWindow".encode_utf16().chain(Some(0)).collect();
                h = FindWindowW(class_name.as_ptr(), std::ptr::null());
            }
            h
        };

        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if hwnd != std::ptr::null_mut() && GetWindowRect(hwnd, &mut rect) != 0 && rect.right > rect.left && rect.bottom > rect.top {
            // Found VALORANT window bounds
        } else {
            // Fallback to primary screen
            rect.left = 0;
            rect.top = 0;
            rect.right = GetSystemMetrics(SM_CXSCREEN);
            rect.bottom = GetSystemMetrics(SM_CYSCREEN);
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;

        if width <= 0 || height <= 0 {
            return Err("Invalid screen dimensions".to_string());
        }

        let hdc_screen = GetDC(std::ptr::null_mut());
        if hdc_screen == std::ptr::null_mut() {
            return Err("Failed to get screen DC".to_string());
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, width, height);
        let old_obj = SelectObject(hdc_mem, hbm);

        // CAPTUREBLT (0x40000000) captures hardware surfaces & overlays
        let rop = SRCCOPY | 0x40000000;
        BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, rect.left, rect.top, rop);

        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // negative = top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                biSizeImage: (width * height * 4) as u32,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD { rgbBlue: 0, rgbGreen: 0, rgbRed: 0, rgbReserved: 0 }],
        };

        let mut bgra = vec![0u8; (width * height * 4) as usize];
        GetDIBits(
            hdc_mem,
            hbm,
            0,
            height as u32,
            bgra.as_mut_ptr() as *mut _,
            &mut bi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_obj);
        DeleteObject(hbm);
        DeleteDC(hdc_mem);
        ReleaseDC(std::ptr::null_mut(), hdc_screen);

        // Convert BGRA (4 bytes) -> RGB (3 bytes)
        let mut rgb = Vec::with_capacity((width * height * 3) as usize);
        for pixel in bgra.chunks_exact(4) {
            let b = pixel[0];
            let g = pixel[1];
            let r = pixel[2];
            rgb.push(r);
            rgb.push(g);
            rgb.push(b);
        }

        // Encode to JPEG using image crate
        let mut jpeg_buf = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, 80);
        encoder.encode(&rgb, width as u32, height as u32, image::ExtendedColorType::Rgb8)
            .map_err(|e| format!("Failed to encode JPEG screenshot: {}", e))?;

        Ok(jpeg_buf)
    }
}

// Start background bot service
pub fn start_discord_bot_service(config_state: Arc<Mutex<AppConfig>>) {
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build() {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[DiscordBot] Failed to create tokio runtime: {}", e);
                    return;
                }
            };

        rt.block_on(async move {
            loop {
                let (enabled, token, owner_id) = {
                    if let Ok(cfg) = config_state.lock() {
                        (cfg.discord_bot_enabled, cfg.discord_bot_token.trim().to_string(), cfg.discord_bot_owner_id.trim().to_string())
                    } else {
                        (false, String::new(), String::new())
                    }
                };

                if enabled && !token.is_empty() {
                    println!("[DiscordBot] Connecting to Discord Gateway...");
                    if let Err(e) = run_bot_session(&token, &owner_id, Arc::clone(&config_state)).await {
                        eprintln!("[DiscordBot] Session disconnected: {}. Retrying in 10s...", e);
                    }
                }

                tokio::time::sleep(Duration::from_secs(10)).await;
            }
        });
    });
}

// Active bot session over WebSocket
async fn run_bot_session(
    token: &str,
    owner_id: &str,
    config_state: Arc<Mutex<AppConfig>>,
) -> Result<(), String> {
    let gateway_url = "wss://gateway.discord.gg/?v=10&encoding=json";
    let (ws_stream, _) = connect_async(gateway_url)
        .await
        .map_err(|e| format!("Gateway connection failed: {}", e))?;

    let (mut write, mut read) = ws_stream.split();
    let http_client = reqwest::Client::new();
    let auth_header = format!("Bot {}", token);

    let mut heartbeat_interval = 41250u64;
    let mut last_seq: Option<i64> = None;
    let mut heartbeat_timer = tokio::time::interval_at(
        tokio::time::Instant::now() + Duration::from_millis(heartbeat_interval),
        Duration::from_millis(heartbeat_interval),
    );

    // Register Slash Commands with Discord
    tokio::spawn({
        let client = http_client.clone();
        let tok = token.to_string();
        async move {
            register_slash_commands(&client, &tok).await;
        }
    });

    println!("[DiscordBot] WebSocket connected. Listening for events...");

    loop {
        // Check if user disabled bot in Sagebot UI
        {
            if let Ok(cfg) = config_state.lock() {
                if !cfg.discord_bot_enabled || cfg.discord_bot_token.trim() != token {
                    println!("[DiscordBot] Bot disabled or token changed, shutting down session.");
                    return Ok(());
                }
            }
        }

        tokio::select! {
            _ = heartbeat_timer.tick() => {
                let hb = serde_json::json!({
                    "op": 1,
                    "d": last_seq
                });
                if let Err(e) = write.send(Message::Text(hb.to_string())).await {
                    return Err(format!("Heartbeat failed: {}", e));
                }
                // Refresh online status on each heartbeat to ensure Discord keeps presence active
                let presence_refresh = serde_json::json!({
                    "op": 3,
                    "d": {
                        "since": 0,
                        "activities": [{
                            "name": "VALORANT",
                            "type": 0
                        }],
                        "status": "online",
                        "afk": false
                    }
                });
                let _ = write.send(Message::Text(presence_refresh.to_string())).await;
            }
            msg = read.next() => {
                let msg = match msg {
                    Some(Ok(m)) => m,
                    Some(Err(e)) => return Err(format!("WS read error: {}", e)),
                    None => return Err("Gateway connection closed by server".to_string()),
                };

                if let Message::Close(Some(ref frame)) = msg {
                    let code = u16::from(frame.code);
                    if code == 4014 {
                        eprintln!("[DiscordBot] Message Content intent disallowed by Discord (code 4014). Switching to standard intents for Slash Commands...");
                        USE_BASIC_INTENTS.store(true, std::sync::atomic::Ordering::Relaxed);
                    } else if code == 4004 {
                        eprintln!("[DiscordBot] Authentication failed (code 4004): Invalid bot token.");
                    }
                    return Err(format!("Gateway closed (code {}): {}", code, frame.reason));
                }

                if let Message::Text(text) = msg {
                    if let Ok(json) = serde_json::from_str::<Value>(&text) {
                        let op = json.get("op").and_then(|v| v.as_i64()).unwrap_or(-1);
                        if let Some(s) = json.get("s").and_then(|v| v.as_i64()) {
                            last_seq = Some(s);
                        }

                        // Opcode 1: Heartbeat requested by Discord server
                        if op == 1 {
                            let hb = serde_json::json!({
                                "op": 1,
                                "d": last_seq
                            });
                            let _ = write.send(Message::Text(hb.to_string())).await;
                        }

                        // Opcode 10: Hello
                        if op == 10 {
                            if let Some(interval) = json.get("d").and_then(|d| d.get("heartbeat_interval")).and_then(|h| h.as_u64()) {
                                heartbeat_interval = interval;
                                heartbeat_timer = tokio::time::interval_at(
                                    tokio::time::Instant::now() + Duration::from_millis(heartbeat_interval),
                                    Duration::from_millis(heartbeat_interval),
                                );
                            }

                            // Send Identify (Opcode 2)
                            // If privileged intents are disallowed (code 4014), fallback to 4609 (GUILDS | GUILD_MESSAGES | DIRECT_MESSAGES)
                            let intents: u64 = if USE_BASIC_INTENTS.load(std::sync::atomic::Ordering::Relaxed) {
                                4609
                            } else {
                                37377
                            };

                            let identify = serde_json::json!({
                                "op": 2,
                                "d": {
                                    "token": token,
                                    "intents": intents,
                                    "properties": {
                                        "os": "windows",
                                        "browser": "sagebot",
                                        "device": "sagebot",
                                        "$os": "windows",
                                        "$browser": "sagebot",
                                        "$device": "sagebot"
                                    },
                                    "presence": {
                                        "since": 0,
                                        "activities": [{
                                            "name": "VALORANT",
                                            "type": 0
                                        }],
                                        "status": "online",
                                        "afk": false
                                    }
                                }
                            });
                            let _ = write.send(Message::Text(identify.to_string())).await;
                        }

                        // Opcode 0: Dispatch
                        if op == 0 {
                            let event_type = json.get("t").and_then(|v| v.as_str()).unwrap_or("");
                            let data = json.get("d").cloned().unwrap_or(Value::Null);

                            if event_type == "READY" {
                                let presence_update = serde_json::json!({
                                    "op": 3,
                                    "d": {
                                        "since": 0,
                                        "activities": [{
                                            "name": "VALORANT",
                                            "type": 0
                                        }],
                                        "status": "online",
                                        "afk": false
                                    }
                                });
                                let _ = write.send(Message::Text(presence_update.to_string())).await;
                            }

                            // 1. Slash Command Interactions
                            if event_type == "INTERACTION_CREATE" {
                                handle_interaction(&http_client, &auth_header, owner_id, &data).await;
                            }

                            // 2. Regular Text Messages (e.g. /ss, !ss, /status, !status, /start, !start, /stop, !stop)
                            if event_type == "MESSAGE_CREATE" {
                                handle_message_create(&http_client, &auth_header, owner_id, &data).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

// Register Discord Slash Commands
async fn register_slash_commands(client: &reqwest::Client, token: &str) {
    // 1. Get Current Application ID
    let me_url = "https://discord.com/api/v10/users/@me";
    let resp = match client.get(me_url).header("Authorization", format!("Bot {}", token)).send().await {
        Ok(r) => r,
        Err(_) => return,
    };

    let app_id = match resp.json::<Value>().await {
        Ok(json) => match json.get("id").and_then(|i| i.as_str()) {
            Some(id) => id.to_string(),
            None => return,
        },
        Err(_) => return,
    };

    let commands_url = format!("https://discord.com/api/v10/applications/{}/commands", app_id);
    let commands = serde_json::json!([
        {
            "name": "ss",
            "description": "Focus VALORANT and capture a live screenshot",
            "type": 1
        },
        {
            "name": "status",
            "description": "Check current VALORANT match score, map, agent, and rank status",
            "type": 1
        },
        {
            "name": "start",
            "description": "Start SageBot automation",
            "type": 1
        },
        {
            "name": "stop",
            "description": "Pause SageBot automation",
            "type": 1
        }
    ]);

    let _ = client.put(&commands_url)
        .header("Authorization", format!("Bot {}", token))
        .json(&commands)
        .send().await;
}

// Handle Slash Command Interactions
async fn handle_interaction(
    client: &reqwest::Client,
    _auth_header: &str,
    owner_id: &str,
    data: &Value,
) {
    let interaction_id = match data.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return,
    };
    let interaction_token = match data.get("token").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return,
    };
    let user_id = data.get("member").and_then(|m| m.get("user")).or_else(|| data.get("user"))
        .and_then(|u| u.get("id")).and_then(|i| i.as_str()).unwrap_or("");

    // Security Check: Whitelist Owner ID
    if !owner_id.is_empty() && user_id != owner_id {
        let resp_url = format!("https://discord.com/api/v10/interactions/{}/{}/callback", interaction_id, interaction_token);
        let _ = client.post(&resp_url).json(&serde_json::json!({
            "type": 4,
            "data": {
                "content": "⛔ **Access Denied**: You are not the authorized owner of this SageBot instance.",
                "flags": 64 // Ephemeral (visible only to sender)
            }
        })).send().await;
        return;
    }

    let command_name = data.get("data").and_then(|d| d.get("name")).and_then(|n| n.as_str()).unwrap_or("");

    // Defer reply (Type 5) for time-consuming actions like screenshot
    let resp_url = format!("https://discord.com/api/v10/interactions/{}/{}/callback", interaction_id, interaction_token);
    let _ = client.post(&resp_url).json(&serde_json::json!({ "type": 5 })).send().await;

    let app_id = data.get("application_id").and_then(|a| a.as_str()).unwrap_or("");
    let followup_url = format!("https://discord.com/api/v10/webhooks/{}/{}", app_id, interaction_token);

    match command_name {
        "ss" => {
            match capture_valorant_screenshot() {
                Ok(jpeg_bytes) => {
                    let form = reqwest::multipart::Form::new()
                        .part("file[0]", reqwest::multipart::Part::bytes(jpeg_bytes)
                            .file_name("valorant.jpg")
                            .mime_str("image/jpeg").unwrap());

                    let _ = client.post(&followup_url).multipart(form).send().await;
                }
                Err(e) => {
                    let _ = client.post(&followup_url).json(&serde_json::json!({
                        "content": format!("Screenshot Failed: {}", e)
                    })).send().await;
                }
            }
        }
        "status" => {
            let status_msg = get_live_status_summary().await;
            let _ = client.post(&followup_url).json(&serde_json::json!({
                "content": status_msg
            })).send().await;
        }
        "start" => {
            crate::remote_set_bot_running(true);
            let _ = client.post(&followup_url).json(&serde_json::json!({
                "content": "SageBot started."
            })).send().await;
        }
        "stop" => {
            crate::remote_set_bot_running(false);
            let _ = client.post(&followup_url).json(&serde_json::json!({
                "content": "SageBot stoped."
            })).send().await;
        }
        _ => {}
    }
}

// Handle Direct Messages / Channel Text Commands (e.g. !ss, /ss, !status, /status)
async fn handle_message_create(
    client: &reqwest::Client,
    auth_header: &str,
    owner_id: &str,
    data: &Value,
) {
    let author_id = data.get("author").and_then(|a| a.get("id")).and_then(|i| i.as_str()).unwrap_or("");
    let is_bot = data.get("author").and_then(|a| a.get("bot")).and_then(|b| b.as_bool()).unwrap_or(false);
    if is_bot {
        return;
    }

    // Security check: Whitelist Owner ID
    if !owner_id.is_empty() && author_id != owner_id {
        return;
    }

    let content = data.get("content").and_then(|c| c.as_str()).unwrap_or("").trim();
    let channel_id = match data.get("channel_id").and_then(|c| c.as_str()) {
        Some(id) => id,
        None => return,
    };

    let msg_url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);

    if content.eq_ignore_ascii_case("!ss") || content.eq_ignore_ascii_case("/ss") {
        match capture_valorant_screenshot() {
            Ok(jpeg_bytes) => {
                let form = reqwest::multipart::Form::new()
                    .part("file[0]", reqwest::multipart::Part::bytes(jpeg_bytes)
                        .file_name("valorant.jpg")
                        .mime_str("image/jpeg").unwrap());

                let _ = client.post(&msg_url)
                    .header("Authorization", auth_header)
                    .multipart(form)
                    .send().await;
            }
            Err(e) => {
                let _ = client.post(&msg_url)
                    .header("Authorization", auth_header)
                    .json(&serde_json::json!({
                        "content": format!("Screenshot Failed: {}", e)
                    })).send().await;
            }
        }
    } else if content.eq_ignore_ascii_case("!status") || content.eq_ignore_ascii_case("/status") {
        let status_msg = get_live_status_summary().await;
        let _ = client.post(&msg_url)
            .header("Authorization", auth_header)
            .json(&serde_json::json!({ "content": status_msg }))
            .send().await;
    } else if content.eq_ignore_ascii_case("!start") || content.eq_ignore_ascii_case("/start") {
        crate::remote_set_bot_running(true);
        let _ = client.post(&msg_url)
            .header("Authorization", auth_header)
            .json(&serde_json::json!({
                "content": "SageBot started."
            })).send().await;
    } else if content.eq_ignore_ascii_case("!stop") || content.eq_ignore_ascii_case("/stop") {
        crate::remote_set_bot_running(false);
        let _ = client.post(&msg_url)
            .header("Authorization", auth_header)
            .json(&serde_json::json!({
                "content": "SageBot stoped."
            })).send().await;
    }
}

// Generate Live Status Summary for /status
async fn get_live_status_summary() -> String {
    let status = match crate::get_client_status().await {
        Ok(s) => s,
        Err(_) => return "VALORANT Client: Offline / Not Detected".to_string(),
    };

    if !status.is_connected {
        return "VALORANT Client: Offline / Not Detected".to_string();
    }

    let state_str = match status.match_state.as_str() {
        "In Match" | "In Game" => "Status: In Game\n".to_string(),
        "Agent Select" => "Status: Agent Select\n".to_string(),
        "In Lobby" => "Status: In Lobby\n".to_string(),
        "In Queue" => "Status: In Queue\n".to_string(),
        s if !s.is_empty() => format!("Status: {}\n", s),
        _ => "Status: Online\n".to_string(),
    };

    let player_str = match (&status.player_name, &status.player_tag) {
        (Some(name), Some(tag)) => format!("Player: {}#{}\n", name, tag),
        _ => String::new(),
    };

    let rank_str = if !status.rank_name.is_empty() && status.rank_name != "Unranked" && status.rank_name != "-" {
        if status.rank_rr >= 0 {
            format!("Rank: {} ({}RR)\n", status.rank_name, status.rank_rr)
        } else {
            format!("Rank: {}\n", status.rank_name)
        }
    } else if status.rank_name == "Unranked" {
        "Rank: Unranked\n".to_string()
    } else {
        String::new()
    };

    let score_str = if status.score_ally > 0 || status.score_enemy > 0 {
        format!("Score: Round {} ({} - {})\n", status.score_ally + status.score_enemy + 1, status.score_ally, status.score_enemy)
    } else {
        String::new()
    };

    let map_str = if !status.map_name.is_empty() && status.map_name != "-" {
        format!("Map: {}\n", status.map_name)
    } else {
        String::new()
    };

    let mode_str = if !status.gamemode.is_empty() && status.gamemode != "-" {
        format!("Mode: {}\n", status.gamemode)
    } else {
        String::new()
    };

    let agent_str = if !status.current_agent.is_empty() && status.current_agent != "-" {
        format!("Agent: {}\n", status.current_agent)
    } else {
        String::new()
    };

    let server_str = if !status.server_name.is_empty() {
        format!("Server: {}\n", status.server_name)
    } else {
        String::new()
    };

    format!(
        "{}{}{}{}{}{}{}{}",
        state_str, player_str, rank_str, score_str, map_str, mode_str, agent_str, server_str
    ).trim_end().to_string()
}
