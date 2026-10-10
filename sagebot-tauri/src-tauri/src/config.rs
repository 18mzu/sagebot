use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub hotkey: String,
    pub auto_vote_mode: u32,          // 0 = Disabled, 1 = Vote YES (F5), 2 = Vote NO (F6)
    pub auto_overtime_vote_mode: u32, // 0 = Disabled, 1 = Vote DRAW (F5), 2 = Vote CONTINUE (F6)
    pub auto_ff_enabled: bool,
    pub auto_ff_round_5: bool,
    pub auto_ff_round_13: bool,
    pub auto_ff_round_14: bool,
    pub auto_ff_custom_rounds: Vec<u32>,
    pub anti_afk_mode: u32,           // 0 = Click Mode, 1 = Hold Mode
    pub anti_afk_key: String,         // Default "Tab" for Click Mode, "W" for Hold Mode
    pub anti_afk_slow_mode: bool,     // 3.7s - 4.2s vs 900ms - 1300ms
    pub chat_enabled: bool,
    pub chat_target: u32,             // 0 = Team Chat, 1 = All Chat (/all)
    pub chat_interval: u64,           // Default 180 seconds
    pub chat_text: String,            // Default "With great Power comes great Responsibility"
    pub webhook_enabled: bool,        // Default true
    pub webhook_url: String,
    pub webhook_user_id: String,
    pub agents_enabled: bool,         // Master toggle for Agents Selection
    pub instalock_enabled: bool,
    pub lock_delay: u64,              // 0 = Instant, or wait N seconds before locking
    pub starter_fallback_enabled: bool,
    pub selected_agents: Vec<String>,
    pub music_volume: u32,            // 0 - 100
    pub auto_focus_game: bool,
    pub always_on_top: bool,
    pub auto_derank_enabled: bool,
    pub auto_queue_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hotkey: "F9".to_string(),
            auto_vote_mode: 0,
            auto_overtime_vote_mode: 0,
            auto_ff_enabled: false,
            auto_ff_round_5: false,
            auto_ff_round_13: false,
            auto_ff_round_14: false,
            auto_ff_custom_rounds: Vec::new(),
            anti_afk_mode: 0,
            anti_afk_key: "Tab".to_string(),
            anti_afk_slow_mode: false,
            chat_enabled: false,
            chat_target: 0,
            chat_interval: 180,
            chat_text: "With great Power comes great Responsibility".to_string(),
            webhook_enabled: true,
            webhook_url: String::new(),
            webhook_user_id: String::new(),
            agents_enabled: true,
            instalock_enabled: false,
            lock_delay: 0,
            starter_fallback_enabled: false,
            selected_agents: Vec::new(),
            music_volume: 80,
            auto_focus_game: false,
            always_on_top: false,
            auto_derank_enabled: false,
            auto_queue_enabled: false,
        }
    }
}

pub fn key_name_to_vk(name: &str) -> u8 {
    let upper = name.to_uppercase();
    match upper.as_str() {
        "F1" => 0x70,
        "F2" => 0x71,
        "F3" => 0x72,
        "F4" => 0x73,
        "F5" => 0x74,
        "F6" => 0x75,
        "F7" => 0x76,
        "F8" => 0x77,
        "F9" => 0x78,
        "F10" => 0x79,
        "F11" => 0x7A,
        "F12" => 0x7B,
        "TAB" => 0x09,
        "SPACE" => 0x20,
        "ENTER" | "RETURN" => 0x0D,
        "ESC" | "ESCAPE" => 0x1B,
        s if s.len() == 1 => s.bytes().next().unwrap(),
        _ => 0x78, // default F9
    }
}

pub fn vk_to_key_name(vk: u8) -> String {
    match vk {
        0x70 => "F1".to_string(),
        0x71 => "F2".to_string(),
        0x72 => "F3".to_string(),
        0x73 => "F4".to_string(),
        0x74 => "F5".to_string(),
        0x75 => "F6".to_string(),
        0x76 => "F7".to_string(),
        0x77 => "F8".to_string(),
        0x78 => "F9".to_string(),
        0x79 => "F10".to_string(),
        0x7A => "F11".to_string(),
        0x7B => "F12".to_string(),
        0x09 => "Tab".to_string(),
        0x20 => "Space".to_string(),
        0x0D => "Enter".to_string(),
        0x1B => "Esc".to_string(),
        b if (b >= b'A' && b <= b'Z') || (b >= b'0' && b <= b'9') => {
            (b as char).to_string()
        }
        _ => format!("Key-{}", vk),
    }
}

impl AppConfig {
    pub fn config_path() -> PathBuf {
        let base = std::env::var("APPDATA")
            .unwrap_or_else(|_| ".".to_string());
        let dir = PathBuf::from(base).join("SageBot");
        let _ = std::fs::create_dir_all(&dir);
        dir.join("config.json")
    }

    pub fn ini_path() -> PathBuf {
        PathBuf::from("config.ini")
    }

    pub fn load() -> Self {
        let mut cfg = Self::default();

        // 1. Try reading config.ini (C code compatibility)
        let ini_p = Self::ini_path();
        if ini_p.exists() {
            if let Ok(content) = std::fs::read_to_string(&ini_p) {
                let mut current_section = String::new();
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with('[') && trimmed.ends_with(']') {
                        current_section = trimmed[1..trimmed.len() - 1].to_lowercase();
                        continue;
                    }
                    if let Some((k, v)) = trimmed.split_once('=') {
                        let key = k.trim().to_lowercase();
                        let val = v.trim();
                        match (current_section.as_str(), key.as_str()) {
                            ("settings", "playpause") => {
                                if let Ok(vk) = val.parse::<u8>() {
                                    cfg.hotkey = vk_to_key_name(vk);
                                }
                            }
                            ("settings", "autovote") => {
                                if let Ok(m) = val.parse::<u32>() {
                                    cfg.auto_vote_mode = m;
                                }
                            }
                            ("antiafk", "method") => {
                                if let Ok(m) = val.parse::<u32>() {
                                    cfg.anti_afk_mode = m;
                                }
                            }
                            ("antiafk", "key") => {
                                if let Ok(vk) = val.parse::<u8>() {
                                    cfg.anti_afk_key = vk_to_key_name(vk);
                                } else {
                                    cfg.anti_afk_key = val.to_string();
                                }
                            }
                            ("antiafk", "slowmode") => {
                                cfg.anti_afk_slow_mode = val == "1";
                            }
                            ("chat", "enabled") => {
                                cfg.chat_enabled = val == "1";
                            }
                            ("chat", "target") => {
                                if let Ok(t) = val.parse::<u32>() {
                                    cfg.chat_target = t;
                                }
                            }
                            ("chat", "interval") => {
                                if let Ok(sec) = val.parse::<u64>() {
                                    cfg.chat_interval = sec;
                                }
                            }
                            ("chat", "text") => {
                                if !val.is_empty() {
                                    cfg.chat_text = val.to_string();
                                }
                            }
                            ("webhook", "enabled") => {
                                cfg.webhook_enabled = val == "1";
                            }
                            ("webhook", "url") => {
                                cfg.webhook_url = val.to_string();
                            }
                            ("webhook", "userid") => {
                                cfg.webhook_user_id = val.to_string();
                            }
                            ("agents", "enabled") => {
                                cfg.agents_enabled = val == "1";
                            }
                            ("agents", "instalock") => {
                                cfg.instalock_enabled = val == "1";
                            }
                            ("agents", "lockdelay") => {
                                if let Ok(d) = val.parse::<u64>() {
                                    cfg.lock_delay = d;
                                }
                            }
                            ("agents", "starterfallback") => {
                                cfg.starter_fallback_enabled = val == "1";
                            }
                            ("agents", "selectedagents") => {
                                cfg.selected_agents = val.split(',')
                                    .map(|s| s.trim().to_string())
                                    .filter(|s| !s.is_empty())
                                    .collect();
                            }
                            _ => {}
                        }
                    }
                }
                return cfg;
            }
        }

        // 2. Fallback to reading config.json
        let path = Self::config_path();
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(json_cfg) = serde_json::from_str::<AppConfig>(&content) {
                return json_cfg;
            }
        }

        cfg
    }

    pub fn save(&self) -> Result<(), String> {
        // 1. Write config.json
        let path = Self::config_path();
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Serialization error: {}", e))?;
        let _ = std::fs::write(&path, json);

        // 2. Write config.ini in exact C structure
        let ini_p = Self::ini_path();
        let hotkey_vk = key_name_to_vk(&self.hotkey);
        let afk_vk = key_name_to_vk(&self.anti_afk_key);
        let agents_str = self.selected_agents.join(",");

        let ini_content = format!(
            "[Settings]\r\n\
            PlayPause={}\r\n\
            AutoVote={}\r\n\
            \r\n\
            [Chat]\r\n\
            Enabled={}\r\n\
            Target={}\r\n\
            Interval={}\r\n\
            Text={}\r\n\
            \r\n\
            [AntiAFK]\r\n\
            Method={}\r\n\
            Key={}\r\n\
            SlowMode={}\r\n\
            \r\n\
            [Webhook]\r\n\
            Url={}\r\n\
            UserId={}\r\n\
            Enabled={}\r\n\
            \r\n\
            [Agents]\r\n\
            Enabled={}\r\n\
            Instalock={}\r\n\
            LockDelay={}\r\n\
            StarterFallback={}\r\n\
            SelectedAgents={}\r\n",
            hotkey_vk,
            self.auto_vote_mode,
            if self.chat_enabled { 1 } else { 0 },
            self.chat_target,
            self.chat_interval,
            self.chat_text,
            self.anti_afk_mode,
            afk_vk,
            if self.anti_afk_slow_mode { 1 } else { 0 },
            self.webhook_url,
            self.webhook_user_id,
            if self.webhook_enabled { 1 } else { 0 },
            if self.agents_enabled { 1 } else { 0 },
            if self.instalock_enabled { 1 } else { 0 },
            self.lock_delay,
            if self.starter_fallback_enabled { 1 } else { 0 },
            agents_str
        );

        let _ = std::fs::write(&ini_p, ini_content);
        Ok(())
    }
}
