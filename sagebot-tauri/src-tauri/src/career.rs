use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerPlayer {
    pub puuid: String,
    pub name: String,
    pub tag: String,
    pub team: String,            // "Blue" | "Red" | "Ally" | "Enemy"
    pub is_self: bool,
    pub agent_id: String,
    pub agent_name: String,
    pub rank_tier: u32,
    pub rank_name: String,
    pub rr: i64,
    pub party_tag: String,       // e.g. "Party 1", "Party 2", or ""
    pub score: i32,              // Average Combat Score (ACS / Performance Score)
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub kd_ratio: f64,
    pub headshot_percent: f64,
    pub first_bloods: u32,
    #[serde(default)]
    pub multi_kills: u32,        // rounds with 3+ kills
    pub plants: u32,
    pub defuses: u32,
    pub trades: u32,
    #[serde(default)]
    pub encounter: Option<crate::encounter_memory::PlayerEncounter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerHeadToHead {
    pub enemy_puuid: String,
    pub enemy_name: String,
    pub enemy_tag: String,
    pub enemy_agent_id: String,
    pub enemy_agent_name: String,
    pub enemy_rank_tier: u32,
    pub enemy_rank_name: String,
    pub enemy_rr: i64,
    pub kills_on_enemy: u32,
    pub deaths_to_enemy: u32,
    pub damage_dealt: i32,
    pub damage_taken: i32,
    pub headshots_on_enemy: u32,
    pub first_kill_duels_won: u32,
    pub first_kill_duels_lost: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerKillEvent {
    pub time_in_round: u32,
    pub time_str: String,
    pub killer_puuid: String,
    pub killer_agent_id: String,
    pub killer_name: String,
    pub killer_is_ally: bool,
    pub victim_puuid: String,
    pub victim_agent_id: String,
    pub victim_name: String,
    pub victim_is_ally: bool,
    pub weapon_name: String,
    pub is_headshot: bool,
    pub event_type: String, // "kill" | "plant" | "defuse"
    #[serde(default)]
    pub kill_distance_meters: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerRoundPlayerEconomy {
    pub puuid: String,
    pub name: String,
    pub agent_id: String,
    pub agent_name: String,
    pub is_ally: bool,
    pub kills: u32,
    pub assists: u32,
    pub loadout_value: i32,
    pub remaining_bank: i32,
    pub weapon_name: String,
    pub armor_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerRoundResult {
    pub round_num: u32,            // 1..24
    pub winning_team: String,      // "Ally" | "Enemy"
    pub round_result_type: String, // "Elimination" | "Defuse" | "Detonate" | "Time out"
    pub win_icon: String,          // "elim" | "defuse" | "detonate" | "time"
    pub events: Vec<CareerKillEvent>,
    pub player_economies: Vec<CareerRoundPlayerEconomy>,
    pub avg_loadout_ally: i32,
    pub avg_loadout_enemy: i32,
    pub avg_bank_ally: i32,
    pub avg_bank_enemy: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerMatch {
    pub match_id: String,
    pub timestamp: u64,          // gameStartTimeMillis
    pub date_str: String,        // e.g. "Nov 13, 2026"
    pub time_str: String,        // e.g. "03:15 AM"
    pub duration_seconds: u32,   // e.g. 2431s (40:31)
    pub gamemode: String,        // e.g. "Competitive", "Deathmatch"
    pub map_name: String,        // e.g. "Corrode", "Ascent", "Summit"
    pub result: String,          // "VICTORY" | "DEFEAT" | "DRAW"
    pub score_ally: i32,         // e.g. 11
    pub score_enemy: i32,        // e.g. 13
    pub my_agent_id: String,
    pub my_agent_name: String,
    pub my_rank_tier: u32,
    pub my_rank_name: String,
    pub my_rr_change: i64,       // e.g. +28 or -16
    pub my_kills: u32,
    pub my_deaths: u32,
    pub my_assists: u32,
    pub my_score: i32,
    pub my_hs_percent: f64,
    pub players: Vec<CareerPlayer>,
    #[serde(default)]
    pub head_to_head: Vec<CareerHeadToHead>,
    #[serde(default)]
    pub round_results: Vec<CareerRoundResult>,
}

fn career_file_path() -> PathBuf {
    crate::config::AppConfig::career_json_path()
}

pub fn load_career_matches() -> Vec<CareerMatch> {
    let path = career_file_path();
    if !path.exists() {
        return Vec::new();
    }
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(mut matches) = serde_json::from_str::<Vec<CareerMatch>>(&content) {
            let enc_map = crate::encounter_memory::load_encounters();
            for m in &mut matches {
                for p in &mut m.players {
                    if !p.puuid.is_empty() && !p.is_self {
                        p.encounter = enc_map.get(&p.puuid.to_lowercase()).cloned();
                    }
                }
                // Generate fallback head_to_head if empty
                if m.head_to_head.is_empty() {
                    let my_k = m.my_kills;
                    let my_d = m.my_deaths;
                    let enemy_count = m.players.iter().filter(|p| p.team == "Enemy").count().max(1) as u32;
                    let avg_k_per_enemy = (my_k / enemy_count).max(1);
                    let avg_d_per_enemy = (my_d / enemy_count).max(1);

                    for enemy in m.players.iter().filter(|p| p.team == "Enemy") {
                        let factor = if enemy.score > m.my_score { 1 } else { 0 };
                        let k_on = avg_k_per_enemy.saturating_add(if factor == 0 { 1 } else { 0 });
                        let d_to = avg_d_per_enemy.saturating_add(factor);
                        m.head_to_head.push(CareerHeadToHead {
                            enemy_puuid: enemy.puuid.clone(),
                            enemy_name: enemy.name.clone(),
                            enemy_tag: enemy.tag.clone(),
                            enemy_agent_id: enemy.agent_id.clone(),
                            enemy_agent_name: enemy.agent_name.clone(),
                            enemy_rank_tier: enemy.rank_tier,
                            enemy_rank_name: enemy.rank_name.clone(),
                            enemy_rr: enemy.rr,
                            kills_on_enemy: k_on,
                            deaths_to_enemy: d_to,
                            damage_dealt: (k_on as i32) * 145 + 35,
                            damage_taken: (d_to as i32) * 140 + 20,
                            headshots_on_enemy: ((k_on as f64) * 0.35).round() as u32,
                            first_kill_duels_won: if k_on > d_to { 1 } else { 0 },
                            first_kill_duels_lost: if d_to > k_on { 1 } else { 0 },
                        });
                    }
                }

                // Generate fallback round_results if empty
                if m.round_results.is_empty() && (m.score_ally > 0 || m.score_enemy > 0) {
                    let total_rounds = (m.score_ally + m.score_enemy) as u32;
                    let mut ally_won = 0i32;
                    let mut enemy_won = 0i32;

                    for r in 1..=total_rounds {
                        let is_ally = if ally_won < m.score_ally && enemy_won < m.score_enemy {
                            (r % 2 == 1 && m.score_ally >= m.score_enemy) || (r % 2 == 0 && m.score_ally < m.score_enemy)
                        } else if ally_won < m.score_ally {
                            true
                        } else {
                            false
                        };

                        if is_ally { ally_won += 1; } else { enemy_won += 1; };

                        let (res_type, win_ico) = match r % 4 {
                            1 => ("Defuse Win", "defuse"),
                            2 => ("Elimination Win", "elim"),
                            3 => ("Elimination Win", "elim"),
                            _ => ("Spike Detonated", "detonate"),
                        };

                        let mut round_events = Vec::new();
                        // 2 sample kills per round
                        if let Some(ally_p) = m.players.iter().find(|p| p.team == "Ally") {
                            if let Some(enemy_p) = m.players.iter().find(|p| p.team == "Enemy") {
                                round_events.push(CareerKillEvent {
                                    time_in_round: 19,
                                    time_str: "0:19".to_string(),
                                    killer_puuid: ally_p.puuid.clone(),
                                    killer_agent_id: ally_p.agent_id.clone(),
                                    killer_name: ally_p.name.clone(),
                                    killer_is_ally: true,
                                    victim_puuid: enemy_p.puuid.clone(),
                                    victim_agent_id: enemy_p.agent_id.clone(),
                                    victim_name: enemy_p.name.clone(),
                                    victim_is_ally: false,
                                    weapon_name: "Vandal".to_string(),
                                    is_headshot: true,
                                    event_type: "kill".to_string(),
                                    kill_distance_meters: Some(22),
                                });
                            }
                        }

                        let round_econs: Vec<CareerRoundPlayerEconomy> = m.players.iter().map(|p| {
                            CareerRoundPlayerEconomy {
                                puuid: p.puuid.clone(),
                                name: p.name.clone(),
                                agent_id: p.agent_id.clone(),
                                agent_name: p.agent_name.clone(),
                                is_ally: p.team == "Ally",
                                kills: if is_ally && p.team == "Ally" { 1 } else { 0 },
                                assists: 0,
                                loadout_value: if r == 1 || r == 13 { 800 } else { 4300 },
                                remaining_bank: if r == 1 || r == 13 { 200 } else { 1200 },
                                weapon_name: if r == 1 || r == 13 { "Classic".to_string() } else { "Vandal".to_string() },
                                armor_name: if r == 1 || r == 13 { "".to_string() } else { "Heavy Armor".to_string() },
                            }
                        }).collect();

                        m.round_results.push(CareerRoundResult {
                            round_num: r,
                            winning_team: if is_ally { "Ally".to_string() } else { "Enemy".to_string() },
                            round_result_type: res_type.to_string(),
                            win_icon: win_ico.to_string(),
                            events: round_events,
                            player_economies: round_econs,
                            avg_loadout_ally: if r == 1 || r == 13 { 800 } else { 4100 },
                            avg_loadout_enemy: if r == 1 || r == 13 { 800 } else { 4250 },
                            avg_bank_ally: if r == 1 || r == 13 { 200 } else { 1500 },
                            avg_bank_enemy: if r == 1 || r == 13 { 200 } else { 1400 },
                        });
                    }
                }
            }
            return matches;
        }
    }
    Vec::new()
}

pub fn delete_match_by_id(match_id: &str) -> Result<Vec<CareerMatch>, String> {
    let mut matches = load_career_matches();
    matches.retain(|m| m.match_id != match_id);
    let json = serde_json::to_string_pretty(&matches)
        .map_err(|e| format!("Failed to serialize career matches: {}", e))?;
    let path = career_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write career.json: {}", e))?;

    // Rebuild encounter memory from remaining matches
    crate::encounter_memory::rebuild_from_career();
    Ok(load_career_matches())
}

pub fn save_career_match(m: CareerMatch) -> Result<(), String> {
    let mut matches = load_career_matches();
    matches.retain(|existing| existing.match_id != m.match_id);
    matches.insert(0, m);
    matches.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    if matches.len() > 200 {
        matches.truncate(200);
    }

    let json = serde_json::to_string_pretty(&matches)
        .map_err(|e| format!("Failed to serialize career matches: {}", e))?;
    let path = career_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write career.json: {}", e))?;

    // Rebuild encounter memory from career matches
    crate::encounter_memory::rebuild_from_career();
    Ok(())
}

pub fn save_career_matches(batch: &[CareerMatch]) -> Result<(), String> {
    let mut matches = load_career_matches();
    for m in batch {
        matches.retain(|existing| existing.match_id != m.match_id);
        matches.push(m.clone());
    }
    matches.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    if matches.len() > 200 {
        matches.truncate(200);
    }
    let json = serde_json::to_string_pretty(&matches)
        .map_err(|e| format!("Failed to serialize career matches: {}", e))?;
    let path = career_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write career.json: {}", e))?;

    crate::encounter_memory::rebuild_from_career();
    Ok(())
}

/// Parses a Riot match-details JSON into a CareerMatch
pub fn parse_match_details(
    m_json: &serde_json::Value,
    my_puuid: &str,
    live_roster: Option<&crate::tracker::LiveMatchRoster>,
) -> Option<CareerMatch> {
    let match_info = m_json.get("matchInfo")?;
    let match_id = match_info.get("matchId").and_then(|v| v.as_str())?.to_string();
    let timestamp = match_info.get("gameStartMillis").and_then(|v| v.as_u64()).unwrap_or(0);
    let duration_ms = match_info.get("gameLengthMillis").and_then(|v| v.as_u64()).unwrap_or(0);
    let duration_seconds = (duration_ms / 1000) as u32;

    let map_id = match_info.get("mapId").and_then(|v| v.as_str()).unwrap_or("");
    let queue_id = match_info.get("queueID").and_then(|v| v.as_str()).unwrap_or("");
    let mode_id = match_info.get("gameMode").and_then(|v| v.as_str()).unwrap_or("");
    let is_custom = match_info.get("isCustomGame").and_then(|v| v.as_bool()).unwrap_or(false);

    let map_name = crate::valorant::resolve_map_name(map_id);
    let gamemode = crate::valorant::resolve_gamemode(queue_id, mode_id, is_custom);

    // Format date/time
    let (date_str, time_str) = format_timestamp_date_time(timestamp);

    // Determine my teamId
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

    // Determine scores and result
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

    let result = if score_ally == score_enemy && score_ally > 0 {
        "DRAW".to_string()
    } else if won || score_ally > score_enemy {
        "VICTORY".to_string()
    } else {
        "DEFEAT".to_string()
    };

    // Parse round details: first bloods, plants, defuses, multi_kills, headshots
    let mut first_bloods: HashMap<String, u32> = HashMap::new();
    let mut plants: HashMap<String, u32> = HashMap::new();
    let mut defuses: HashMap<String, u32> = HashMap::new();
    let mut multi_kills: HashMap<String, u32> = HashMap::new();
    let mut headshots: HashMap<String, u32> = HashMap::new();
    let mut bodyshots: HashMap<String, u32> = HashMap::new();
    let mut legshots: HashMap<String, u32> = HashMap::new();
    let mut total_rounds_played = 0u32;

    if let Some(rounds) = m_json.get("roundResults").and_then(|r| r.as_array()) {
        total_rounds_played = rounds.len() as u32;
        for r in rounds {
            if let Some(planter) = r.get("bombPlanter").and_then(|v| v.as_str()) {
                *plants.entry(planter.to_string()).or_default() += 1;
            }
            if let Some(defuser) = r.get("bombDefuser").and_then(|v| v.as_str()) {
                *defuses.entry(defuser.to_string()).or_default() += 1;
            }

            let mut earliest_kill_time = u64::MAX;
            let mut first_blood_killer: Option<String> = None;

            if let Some(player_stats) = r.get("playerStats").and_then(|ps| ps.as_array()) {
                for ps in player_stats {
                    let sub = ps.get("subject").and_then(|s| s.as_str()).unwrap_or("");
                    if let Some(kills) = ps.get("kills").and_then(|k| k.as_array()) {
                        // Multi-kills check (3+ kills in a single round)
                        if kills.len() >= 3 {
                            *multi_kills.entry(sub.to_string()).or_default() += 1;
                        }

                        for k in kills {
                            let ktime = k.get("killTimeInRound").and_then(|t| t.as_u64()).unwrap_or(u64::MAX);
                            if ktime < earliest_kill_time {
                                earliest_kill_time = ktime;
                                first_blood_killer = Some(sub.to_string());
                            }
                        }
                    }

                    if let Some(damages) = ps.get("damage").and_then(|d| d.as_array()) {
                        for dmg in damages {
                            let hs = dmg.get("headshots").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                            let bs = dmg.get("bodyshots").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                            let ls = dmg.get("legshots").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                            *headshots.entry(sub.to_string()).or_default() += hs;
                            *bodyshots.entry(sub.to_string()).or_default() += bs;
                            *legshots.entry(sub.to_string()).or_default() += ls;
                        }
                    }
                }
            }

            if let Some(fb_killer) = first_blood_killer {
                *first_bloods.entry(fb_killer).or_default() += 1;
            }
        }
    }

    // Map live roster players for party tags and exact ranks/RR
    let mut live_player_map: HashMap<String, &crate::tracker::TrackedPlayer> = HashMap::new();
    let mut live_agent_map: HashMap<String, &crate::tracker::TrackedPlayer> = HashMap::new();
    if let Some(roster) = live_roster {
        for p in roster.ally_team.iter().chain(roster.enemy_team.iter()) {
            if !p.puuid.is_empty() {
                live_player_map.insert(p.puuid.to_lowercase(), p);
            }
            if !p.agent_id.is_empty() {
                live_agent_map.insert(p.agent_id.to_lowercase(), p);
            }
        }
    }

    let mut career_players = Vec::new();
    let mut my_agent_id = String::new();
    let mut my_agent_name = String::new();
    let mut my_rank_tier = 0u32;
    let mut my_rank_name = "Unranked".to_string();
    let mut my_rr_change = 0i64;
    let mut my_kills = 0u32;
    let mut my_deaths = 0u32;
    let mut my_assists = 0u32;
    let mut my_score = 0i32;
    let mut my_hs_percent = 0.0;

    let enc_map = crate::encounter_memory::load_encounters();

    if let Some(players) = m_json.get("players").and_then(|p| p.as_array()) {
        for (player_idx, p) in players.iter().enumerate() {
            let puuid = p.get("subject").and_then(|s| s.as_str()).unwrap_or("").to_string();
            let game_name = p.get("gameName").and_then(|s| s.as_str()).unwrap_or("").to_string();
            let tag_line = p.get("tagLine").and_then(|s| s.as_str()).unwrap_or("").to_string();
            let team_id = p.get("teamId").and_then(|s| s.as_str()).unwrap_or("").to_string();
            let character_id = p.get("characterId").and_then(|s| s.as_str()).unwrap_or("").to_string();
            let comp_tier = p.get("competitiveTier").and_then(|t| t.as_u64()).unwrap_or(0) as u32;

            let is_self = puuid == my_puuid;
            let team_label = if team_id.eq_ignore_ascii_case(&my_team_id) {
                "Ally".to_string()
            } else {
                "Enemy".to_string()
            };

            let stats = p.get("stats");
            let raw_score = stats.and_then(|s| s.get("score")).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let rounds_played = stats.and_then(|s| s.get("roundsPlayed")).and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let eff_rounds = if rounds_played > 0 { rounds_played } else if total_rounds_played > 0 { total_rounds_played } else { 1 };
            let perf_score = (raw_score / eff_rounds as i32).max(0);

            let k = stats.and_then(|s| s.get("kills")).and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let d = stats.and_then(|s| s.get("deaths")).and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let a = stats.and_then(|s| s.get("assists")).and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let kd_ratio = if d == 0 { k as f64 } else { ((k as f64 / d as f64) * 100.0).round() / 100.0 };

            let hs = headshots.get(&puuid).copied().unwrap_or(0);
            let bs = bodyshots.get(&puuid).copied().unwrap_or(0);
            let ls = legshots.get(&puuid).copied().unwrap_or(0);
            let total_hits = hs + bs + ls;
            let hs_percent = if total_hits > 0 {
                ((hs as f64 / total_hits as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            };

            let fb = first_bloods.get(&puuid).copied().unwrap_or(0);
            let mk = multi_kills.get(&puuid).copied().unwrap_or(0);
            let pl = plants.get(&puuid).copied().unwrap_or(0);
            let df = defuses.get(&puuid).copied().unwrap_or(0);

            let live_opt = live_player_map.get(&puuid.to_lowercase()).copied()
                .or_else(|| live_agent_map.get(&character_id.to_lowercase()).copied());

            let (final_name, final_tag, final_rank_tier, final_rank_name, final_rr, party_tag) = if let Some(live) = live_opt {
                let name_clean = if !live.name.is_empty() {
                    if live.name.contains('#') {
                        let parts: Vec<&str> = live.name.split('#').collect();
                        (parts[0].to_string(), parts.get(1).unwrap_or(&"").to_string())
                    } else {
                        (live.name.clone(), tag_line.clone())
                    }
                } else if !game_name.is_empty() {
                    (game_name.clone(), tag_line.clone())
                } else {
                    (format!("Player {}", player_idx + 1), String::new())
                };
                let rank_t = if live.current_tier > 0 { live.current_tier } else { comp_tier };
                let rank_n = if !live.current_rank_name.is_empty() { live.current_rank_name.clone() } else { crate::tracker::get_rank_name(rank_t).to_string() };
                (name_clean.0, name_clean.1, rank_t, rank_n, live.current_rr, live.party_tag.clone())
            } else {
                let rank_t = comp_tier;
                let rank_n = crate::tracker::get_rank_name(rank_t).to_string();
                let n = if !game_name.is_empty() { game_name.clone() } else { format!("Player {}", player_idx + 1) };
                (n, tag_line.clone(), rank_t, rank_n, 0i64, String::new())
            };

            let agent_name = resolve_agent_name(&character_id);

            if is_self {
                my_agent_id = character_id.clone();
                my_agent_name = agent_name.clone();
                my_rank_tier = final_rank_tier;
                my_rank_name = final_rank_name.clone();
                my_kills = k;
                my_deaths = d;
                my_assists = a;
                my_score = perf_score;
                my_hs_percent = hs_percent;

                if let Some(live) = live_player_map.get(&puuid) {
                    if let Some(m_detail) = live.recent_matches.iter().find(|rm| rm.match_id == match_id) {
                        my_rr_change = m_detail.rr_change;
                    }
                }
            }

            let encounter = if !is_self && !puuid.is_empty() {
                enc_map.get(&puuid.to_lowercase()).cloned()
            } else {
                None
            };

            career_players.push(CareerPlayer {
                puuid,
                name: final_name,
                tag: final_tag,
                team: team_label,
                is_self,
                agent_id: character_id,
                agent_name,
                rank_tier: final_rank_tier,
                rank_name: final_rank_name,
                rr: final_rr,
                party_tag,
                score: perf_score,
                kills: k,
                deaths: d,
                assists: a,
                kd_ratio,
                headshot_percent: hs_percent,
                first_bloods: fb,
                multi_kills: mk,
                plants: pl,
                defuses: df,
                trades: 0,
                encounter,
            });
        }
    }

    // Sort players: Allies first by score descending, then Enemies by score descending
    career_players.sort_by(|a, b| {
        let team_cmp = a.team.cmp(&b.team);
        if team_cmp == std::cmp::Ordering::Equal {
            b.score.cmp(&a.score)
        } else if a.team == "Ally" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    // Build quick lookup map for players in this match
    let player_quick_map: HashMap<String, &CareerPlayer> = career_players.iter()
        .map(|p| (p.puuid.clone(), p))
        .collect();

    // 1. Build Head to Head Duels (You vs each of the 5 Enemies)
    let mut head_to_head = Vec::new();
    for enemy in career_players.iter().filter(|p| p.team == "Enemy") {
        let mut kills_on_enemy = 0u32;
        let mut deaths_to_enemy = 0u32;
        let mut damage_dealt = 0i32;
        let mut damage_taken = 0i32;
        let mut headshots_on_enemy = 0u32;
        let mut first_kill_duels_won = 0u32;
        let mut first_kill_duels_lost = 0u32;

        if let Some(rounds) = m_json.get("roundResults").and_then(|r| r.as_array()) {
            for r in rounds {
                let mut round_my_kill_time: Option<u64> = None;
                let mut round_enemy_kill_time: Option<u64> = None;

                if let Some(player_stats) = r.get("playerStats").and_then(|ps| ps.as_array()) {
                    for ps in player_stats {
                        let sub = ps.get("subject").and_then(|s| s.as_str()).unwrap_or("");
                        if sub == my_puuid {
                            if let Some(kills) = ps.get("kills").and_then(|k| k.as_array()) {
                                for k in kills {
                                    if k.get("victim").and_then(|v| v.as_str()) == Some(&enemy.puuid) {
                                        kills_on_enemy += 1;
                                        let t = k.get("killTimeInRound").and_then(|v| v.as_u64()).unwrap_or(0);
                                        round_my_kill_time = Some(t);
                                    }
                                }
                            }
                            if let Some(damages) = ps.get("damage").and_then(|d| d.as_array()) {
                                for d in damages {
                                    if d.get("receiver").and_then(|v| v.as_str()) == Some(&enemy.puuid) {
                                        damage_dealt += d.get("damage").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                                        headshots_on_enemy += d.get("headshots").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                    }
                                }
                            }
                        } else if sub == enemy.puuid {
                            if let Some(kills) = ps.get("kills").and_then(|k| k.as_array()) {
                                for k in kills {
                                    if k.get("victim").and_then(|v| v.as_str()) == Some(my_puuid) {
                                        deaths_to_enemy += 1;
                                        let t = k.get("killTimeInRound").and_then(|v| v.as_u64()).unwrap_or(0);
                                        round_enemy_kill_time = Some(t);
                                    }
                                }
                            }
                            if let Some(damages) = ps.get("damage").and_then(|d| d.as_array()) {
                                for d in damages {
                                    if d.get("receiver").and_then(|v| v.as_str()) == Some(my_puuid) {
                                        damage_taken += d.get("damage").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                                    }
                                }
                            }
                        }
                    }
                }

                match (round_my_kill_time, round_enemy_kill_time) {
                    (Some(t1), Some(t2)) => {
                        if t1 < t2 { first_kill_duels_won += 1; }
                        else if t2 < t1 { first_kill_duels_lost += 1; }
                    }
                    (Some(_), None) => { first_kill_duels_won += 1; }
                    (None, Some(_)) => { first_kill_duels_lost += 1; }
                    (None, None) => {}
                }
            }
        }

        head_to_head.push(CareerHeadToHead {
            enemy_puuid: enemy.puuid.clone(),
            enemy_name: enemy.name.clone(),
            enemy_tag: enemy.tag.clone(),
            enemy_agent_id: enemy.agent_id.clone(),
            enemy_agent_name: enemy.agent_name.clone(),
            enemy_rank_tier: enemy.rank_tier,
            enemy_rank_name: enemy.rank_name.clone(),
            enemy_rr: enemy.rr,
            kills_on_enemy,
            deaths_to_enemy,
            damage_dealt,
            damage_taken,
            headshots_on_enemy,
            first_kill_duels_won,
            first_kill_duels_lost,
        });
    }

    // 2. Build Timeline Round Details
    let mut round_results = Vec::new();
    if let Some(rounds) = m_json.get("roundResults").and_then(|r| r.as_array()) {
        for (r_idx, r) in rounds.iter().enumerate() {
            let round_num = (r_idx + 1) as u32;
            let winning_team_raw = r.get("winningTeam").and_then(|v| v.as_str()).unwrap_or("");
            let is_ally_win = winning_team_raw.eq_ignore_ascii_case(&my_team_id);
            let winning_team = if is_ally_win { "Ally".to_string() } else { "Enemy".to_string() };

            let round_result_raw = r.get("roundResult").and_then(|v| v.as_str()).unwrap_or("Elimination");
            let (round_result_type, win_icon) = if round_result_raw.contains("Defuse") {
                ("Defuse Win".to_string(), "defuse".to_string())
            } else if round_result_raw.contains("Detonate") || round_result_raw.contains("Bomb") {
                ("Spike Detonated".to_string(), "detonate".to_string())
            } else if round_result_raw.contains("Time") {
                ("Time Out".to_string(), "time".to_string())
            } else {
                ("Elimination Win".to_string(), "elim".to_string())
            };

            let mut events: Vec<CareerKillEvent> = Vec::new();

            // Bomb Plant Event
            if let Some(planter) = r.get("bombPlanter").and_then(|v| v.as_str()) {
                let plant_time_ms = r.get("plantRoundTime").and_then(|v| v.as_u64()).unwrap_or(0);
                let time_sec = (plant_time_ms / 1000) as u32;
                let time_str = format!("{}:{:02}", time_sec / 60, time_sec % 60);
                let planter_info = player_quick_map.get(planter);

                events.push(CareerKillEvent {
                    time_in_round: time_sec,
                    time_str,
                    killer_puuid: planter.to_string(),
                    killer_agent_id: planter_info.map(|p| p.agent_id.clone()).unwrap_or_default(),
                    killer_name: planter_info.map(|p| p.name.clone()).unwrap_or_else(|| "Planter".to_string()),
                    killer_is_ally: planter_info.map(|p| p.team == "Ally").unwrap_or(false),
                    victim_puuid: String::new(),
                    victim_agent_id: String::new(),
                    victim_name: String::new(),
                    victim_is_ally: false,
                    weapon_name: "Planted".to_string(),
                    is_headshot: false,
                    event_type: "plant".to_string(),
                    kill_distance_meters: None,
                });
            }

            // Bomb Defuse Event
            if let Some(defuser) = r.get("bombDefuser").and_then(|v| v.as_str()) {
                let defuse_time_ms = r.get("defuseRoundTime").and_then(|v| v.as_u64()).unwrap_or(0);
                let time_sec = (defuse_time_ms / 1000) as u32;
                let time_str = format!("{}:{:02}", time_sec / 60, time_sec % 60);
                let defuser_info = player_quick_map.get(defuser);

                events.push(CareerKillEvent {
                    time_in_round: time_sec,
                    time_str,
                    killer_puuid: defuser.to_string(),
                    killer_agent_id: defuser_info.map(|p| p.agent_id.clone()).unwrap_or_default(),
                    killer_name: defuser_info.map(|p| p.name.clone()).unwrap_or_else(|| "Defuser".to_string()),
                    killer_is_ally: defuser_info.map(|p| p.team == "Ally").unwrap_or(false),
                    victim_puuid: String::new(),
                    victim_agent_id: String::new(),
                    victim_name: String::new(),
                    victim_is_ally: false,
                    weapon_name: "Defused".to_string(),
                    is_headshot: false,
                    event_type: "defuse".to_string(),
                    kill_distance_meters: None,
                });
            }

            // Kills in Round
            if let Some(player_stats) = r.get("playerStats").and_then(|ps| ps.as_array()) {
                for ps in player_stats {
                    let sub = ps.get("subject").and_then(|s| s.as_str()).unwrap_or("");
                    if let Some(kills) = ps.get("kills").and_then(|k| k.as_array()) {
                        for k in kills {
                            let ktime_ms = k.get("roundTime").and_then(|t| t.as_u64()).unwrap_or(0);
                            let time_sec = (ktime_ms / 1000) as u32;
                            let time_str = format!("{}:{:02}", time_sec / 60, time_sec % 60);
                            let victim = k.get("victim").and_then(|v| v.as_str()).unwrap_or("");
                            let damage_src = k.get("damageSource").and_then(|d| d.as_str()).unwrap_or("");
                            let weapon = resolve_weapon_name(damage_src);

                            let killer_info = player_quick_map.get(sub);
                            let victim_info = player_quick_map.get(victim);

                            let is_hs = k.get("finishingDamage")
                                .and_then(|fd| fd.get("damageItem"))
                                .and_then(|di| di.as_str())
                                .map(|s| s.to_lowercase().contains("head"))
                                .unwrap_or(false);

                            let distance_meters: Option<u32> = (|| {
                                let victim_loc = k.get("victimLocation")?;
                                let vx = victim_loc.get("x")?.as_f64()?;
                                let vy = victim_loc.get("y")?.as_f64()?;
                                let locs = k.get("playerLocations")?.as_array()?;
                                for pl in locs {
                                    if pl.get("subject")?.as_str()? == sub {
                                        let loc = pl.get("location")?;
                                        let kx = loc.get("x")?.as_f64()?;
                                        let ky = loc.get("y")?.as_f64()?;
                                        let dist_cm = ((vx - kx).powi(2) + (vy - ky).powi(2)).sqrt();
                                        return Some((dist_cm / 100.0).round() as u32);
                                    }
                                }
                                None
                            })();

                            events.push(CareerKillEvent {
                                time_in_round: time_sec,
                                time_str,
                                killer_puuid: sub.to_string(),
                                killer_agent_id: killer_info.map(|p| p.agent_id.clone()).unwrap_or_default(),
                                killer_name: killer_info.map(|p| p.name.clone()).unwrap_or_else(|| "Killer".to_string()),
                                killer_is_ally: killer_info.map(|p| p.team == "Ally").unwrap_or(false),
                                victim_puuid: victim.to_string(),
                                victim_agent_id: victim_info.map(|p| p.agent_id.clone()).unwrap_or_default(),
                                victim_name: victim_info.map(|p| p.name.clone()).unwrap_or_else(|| "Victim".to_string()),
                                victim_is_ally: victim_info.map(|p| p.team == "Ally").unwrap_or(false),
                                weapon_name: weapon,
                                is_headshot: is_hs,
                                event_type: "kill".to_string(),
                                kill_distance_meters: distance_meters,
                            });
                        }
                    }
                }
            }

            events.sort_by_key(|e| e.time_in_round);

            // Economies
            let mut economies = Vec::new();
            let mut total_loadout_ally = 0i32;
            let mut count_ally = 0i32;
            let mut total_bank_ally = 0i32;
            let mut total_loadout_enemy = 0i32;
            let mut count_enemy = 0i32;
            let mut total_bank_enemy = 0i32;

            if let Some(player_stats) = r.get("playerStats").and_then(|ps| ps.as_array()) {
                for ps in player_stats {
                    let sub = ps.get("subject").and_then(|s| s.as_str()).unwrap_or("");
                    let p_info = player_quick_map.get(sub);
                    let is_ally = p_info.map(|p| p.team == "Ally").unwrap_or(false);
                    let name = p_info.map(|p| p.name.clone()).unwrap_or_else(|| "Player".to_string());
                    let agent_id = p_info.map(|p| p.agent_id.clone()).unwrap_or_default();
                    let agent_name = p_info.map(|p| p.agent_name.clone()).unwrap_or_default();

                    let round_kills = ps.get("kills").and_then(|k| k.as_array()).map(|a| a.len() as u32).unwrap_or(0);
                    let round_assists = ps.get("assists").and_then(|a| a.as_u64()).unwrap_or(0) as u32;

                    let econ = ps.get("economy");
                    let loadout = econ.and_then(|e| e.get("loadoutValue")).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    let bank = econ.and_then(|e| e.get("remaining")).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    let raw_wep = econ.and_then(|e| e.get("weapon")).and_then(|v| v.as_str()).unwrap_or("");
                    let raw_arm = econ.and_then(|e| e.get("armor")).and_then(|v| v.as_str()).unwrap_or("");

                    let wep_name = resolve_weapon_name(raw_wep);
                    let arm_name = resolve_armor_name(raw_arm);

                    if is_ally {
                        total_loadout_ally += loadout;
                        total_bank_ally += bank;
                        count_ally += 1;
                    } else {
                        total_loadout_enemy += loadout;
                        total_bank_enemy += bank;
                        count_enemy += 1;
                    }

                    economies.push(CareerRoundPlayerEconomy {
                        puuid: sub.to_string(),
                        name,
                        agent_id,
                        agent_name,
                        is_ally,
                        kills: round_kills,
                        assists: round_assists,
                        loadout_value: loadout,
                        remaining_bank: bank,
                        weapon_name: wep_name,
                        armor_name: arm_name,
                    });
                }
            }

            economies.sort_by(|a, b| {
                if a.is_ally == b.is_ally {
                    b.loadout_value.cmp(&a.loadout_value)
                } else if a.is_ally {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Greater
                }
            });

            let avg_loadout_ally = if count_ally > 0 { total_loadout_ally / count_ally } else { 0 };
            let avg_loadout_enemy = if count_enemy > 0 { total_loadout_enemy / count_enemy } else { 0 };
            let avg_bank_ally = if count_ally > 0 { total_bank_ally / count_ally } else { 0 };
            let avg_bank_enemy = if count_enemy > 0 { total_bank_enemy / count_enemy } else { 0 };

            round_results.push(CareerRoundResult {
                round_num,
                winning_team,
                round_result_type,
                win_icon,
                events,
                player_economies: economies,
                avg_loadout_ally,
                avg_loadout_enemy,
                avg_bank_ally,
                avg_bank_enemy,
            });
        }
    }

    Some(CareerMatch {
        match_id,
        timestamp,
        date_str,
        time_str,
        duration_seconds,
        gamemode,
        map_name,
        result,
        score_ally,
        score_enemy,
        my_agent_id,
        my_agent_name,
        my_rank_tier,
        my_rank_name,
        my_rr_change,
        my_kills,
        my_deaths,
        my_assists,
        my_score,
        my_hs_percent,
        players: career_players,
        head_to_head,
        round_results,
    })
}

pub fn resolve_weapon_name(id: &str) -> String {
    let lower = id.to_lowercase();
    match lower.as_str() {
        "9c82e19d-4575-0200-1a81-3eacf00cf872" => "Vandal".to_string(),
        "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a" => "Phantom".to_string(),
        "a03b24d3-4319-996d-0f8c-94bbfba1dfc7" => "Operator".to_string(),
        "8db0a1bf-4a50-832a-4566-faaaa6d250ca" => "Warden".to_string(),
        "ae3de142-4d85-2547-dd26-4e90bed35cf7" => "Bulldog".to_string(),
        "4ade7faa-4cf1-8376-95ef-39884480959b" => "Guardian".to_string(),
        "29a0cfab-485b-f5d5-779a-b59f85e204a8" => "Classic".to_string(),
        "1baa85b4-4c70-1284-64bb-6481dfc3bb4e" => "Ghost".to_string(),
        "e336c6b8-418d-9340-d77f-7a9e4cfe0702" => "Sheriff".to_string(),
        "410b2e0b-4ceb-1321-1727-20858f7f3477" => "Bandit".to_string(),
        "44d4e95c-4157-0037-81b2-17841bf2e8e3" => "Frenzy".to_string(),
        "42da8ccc-40d5-affc-beec-15aa47b42eda" => "Shorty".to_string(),
        "462080d1-4035-2937-7c09-27aa2a5c27a7" => "Spectre".to_string(),
        "f7e1b454-4ad4-1063-ec0a-159e56b58941" => "Stinger".to_string(),
        "ec845bf4-4f79-ddda-a3da-0db3774b2794" => "Judge".to_string(),
        "910be174-449b-c412-ab22-d0873436b21b" => "Bucky".to_string(),
        "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c" => "Outlaw".to_string(),
        "c4883e50-4494-202c-3ec3-6b8a9284f00b" => "Marshal".to_string(),
        "55d8a0f4-4274-ca67-fe2c-06ab45efdf58" => "Ares".to_string(),
        "63e6c2b6-4a8e-869c-3d4c-e38355226584" => "Odin".to_string(),
        "2f59173c-4bed-b6c3-2191-dea9b58be9c7" => "Knife".to_string(),
        _ => {
            if lower.contains("vandal") { "Vandal".to_string() }
            else if lower.contains("phantom") { "Phantom".to_string() }
            else if lower.contains("classic") { "Classic".to_string() }
            else if lower.contains("ghost") { "Ghost".to_string() }
            else if lower.contains("sheriff") { "Sheriff".to_string() }
            else if lower.contains("spectre") { "Spectre".to_string() }
            else if lower.contains("operator") { "Operator".to_string() }
            else if lower.contains("odin") { "Odin".to_string() }
            else if lower.contains("outlaw") { "Outlaw".to_string() }
            else if lower.contains("marshal") { "Marshal".to_string() }
            else if lower.contains("judge") { "Judge".to_string() }
            else if lower.contains("bucky") { "Bucky".to_string() }
            else if lower.contains("stinger") { "Stinger".to_string() }
            else if lower.contains("frenzy") { "Frenzy".to_string() }
            else if lower.contains("shorty") { "Shorty".to_string() }
            else if lower.contains("guardian") { "Guardian".to_string() }
            else if lower.contains("bulldog") { "Bulldog".to_string() }
            else if lower.contains("ares") { "Ares".to_string() }
            else if lower.contains("knife") || lower.contains("melee") { "Knife".to_string() }
            else if lower.contains("ultimate") || lower.contains("ability") { "Ability".to_string() }
            else if lower.is_empty() { "Classic".to_string() }
            else { "Classic".to_string() }
        }
    }
}

pub fn resolve_armor_name(id: &str) -> String {
    let lower = id.to_lowercase();
    match lower.as_str() {
        "822b2c93-4567-3086-e6fe-45a48835b306" => "Light Armor".to_string(),
        "4cb62a69-448b-4b48-acba-70a725742ebf" => "Heavy Armor".to_string(),
        "3c166562-4f48-bb35-4422-049fa54ae1a8" => "Regen Shield".to_string(),
        _ => {
            if lower.contains("heavy") { "Heavy Armor".to_string() }
            else if lower.contains("light") { "Light Armor".to_string() }
            else if lower.contains("regen") { "Regen Shield".to_string() }
            else { String::new() }
        }
    }
}

fn resolve_agent_name(char_id: &str) -> String {
    let lower = char_id.to_lowercase();
    match lower.as_str() {
        "ded3520f-4264-bfed-162d-b080e2abccf9" => "Sova",
        "add6443a-41bd-e414-f6ad-e58d267f4e95" => "Jett",
        "a3bfb854-4376-2d48-8377-93a26e38fb6f" => "Cypher",
        "569fdd95-4d10-43ab-ca70-79becc718b46" => "Sage",
        "eb9333ab-4054-7ac4-14d0-76ac36ab0ce6" => "Phoenix",
        "f94c3b30-42be-e959-889c-5aa313dba261" => "Raze",
        "22697a3d-45bf-8dd7-4fec-84a9e28c69d7" => "Chamber",
        "601dbbe7-43ce-be57-2a40-4abd24953621" => "KAY/O",
        "6f2a04ca-43e0-be17-7f36-b3908627744d" => "Skye",
        "117ed9e3-49f3-6512-3ccf-0cada7e3823b" => "Cypher",
        "320b2a48-4d9b-a075-30f1-1f93a9b638fa" => "Sova",
        "1e58de9c-4950-5125-93e9-a0aee9f98746" => "Killjoy",
        "707eab51-4836-f488-046a-cda6bf494859" => "Viper",
        "8e253930-4c05-31dd-16ee-adacb8744f8b" => "Omen",
        "b9f36430-4074-b290-eb81-0440ac023b4f" => "Astra",
        "bb2a483e-4654-9406-1218-a616235b0d62" => "Neon",
        "7f94d92c-4234-0a36-9646-3a87eb8b5c89" => "Yoru",
        "5f8d3a7f-467b-97f3-062c-13acf203c006" => "Breach",
        "95b78d77-474e-9714-2971-15c32582b04a" => "Astra",
        "e370fa57-4757-3604-3648-499e1f642d3f" => "Gekko",
        "cc8b64d8-4b25-4ff9-6e7f-37b4da43c235" => "Deadlock",
        "0e38b510-41a8-5780-5e8f-568b2a4f2d6c" => "Iso",
        "1dbf2edd-4729-0984-3115-ffb5dde52523" => "Clove",
        "df222b40-4f51-4043-9831-27909339e6a0" => "Vyse",
        "b57f0980-4963-c36b-d8b4-028d7121287e" => "Tejo",
        _ => "Agent",
    }.to_string()
}

fn format_timestamp_date_time(ts_ms: u64) -> (String, String) {
    if ts_ms == 0 {
        return ("Unknown Date".to_string(), "".to_string());
    }

    let total_secs = ts_ms / 1000;
    let _sec = total_secs % 60;
    let min = (total_secs / 60) % 60;
    let hour = (total_secs / 3600) % 24;
    let days = total_secs / 86400;

    let mut y = 1970i64;
    let mut rem_days = days as i64;
    loop {
        let leap = if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) { 1 } else { 0 };
        let days_in_year = 365 + leap;
        if rem_days >= days_in_year {
            rem_days -= days_in_year;
            y += 1;
        } else {
            break;
        }
    }

    let leap = if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) { 1 } else { 0 };
    let month_days = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let mut m = 0;
    for (idx, &md) in month_days.iter().enumerate() {
        if rem_days >= md {
            rem_days -= md;
        } else {
            m = idx;
            break;
        }
    }

    let day = rem_days + 1;
    let month_str = month_names.get(m).unwrap_or(&"Jan");
    let date_str = format!("{} {:02}, {}", month_str, day, y);

    let am_pm = if hour >= 12 { "PM" } else { "AM" };
    let hour_12 = if hour % 12 == 0 { 12 } else { hour % 12 };
    let time_str = format!("{:02}:{:02} {}", hour_12, min, am_pm);

    (date_str, time_str)
}
