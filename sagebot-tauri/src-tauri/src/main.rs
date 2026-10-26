// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn SetPriorityClass(h_process: *mut std::ffi::c_void, dw_priority_class: u32) -> i32;
            fn GetCurrentProcess() -> *mut std::ffi::c_void;
        }
        // 0x00004000 = BELOW_NORMAL_PRIORITY_CLASS: guarantees VALORANT gets full CPU scheduling priority
        SetPriorityClass(GetCurrentProcess(), 0x00004000);
    }
    sagebot_tauri_lib::run()
}
