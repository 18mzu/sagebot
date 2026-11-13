use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use crate::career::CareerMatch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerEncounter {
    pub puuid: String,
    pub name: String,
    pub tag: String,
    pub encounters_count: u32,
    pub matches_as_ally: u32,
    pub wins_as_ally: u32,
    pub losses_as_ally: u32,
    pub matches_as_enemy: u32,
    pub wins_against: u32,
    pub losses_against: u32,
    pub last_seen_timestamp: u64,
    pub last_seen_map: String,
    pub last_seen_agent: String,
    pub notes: String,
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

pub fn record_match(cm: &CareerMatch) {
    let mut map = load_encounters();
    let is_win = cm.result == "VICTORY";
    let is_loss = cm.result == "DEFEAT";

    for p in &cm.players {
        if p.is_self || p.puuid.is_empty() {
            continue;
        }
        let key = p.puuid.to_lowercase();
        let enc = map.entry(key.clone()).or_insert_with(|| PlayerEncounter {
            puuid: p.puuid.clone(),
            name: p.name.clone(),
            tag: p.tag.clone(),
            encounters_count: 0,
            matches_as_ally: 0,
            wins_as_ally: 0,
            losses_as_ally: 0,
            matches_as_enemy: 0,
            wins_against: 0,
            losses_against: 0,
            last_seen_timestamp: cm.timestamp,
            last_seen_map: cm.map_name.clone(),
            last_seen_agent: p.agent_name.clone(),
            notes: String::new(),
        });

        enc.encounters_count += 1;
        if !p.name.is_empty() && !p.name.starts_with("Player ") {
            enc.name = p.name.clone();
            enc.tag = p.tag.clone();
        }
        if cm.timestamp >= enc.last_seen_timestamp {
            enc.last_seen_timestamp = cm.timestamp;
            enc.last_seen_map = cm.map_name.clone();
            enc.last_seen_agent = p.agent_name.clone();
        }

        if p.team == "Ally" {
            enc.matches_as_ally += 1;
            if is_win { enc.wins_as_ally += 1; }
            else if is_loss { enc.losses_as_ally += 1; }
        } else {
            enc.matches_as_enemy += 1;
            if is_win { enc.wins_against += 1; }
            else if is_loss { enc.losses_against += 1; }
        }
    }

    let _ = save_encounters(&map);
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
            let enc = map.entry(key.clone()).or_insert_with(|| PlayerEncounter {
                puuid: p.puuid.clone(),
                name: p.name.clone(),
                tag: p.tag.clone(),
                encounters_count: 0,
                matches_as_ally: 0,
                wins_as_ally: 0,
                losses_as_ally: 0,
                matches_as_enemy: 0,
                wins_against: 0,
                losses_against: 0,
                last_seen_timestamp: cm.timestamp,
                last_seen_map: cm.map_name.clone(),
                last_seen_agent: p.agent_name.clone(),
                notes: String::new(),
            });

            enc.encounters_count += 1;
            if !p.name.is_empty() && !p.name.starts_with("Player ") {
                enc.name = p.name.clone();
                enc.tag = p.tag.clone();
            }
            if cm.timestamp >= enc.last_seen_timestamp {
                enc.last_seen_timestamp = cm.timestamp;
                enc.last_seen_map = cm.map_name.clone();
                enc.last_seen_agent = p.agent_name.clone();
            }

            if p.team == "Ally" {
                enc.matches_as_ally += 1;
                if is_win { enc.wins_as_ally += 1; }
                else if is_loss { enc.losses_as_ally += 1; }
            } else {
                enc.matches_as_enemy += 1;
                if is_win { enc.wins_against += 1; }
                else if is_loss { enc.losses_against += 1; }
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

