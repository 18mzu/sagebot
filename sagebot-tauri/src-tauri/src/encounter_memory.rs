use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use crate::career::CareerMatch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncounterMatchHistory {
    pub match_id: String,
    pub timestamp: u64,
    pub date_str: String,
    pub time_str: String,
    pub map_name: String,
    pub gamemode: String,
    pub relationship: String, // "PLAYED WITH" (Ally) or "PLAYED AGAINST" (Enemy)
    pub result: String,       // "VICTORY", "DEFEAT", "DRAW"
    pub score_ally: i32,
    pub score_enemy: i32,
    pub agent_id: String,
    pub agent_name: String,
    pub rank_tier: u32,
    pub rank_name: String,
    pub rr: i64,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub score: i32,
    pub is_win: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerEncounter {
    pub puuid: String,
    pub name: String,
    pub tag: String,
    pub is_hidden: bool,
    pub encounters_count: u32,
    pub matches_as_ally: u32,
    pub wins_as_ally: u32,
    pub losses_as_ally: u32,
    pub matches_as_enemy: u32,
    pub wins_against: u32,
    pub losses_against: u32,
    pub last_seen_timestamp: u64,
    pub last_seen_date_str: String,
    pub last_seen_time_str: String,
    pub last_seen_map: String,
    pub last_seen_agent_id: String,
    pub last_seen_agent_name: String,
    pub last_rank_tier: u32,
    pub last_rank_name: String,
    pub last_rr: i64,
    pub last_score_ally: i32,
    pub last_score_enemy: i32,
    pub last_result: String,
    pub last_relationship: String,
    #[serde(default)]
    pub history: Vec<EncounterMatchHistory>,
}

fn encounters_file_path() -> PathBuf {
    crate::config::AppConfig::data_dir().join("encounters.json")
}

pub fn load_encounters() -> HashMap<String, PlayerEncounter> {
    let path = encounters_file_path();
    if !path.exists() {
        return HashMap::new();
    }
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(map) = serde_json::from_str::<HashMap<String, PlayerEncounter>>(&content) {
            return map;
        }
    }
    HashMap::new()
}

pub fn save_encounters(map: &HashMap<String, PlayerEncounter>) -> Result<(), String> {
    let path = encounters_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(map)
        .map_err(|e| format!("Failed to serialize encounters: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write encounters.json: {}", e))?;
    Ok(())
}

pub fn record_match(_cm: &CareerMatch) {
    // Rebuilding from career matches guarantees zero duplicate increments and perfect integrity
    rebuild_from_career();
}

pub fn rebuild_from_career() {
    let matches = crate::career::load_career_matches();
    let mut map: HashMap<String, PlayerEncounter> = HashMap::new();
    let mut sorted = matches;
    sorted.sort_by_key(|m| m.timestamp);

    for cm in &sorted {
        let is_win = cm.result == "VICTORY";
        let is_loss = cm.result == "DEFEAT";

        for p in &cm.players {
            if p.is_self || p.puuid.is_empty() {
                continue;
            }
            let key = p.puuid.to_lowercase();
            let is_name_hidden = p.name.is_empty()
                || p.name.starts_with("Player ")
                || p.name.starts_with("Player#")
                || p.name == "Player";

            let rel = if p.team == "Ally" {
                "PLAYED WITH".to_string()
            } else {
                "PLAYED AGAINST".to_string()
            };

            let hist_entry = EncounterMatchHistory {
                match_id: cm.match_id.clone(),
                timestamp: cm.timestamp,
                date_str: cm.date_str.clone(),
                time_str: cm.time_str.clone(),
                map_name: cm.map_name.clone(),
                gamemode: cm.gamemode.clone(),
                relationship: rel.clone(),
                result: cm.result.clone(),
                score_ally: cm.score_ally,
                score_enemy: cm.score_enemy,
                agent_id: p.agent_id.clone(),
                agent_name: p.agent_name.clone(),
                rank_tier: p.rank_tier,
                rank_name: p.rank_name.clone(),
                rr: p.rr,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                score: p.score,
                is_win,
            };

            let enc = map.entry(key.clone()).or_insert_with(|| PlayerEncounter {
                puuid: p.puuid.clone(),
                name: p.name.clone(),
                tag: p.tag.clone(),
                is_hidden: is_name_hidden,
                encounters_count: 0,
                matches_as_ally: 0,
                wins_as_ally: 0,
                losses_as_ally: 0,
                matches_as_enemy: 0,
                wins_against: 0,
                losses_against: 0,
                last_seen_timestamp: cm.timestamp,
                last_seen_date_str: cm.date_str.clone(),
                last_seen_time_str: cm.time_str.clone(),
                last_seen_map: cm.map_name.clone(),
                last_seen_agent_id: p.agent_id.clone(),
                last_seen_agent_name: p.agent_name.clone(),
                last_rank_tier: p.rank_tier,
                last_rank_name: p.rank_name.clone(),
                last_rr: p.rr,
                last_score_ally: cm.score_ally,
                last_score_enemy: cm.score_enemy,
                last_result: cm.result.clone(),
                last_relationship: rel.clone(),
                history: Vec::new(),
            });

            enc.encounters_count += 1;
            if !is_name_hidden {
                enc.name = p.name.clone();
                enc.tag = p.tag.clone();
                enc.is_hidden = false;
            }
            if cm.timestamp >= enc.last_seen_timestamp {
                enc.last_seen_timestamp = cm.timestamp;
                enc.last_seen_date_str = cm.date_str.clone();
                enc.last_seen_time_str = cm.time_str.clone();
                enc.last_seen_map = cm.map_name.clone();
                enc.last_seen_agent_id = p.agent_id.clone();
                enc.last_seen_agent_name = p.agent_name.clone();
                enc.last_rank_tier = p.rank_tier;
                enc.last_rank_name = p.rank_name.clone();
                enc.last_rr = p.rr;
                enc.last_score_ally = cm.score_ally;
                enc.last_score_enemy = cm.score_enemy;
                enc.last_result = cm.result.clone();
                enc.last_relationship = rel.clone();
            }

            if p.team == "Ally" {
                enc.matches_as_ally += 1;
                if is_win {
                    enc.wins_as_ally += 1;
                } else if is_loss {
                    enc.losses_as_ally += 1;
                }
            } else {
                enc.matches_as_enemy += 1;
                if is_win {
                    enc.wins_against += 1;
                } else if is_loss {
                    enc.losses_against += 1;
                }
            }

            // Append to history without duplicate match IDs
            if !enc.history.iter().any(|h| h.match_id == cm.match_id) {
                enc.history.insert(0, hist_entry);
            }
        }
    }

    let _ = save_encounters(&map);
}

pub fn get_encounter(puuid: &str) -> Option<PlayerEncounter> {
    if puuid.is_empty() {
        return None;
    }
    let map = load_encounters();
    map.get(&puuid.to_lowercase()).cloned()
}

pub fn get_all_visible_encounters() -> Vec<PlayerEncounter> {
    let map = load_encounters();
    let mut list: Vec<_> = map.into_values().filter(|e| !e.is_hidden).collect();
    list.sort_by(|a, b| b.last_seen_timestamp.cmp(&a.last_seen_timestamp));
    list
}

pub fn delete_encounter(puuid: &str) -> Result<Vec<PlayerEncounter>, String> {
    let mut map = load_encounters();
    map.remove(&puuid.to_lowercase());
    save_encounters(&map)?;
    Ok(get_all_visible_encounters())
}
