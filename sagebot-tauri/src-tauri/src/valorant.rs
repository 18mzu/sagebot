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
    /// Reads Riot Client credentials. Searches every user profile for the lockfile and,
    /// if none is usable (internet cafes, redirected profiles), falls back to reading the
    /// port/token directly from the running Riot Client / VALORANT process arguments.
    pub fn read_from_disk() -> Result<Self, String> {
        if let Some(path) = crate::paths::find_lockfile_path() {
            if let Ok(data) = Self::parse_file(&path) {
                if data.pid == 0 || crate::paths::is_pid_alive(data.pid) {
                    return Ok(data);
                }
            }
        }

        if let Some((pid, port, password)) = crate::paths::credentials_from_processes() {
            return Ok(LockfileData {
                process: "Riot Client".to_string(),
                pid,
                port,
                password,
                protocol: "https".to_string(),
            });
        }

        Err("Valorant / Riot Client is not running (lockfile not found)".to_string())
    }

    fn parse_file(path: &PathBuf) -> Result<Self, String> {
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

pub static VALORANT_CACHED_PID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
pub static VALORANT_CACHED_HWND: std::sync::atomic::AtomicPtr<std::ffi::c_void> = std::sync::atomic::AtomicPtr::new(std::ptr::null_mut());
static LAST_SNAPSHOT_TIME_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn current_time_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(target_os = "windows")]
fn is_pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    unsafe {
        extern "system" {
            fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut std::ffi::c_void;
            fn GetExitCodeProcess(h_process: *mut std::ffi::c_void, lp_exit_code: *mut u32) -> i32;
            fn CloseHandle(h_object: *mut std::ffi::c_void) -> i32;
        }
        let handle = OpenProcess(0x1000, 0, pid); // PROCESS_QUERY_LIMITED_INFORMATION
        if handle.is_null() || handle == (-1isize as *mut std::ffi::c_void) {
            return false;
        }
        let mut exit_code = 0u32;
        let res = GetExitCodeProcess(handle, &mut exit_code);
        CloseHandle(handle);
        res != 0 && exit_code == 259 // STILL_ACTIVE = 259
    }
}

pub fn get_valorant_pids_fresh() -> Vec<u32> {
    LAST_SNAPSHOT_TIME_MS.store(current_time_ms(), std::sync::atomic::Ordering::Relaxed);
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut std::ffi::c_void;
            fn Process32FirstW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
            fn Process32NextW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
            fn CloseHandle(h_object: *mut std::ffi::c_void) -> i32;
        }

        let mut pids = Vec::new();
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

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    let len = entry
                        .sz_exe_file
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.sz_exe_file.len());
                    let name = String::from_utf16_lossy(&entry.sz_exe_file[..len]).to_lowercase();
                    if name == "valorant.exe" || name == "valorant-win64-shipping.exe" {
                        pids.push(entry.th32_process_id);
                    }
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
        }
        if let Some(&first) = pids.first() {
            VALORANT_CACHED_PID.store(first, std::sync::atomic::Ordering::Relaxed);
        } else {
            VALORANT_CACHED_PID.store(0, std::sync::atomic::Ordering::Relaxed);
            VALORANT_CACHED_HWND.store(std::ptr::null_mut(), std::sync::atomic::Ordering::Relaxed);
        }
        return pids;
    }
    #[cfg(not(target_os = "windows"))]
    Vec::new()
}

pub fn get_valorant_pids() -> Vec<u32> {
    let cached = VALORANT_CACHED_PID.load(std::sync::atomic::Ordering::Relaxed);
    #[cfg(target_os = "windows")]
    if cached != 0 && is_pid_alive(cached) {
        return vec![cached];
    }
    get_valorant_pids_fresh()
}

pub fn is_valorant_process_running() -> bool {
    let cached = VALORANT_CACHED_PID.load(std::sync::atomic::Ordering::Relaxed);
    #[cfg(target_os = "windows")]
    if cached != 0 && is_pid_alive(cached) {
        return true;
    }

    let now = current_time_ms();
    let last = LAST_SNAPSHOT_TIME_MS.load(std::sync::atomic::Ordering::Relaxed);
    if now.saturating_sub(last) < 4000 && cached != 0 {
        return false;
    }

    !get_valorant_pids_fresh().is_empty()
}

#[derive(Clone)]
pub struct ValorantClient {
    client: reqwest::Client,
    glz_client: reqwest::Client,
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

        let glz_client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .map_err(|e| format!("Failed to initialize GLZ HTTP client: {}", e))?;

        let base_url = format!("https://127.0.0.1:{}", lockfile.port);

        Ok(ValorantClient {
            client,
            glz_client,
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
        let resp = self.glz_client.get(&url)
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
        let resp = self.glz_client.post(&url)
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
        let resp = self.glz_client.post(&url)
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

    pub async fn get_coregame_player(&self, puuid: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}/core-game/v1/players/{}", self.base_url, puuid);
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

    pub async fn get_coregame_match(&self, match_id: &str) -> Result<serde_json::Value, String> {
        let url = format!("{}/core-game/v1/matches/{}", self.base_url, match_id);
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
        self.start_queue("competitive").await
    }

    pub async fn start_queue(&self, queue_id: &str) -> Result<bool, String> {
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
        let party_res = self.glz_client.get(&party_player_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .send().await.map_err(|e| format!("Party player request failed: {}", e))?;

        if !party_res.status().is_success() {
            let status = party_res.status().as_u16();
            let body = party_res.text().await.unwrap_or_default();
            let err = match status {
                403 => "Cannot lookup party: Permission denied or session expired".to_string(),
                404 => "Party not found: Player not connected to lobby".to_string(),
                _ => {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                        if let Some(msg) = json.get("message").and_then(|m| m.as_str()) {
                            format!("Party lookup returned HTTP {}: {}", status, msg)
                        } else {
                            format!("Party lookup returned HTTP {}", status)
                        }
                    } else {
                        format!("Party lookup returned HTTP {}", status)
                    }
                }
            };
            return Err(err);
        }
        let party_json: serde_json::Value = party_res.json().await.map_err(|e| e.to_string())?;
        let party_id = party_json.get("CurrentPartyID").and_then(|v| v.as_str()).ok_or_else(|| "Missing CurrentPartyID".to_string())?;

        // 2. Set queue to desired gamemode
        let queue_url = format!("https://{}/parties/v1/parties/{}/queue", glz_host, party_id);
        let queue_body = serde_json::json!({ "queueID": queue_id });
        let _ = self.glz_client.post(&queue_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .json(&queue_body)
            .send().await;

        // 3. Enter matchmaking (/matchmaking/join)
        let join_url = format!("https://{}/parties/v1/parties/{}/matchmaking/join", glz_host, party_id);
        let join_res = self.glz_client.post(&join_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .send().await.map_err(|e| format!("Matchmaking join request failed: {}", e))?;

        let status = join_res.status();
        if status.is_success() || status.as_u16() == 409 {
            return Ok(true);
        }

        let err_desc = match status.as_u16() {
            403 => "Cannot start a new game (Queue restricted, party member penalty, or party leader required)".to_string(),
            400 => "Cannot start queue: Invalid party size or mode unavailable".to_string(),
            404 => "Cannot start queue: Party session expired".to_string(),
            429 => "Cannot start queue: Rate limited by Riot matchmaking".to_string(),
            500..=599 => "Cannot start queue: VALORANT matchmaking servers temporarily unavailable".to_string(),
            code => format!("Cannot start queue: Matchmaking server returned code {}", code),
        };
        Err(err_desc)
    }

    pub async fn get_player_party_state(&self, puuid: &str) -> Result<(String, String), String> {
        let (access_token, jwt) = self.get_riot_tokens().await?;
        let glz_host = discover_glz_host();
        let client_version = discover_client_version();

        let party_player_url = format!("https://{}/parties/v1/players/{}", glz_host, puuid);
        let resp = self.glz_client.get(&party_player_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err("Party player fetch failed".to_string());
        }
        let pjson: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let party_id = match pjson.get("CurrentPartyID").and_then(|v| v.as_str()) {
            Some(id) if !id.is_empty() => id,
            _ => return Ok(("DEFAULT".to_string(), "".to_string())),
        };

        let party_url = format!("https://{}/parties/v1/parties/{}", glz_host, party_id);
        let presp = self.glz_client.get(&party_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Riot-Entitlements-JWT", &jwt)
            .header("X-Riot-ClientPlatform", "ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=")
            .header("X-Riot-ClientVersion", &client_version)
            .send().await.map_err(|e| e.to_string())?;

        if !presp.status().is_success() {
            return Err("Party info fetch failed".to_string());
        }
        let party_info: serde_json::Value = presp.json().await.map_err(|e| e.to_string())?;
        let state = party_info.get("State").and_then(|v| v.as_str()).unwrap_or("DEFAULT").to_string();
        let queue_id = party_info.get("MatchmakingData")
            .and_then(|m| m.get("QueueID"))
            .and_then(|q| q.as_str())
            .unwrap_or("")
            .to_string();
        Ok((state, queue_id))
    }
}

pub fn discover_glz_host() -> String {
    if let Some(path) = crate::paths::find_shooter_game_log() {
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
    if let Some(path) = crate::paths::find_shooter_game_log() {
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
                // 1. Search for "CI server version: "
                if let Some(pos) = text.rfind("CI server version: ") {
                    let sub = &text[pos + 19..];
                    let end = sub.find(|c: char| c.is_whitespace() || c == '\"' || c == '\'').unwrap_or(sub.len());
                    let ver = &sub[..end];
                    if ver.contains("shipping") {
                        return ver.to_string();
                    }
                }
                // 2. Scan lines backwards for any line containing "release-" and "shipping"
                for line in text.lines().rev() {
                    if let Some(pos) = line.find("release-") {
                        let sub = &line[pos..];
                        let end = sub.find(|c: char| c.is_whitespace() || c == '\"' || c == '\'').unwrap_or(sub.len());
                        let ver = &sub[..end];
                        if ver.contains("shipping") {
                            return ver.to_string();
                        }
                    }
                }
            }
        }
    }
    "release-13.08-shipping-19-5698904".to_string()
}

pub fn resolve_agent_from_log() -> String {
    if let Some(path) = crate::paths::find_shooter_game_log() {
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
                let read_bytes = if len > 1048576 { 1048576 } else { len };
                let _ = file.seek(SeekFrom::End(-(read_bytes as i64)));
                let mut buf = vec![0u8; read_bytes as usize];
                if let Ok(_) = file.read_exact(&mut buf) {
                    let text = String::from_utf8_lossy(&buf);
                    let last_menu_travel = text.rfind("Beginning travel to /Game/Maps/Menu/MainMenuV2")
                        .or_else(|| text.rfind("Beginning travel to /Game/Maps/PregameV2/CharacterSelectPersistentLevel"));
                    let target = "AcknowledgePossession('";
                    let last_ack = text.rfind(target);

                    if let Some(pos) = last_ack {
                        // If player traveled back to the main menu or character select AFTER the last AcknowledgePossession,
                        // they are not currently in an active match.
                        if let Some(travel_pos) = last_menu_travel {
                            if travel_pos > pos {
                                return "-".to_string();
                            }
                        }

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
    pub rank_tier: u32,
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
        rank_tier: 0,
        agent_name: "-".to_string(),
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
                            // Match Score (can be integer or string in Riot presence JSON)
                            fn parse_score_value(v: &serde_json::Value) -> Option<i32> {
                                if let Some(n) = v.as_i64() {
                                    return Some(n as i32);
                                }
                                if let Some(s) = v.as_str() {
                                    if let Ok(n) = s.trim().parse::<i32>() {
                                        return Some(n);
                                    }
                                }
                                None
                            }

                            let ally_opt = priv_json.get("partyOwnerMatchScoreAllyTeam")
                                .or_else(|| priv_json.get("partyOwnerMatchScoreAlly"))
                                .or_else(|| priv_json.get("matchScoreAllyTeam"))
                                .or_else(|| priv_json.get("matchPresenceData").and_then(|m| m.get("partyOwnerMatchScoreAllyTeam")))
                                .or_else(|| priv_json.get("matchPresenceData").and_then(|m| m.get("partyOwnerMatchScoreAlly")))
                                .and_then(parse_score_value);

                            if let Some(ally) = ally_opt {
                                details.score_ally = ally;
                            }

                            let enemy_opt = priv_json.get("partyOwnerMatchScoreEnemyTeam")
                                .or_else(|| priv_json.get("partyOwnerMatchScoreEnemy"))
                                .or_else(|| priv_json.get("matchScoreEnemyTeam"))
                                .or_else(|| priv_json.get("matchPresenceData").and_then(|m| m.get("partyOwnerMatchScoreEnemyTeam")))
                                .or_else(|| priv_json.get("matchPresenceData").and_then(|m| m.get("partyOwnerMatchScoreEnemy")))
                                .and_then(parse_score_value);

                            if let Some(enemy) = enemy_opt {
                                details.score_enemy = enemy;
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
                                .or_else(|| priv_json.get("partyOwnerPartyState"))
                                .or_else(|| priv_json.get("partyOwnerState"))
                                .or_else(|| priv_json.get("partyData").and_then(|d| d.get("partyState")))
                                .or_else(|| priv_json.get("matchPresenceData").and_then(|m| m.get("partyState")))
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

                            let queue_entry_time = priv_json.get("queueEntryTime").and_then(|v| v.as_str()).unwrap_or("");
                            let is_queue_time_active = !queue_entry_time.is_empty()
                                && queue_entry_time != "0001.01.01-00.00.00"
                                && queue_entry_time != "0";

                            let party_state_upper = party_state.to_uppercase();
                            let priv_raw = priv_json.to_string().to_uppercase();
                            let is_queue = party_state_upper.contains("MATCHMAKING")
                                || party_state_upper.contains("QUEUE")
                                || party_state_upper.contains("STARTING")
                                || priv_raw.contains("\"MATCHMAKING\"")
                                || priv_raw.contains("\"STARTING\"")
                                || is_queue_time_active;

                            details.match_state = match loop_state {
                                "PREGAME" => "Agent Select".to_string(),
                                "INGAME" => "In Game".to_string(),
                                _ => {
                                    if is_queue {
                                        "In Queue".to_string()
                                    } else {
                                        "In Lobby".to_string()
                                    }
                                }
                            };

                            if details.match_state == "In Game" {
                                details.agent_name = resolve_agent_from_log();
                            } else {
                                details.agent_name = "-".to_string();
                            }

                            // Rank
                            let tier = priv_json.get("playerPresenceData")
                                .and_then(|ppd| ppd.get("competitiveTier"))
                                .or_else(|| priv_json.get("competitiveTier"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            details.rank_tier = tier as u32;
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

pub fn resolve_agent_name_by_id(id: &str) -> String {
    for a in crate::agents_data::get_all_agents() {
        if a.id.eq_ignore_ascii_case(id) {
            return a.name;
        }
    }
    id.to_string()
}

pub fn resolve_map_name(raw: &str) -> String {
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

pub fn resolve_gamemode(queue: &str, raw_mode: &str, is_custom: bool) -> String {
    let q_lower = queue.to_lowercase();
    let m_lower = raw_mode.to_lowercase();

    if q_lower.contains("premier") || m_lower.contains("premier") {
        return "Premier".to_string();
    }

    let sub = if (m_lower.contains("bomb") || q_lower.contains("bomb")) && !m_lower.contains("quickbomb") && !q_lower.contains("quickbomb") {
        if q_lower.contains("competitive") {
            "Competitive"
        } else if q_lower.contains("unrated") {
            "Unrated"
        } else {
            "Competitive"
        }
    } else if m_lower.contains("quickbomb") || q_lower.contains("quickbomb") || q_lower.contains("spikerush") {
        "Spike Rush"
    } else if m_lower.contains("swiftplay") || q_lower.contains("swiftplay") {
        "Swiftplay"
    } else if m_lower.contains("hurm") || q_lower.contains("hurm") {
        "Team Deathmatch"
    } else if m_lower.contains("deathmatch") || q_lower.contains("deathmatch") {
        "Deathmatch"
    } else if m_lower.contains("onefa") || q_lower.contains("onefa") {
        "Replication"
    } else if m_lower.contains("ggteam") || q_lower.contains("ggteam") {
        "Escalation"
    } else if m_lower.contains("snowball") || q_lower.contains("snowball") {
        "Snowball Fight"
    } else if q_lower.contains("competitive") {
        "Competitive"
    } else if q_lower.contains("unrated") {
        "Unrated"
    } else {
        "Competitive"
    };

    if is_custom {
        format!("Custom: {}", sub)
    } else {
        sub.to_string()
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
    fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
    fn MapVirtualKeyW(u_code: u32, u_map_type: u32) -> u32;
    fn mouse_event(dw_flags: u32, dx: u32, dy: u32, dw_data: u32, dw_extra_info: usize);
    fn OpenClipboard(h_wnd_new_owner: *mut std::ffi::c_void) -> i32;
    fn CloseClipboard() -> i32;
    fn EmptyClipboard() -> i32;
    fn SetClipboardData(u_format: u32, h_mem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GlobalAlloc(u_flags: u32, dw_bytes: usize) -> *mut std::ffi::c_void;
    fn GlobalLock(h_mem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GlobalUnlock(h_mem: *mut std::ffi::c_void) -> i32;
    fn GetAsyncKeyState(v_key: i32) -> i16;
}

pub fn send_mouse_click() {
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(30));
    }
    #[cfg(target_os = "windows")]
    unsafe {
        mouse_event(0x0002, 0, 0, 0, 0); // MOUSEEVENTF_LEFTDOWN
        std::thread::sleep(std::time::Duration::from_millis(50));
        mouse_event(0x0004, 0, 0, 0, 0); // MOUSEEVENTF_LEFTUP
    }
}

pub fn send_mouse_down() {
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(30));
    }
    #[cfg(target_os = "windows")]
    unsafe {
        mouse_event(0x0002, 0, 0, 0, 0); // MOUSEEVENTF_LEFTDOWN
    }
}

pub fn send_mouse_up() {
    #[cfg(target_os = "windows")]
    unsafe {
        mouse_event(0x0004, 0, 0, 0, 0); // MOUSEEVENTF_LEFTUP
    }
}

pub fn send_key_press(vk: u8) {
    if vk == 0x01 {
        send_mouse_click();
        return;
    }
    if vk == 0x02 {
        if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
            focus_valorant_window();
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
        #[cfg(target_os = "windows")]
        unsafe {
            mouse_event(0x0008, 0, 0, 0, 0); // RIGHTDOWN
            std::thread::sleep(std::time::Duration::from_millis(50));
            mouse_event(0x0010, 0, 0, 0, 0); // RIGHTUP
        }
        return;
    }
    if vk == 0x04 {
        if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
            focus_valorant_window();
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
        #[cfg(target_os = "windows")]
        unsafe {
            mouse_event(0x0020, 0, 0, 0, 0); // MIDDLEDOWN
            std::thread::sleep(std::time::Duration::from_millis(50));
            mouse_event(0x0040, 0, 0, 0, 0); // MIDDLEUP
        }
        return;
    }
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(30));
    }
    #[cfg(target_os = "windows")]
    unsafe {
        let scan = MapVirtualKeyW(vk as u32, 0) as u8;
        keybd_event(vk, scan, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(50));
        keybd_event(vk, scan, 0x0002, 0);
    }
}

pub fn send_key_down(vk: u8) {
    if vk == 0x01 {
        send_mouse_down();
        return;
    }
    if vk == 0x02 {
        #[cfg(target_os = "windows")]
        unsafe {
            mouse_event(0x0008, 0, 0, 0, 0);
        }
        return;
    }
    if vk == 0x04 {
        #[cfg(target_os = "windows")]
        unsafe {
            mouse_event(0x0020, 0, 0, 0, 0);
        }
        return;
    }
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(30));
    }
    #[cfg(target_os = "windows")]
    unsafe {
        let scan = MapVirtualKeyW(vk as u32, 0) as u8;
        keybd_event(vk, scan, 0, 0);
    }
}

pub fn send_key_up(vk: u8) {
    if vk == 0x01 {
        send_mouse_up();
        return;
    }
    if vk == 0x02 {
        #[cfg(target_os = "windows")]
        unsafe {
            mouse_event(0x0010, 0, 0, 0, 0);
        }
        return;
    }
    if vk == 0x04 {
        #[cfg(target_os = "windows")]
        unsafe {
            mouse_event(0x0040, 0, 0, 0, 0);
        }
        return;
    }
    #[cfg(target_os = "windows")]
    unsafe {
        let scan = MapVirtualKeyW(vk as u32, 0) as u8;
        keybd_event(vk, scan, 0x0002, 0);
    }
}

pub fn send_comms_sequence(hotkey_vk: u8, first_vk: u8, second_vk: u8) {
    #[cfg(target_os = "windows")]
    unsafe {
        if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
            focus_valorant_window();
            std::thread::sleep(std::time::Duration::from_millis(40));
        }

        // Step 1: Comms Menu key (e.g. '.')
        let scan0 = MapVirtualKeyW(hotkey_vk as u32, 0) as u8;
        keybd_event(hotkey_vk, scan0, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(25));
        keybd_event(hotkey_vk, scan0, 0x0002, 0);

        // Minimal inter-key delay
        std::thread::sleep(std::time::Duration::from_millis(35));

        // Step 2: Category number (1-4)
        let scan1 = MapVirtualKeyW(first_vk as u32, 0) as u8;
        keybd_event(first_vk, scan1, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(25));
        keybd_event(first_vk, scan1, 0x0002, 0);

        // Minimal inter-key delay
        std::thread::sleep(std::time::Duration::from_millis(35));

        // Step 3: Option number (1-6)
        let scan2 = MapVirtualKeyW(second_vk as u32, 0) as u8;
        keybd_event(second_vk, scan2, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(25));
        keybd_event(second_vk, scan2, 0x0002, 0);
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
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed)
        && IS_INGAME_WITH_AGENT.load(std::sync::atomic::Ordering::Relaxed)
    {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
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
            std::thread::sleep(std::time::Duration::from_millis(40));
            keybd_event(0x0D, 0, 0x0002, 0);
            std::thread::sleep(std::time::Duration::from_millis(50));

            // Paste message
            keybd_event(0x11, 0, 0, 0);
            keybd_event(0x56, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(30));
            keybd_event(0x56, 0, 0x0002, 0);
            keybd_event(0x11, 0, 0x0002, 0);
            std::thread::sleep(std::time::Duration::from_millis(50));

            // Press Enter to send
            keybd_event(0x0D, 0, 0, 0);
            std::thread::sleep(std::time::Duration::from_millis(40));
            keybd_event(0x0D, 0, 0x0002, 0);
        }
    }
}

pub fn simulate_anti_afk_action(mode: &str) {
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed)
        && IS_INGAME_WITH_AGENT.load(std::sync::atomic::Ordering::Relaxed)
    {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    #[cfg(target_os = "windows")]
    unsafe {
        match mode {
            "click" => {
                mouse_event(0x0002, 0, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(50));
                mouse_event(0x0004, 0, 0, 0, 0);
            }
            "jump" => {
                keybd_event(0x20, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(40));
                keybd_event(0x20, 0, 0x0002, 0);
            }
            "move" | _ => {
                keybd_event(0x57, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(80));
                keybd_event(0x57, 0, 0x0002, 0);
                std::thread::sleep(std::time::Duration::from_millis(60));
                keybd_event(0x53, 0, 0, 0);
                std::thread::sleep(std::time::Duration::from_millis(80));
                keybd_event(0x53, 0, 0x0002, 0);
            }
        }
    }
}

pub fn simulate_vote_key(vote_yes: bool) {
    if AUTO_FOCUS_ENABLED.load(std::sync::atomic::Ordering::Relaxed)
        && IS_INGAME_WITH_AGENT.load(std::sync::atomic::Ordering::Relaxed)
    {
        focus_valorant_window();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    #[cfg(target_os = "windows")]
    unsafe {
        let vk = if vote_yes { 0x74 } else { 0x75 }; // VK_F5 (0x74), VK_F6 (0x75)
        let scan = MapVirtualKeyW(vk as u32, 0) as u8;
        keybd_event(vk, scan, 0, 0);
        std::thread::sleep(std::time::Duration::from_millis(40));
        keybd_event(vk, scan, 0x0002, 0);
    }
}

#[cfg(target_os = "windows")]
pub fn find_valorant_window() -> Option<*mut std::ffi::c_void> {
    unsafe {
        extern "system" {
            fn EnumWindows(
                lp_enum_func: unsafe extern "system" fn(*mut std::ffi::c_void, isize) -> i32,
                l_param: isize,
            ) -> i32;
            fn GetWindowTextW(h_wnd: *mut std::ffi::c_void, lp_string: *mut u16, n_max_count: i32) -> i32;
            fn GetClassNameW(h_wnd: *mut std::ffi::c_void, lp_class_name: *mut u16, n_max_count: i32) -> i32;
            fn GetWindowThreadProcessId(h_wnd: *mut std::ffi::c_void, lpdw_process_id: *mut u32) -> u32;
            fn IsWindowVisible(h_wnd: *mut std::ffi::c_void) -> i32;
            fn IsWindow(h_wnd: *mut std::ffi::c_void) -> i32;
        }

        let cached_hwnd = VALORANT_CACHED_HWND.load(std::sync::atomic::Ordering::Relaxed);
        if !cached_hwnd.is_null() && IsWindow(cached_hwnd) != 0 && IsWindowVisible(cached_hwnd) != 0 {
            return Some(cached_hwnd);
        }

        struct EnumData {
            out_hwnd: *mut std::ffi::c_void,
            pids: Vec<u32>,
        }

        unsafe extern "system" fn enum_wnd(h_wnd: *mut std::ffi::c_void, l_param: isize) -> i32 {
            if IsWindowVisible(h_wnd) != 0 {
                let data = &mut *(l_param as *mut EnumData);
                let mut pid = 0u32;
                GetWindowThreadProcessId(h_wnd, &mut pid);

                let mut title_buf = [0u16; 512];
                let title_len = GetWindowTextW(h_wnd, title_buf.as_mut_ptr(), 512);
                let title = if title_len > 0 {
                    String::from_utf16_lossy(&title_buf[..title_len as usize])
                } else {
                    String::new()
                };
                let title_upper = title.to_uppercase();

                if title_upper.contains("SAGEBOT") {
                    return 1;
                }

                if pid != 0 && data.pids.contains(&pid) {
                    data.out_hwnd = h_wnd;
                    return 0; // stop enumeration
                }

                let mut class_buf = [0u16; 256];
                let class_len = GetClassNameW(h_wnd, class_buf.as_mut_ptr(), 256);
                let class_name = if class_len > 0 {
                    String::from_utf16_lossy(&class_buf[..class_len as usize])
                } else {
                    String::new()
                };

                if class_name == "UnrealWindow" || title_upper.contains("VALORANT") {
                    data.out_hwnd = h_wnd;
                    return 0; // stop enumeration
                }
            }
            1
        }

        let mut data = EnumData {
            out_hwnd: std::ptr::null_mut(),
            pids: get_valorant_pids(),
        };

        EnumWindows(enum_wnd, &mut data as *mut _ as isize);
        if !data.out_hwnd.is_null() {
            VALORANT_CACHED_HWND.store(data.out_hwnd, std::sync::atomic::Ordering::Relaxed);
            Some(data.out_hwnd)
        } else {
            None
        }
    }
}

pub fn focus_valorant_window() {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn GetForegroundWindow() -> *mut std::ffi::c_void;
            fn ShowWindow(h_wnd: *mut std::ffi::c_void, n_cmd_show: i32) -> i32;
            fn BringWindowToTop(h_wnd: *mut std::ffi::c_void) -> i32;
            fn SetForegroundWindow(h_wnd: *mut std::ffi::c_void) -> i32;
            fn IsIconic(h_wnd: *mut std::ffi::c_void) -> i32;
            fn SwitchToThisWindow(h_wnd: *mut std::ffi::c_void, f_unknown: i32);
            fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
        }

        if let Some(val_hwnd) = find_valorant_window() {
            let fg = GetForegroundWindow();
            if fg == val_hwnd {
                return;
            }

            // Unlock Windows foreground restrictions
            keybd_event(0, 0, 0, 0);

            if IsIconic(val_hwnd) != 0 {
                ShowWindow(val_hwnd, 9); // SW_RESTORE
            }
            ShowWindow(val_hwnd, 5); // SW_SHOW
            BringWindowToTop(val_hwnd);
            SetForegroundWindow(val_hwnd);
            SwitchToThisWindow(val_hwnd, 1);
        }
    }
}

pub fn is_valorant_focused() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn GetForegroundWindow() -> *mut std::ffi::c_void;
            fn GetWindowTextW(h_wnd: *mut std::ffi::c_void, lp_string: *mut u16, n_max_count: i32) -> i32;
            fn GetClassNameW(h_wnd: *mut std::ffi::c_void, lp_class_name: *mut u16, n_max_count: i32) -> i32;
            fn GetWindowThreadProcessId(h_wnd: *mut std::ffi::c_void, lpdw_process_id: *mut u32) -> u32;
        }
        let fg = GetForegroundWindow();
        if fg.is_null() {
            return false;
        }

        // Fast check 1: cached HWND
        let cached_hwnd = VALORANT_CACHED_HWND.load(std::sync::atomic::Ordering::Relaxed);
        if !cached_hwnd.is_null() && fg == cached_hwnd {
            return true;
        }

        // Fast check 2: check PID against cached PID
        let mut pid = 0u32;
        GetWindowThreadProcessId(fg, &mut pid);
        let cached_pid = VALORANT_CACHED_PID.load(std::sync::atomic::Ordering::Relaxed);
        if pid != 0 && cached_pid != 0 && pid == cached_pid {
            VALORANT_CACHED_HWND.store(fg, std::sync::atomic::Ordering::Relaxed);
            return true;
        }

        // Fast check 3: inspect class name of foreground window only
        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(fg, class_buf.as_mut_ptr(), 256);
        let class_name = if class_len > 0 {
            String::from_utf16_lossy(&class_buf[..class_len as usize])
        } else {
            String::new()
        };

        if class_name == "UnrealWindow" {
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(fg, title_buf.as_mut_ptr(), 512);
            let title = if title_len > 0 {
                String::from_utf16_lossy(&title_buf[..title_len as usize])
            } else {
                String::new()
            };
            let title_upper = title.to_uppercase();
            if (title_upper.contains("VALORANT") || class_name == "UnrealWindow") && !title_upper.contains("SAGEBOT") {
                if pid != 0 {
                    VALORANT_CACHED_PID.store(pid, std::sync::atomic::Ordering::Relaxed);
                }
                VALORANT_CACHED_HWND.store(fg, std::sync::atomic::Ordering::Relaxed);
                return true;
            }
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    false
}

pub static IS_INGAME_WITH_AGENT: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
pub static AUTO_FOCUS_ENABLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

pub fn start_focus_monitor() {
    std::thread::spawn(|| {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1000));
            if !crate::IS_BOT_RUNNING.load(std::sync::atomic::Ordering::Relaxed)
                || !IS_INGAME_WITH_AGENT.load(std::sync::atomic::Ordering::Relaxed)
            {
                continue;
            }
            #[cfg(target_os = "windows")]
            {
                if !is_valorant_focused() {
                    focus_valorant_window();
                }
            }
        }
    });
}


