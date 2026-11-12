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
    pub plants: u32,
    pub defuses: u32,
    pub trades: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerMatch {
    pub match_id: String,
    pub timestamp: u64,          // gameStartTimeMillis
    pub date_str: String,        // e.g. "Nov 13, 2026"
    pub time_str: String,        // e.g. "03:15 AM"
    pub duration_seconds: u32,   // e.g. 2431s (40:31)
    pub gamemode: String,        // e.g. "Competitive", "Deathmatch"
    pub map_name: String,        // e.g. "Corrode", "Ascent"
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
        if let Ok(matches) = serde_json::from_str::<Vec<CareerMatch>>(&content) {
            return matches;
        }
    }
    Vec::new()
}

pub fn save_career_match(m: CareerMatch) -> Result<(), String> {
    let mut matches = load_career_matches();
    // Remove if already exists with same match_id
    matches.retain(|existing| existing.match_id != m.match_id);
    matches.insert(0, m);
    // Sort descending by timestamp
    matches.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    // Keep up to 200 matches locally
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

    // Parse round details: first bloods, plants, defuses, headshots, bodyshots, legshots
    let mut first_bloods: HashMap<String, u32> = HashMap::new();
    let mut plants: HashMap<String, u32> = HashMap::new();
    let mut defuses: HashMap<String, u32> = HashMap::new();
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

            // Find first blood of the round: earliest kill event
            let mut earliest_kill_time = u64::MAX;
            let mut first_blood_killer: Option<String> = None;

            if let Some(player_stats) = r.get("playerStats").and_then(|ps| ps.as_array()) {
                for ps in player_stats {
                    let sub = ps.get("subject").and_then(|s| s.as_str()).unwrap_or("");
                    if let Some(kills) = ps.get("kills").and_then(|k| k.as_array()) {
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
    if let Some(roster) = live_roster {
        for p in roster.ally_team.iter().chain(roster.enemy_team.iter()) {
            live_player_map.insert(p.puuid.clone(), p);
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

    if let Some(players) = m_json.get("players").and_then(|p| p.as_array()) {
        for p in players {
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
            let pl = plants.get(&puuid).copied().unwrap_or(0);
            let df = defuses.get(&puuid).copied().unwrap_or(0);

            // Inherit party tag, name, rank details from live roster hint if available
            let (final_name, final_tag, final_rank_tier, final_rank_name, final_rr, party_tag) = if let Some(live) = live_player_map.get(&puuid) {
                let name_clean = if !live.name.is_empty() {
                    let parts: Vec<&str> = live.name.split('#').collect();
                    (parts[0].to_string(), parts.get(1).unwrap_or(&"").to_string())
                } else {
                    (game_name.clone(), tag_line.clone())
                };
                let rank_t = if live.current_tier > 0 { live.current_tier } else { comp_tier };
                let rank_n = if !live.current_rank_name.is_empty() { live.current_rank_name.clone() } else { crate::tracker::get_rank_name(rank_t).to_string() };
                (name_clean.0, name_clean.1, rank_t, rank_n, live.current_rr, live.party_tag.clone())
            } else {
                let rank_t = comp_tier;
                let rank_n = crate::tracker::get_rank_name(rank_t).to_string();
                (game_name.clone(), tag_line.clone(), rank_t, rank_n, 0i64, String::new())
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

                // Look for RR change in live player recent matches
                if let Some(live) = live_player_map.get(&puuid) {
                    if let Some(m_detail) = live.recent_matches.iter().find(|rm| rm.match_id == match_id) {
                        my_rr_change = m_detail.rr_change;
                    }
                }
            }

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
                plants: pl,
                defuses: df,
                trades: 0,
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
    })
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

    // Days since unix epoch
    let total_secs = ts_ms / 1000;
    let _sec = total_secs % 60;
    let min = (total_secs / 60) % 60;
    let hour = (total_secs / 3600) % 24;
    let days = total_secs / 86400;

    // Approximate Gregorian calendar calculation
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
