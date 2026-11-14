use crate::agents_data::get_all_agents;
use crate::config::AppConfig;
use crate::valorant::{discover_client_version, discover_glz_host, LockfileData, ValorantClient};
use crate::webhook::send_unified_discord_notification;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

fn shuffle_agents(mut ids: Vec<String>) -> Vec<String> {
    if ids.len() <= 1 {
        return ids;
    }
    let mut seed = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;

    for i in (1..ids.len()).rev() {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let j = (seed % (i as u64 + 1)) as usize;
        ids.swap(i, j);
    }
    ids
}

async fn try_lock_candidates(
    client: &ValorantClient,
    match_id: &str,
    candidates: &[String],
    access_token: &str,
    jwt: &str,
    glz_host: &str,
    client_version: &str,
) -> Option<String> {
    for agent_id in candidates {
        let _ = client
            .select_agent_glz(match_id, agent_id, access_token, jwt, glz_host, client_version)
            .await;
        if let Ok(true) = client
            .lock_agent_glz(match_id, agent_id, access_token, jwt, glz_host, client_version)
            .await
        {
            return Some(agent_id.clone());
        }
    }
    None
}

pub fn start_background_locker(config_state: Arc<Mutex<AppConfig>>) {
    tauri::async_runtime::spawn(async move {
        let mut last_match_id = String::new();
        let mut has_locked_in_match = false;
        let mut match_detected_time: Option<std::time::Instant> = None;

        loop {
            let cfg_snapshot = {
                if let Ok(cfg) = config_state.lock() {
                    let mut c = cfg.clone();
                    c.validate_agent_lock();
                    Some(c)
                } else {
                    None
                }
            };

            let cfg = match cfg_snapshot {
                Some(c) => c,
                None => {
                    tokio::time::sleep(Duration::from_millis(1000)).await;
                    continue;
                }
            };

            let is_ingame =
                crate::valorant::IS_INGAME_WITH_AGENT.load(std::sync::atomic::Ordering::Relaxed);
            let locker_active = cfg.agents_enabled && !cfg.selected_agents.is_empty();

            // Adaptive sleep: 3000ms in-game, 2000ms disabled, 750ms while waiting/pregame
            let sleep_ms = if is_ingame {
                3000
            } else if !locker_active {
                2000
            } else {
                750
            };
            tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

            // Agent Mode runs independently from SageBot Main toggle (IS_BOT_RUNNING)
            if !locker_active {
                has_locked_in_match = false;
                last_match_id.clear();
                match_detected_time = None;
                continue;
            }

            if is_ingame {
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

            let pregame_player = match client
                .get_pregame_player_glz(&puuid, &access_token, &jwt, &glz_host, &client_version)
                .await
            {
                Ok(p) => p,
                Err(_) => {
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

            if match_id != last_match_id {
                last_match_id = match_id.clone();
                has_locked_in_match = false;
                crate::HAS_MANUALLY_LOCKED.store(false, std::sync::atomic::Ordering::SeqCst);
                match_detected_time = Some(std::time::Instant::now());
            }

            if has_locked_in_match
                || crate::HAS_MANUALLY_LOCKED.load(std::sync::atomic::Ordering::Relaxed)
            {
                has_locked_in_match = true;
                continue;
            }

            let elapsed_secs = match_detected_time
                .map(|t| t.elapsed().as_secs())
                .unwrap_or(0);

            let mode = match cfg.agent_lock_mode.as_str() {
                "linear" | "random" | "fill" => cfg.agent_lock_mode.as_str(),
                _ => {
                    if cfg.lock_random_agent {
                        "random"
                    } else {
                        "linear"
                    }
                }
            };

            let locked_agent_id: Option<String> = match mode {
                "random" => {
                    let effective_delay = if cfg.instalock_enabled {
                        0
                    } else {
                        cfg.lock_delay.clamp(5, 75)
                    };
                    if elapsed_secs < effective_delay {
                        continue;
                    }
                    let candidates = shuffle_agents(cfg.selected_agents.clone());
                    try_lock_candidates(
                        &client,
                        &match_id,
                        &candidates,
                        &access_token,
                        &jwt,
                        &glz_host,
                        &client_version,
                    )
                    .await
                }
                "fill" => {
                    let pmatch_res = client
                        .get_pregame_match_glz(
                            &match_id,
                            &access_token,
                            &jwt,
                            &glz_host,
                            &client_version,
                        )
                        .await;

                    let pmatch = match pmatch_res {
                        Ok(m) => m,
                        Err(_) => {
                            // Fail-safe at 75s if match info is unavailable
                            if elapsed_secs >= 75 {
                                let candidates = if cfg.fill_fallback_mode == "random" {
                                    shuffle_agents(cfg.selected_agents.clone())
                                } else {
                                    cfg.selected_agents.clone()
                                };
                                let locked = try_lock_candidates(
                                    &client,
                                    &match_id,
                                    &candidates,
                                    &access_token,
                                    &jwt,
                                    &glz_host,
                                    &client_version,
                                )
                                .await;
                                if let Some(ref aid) = locked {
                                    has_locked_in_match = true;
                                    if cfg.webhook_enabled
                                        && cfg.webhook_notify_agent_select
                                        && !cfg.webhook_url.is_empty()
                                    {
                                        let agent_name =
                                            crate::valorant::resolve_agent_name_by_id(aid);
                                        let desc =
                                            format!("Successfully locked **{}**!", agent_name);
                                        let _ = send_unified_discord_notification(
                                            &cfg.webhook_url,
                                            "",
                                            &cfg.webhook_user_id,
                                            &desc,
                                        )
                                        .await;
                                    }
                                }
                            }
                            continue;
                        }
                    };

                    // Extract ally team players
                    let mut players_list: Vec<serde_json::Value> = Vec::new();
                    if let Some(ally) = pmatch
                        .get("AllyTeam")
                        .and_then(|a| a.get("Players"))
                        .and_then(|p| p.as_array())
                    {
                        players_list = ally.clone();
                    } else if let Some(teams) = pmatch.get("Teams").and_then(|t| t.as_array()) {
                        for team in teams {
                            if let Some(pls) = team.get("Players").and_then(|p| p.as_array()) {
                                let has_me = pls.iter().any(|pl| {
                                    pl.get("Subject").and_then(|s| s.as_str()) == Some(&puuid)
                                });
                                if has_me || teams.len() == 1 {
                                    players_list = pls.clone();
                                    break;
                                }
                            }
                        }
                    }

                    // Skip if self has already locked
                    let self_locked = players_list.iter().any(|pl| {
                        pl.get("Subject").and_then(|s| s.as_str()) == Some(&puuid)
                            && pl
                                .get("CharacterSelectionState")
                                .and_then(|s| s.as_str())
                                .unwrap_or("")
                                .eq_ignore_ascii_case("locked")
                    });
                    if self_locked {
                        has_locked_in_match = true;
                        continue;
                    }

                    let other_players: Vec<&serde_json::Value> = players_list
                        .iter()
                        .filter(|pl| {
                            pl.get("Subject").and_then(|s| s.as_str()) != Some(&puuid)
                        })
                        .collect();

                    let all_teammates_locked = !other_players.is_empty()
                        && other_players.iter().all(|pl| {
                            pl.get("CharacterSelectionState")
                                .and_then(|s| s.as_str())
                                .unwrap_or("")
                                .eq_ignore_ascii_case("locked")
                        });

                    let phase_remaining_ns = pmatch
                        .get("PhaseTimeRemainingNS")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(u64::MAX);
                    let near_timeout = phase_remaining_ns <= 5_000_000_000;

                    let ready_to_fill = if cfg.fill_timing_mode == "delayed" {
                        let delay_secs = cfg.fill_delay.clamp(1, 75);
                        elapsed_secs >= delay_secs || near_timeout
                    } else {
                        // "last" fill: wait until every teammate LOCKED (75s failsafe to avoid dodging)
                        all_teammates_locked || elapsed_secs >= 75 || near_timeout
                    };

                    if !ready_to_fill {
                        continue;
                    }

                    // Determine taken agents & satisfied roles from teammates
                    let all_agents = get_all_agents();
                    let mut taken_agent_ids: HashSet<String> = HashSet::new();
                    let mut picked_roles: HashSet<String> = HashSet::new();

                    for pl in &other_players {
                        let cid = pl
                            .get("CharacterID")
                            .and_then(|s| s.as_str())
                            .unwrap_or("")
                            .trim();
                        if !cid.is_empty() {
                            taken_agent_ids.insert(cid.to_lowercase());
                            if let Some(info) = all_agents
                                .iter()
                                .find(|a| a.id.eq_ignore_ascii_case(cid))
                            {
                                picked_roles.insert(info.role.to_lowercase());
                            }
                        }
                    }

                    // Build priority-ordered candidate list:
                    // First, agents matching unsatisfied fill_roles in user priority order
                    let mut candidates: Vec<String> = Vec::new();
                    for role in &cfg.fill_roles {
                        let role_lower = role.to_lowercase();
                        if picked_roles.contains(&role_lower) {
                            continue;
                        }
                        for agent_id in &cfg.selected_agents {
                            if taken_agent_ids.contains(&agent_id.to_lowercase()) {
                                continue;
                            }
                            let matches_role = all_agents
                                .iter()
                                .find(|a| a.id == agent_id.as_str())
                                .map(|a| a.role.to_lowercase() == role_lower)
                                .unwrap_or(false);
                            if matches_role && !candidates.contains(agent_id) {
                                candidates.push(agent_id.clone());
                            }
                        }
                    }

                    // Fallback when all selected roles are satisfied (or no agents left for them)
                    let mut fallback: Vec<String> = cfg
                        .selected_agents
                        .iter()
                        .filter(|id| !taken_agent_ids.contains(&id.to_lowercase()))
                        .cloned()
                        .collect();
                    if cfg.fill_fallback_mode == "random" {
                        fallback = shuffle_agents(fallback);
                    }
                    for id in fallback {
                        if !candidates.contains(&id) {
                            candidates.push(id);
                        }
                    }

                    try_lock_candidates(
                        &client,
                        &match_id,
                        &candidates,
                        &access_token,
                        &jwt,
                        &glz_host,
                        &client_version,
                    )
                    .await
                }
                _ => {
                    // "linear" (default): lock in queue priority order
                    let effective_delay = if cfg.instalock_enabled {
                        0
                    } else {
                        cfg.lock_delay.clamp(5, 75)
                    };
                    if elapsed_secs < effective_delay {
                        continue;
                    }
                    try_lock_candidates(
                        &client,
                        &match_id,
                        &cfg.selected_agents,
                        &access_token,
                        &jwt,
                        &glz_host,
                        &client_version,
                    )
                    .await
                }
            };

            if let Some(aid) = locked_agent_id {
                has_locked_in_match = true;
                if cfg.webhook_enabled
                    && cfg.webhook_notify_agent_select
                    && !cfg.webhook_url.is_empty()
                {
                    let agent_name = crate::valorant::resolve_agent_name_by_id(&aid);
                    let desc = format!("Successfully locked **{}**!", agent_name);
                    let _ = send_unified_discord_notification(
                        &cfg.webhook_url,
                        "",
                        &cfg.webhook_user_id,
                        &desc,
                    )
                    .await;
                }
            }
        }
    });
}
