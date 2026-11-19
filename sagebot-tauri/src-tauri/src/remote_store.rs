use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PersistedPairedDevice {
    pub id: String,
    pub name: String,
    pub paired_at: String,
    pub key: String,
    #[serde(default)]
    pub last_seen_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PersistedRemoteState {
    pub code: String,
    pub channel_id: String,
    pub paired_device: Option<PersistedPairedDevice>,
}

const REMOTE_ENTROPY: &[u8] = b"SageBotRemoteStoreV4";

fn store_path() -> PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(base).join("SageBot");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("remote_state.dpapi")
}

#[cfg(target_os = "windows")]
mod dpapi {
    use std::ffi::c_void;

    #[repr(C)]
    struct DataBlob {
        cb_data: u32,
        pb_data: *mut u8,
    }

    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            p_data_in: *const DataBlob,
            sz_data_descr: *const u16,
            p_optional_entropy: *const DataBlob,
            pv_reserved: *mut c_void,
            p_prompt_struct: *const c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;

        fn CryptUnprotectData(
            p_data_in: *const DataBlob,
            ppsz_data_descr: *mut *mut u16,
            p_optional_entropy: *const DataBlob,
            pv_reserved: *mut c_void,
            p_prompt_struct: *const c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(h_mem: *mut c_void) -> *mut c_void;
    }

    pub fn encrypt(plain: &[u8], entropy: &[u8]) -> Result<Vec<u8>, String> {
        unsafe {
            let in_blob = DataBlob {
                cb_data: plain.len() as u32,
                pb_data: plain.as_ptr() as *mut u8,
            };
            let ent_blob = DataBlob {
                cb_data: entropy.len() as u32,
                pb_data: entropy.as_ptr() as *mut u8,
            };
            let mut out_blob = DataBlob {
                cb_data: 0,
                pb_data: std::ptr::null_mut(),
            };
            let ok = CryptProtectData(
                &in_blob,
                std::ptr::null(),
                &ent_blob,
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            );
            if ok == 0 || out_blob.pb_data.is_null() {
                return Err("DPAPI CryptProtectData failed".to_string());
            }
            let result = std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec();
            LocalFree(out_blob.pb_data as *mut c_void);
            Ok(result)
        }
    }

    pub fn decrypt(cipher: &[u8], entropy: &[u8]) -> Result<Vec<u8>, String> {
        unsafe {
            let in_blob = DataBlob {
                cb_data: cipher.len() as u32,
                pb_data: cipher.as_ptr() as *mut u8,
            };
            let ent_blob = DataBlob {
                cb_data: entropy.len() as u32,
                pb_data: entropy.as_ptr() as *mut u8,
            };
            let mut out_blob = DataBlob {
                cb_data: 0,
                pb_data: std::ptr::null_mut(),
            };
            let ok = CryptUnprotectData(
                &in_blob,
                std::ptr::null_mut(),
                &ent_blob,
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            );
            if ok == 0 || out_blob.pb_data.is_null() {
                return Err("DPAPI CryptUnprotectData failed".to_string());
            }
            let result = std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec();
            LocalFree(out_blob.pb_data as *mut c_void);
            Ok(result)
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod dpapi {
    pub fn encrypt(plain: &[u8], _entropy: &[u8]) -> Result<Vec<u8>, String> {
        Ok(plain.to_vec())
    }
    pub fn decrypt(cipher: &[u8], _entropy: &[u8]) -> Result<Vec<u8>, String> {
        Ok(cipher.to_vec())
    }
}

pub fn load_state() -> Result<Option<PersistedRemoteState>, String> {
    let path = store_path();
    if !path.exists() {
        return Ok(None);
    }
    let encrypted = std::fs::read(&path).map_err(|e| format!("Failed to read remote store: {}", e))?;
    if encrypted.is_empty() {
        return Ok(None);
    }
    let plain = dpapi::decrypt(&encrypted, REMOTE_ENTROPY)?;
    let parsed: PersistedRemoteState = serde_json::from_slice(&plain)
        .map_err(|e| format!("Failed to parse remote store JSON: {}", e))?;
    Ok(Some(parsed))
}

pub fn save_state(state: &PersistedRemoteState) -> Result<(), String> {
    let path = store_path();
    let json = serde_json::to_vec(state).map_err(|e| format!("Failed to serialize remote store: {}", e))?;
    let encrypted = dpapi::encrypt(&json, REMOTE_ENTROPY)?;
    let tmp_path = path.with_extension("dpapi.tmp");
    std::fs::write(&tmp_path, &encrypted).map_err(|e| format!("Failed to write remote store tmp: {}", e))?;
    if std::fs::rename(&tmp_path, &path).is_err() {
        std::fs::write(&path, &encrypted).map_err(|e| format!("Failed to write remote store: {}", e))?;
        let _ = std::fs::remove_file(&tmp_path);
    }
    Ok(())
}
