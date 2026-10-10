use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockfileData {
    pub process: String,
    pub pid: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

impl LockfileData {
    pub fn read_from_disk() -> Result<Self, String> {
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Failed to find LOCALAPPDATA environment variable".to_string())?;

        let path = PathBuf::from(local_app_data)
            .join("Riot Games")
            .join("Riot Client")
            .join("Config")
            .join("lockfile");

        if !path.exists() {
            return Err("Valorant / Riot Client is not running (lockfile not found)".to_string());
        }

        #[cfg(target_os = "windows")]
        use std::os::windows::fs::OpenOptionsExt;
        use std::io::Read;

        let mut file = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(7) // FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
            .open(&path)
            .map_err(|e| format!("Failed to read lockfile: {}", e))?;
        let mut content = String::new();
        file.read_to_string(&mut content)
            .map_err(|e| format!("Failed to read lockfile: {}", e))?;

        let parts: Vec<&str> = content.trim().split(':').collect();
        if parts.len() < 5 {
            return Err("Invalid lockfile format".to_string());
        }

        let port = parts[2].parse::<u16>()
            .map_err(|_| "Invalid port in lockfile".to_string())?;
        let pid = parts[1].parse::<u32>()
            .unwrap_or(0);

        Ok(LockfileData {
            process: parts[0].to_string(),
            pid,
            port,
            password: parts[3].to_string(),
            protocol: parts[4].to_string(),
        })
    }
}

#[repr(C)]
struct PROCESSENTRY32W {
    dw_size: u32,
    cnt_usage: u32,
    th32_process_id: u32,
    th32_default_heap_id: usize,
    th32_module_id: u32,
    cnt_threads: u32,
    th32_parent_process_id: u32,
    pc_pri_class_base: i32,
    dw_flags: u32,
    sz_exe_file: [u16; 260],
}

pub fn is_valorant_process_running() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut std::ffi::c_void;
            fn Process32FirstW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
            fn Process32NextW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
            fn CloseHandle(h_object: *mut std::ffi::c_void) -> i32;
        }

        let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if snapshot != (-1isize as *mut std::ffi::c_void) && !snapshot.is_null() {
            let mut entry = PROCESSENTRY32W {
                dw_size: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                cnt_usage: 0,
                th32_process_id: 0,
                th32_default_heap_id: 0,
                th32_module_id: 0,
                cnt_threads: 0,
                th32_parent_process_id: 0,
                pc_pri_class_base: 0,
                dw_flags: 0,
                sz_exe_file: [0u16; 260],
            };

            let mut running = false;
            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    let len = entry
                        .sz_exe_file
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.sz_exe_file.len());
                    let name = String::from_utf16_lossy(&entry.sz_exe_file[..len]).to_lowercase();
                    if name == "valorant.exe" || name == "valorant-win64-shipping.exe" {
                        running = true;
                        break;
                    }
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
            return running;
        }
    }
    false
}

#[derive(Clone)]
pub struct ValorantClient {
    client: reqwest::Client,
    pub lockfile: LockfileData,
    base_url: String,
}

impl ValorantClient {
    pub fn new(lockfile: LockfileData) -> Result<Self, String> {
        let auth_str = format!("riot:{}", lockfile.password);
        use base64::Engine;
        let encoded_auth = base64::engine::general_purpose::STANDARD.encode(auth_str);

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Basic {}", encoded_auth))
                .map_err(|e| e.to_string())?,
        );

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .default_headers(headers)
            .build()
            .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

        let base_url = format!("https://127.0.0.1:{}", lockfile.port);

        Ok(ValorantClient {
            client,
            lockfile,
            base_url,
        })
    }

    pub async fn get_entitlements(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/entitlements/v1/token", self.base_url);
        let resp = self.client.get(&url).send().await
            .map_err(|e| e.to_string())?;
        resp.json::<serde_json::Value>().await
            .map_err(|e| e.to_string())
    }

    pub async fn get_session(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/chat/v1/session", self.base_url);
        let resp = self.client.get(&url).send().await
            .map_err(|e| e.to_string())?;
        resp.json::<serde_json::Value>().await
            .map_err(|e| e.to_string())
    }

    pub async fn get_presences(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/chat/v4/presences", self.base_url);
        let resp = self.client.get(&url).send().await
            .map_err(|e| e.to_string())?;
        resp.json::<serde_json::Value>().await
            .map_err(|e| e.to_string())
    }

    pub async fn get_riot_tokens(&self) -> Result<(String, String), String> {
        let json = self.get_entitlements().await?;
        let access_token = json.get("accessToken")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing accessToken in entitlements response".to_string())?
            .to_string();
        let token = json.get("token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing token in entitlements response".to_string())?
            .to_string();
        Ok((access_token, token))
    }

    pub async fn get_pregame_player_glz(
        &self,
        puuid: &str,
        access_token: &str,
        jwt: &str,
        glz_host: &str,
        client_version: &str,
    ) -> Result<serde_json::Value, String> {
        let url = format!("https://{}/pregame/v1/players/{}", glz_host, puuid);
        let resp = self.client.get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", client_version)
            .send().await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("Pregame player request returned HTTP {}", resp.status()));
        }

        resp.json::<serde_json::Value>().await
            .map_err(|e| e.to_string())
    }

    pub async fn select_agent_glz(
        &self,
        match_id: &str,
        agent_id: &str,
        access_token: &str,
        jwt: &str,
        glz_host: &str,
        client_version: &str,
    ) -> Result<bool, String> {
        let url = format!("https://{}/pregame/v1/matches/{}/select/{}", glz_host, match_id, agent_id);
        let resp = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", client_version)
            .send().await
            .map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }

    pub async fn lock_agent_glz(
        &self,
        match_id: &str,
        agent_id: &str,
        access_token: &str,
        jwt: &str,
        glz_host: &str,
        client_version: &str,
    ) -> Result<bool, String> {
        let url = format!("https://{}/pregame/v1/matches/{}/lock/{}", glz_host, match_id, agent_id);
        let resp = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", client_version)
            .send().await
            .map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }

    pub async fn get_pregame_player(&self, puuid: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}/pregame/v1/players/{}", self.base_url, puuid);
        let resp = self.client.get(&url).send().await
            .map_err(|e| e.to_string())?;
        resp.json::<serde_json::Value>().await
            .map_err(|e| e.to_string())
    }

    pub async fn get_pregame_match(&self, match_id: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}/pregame/v1/matches/{}", self.base_url, match_id);
        let resp = self.client.get(&url).send().await
            .map_err(|e| e.to_string())?;
        resp.json::<serde_json::Value>().await
            .map_err(|e| e.to_string())
    }

    pub async fn select_agent(&self, match_id: &str, agent_id: &str) -> Result<bool, String> {
        let url = format!("{}/pregame/v1/matches/{}/select/{}", self.base_url, match_id, agent_id);
        let resp = self.client.post(&url).send().await
            .map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }

    pub async fn lock_agent(&self, match_id: &str, agent_id: &str) -> Result<bool, String> {
        let url = format!("{}/pregame/v1/matches/{}/lock/{}", self.base_url, match_id, agent_id);
        let resp = self.client.post(&url).send().await
            .map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }

    pub async fn get_owned_agents(&self, puuid: &str) -> Result<Vec<String>, String> {
        let agent_type_id = "01d6951d-f167-4da0-8b57-6ded65f95ec4";
        let url = format!("{}/store/v1/entitlements/{}/{}", self.base_url, puuid, agent_type_id);
        let resp = self.client.get(&url).send().await
            .map_err(|e| e.to_string())?;
        let json: serde_json::Value = resp.json().await
            .map_err(|e| e.to_string())?;

        let mut owned = Vec::new();
        // Starter 5 agents are always owned
        owned.push("41fb69c1-4139-7737-7b81-845e5d63b480".to_string()); // Phoenix
        owned.push("add6443a-41bd-e414-f6ad-e58d267f4e95".to_string()); // Jett
        owned.push("ded3520f-4264-bfed-162d-b080e2abccf9".to_string()); // Sova
        owned.push("569fdd95-4d10-43ab-ca70-79becc718b46".to_string()); // Sage
        owned.push("9f0d8ba9-42c0-8739-6932-a1630e6072e5".to_string()); // Brimstone

        if let Some(items) = json.get("Entitlements").and_then(|e| e.as_array()) {
            for item in items {
                if let Some(item_id) = item.get("ItemID").and_then(|i| i.as_str()) {
                    let id_str = item_id.to_lowercase();
                    if !owned.contains(&id_str) {
                        owned.push(id_str);
                    }
                }
            }
        }
        Ok(owned)
    }

    pub async fn start_competitive_queue(&self) -> Result<bool, String> {
        let (access_token, jwt) = self.get_riot_tokens().await?;
        let ent = self.get_entitlements().await.ok();
        let puuid = if let Some(sub) = ent.as_ref().and_then(|e| e.get("subject")).and_then(|v| v.as_str()) {
            sub.to_string()
        } else {
            let session = self.get_session().await?;
            session.get("puuid").and_then(|v| v.as_str()).ok_or_else(|| "Missing puuid in session".to_string())?.to_string()
        };
        let glz_host = discover_glz_host();
        let client_version = discover_client_version();

        // 1. Get party ID
        let party_player_url = format!("https://{}/parties/v1/players/{}", glz_host, puuid);
        let party_res = self.client.get(&party_player_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .send().await.map_err(|e| format!("Party player request failed: {}", e))?;

        if !party_res.status().is_success() {
            return Err(format!("Party lookup returned HTTP {}", party_res.status()));
        }
        let party_json: serde_json::Value = party_res.json().await.map_err(|e| e.to_string())?;
        let party_id = party_json.get("CurrentPartyID").and_then(|v| v.as_str()).ok_or_else(|| "Missing CurrentPartyID".to_string())?;

        // 2. Set queue to competitive
        let queue_url = format!("https://{}/parties/v1/parties/{}/queue", glz_host, party_id);
        let queue_body = serde_json::json!({ "queueID": "competitive" });
        let _ = self.client.post(&queue_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .json(&queue_body)
            .send().await;

        // 3. Enter matchmaking (/matchmaking/join)
        let join_url = format!("https://{}/parties/v1/parties/{}/matchmaking/join", glz_host, party_id);
        let join_res = self.client.post(&join_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .send().await.map_err(|e| format!("Matchmaking join request failed: {}", e))?;

        let status = join_res.status();
        if status.is_success() || status.as_u16() == 409 {
            return Ok(true);
        }

        Err(format!("Matchmaking join returned HTTP {}", status))
    }

    pub async fn send_chat_message(&self, cid: &str, message: &str) -> Result<bool, String> {
        let url = format!("{}/chat/v6/messages", self.base_url);
        let payload = serde_json::json!({
            "cid": cid,
            "message": message,
            "type": "groupchat"
        });
        let resp = self.client.post(&url).json(&payload).send().await
            .map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }
}

pub fn discover_glz_host() -> String {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let path = std::path::PathBuf::from(local_app_data)
            .join("VALORANT")
            .join("Saved")
            .join("Logs")
            .join("ShooterGame.log");
        #[cfg(target_os = "windows")]
        use std::os::windows::fs::OpenOptionsExt;
        let file_res = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(7)
            .open(&path);

        if let Ok(mut file) = file_res {
            use std::io::Read;
            let mut text = String::new();
            if let Ok(_) = file.read_to_string(&mut text) {
                if let Some(pos) = text.rfind("https://glz-") {
                    let sub = &text[pos + 8..];
                    if let Some(end) = sub.find(".a.pvp.net") {
                        return sub[..end + 10].to_string();
                    }
                }
            }
        }
    }
    "glz-ap-1.ap.a.pvp.net".to_string()
}

pub fn discover_client_version() -> String {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let path = std::path::PathBuf::from(local_app_data)
            .join("VALORANT")
            .join("Saved")
            .join("Logs")
            .join("ShooterGame.log");
        #[cfg(target_os = "windows")]
        use std::os::windows::fs::OpenOptionsExt;
        let file_res = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(7)
            .open(&path);

        if let Ok(mut file) = file_res {
            use std::io::Read;
            let mut text = String::new();
            if let Ok(_) = file.read_to_string(&mut text) {
                if let Some(pos) = text.rfind("release-") {
                    let sub = &text[pos..];
                    let end = sub.find(|c: char| c.is_whitespace() || c == '\"' || c == '\'').unwrap_or(sub.len());
                    let ver = &sub[..end];
                    if ver.contains("shipping") {
                        return ver.to_string();
                    }
                }
            }
        }
    }
    "release-13.06-shipping-18-5590001".to_string()
}

pub fn resolve_agent_from_log() -> String {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let path = std::path::PathBuf::from(local_app_data)
            .join("VALORANT")
            .join("Saved")
            .join("Logs")
            .join("ShooterGame.log");
        #[cfg(target_os = "windows")]
        use std::os::windows::fs::OpenOptionsExt;
        let file_res = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(7) // FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
            .open(&path);

        if let Ok(mut file) = file_res {
            use std::io::{Read, Seek, SeekFrom};
            if let Ok(meta) = file.metadata() {
                let len = meta.len();
                let read_bytes = if len > 65536 { 65536 } else { len };
                let _ = file.seek(SeekFrom::End(-(read_bytes as i64)));
                let mut buf = vec![0u8; read_bytes as usize];
                if let Ok(_) = file.read_exact(&mut buf) {
                    let text = String::from_utf8_lossy(&buf);
                    let target = "AcknowledgePossession('";
                    if let Some(pos) = text.rfind(target) {
                        let sub = &text[pos + target.len()..];
                        if let Some(quote_end) = sub.find('\'') {
                            let pawn = &sub[..quote_end];
                            if pawn.contains("Sarge") || pawn.contains("Brimstone") { return "Brimstone".to_string(); }
                            if pawn.contains("Rift") || pawn.contains("Astra") { return "Astra".to_string(); }
                            if pawn.contains("Hunter") || pawn.contains("Sova") { return "Sova".to_string(); }
                            if pawn.contains("Thorne") || pawn.contains("Sage") { return "Sage".to_string(); }
                            if pawn.contains("Wushu") || pawn.contains("Jett") { return "Jett".to_string(); }
                            if pawn.contains("Vampire") || pawn.contains("Reyna") { return "Reyna".to_string(); }
                            if pawn.contains("Clay") || pawn.contains("Raze") { return "Raze".to_string(); }
                            if pawn.contains("Wraith") || pawn.contains("Omen") { return "Omen".to_string(); }
                            if pawn.contains("Smonk") || pawn.contains("Clove") { return "Clove".to_string(); }
                            if pawn.contains("Nox") || pawn.contains("Vyse") { return "Vyse".to_string(); }
                            if pawn.contains("Stealth") || pawn.contains("Yoru") { return "Yoru".to_string(); }
                            if pawn.contains("Cashew") || pawn.contains("Tejo") { return "Tejo".to_string(); }
                            if pawn.contains("Sequoia") || pawn.contains("Iso") { return "Iso".to_string(); }
                            if pawn.contains("BountyHunter") || pawn.contains("Fade") { return "Fade".to_string(); }
                            if pawn.contains("Gumshoe") || pawn.contains("Cypher") { return "Cypher".to_string(); }
                            if pawn.contains("Mage") || pawn.contains("Harbor") { return "Harbor".to_string(); }
                            if pawn.contains("Sprinter") || pawn.contains("Neon") { return "Neon".to_string(); }
                            if pawn.contains("Deadeye") || pawn.contains("Chamber") { return "Chamber".to_string(); }
                            if pawn.contains("AggroBot") || pawn.contains("Gekko") { return "Gekko".to_string(); }
                            if pawn.contains("Cable") || pawn.contains("Deadlock") { return "Deadlock".to_string(); }
                            if pawn.contains("Pandemic") || pawn.contains("Viper") { return "Viper".to_string(); }
                            if pawn.contains("Phoenix") { return "Phoenix".to_string(); }
                            if pawn.contains("Breach") { return "Breach".to_string(); }
                            if pawn.contains("Killjoy") { return "Killjoy".to_string(); }
                            if pawn.contains("Guide") || pawn.contains("Skye") { return "Skye".to_string(); }
                            if pawn.contains("Grenadier") || pawn.contains("KAY/O") || pawn.contains("Kayo") { return "KAY/O".to_string(); }
                            if pawn.contains("Iris") { return "Miks".to_string(); }
                            if pawn.contains("Pine") || pawn.contains("Veto") { return "Veto".to_string(); }
                            if pawn.contains("Terra") || pawn.contains("Waylay") { return "Waylay".to_string(); }
                        }
                    }
                }
            }
        }
    }
    "-".to_string()
}

// Presence Information Resolution
#[derive(Debug, Clone, Default, Serialize)]
pub struct PresenceDetails {
    pub player_name: Option<String>,
    pub player_tag: Option<String>,
    pub map_name: String,
    pub gamemode: String,
    pub match_state: String,
    pub score_ally: i32,
    pub score_enemy: i32,
    pub rank_name: String,
    pub agent_name: String,
}

pub fn decode_presence_data(presences: &serde_json::Value, target_puuid: &str) -> PresenceDetails {
    let mut details = PresenceDetails {
        player_name: None,
        player_tag: None,
        map_name: "-".to_string(),
        gamemode: "-".to_string(),
        match_state: "LOBBY".to_string(),
        score_ally: 0,
        score_enemy: 0,
        rank_name: "Unranked".to_string(),
        agent_name: resolve_agent_from_log(),
    };

    if let Some(arr) = presences.get("presences").and_then(|p| p.as_array()) {
        for p in arr {
            let is_valorant = p.get("product").and_then(|v| v.as_str()) == Some("valorant")
                || p.get("product_id").and_then(|v| v.as_str()) == Some("valorant");
            let puuid = p.get("puuid").and_then(|v| v.as_str()).unwrap_or("");
            let is_me = !target_puuid.is_empty() && puuid == target_puuid;

            if is_valorant && (is_me || target_puuid.is_empty()) {
                if let Some(name) = p.get("game_name").and_then(|v| v.as_str()) {
                    if !name.is_empty() {
                        details.player_name = Some(name.to_string());
                    }
                }
                if let Some(tag) = p.get("game_tag").and_then(|v| v.as_str()) {
                    if !tag.is_empty() {
                        details.player_tag = Some(tag.to_string());
                    }
                }

                if let Some(private_b64) = p.get("private").and_then(|v| v.as_str()) {
                    use base64::Engine;
                    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(private_b64) {
                        if let Ok(priv_json) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                            // Match Score
                            if let Some(ally) = priv_json.get("partyOwnerMatchScoreAllyTeam")
                                .or_else(|| priv_json.get("partyOwnerMatchScoreAlly"))
                                .and_then(|v| v.as_i64()) {
                                details.score_ally = ally as i32;
                            }
                            if let Some(enemy) = priv_json.get("partyOwnerMatchScoreEnemyTeam")
                                .or_else(|| priv_json.get("partyOwnerMatchScoreEnemy"))
                                .and_then(|v| v.as_i64()) {
                                details.score_enemy = enemy as i32;
                            }

                            // Map Name
                            let raw_map = priv_json.get("matchPresenceData")
                                .and_then(|m| m.get("matchMap"))
                                .or_else(|| priv_json.get("matchMap"))
                                .or_else(|| priv_json.get("partyOwnerMatchMap"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            if !raw_map.is_empty() {
                                details.map_name = resolve_map_name(raw_map);
                            }

                            // Gamemode
                            let queue = priv_json.get("matchPresenceData")
                                .and_then(|m| m.get("queueId"))
                                .or_else(|| priv_json.get("queueId"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            let raw_gamemode = priv_json.get("matchPresenceData")
                                .and_then(|m| m.get("gameMode"))
                                .or_else(|| priv_json.get("gameMode"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            let prov_flow = priv_json.get("matchPresenceData")
                                .and_then(|m| m.get("provisioningFlow"))
                                .or_else(|| priv_json.get("provisioningFlow"))
                                .or_else(|| priv_json.get("partyOwnerProvisioningFlow"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            let party_state = priv_json.get("partyState")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            let is_custom = prov_flow.eq_ignore_ascii_case("CustomGame")
                                || queue.eq_ignore_ascii_case("custom")
                                || party_state.to_uppercase().contains("CUSTOM")
                                || priv_json.get("customGameName").is_some()
                                || priv_json.get("hasCustomGameData").and_then(|v| v.as_bool()).unwrap_or(false);

                            details.gamemode = resolve_gamemode(queue, raw_gamemode, is_custom);

                            // State
                            let loop_state = priv_json.get("matchPresenceData")
                                .and_then(|m| m.get("sessionLoopState"))
                                .or_else(|| priv_json.get("sessionLoopState"))
                                .or_else(|| priv_json.get("partyOwnerSessionLoopState"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            details.match_state = match loop_state {
                                "PREGAME" => "Agent Select".to_string(),
                                "INGAME" => "In Game".to_string(),
                                _ => "In Lobby".to_string(),
                            };

                            // Rank
                            let tier = priv_json.get("playerPresenceData")
                                .and_then(|ppd| ppd.get("competitiveTier"))
                                .or_else(|| priv_json.get("competitiveTier"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            details.rank_name = resolve_tier_name(tier as i32);
                        }
                    }
                }

                if is_me {
                    break;
                }
            }
        }
    }

    details
}

fn resolve_map_name(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("ascent") { "Ascent".to_string() }
    else if lower.contains("lotus") || lower.contains("jam") { "Lotus".to_string() }
    else if lower.contains("sunset") || lower.contains("jules") || lower.contains("juliett") { "Sunset".to_string() }
    else if lower.contains("haven") || lower.contains("triad") { "Haven".to_string() }
    else if lower.contains("bind") || lower.contains("duality") { "Bind".to_string() }
    else if lower.contains("split") || lower.contains("bonsai") { "Split".to_string() }
    else if lower.contains("breeze") || lower.contains("foxtrot") { "Breeze".to_string() }
    else if lower.contains("icebox") || lower.contains("port") { "Icebox".to_string() }
    else if lower.contains("abyss") || lower.contains("infinity") { "Abyss".to_string() }
    else if lower.contains("pearl") || lower.contains("pitt") { "Pearl".to_string() }
    else if lower.contains("fracture") || lower.contains("canyon") { "Fracture".to_string() }
    else if lower.contains("corrode") || lower.contains("rook") { "Corrode".to_string() }
    else if lower.contains("summit") || lower.contains("plummet") { "Summit".to_string() }
    else if lower.contains("range") || lower.contains("poveglia") { "The Range".to_string() }
    // Team Deathmatch (HURM) Maps
    else if lower.contains("district") || lower.contains("hurm_alley") || lower.contains("alley") { "District".to_string() }
    else if lower.contains("kasbah") || lower.contains("hurm_bowl") || lower.contains("bowl") { "Kasbah".to_string() }
    else if lower.contains("drift") || lower.contains("hurm_helix") || lower.contains("helix") { "Drift".to_string() }
    else if lower.contains("glitch") || lower.contains("hurm_hightide") || lower.contains("hightide") { "Glitch".to_string() }
    else if lower.contains("piazza") || lower.contains("hurm_yard") || lower.contains("yard") { "Piazza".to_string() }
    else if lower.contains("abilitydraft") { "Gauntlet".to_string() }
    else if !raw.is_empty() { raw.to_string() }
    else { "-".to_string() }
}

fn resolve_gamemode(queue: &str, raw_mode: &str, is_custom: bool) -> String {
    let q_lower = queue.to_lowercase();
    let m_lower = raw_mode.to_lowercase();

    let sub = if m_lower.contains("bomb") && !m_lower.contains("quickbomb") {
        if q_lower == "competitive" {
            "Competitive"
        } else {
            "Unrated"
        }
    } else if m_lower.contains("quickbomb") || q_lower == "spikerush" {
        "Spike Rush"
    } else if m_lower.contains("swiftplay") || q_lower == "swiftplay" {
        "Swiftplay"
    } else if m_lower.contains("hurm") || q_lower == "hurm" {
        "Team Deathmatch"
    } else if m_lower.contains("deathmatch") || q_lower == "deathmatch" {
        "Deathmatch"
    } else if m_lower.contains("onefa") || q_lower == "onefa" {
        "Replication"
    } else if m_lower.contains("ggteam") || q_lower == "ggteam" {
        "Escalation"
    } else if m_lower.contains("snowball") || q_lower == "snowball" {
        "Snowball Fight"
    } else if q_lower == "competitive" {
        "Competitive"
    } else if q_lower == "unrated" {
        "Unrated"
    } else {
        "Unrated"
    };

    if is_custom {
        format!("Custom: {}", sub)
    } else if !queue.is_empty() {
        match q_lower.as_str() {
            "competitive" => "Competitive".to_string(),
            "unrated" => "Unrated".to_string(),
            "swiftplay" => "Swiftplay".to_string(),
            "spikerush" => "Spike Rush".to_string(),
            "deathmatch" => "Deathmatch".to_string(),
            "hurm" => "Team Deathmatch".to_string(),
            "ggteam" => "Escalation".to_string(),
            "onefa" => "Replication".to_string(),
            "newmap" => "New Map Queue".to_string(),
            _ => queue.to_string(),
        }
    } else if !raw_mode.is_empty() {
        sub.to_string()
    } else {
        "-".to_string()
    }
}

pub fn terminate_valorant_processes() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut std::ffi::c_void;
            fn Process32FirstW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
            fn Process32NextW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
            fn CloseHandle(h_object: *mut std::ffi::c_void) -> i32;
            fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut std::ffi::c_void;
            fn TerminateProcess(h_process: *mut std::ffi::c_void, u_exit_code: u32) -> i32;
        }

        const PROCESS_TERMINATE: u32 = 0x0001;

        let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if snapshot != (-1isize as *mut std::ffi::c_void) && !snapshot.is_null() {
            let mut entry = PROCESSENTRY32W {
                dw_size: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                cnt_usage: 0,
                th32_process_id: 0,
                th32_default_heap_id: 0,
                th32_module_id: 0,
                cnt_threads: 0,
                th32_parent_process_id: 0,
                pc_pri_class_base: 0,
                dw_flags: 0,
                sz_exe_file: [0u16; 260],
            };

            let mut terminated_any = false;
            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    let len = entry
                        .sz_exe_file
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.sz_exe_file.len());
                    let name = String::from_utf16_lossy(&entry.sz_exe_file[..len]).to_lowercase();
                    if name == "valorant.exe" || name == "valorant-win64-shipping.exe" {
                        let h_proc = OpenProcess(PROCESS_TERMINATE, 0, entry.th32_process_id);
                        if !h_proc.is_null() {
                            TerminateProcess(h_proc, 1);
                            CloseHandle(h_proc);
                            terminated_any = true;
                        }
                    }
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
            return Ok(terminated_any);
        }
    }
    Ok(false)
}

fn resolve_tier_name(tier: i32) -> String {
    match tier {
        3 => "Iron 1".to_string(),
        4 => "Iron 2".to_string(),
        5 => "Iron 3".to_string(),
        6 => "Bronze 1".to_string(),
        7 => "Bronze 2".to_string(),
        8 => "Bronze 3".to_string(),
        9 => "Silver 1".to_string(),
        10 => "Silver 2".to_string(),
        11 => "Silver 3".to_string(),
        12 => "Gold 1".to_string(),
        13 => "Gold 2".to_string(),
        14 => "Gold 3".to_string(),
        15 => "Platinum 1".to_string(),
        16 => "Platinum 2".to_string(),
        17 => "Platinum 3".to_string(),
        18 => "Diamond 1".to_string(),
        19 => "Diamond 2".to_string(),
        20 => "Diamond 3".to_string(),
        21 => "Ascendant 1".to_string(),
        22 => "Ascendant 2".to_string(),
        23 => "Ascendant 3".to_string(),
        24 => "Immortal 1".to_string(),
        25 => "Immortal 2".to_string(),
        26 => "Immortal 3".to_string(),
        27 => "Radiant".to_string(),
        _ => "Unranked".to_string(),
    }
}

// Win32 Input Simulation for Anti-AFK, Auto-Vote, Auto-Chat & Hotkey Listener
#[cfg(target_os = "windows")]
extern "system" {
    fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
    fn mouse_event(dwFlags: u32, dx: u32, dy: u32, dwData: u32, dwExtraInfo: usize);
    fn OpenClipboard(hWndNewOwner: *mut std::ffi::c_void) -> i32;
    fn CloseClipboard() -> i32;
    fn EmptyClipboard() -> i32;
    fn SetClipboardData(uFormat: u32, hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GlobalAlloc(uFlags: u32, dwBytes: usize) -> *mut std::ffi::c_void;
    fn GlobalLock(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GlobalUnlock(hMem: *mut std::ffi::c_void) -> i32;
    fn GetAsyncKeyState(vKey: i32) -> i16;
}

pub fn send_key_press(vk: u8) {
    #[cfg(target_os = "windows")]
    unsafe {
        keybd_event(vk, 0, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(50));
        keybd_event(vk, 0, 0x0002, 0);
    }
}

pub fn send_key_down(vk: u8) {
    #[cfg(target_os = "windows")]
    unsafe {
        keybd_event(vk, 0, 0, 0);
    }
}

pub fn send_key_up(vk: u8) {
    #[cfg(target_os = "windows")]
    unsafe {
        keybd_event(vk, 0, 0x0002, 0);
    }
}

pub fn is_key_pressed(vk: u8) -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0
    }
    #[cfg(not(target_os = "windows"))]
    false
}

pub fn copy_to_clipboard(text: &str) -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = OsStr::new(text).encode_wide().chain(std::iter::once(0)).collect();
        let bytes_len = wide.len() * 2;
        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return false;
        }
        EmptyClipboard();
        let h_mem = GlobalAlloc(0x0002 /* GMEM_MOVEABLE */, bytes_len);
        if !h_mem.is_null() {
            let ptr = GlobalLock(h_mem) as *mut u16;
            if !ptr.is_null() {
                std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
                GlobalUnlock(h_mem);
                SetClipboardData(13 /* CF_UNICODETEXT */, h_mem);
            }
        }
        CloseClipboard();
        true
    }
    #[cfg(not(target_os = "windows"))]
    false
}

pub fn send_chat_message(channel: u32, text: &str) {
    let final_text = if channel == 1 {
        format!("/all {}", text)
    } else {
        text.to_string()
    };
    if copy_to_clipboard(&final_text) {
        #[cfg(target_os = "windows")]
        unsafe {
            // Press Enter to open chat
            keybd_event(0x0D, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(60));
            keybd_event(0x0D, 0, 0x0002, 0);
            std::thread::sleep(std::time::Duration::from_millis(80));

            // Paste message
            keybd_event(0x11, 0, 0, 0);
            keybd_event(0x56, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(40));
            keybd_event(0x56, 0, 0x0002, 0);
            keybd_event(0x11, 0, 0x0002, 0);
            std::thread::sleep(std::time::Duration::from_millis(80));

            // Press Enter to send
            keybd_event(0x0D, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(60));
            keybd_event(0x0D, 0, 0x0002, 0);
        }
    }
}

pub fn simulate_anti_afk_action(mode: &str) {
    #[cfg(target_os = "windows")]
    unsafe {
        match mode {
            "click" => {
                mouse_event(0x0002, 0, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(60));
                mouse_event(0x0004, 0, 0, 0, 0);
            }
            "jump" => {
                keybd_event(0x20, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(50));
                keybd_event(0x20, 0, 0x0002, 0);
            }
            "move" | _ => {
                keybd_event(0x57, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(100));
                keybd_event(0x57, 0, 0x0002, 0);
                std::thread::sleep(std::time::Duration::from_millis(80));
                keybd_event(0x53, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(100));
                keybd_event(0x53, 0, 0x0002, 0);
            }
        }
    }
}

pub fn simulate_vote_key(vote_yes: bool) {
    #[cfg(target_os = "windows")]
    unsafe {
        let vk = if vote_yes { 0x74 } else { 0x75 }; // VK_F5 (0x74), VK_F6 (0x75)
        keybd_event(vk, 0, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(60));
        keybd_event(vk, 0, 0x0002, 0);
    }
}

pub fn focus_valorant_window() {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn EnumWindows(
                lp_enum_func: unsafe extern "system" fn(*mut std::ffi::c_void, isize) -> i32,
                l_param: isize,
            ) -> i32;
            fn GetWindowTextW(h_wnd: *mut std::ffi::c_void, lp_string: *mut u16, n_max_count: i32) -> i32;
            fn SetForegroundWindow(h_wnd: *mut std::ffi::c_void) -> i32;
            fn IsWindowVisible(h_wnd: *mut std::ffi::c_void) -> i32;
        }

        unsafe extern "system" fn enum_wnd(h_wnd: *mut std::ffi::c_void, l_param: isize) -> i32 {
            if IsWindowVisible(h_wnd) != 0 {
                let mut buf = [0u16; 512];
                let len = GetWindowTextW(h_wnd, buf.as_mut_ptr(), 512);
                if len > 0 {
                    let title = String::from_utf16_lossy(&buf[..len as usize]).to_uppercase();
                    if title.contains("VALORANT") && !title.contains("SAGEBOT") {
                        let out = l_param as *mut *mut std::ffi::c_void;
                        *out = h_wnd;
                        return 0; // stop
                    }
                }
            }
            1
        }

        let mut val_hwnd: *mut std::ffi::c_void = std::ptr::null_mut();
        EnumWindows(enum_wnd, &mut val_hwnd as *mut _ as isize);
        if !val_hwnd.is_null() {
            SetForegroundWindow(val_hwnd);
        }
    }
}

