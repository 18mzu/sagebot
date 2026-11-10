//! Robust discovery of Riot Client / VALORANT files and credentials.
//!
//! Designed to work on "special" machines (internet cafes, diskless boot, custom drives,
//! redirected / multiple user profiles) where VALORANT is not installed in the default
//! `C:\Riot Games` location and `%LOCALAPPDATA%` may not belong to the user running the game.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

// ---------------------------------------------------------------------------
// Win32 bindings (kernel32 only; ntdll is resolved dynamically)
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
#[repr(C)]
struct ProcessEntry32W {
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

#[cfg(target_os = "windows")]
extern "system" {
    fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut std::ffi::c_void;
    fn Process32FirstW(h_snapshot: *mut std::ffi::c_void, lppe: *mut ProcessEntry32W) -> i32;
    fn Process32NextW(h_snapshot: *mut std::ffi::c_void, lppe: *mut ProcessEntry32W) -> i32;
    fn OpenProcess(
        dw_desired_access: u32,
        b_inherit_handle: i32,
        dw_process_id: u32,
    ) -> *mut std::ffi::c_void;
    fn CloseHandle(h_object: *mut std::ffi::c_void) -> i32;
    fn QueryFullProcessImageNameW(
        h_process: *mut std::ffi::c_void,
        dw_flags: u32,
        lp_exe_name: *mut u16,
        lpdw_size: *mut u32,
    ) -> i32;
    fn GetLogicalDrives() -> u32;
    fn GetDriveTypeW(lp_root_path_name: *const u16) -> u32;
    fn GetModuleHandleW(lp_module_name: *const u16) -> *mut std::ffi::c_void;
    fn GetProcAddress(
        h_module: *mut std::ffi::c_void,
        lp_proc_name: *const u8,
    ) -> *mut std::ffi::c_void;
}

const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Returns `(pid, lowercase exe name)` for every running process whose name is in `names` (lowercase).
pub fn find_processes(names: &[&str]) -> Vec<(u32, String)> {
    let mut out = Vec::new();
    #[cfg(target_os = "windows")]
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if snapshot.is_null() || snapshot == (-1isize as *mut std::ffi::c_void) {
            return out;
        }
        let mut entry: ProcessEntry32W = std::mem::zeroed();
        entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let len = entry
                    .sz_exe_file
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(260);
                let name = String::from_utf16_lossy(&entry.sz_exe_file[..len]).to_lowercase();
                if names.iter().any(|n| *n == name) {
                    out.push((entry.th32_process_id, name));
                }
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snapshot);
    }
    let _ = names;
    out
}

/// Full executable path of a running process.
pub fn process_image_path(pid: u32) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return None;
        }
        let mut buf = [0u16; 1024];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(h);
        if ok != 0 && size > 0 {
            return Some(PathBuf::from(String::from_utf16_lossy(
                &buf[..size as usize],
            )));
        }
    }
    let _ = pid;
    None
}

/// Reads the command line of another process (Windows 8.1+, needs only limited query access).
pub fn read_process_command_line(pid: u32) -> Option<String> {
    #[cfg(target_os = "windows")]
    unsafe {
        type NtQip = unsafe extern "system" fn(
            *mut std::ffi::c_void,
            u32,
            *mut std::ffi::c_void,
            u32,
            *mut u32,
        ) -> i32;

        let ntdll = GetModuleHandleW(to_wide("ntdll.dll").as_ptr());
        if ntdll.is_null() {
            return None;
        }
        let proc_addr = GetProcAddress(ntdll, b"NtQueryInformationProcess\0".as_ptr());
        if proc_addr.is_null() {
            return None;
        }
        let nt_query: NtQip = std::mem::transmute(proc_addr);

        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return None;
        }

        const PROCESS_COMMAND_LINE_INFORMATION: u32 = 60;
        let mut needed: u32 = 0;
        let _ = nt_query(
            h,
            PROCESS_COMMAND_LINE_INFORMATION,
            std::ptr::null_mut(),
            0,
            &mut needed,
        );
        if needed == 0 || needed > 1 << 20 {
            CloseHandle(h);
            return None;
        }

        // u64 backing store keeps the embedded UNICODE_STRING pointer-aligned.
        let mut buf: Vec<u64> = vec![0; (needed as usize + 7) / 8 + 1];
        let status = nt_query(
            h,
            PROCESS_COMMAND_LINE_INFORMATION,
            buf.as_mut_ptr() as *mut std::ffi::c_void,
            (buf.len() * 8) as u32,
            &mut needed,
        );
        CloseHandle(h);
        if status < 0 {
            return None;
        }

        #[repr(C)]
        struct UnicodeString {
            length: u16,
            maximum_length: u16,
            buffer: *const u16,
        }
        let us = &*(buf.as_ptr() as *const UnicodeString);
        if us.buffer.is_null() || us.length == 0 {
            return None;
        }
        let slice = std::slice::from_raw_parts(us.buffer, (us.length / 2) as usize);
        return Some(String::from_utf16_lossy(slice));
    }
    #[allow(unreachable_code)]
    {
        let _ = pid;
        None
    }
}

pub fn is_pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn GetExitCodeProcess(h_process: *mut std::ffi::c_void, lp_exit_code: *mut u32) -> i32;
        }
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            // Access denied still means the process exists; treat as alive.
            return true;
        }
        let mut code = 0u32;
        let ok = GetExitCodeProcess(h, &mut code);
        CloseHandle(h);
        return ok != 0 && code == 259; // STILL_ACTIVE
    }
    #[allow(unreachable_code)]
    true
}

// ---------------------------------------------------------------------------
// %LOCALAPPDATA% candidates (handles redirected / multiple profiles)
// ---------------------------------------------------------------------------

fn local_appdata_candidates() -> &'static Vec<PathBuf> {
    static CANDIDATES: OnceLock<Vec<PathBuf>> = OnceLock::new();
    CANDIDATES.get_or_init(|| {
        let mut list: Vec<PathBuf> = Vec::new();
        let mut push = |p: PathBuf| {
            let key = p.to_string_lossy().to_lowercase();
            if !list
                .iter()
                .any(|e| e.to_string_lossy().to_lowercase() == key)
            {
                list.push(p);
            }
        };

        if let Ok(v) = std::env::var("LOCALAPPDATA") {
            push(PathBuf::from(v));
        }
        if let Ok(v) = std::env::var("USERPROFILE") {
            push(PathBuf::from(v).join("AppData").join("Local"));
        }

        // Every profile on the system drive (+ any drive that has a \Users folder).
        let mut user_roots: Vec<PathBuf> = Vec::new();
        let sys_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
        user_roots.push(PathBuf::from(format!("{}\\Users", sys_drive)));
        for d in fixed_drive_roots() {
            let p = d.join("Users");
            if !user_roots.iter().any(|e| e == &p) {
                user_roots.push(p);
            }
        }
        for root in user_roots {
            if let Ok(rd) = std::fs::read_dir(&root) {
                for entry in rd.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if matches!(
                        name.as_str(),
                        "public" | "default" | "default user" | "all users"
                    ) {
                        continue;
                    }
                    let local = entry.path().join("AppData").join("Local");
                    if local.is_dir() {
                        push(local);
                    }
                }
            }
        }
        list
    })
}

/// Most recently modified existing file among `paths`.
fn newest_existing(paths: impl Iterator<Item = PathBuf>) -> Option<PathBuf> {
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for p in paths {
        if let Ok(meta) = std::fs::metadata(&p) {
            if !meta.is_file() {
                continue;
            }
            let t = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
            if best.as_ref().map(|(bt, _)| t > *bt).unwrap_or(true) {
                best = Some((t, p));
            }
        }
    }
    best.map(|(_, p)| p)
}

/// Riot Client lockfile (`...\Riot Games\Riot Client\Config\lockfile`).
pub fn find_lockfile_path() -> Option<PathBuf> {
    newest_existing(local_appdata_candidates().iter().map(|b| {
        b.join("Riot Games")
            .join("Riot Client")
            .join("Config")
            .join("lockfile")
    }))
}

/// VALORANT game log (`...\VALORANT\Saved\Logs\ShooterGame.log`).
pub fn find_shooter_game_log() -> Option<PathBuf> {
    newest_existing(local_appdata_candidates().iter().map(|b| {
        b.join("VALORANT")
            .join("Saved")
            .join("Logs")
            .join("ShooterGame.log")
    }))
}

// ---------------------------------------------------------------------------
// Credentials straight from process command lines (lockfile-less fallback)
// ---------------------------------------------------------------------------

/// `(pid, port, password)` parsed from the Riot Client / VALORANT process arguments.
pub fn credentials_from_processes() -> Option<(u32, u16, String)> {
    static CACHE: OnceLock<Mutex<Option<(Instant, Option<(u32, u16, String)>)>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some((at, val)) = guard.as_ref() {
            let still_valid = match val {
                Some((pid, _, _)) => is_pid_alive(*pid),
                None => true,
            };
            if at.elapsed() < Duration::from_secs(4) && still_valid {
                return val.clone();
            }
        }
    }

    let result = scan_process_credentials();
    if let Ok(mut guard) = cache.lock() {
        *guard = Some((Instant::now(), result.clone()));
    }
    result
}

fn arg_value(cmd: &str, key: &str) -> Option<String> {
    let pos = cmd.find(key)?;
    let rest = &cmd[pos + key.len()..];
    let rest = rest.trim_start_matches('"');
    let end = rest
        .find(|c: char| c.is_whitespace() || c == '"')
        .unwrap_or(rest.len());
    let v = rest[..end].trim();
    if v.is_empty() {
        None
    } else {
        Some(v.to_string())
    }
}

fn scan_process_credentials() -> Option<(u32, u16, String)> {
    let procs = find_processes(&[
        "riot client.exe",
        "riotclientux.exe",
        "riotclientservices.exe",
        "valorant-win64-shipping.exe",
    ]);
    let pairs: [(&str, &str); 2] = [
        ("--app-port=", "--remoting-auth-token="),
        ("-riotclient-app-port=", "-riotclient-auth-token="),
    ];
    for (pid, _name) in procs {
        let Some(cmd) = read_process_command_line(pid) else {
            continue;
        };
        for (port_key, token_key) in pairs {
            if let (Some(port), Some(token)) =
                (arg_value(&cmd, port_key), arg_value(&cmd, token_key))
            {
                if let Ok(port) = port.parse::<u16>() {
                    return Some((pid, port, token));
                }
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// RiotClientServices.exe discovery (custom drives / cafe layouts)
// ---------------------------------------------------------------------------

fn fixed_drive_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    #[cfg(target_os = "windows")]
    unsafe {
        let mask = GetLogicalDrives();
        for i in 0..26u32 {
            if mask & (1 << i) == 0 {
                continue;
            }
            let letter = (b'A' + i as u8) as char;
            let root = format!("{}:\\", letter);
            // 2 = removable, 3 = fixed, 4 = remote (network game disks), 6 = ramdisk
            let t = GetDriveTypeW(to_wide(&root).as_ptr());
            if matches!(t, 2 | 3 | 4 | 6) {
                roots.push(PathBuf::from(root));
            }
        }
    }
    roots
}

fn exe_if_exists(p: PathBuf) -> Option<PathBuf> {
    if p.is_file() {
        Some(p)
    } else {
        None
    }
}

fn from_installs_json() -> Option<PathBuf> {
    let program_data = std::env::var("ProgramData")
        .or_else(|_| std::env::var("ALLUSERSPROFILE"))
        .unwrap_or_else(|_| "C:\\ProgramData".to_string());
    let path = Path::new(&program_data)
        .join("Riot Games")
        .join("RiotClientInstalls.json");
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    for key in ["rc_live", "rc_default", "rc_beta"] {
        if let Some(p) = json.get(key).and_then(|v| v.as_str()) {
            if let Some(found) = exe_if_exists(PathBuf::from(p)) {
                return Some(found);
            }
        }
    }
    None
}

fn from_registry() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let keys = [
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Riot Game valorant.live",
            "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Riot Game valorant.live",
            "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Riot Game valorant.live",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Riot Game Riot_Client.",
        ];
        for key in keys {
            let out = std::process::Command::new("reg")
                .args(["query", key, "/v", "UninstallString"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            let Ok(out) = out else { continue };
            let text = String::from_utf8_lossy(&out.stdout);
            let lower = text.to_lowercase();
            if let Some(end) = lower.find("riotclientservices.exe") {
                let head = &text[..end + "riotclientservices.exe".len()];
                // Path starts after the opening quote or after "REG_SZ"
                let start = head
                    .rfind('"')
                    .map(|i| i + 1)
                    .or_else(|| head.rfind("REG_SZ").map(|i| i + 6))
                    .unwrap_or(0);
                let candidate = head[start..].trim();
                if let Some(found) = exe_if_exists(PathBuf::from(candidate)) {
                    return Some(found);
                }
            }
        }
    }
    None
}

fn from_drive_scan() -> Option<PathBuf> {
    const RC: &str = "RiotClientServices.exe";
    let known_layouts: [&[&str]; 8] = [
        &["Riot Games", "Riot Client"],
        &["Games", "Riot Games", "Riot Client"],
        &["Game", "Riot Games", "Riot Client"],
        &["Program Files", "Riot Games", "Riot Client"],
        &["Program Files (x86)", "Riot Games", "Riot Client"],
        &["Riot Client"],
        &["Riot", "Riot Client"],
        &["Riot Games", "Riot Client", "RiotClient"],
    ];
    let roots = fixed_drive_roots();

    for root in &roots {
        for layout in known_layouts.iter() {
            let mut p = root.clone();
            for seg in layout.iter() {
                p.push(seg);
            }
            if let Some(found) = exe_if_exists(p.join(RC)) {
                return Some(found);
            }
        }
    }

    // Shallow scan: <drive>\<any>\Riot Client and <drive>\<any>\Riot Games\Riot Client
    for root in &roots {
        let Ok(rd) = std::fs::read_dir(root) else {
            continue;
        };
        for entry in rd.flatten() {
            let dir = entry.path();
            if !dir.is_dir() {
                continue;
            }
            for sub in [
                dir.join("Riot Client"),
                dir.join("Riot Games").join("Riot Client"),
            ] {
                if let Some(found) = exe_if_exists(sub.join(RC)) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// Locates `RiotClientServices.exe` using every known strategy. Successful results are cached.
pub fn find_riot_client_services() -> Option<PathBuf> {
    static CACHE: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some(p) = guard.as_ref() {
            if p.is_file() {
                return Some(p.clone());
            }
        }
    }

    // 1. Already running -> exact path, regardless of where it is installed
    let running = find_processes(&["riotclientservices.exe"])
        .into_iter()
        .find_map(|(pid, _)| process_image_path(pid).and_then(exe_if_exists));

    let found = running
        .or_else(from_installs_json)
        .or_else(from_registry)
        .or_else(from_drive_scan);

    if let Some(ref p) = found {
        if let Ok(mut guard) = cache.lock() {
            *guard = Some(p.clone());
        }
    }
    found
}

/// Starts the Riot Client and asks it to launch VALORANT.
pub fn spawn_valorant_via_riot_client() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // 1. Terminate any stale or zombie Riot Client processes that deadlock the splash screen
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "Riot Client.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RiotClientUx.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RiotClientServices.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        std::thread::sleep(std::time::Duration::from_millis(600));

        let rc = find_riot_client_services()
            .ok_or_else(|| "Could not locate RiotClientServices.exe on this PC".to_string())?;

        let rc_dir = rc.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("."));

        let mut cmd = std::process::Command::new(&rc);
        cmd.args(["--launch-product=valorant", "--launch-patchline=live"])
            .current_dir(&rc_dir);

        cmd.spawn()
            .map_err(|e| format!("Failed to start Riot Client ({}): {}", rc.display(), e))?;
    }
    Ok(())
}

/// Checks whether the user has "Stay signed in" enabled and active in Riot Client.
pub fn is_riot_stay_signed_in() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let settings_path = PathBuf::from(local_appdata)
                .join("Riot Games")
                .join("Riot Client")
                .join("Data")
                .join("RiotGamesPrivateSettings.yaml");
            if let Ok(content) = std::fs::read_to_string(&settings_path) {
                let has_persist = content.contains("persistent: true");
                let has_refresh = content.contains("refresh_token:");
                return has_persist && has_refresh;
            }
        }
    }
    false
}

/// Spawns Riot Client without launching product directly so the user can log in.
pub fn spawn_riot_client_for_login() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "Riot Client.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RiotClientUx.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RiotClientServices.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        std::thread::sleep(std::time::Duration::from_millis(600));

        let rc = find_riot_client_services()
            .ok_or_else(|| "Could not locate RiotClientServices.exe on this PC".to_string())?;

        let rc_dir = rc.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("."));

        let mut cmd = std::process::Command::new(&rc);
        cmd.current_dir(&rc_dir);

        cmd.spawn()
            .map_err(|e| format!("Failed to start Riot Client for login ({}): {}", rc.display(), e))?;
    }
    Ok(())
}
