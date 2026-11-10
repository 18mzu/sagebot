use crate::config::AppConfig;
use crate::valorant::{discover_client_version, discover_glz_host, LockfileData, ValorantClient};
use crate::webhook::send_unified_discord_notification;
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub fn start_background_locker(config_state: Arc<Mutex<AppConfig>>) {
    tauri::async_runtime::spawn(async move {
        let mut last_match_id = String::new();
        let mut has_locked_in_match = false;
        let mut match_detected_time: Option<std::time::Instant> = None;

        loop {
            // Adaptive sleep: throttle down to 3000ms when live in-game with agent or 2500ms when idle
            let is_bot_active = crate::IS_BOT_RUNNING.load(std::sync::atomic::Ordering::Relaxed);
            let is_ingame = crate::valorant::IS_INGAME_WITH_AGENT.load(std::sync::atomic::Ordering::Relaxed);
            let sleep_ms = if !is_bot_active {
                2500
            } else if is_ingame {
                3000
            } else {
                1000
            };
            tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

            let (agents_enabled, instalock, lock_delay, fallback, lock_random_agent, selected_agents, webhook_url, webhook_user_id, webhook_enabled, webhook_notify_agent_select, bot_token) = {
                if let Ok(cfg) = config_state.lock() {
                    let uid = if !cfg.discord_bot_owner_id.is_empty() { cfg.discord_bot_owner_id.clone() } else { cfg.webhook_user_id.clone() };
                    (
                        cfg.agents_enabled,
                        cfg.instalock_enabled,
                        cfg.lock_delay,
                        cfg.starter_fallback_enabled,
                        cfg.lock_random_agent,
                        cfg.selected_agents.clone(),
                        cfg.webhook_url.clone(),
                        uid,
                        cfg.webhook_enabled || cfg.discord_bot_enabled,
                        cfg.webhook_notify_agent_select,
                        cfg.discord_bot_token.clone(),
                    )
                } else {
                    continue;
                }
            };

            // Ensure locker only executes when SageBot is actively running
            if !is_bot_active {
                has_locked_in_match = false;
                last_match_id.clear();
                match_detected_time = None;
                continue;
            }

            // If already in-game, skip pregame queries
            if is_ingame {
                continue;
            }

            // Run locker if agent selection is enabled (with queued agents OR random agent) OR starter fallback is enabled
            let has_custom_agents = agents_enabled && !selected_agents.is_empty();
            let has_random = agents_enabled && lock_random_agent;
            if !has_custom_agents && !has_random && !fallback {
                continue;
            }

            let lockfile = match LockfileData::read_from_disk() {
                Ok(l) => l,
                Err(_) => {
                    has_locked_in_match = false;
                    last_match_id.clear();
                    match_detected_time = None;
                    continue;
                }
            };

            let client = match ValorantClient::new(lockfile) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let session = match client.get_session().await {
                Ok(s) => s,
                Err(_) => continue,
            };

            let puuid = match session.get("puuid").and_then(|v| v.as_str()) {
                Some(p) => p.to_string(),
                None => continue,
            };

            let (access_token, jwt) = match client.get_riot_tokens().await {
                Ok(t) => t,
                Err(_) => continue,
            };

            let glz_host = discover_glz_host();
            let client_version = discover_client_version();

            // Check pregame player on regional GLZ server
            let pregame_player = match client.get_pregame_player_glz(&puuid, &access_token, &jwt, &glz_host, &client_version).await {
                Ok(p) => p,
                Err(_) => {
                    // Not in pregame
                    has_locked_in_match = false;
                    last_match_id.clear();
                    match_detected_time = None;
                    continue;
                }
            };

            let match_id = match pregame_player.get("MatchID").and_then(|v| v.as_str()) {
                Some(mid) if !mid.is_empty() => mid.to_string(),
                _ => {
                    has_locked_in_match = false;
                    last_match_id.clear();
                    match_detected_time = None;
                    continue;
                }
            };

            // If new match detected, initialize match timer
            if match_id != last_match_id {
                last_match_id = match_id.clone();
                has_locked_in_match = false;
                crate::HAS_MANUALLY_LOCKED.store(false, std::sync::atomic::Ordering::SeqCst);
                match_detected_time = Some(std::time::Instant::now());
            }

            if has_locked_in_match || crate::HAS_MANUALLY_LOCKED.load(std::sync::atomic::Ordering::Relaxed) {
                has_locked_in_match = true;
                continue;
            }

            // Both custom agents and Starter Fallback MUST follow Lock Delay unless Instalock is on
            let effective_delay_secs = if instalock {
                0
            } else {
                lock_delay.clamp(10, 70)
            };

            if effective_delay_secs > 0 {
                if let Some(t0) = match_detected_time {
                    let elapsed = t0.elapsed();
                    let target_duration = Duration::from_secs(effective_delay_secs);
                    if elapsed < target_duration {
                        // Recheck every tick until target delay has elapsed
                        continue;
                    }
                }
            }

            // 1. Attempt to lock agents (if agents_enabled is on)
            let mut locked = false;
            let mut locked_agent_id = String::new();

            if agents_enabled && lock_random_agent {
                // Random agent locking: shuffle selected agents in queue and try until one succeeds
                let mut candidate_ids: Vec<String> = selected_agents.clone();

                if !candidate_ids.is_empty() {
                    let mut seed = std::time::SystemTime::now()
                        .duration_since(std::time::SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_nanos() as u64;

                    for i in (1..candidate_ids.len()).rev() {
                        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                        let j = (seed % (i as u64 + 1)) as usize;
                        candidate_ids.swap(i, j);
                    }

                    for agent_id in candidate_ids {
                        let _ = client.select_agent_glz(&match_id, &agent_id, &access_token, &jwt, &glz_host, &client_version).await;
                        if let Ok(success) = client.lock_agent_glz(&match_id, &agent_id, &access_token, &jwt, &glz_host, &client_version).await {
                            if success {
                                locked = true;
                                locked_agent_id = agent_id;
                                break;
                            }
                        }
                    }
                }
            } else if agents_enabled {
                for agent_id in &selected_agents {
                    let _ = client.select_agent_glz(&match_id, agent_id, &access_token, &jwt, &glz_host, &client_version).await;
                    if let Ok(success) = client.lock_agent_glz(&match_id, agent_id, &access_token, &jwt, &glz_host, &client_version).await {
                        if success {
                            locked = true;
                            locked_agent_id = agent_id.to_string();
                            break;
                        }
                    }
                }
            }

            // 2. If selected agents failed (or none selected) and starter fallback is enabled
            if !locked && fallback {
                // Official starter 5 agents guaranteed to be owned by all accounts
                let starters = vec![
                    "569fdd95-4d10-43ab-ca70-79becc718b46", // Sage
                    "add6443a-41bd-e414-f6ad-e58d267f4e95", // Jett
                    "eb93336a-449b-9c1b-0a54-a891f7921d69", // Phoenix
                    "320b2a48-4d9b-a075-30f1-1f93a9b638fa", // Sova
                    "9f0d8ba9-4140-b941-57d3-a7ad57c6b417", // Brimstone
                ];

                for starter_id in starters {
                    let _ = client.select_agent_glz(&match_id, starter_id, &access_token, &jwt, &glz_host, &client_version).await;
                    if let Ok(success) = client.lock_agent_glz(&match_id, starter_id, &access_token, &jwt, &glz_host, &client_version).await {
                        if success {
                            locked = true;
                            locked_agent_id = starter_id.to_string();
                            break;
                        }
                    }
                }
            }

            if locked {
                has_locked_in_match = true;
                if webhook_enabled && webhook_notify_agent_select && (!webhook_url.is_empty() || (!bot_token.is_empty() && !webhook_user_id.is_empty())) {
                    let agent_name = crate::valorant::resolve_agent_name_by_id(&locked_agent_id);
                    let desc = format!("Successfully locked **{}**!", agent_name);
                    let _ = send_unified_discord_notification(
                        &webhook_url,
                        &bot_token,
                        &webhook_user_id,
                        &desc,
                    ).await;
                }
            }
        }
    });
}
