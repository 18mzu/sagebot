#include "spammer.h"
#include "config.h"

static HANDLE g_hSpammerThread = NULL;

// Key Injection Helpers
void send_key_down(WORD vk) {
  INPUT inp = {0};
  inp.type = INPUT_KEYBOARD;
  inp.ki.wVk = vk;
  inp.ki.wScan = (WORD)MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
  inp.ki.dwFlags = 0;
  SendInput(1, &inp, sizeof(INPUT));
}

void send_key_up(WORD vk) {
  INPUT inp = {0};
  inp.type = INPUT_KEYBOARD;
  inp.ki.wVk = vk;
  inp.ki.wScan = (WORD)MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
  inp.ki.dwFlags = KEYEVENTF_KEYUP;
  SendInput(1, &inp, sizeof(INPUT));
}

void send_key_press(WORD vk) {
  send_key_down(vk);
  Sleep(50 + rand() % 50);
  send_key_up(vk);
}

void send_extra_key(WORD vk) {
  int is_hotkey = ((int)vk == atomic_load(&g_playpause_vk));
  if (is_hotkey)
    atomic_store(&g_suppress_hotkey, 1);
  send_key_press(vk);
  if (is_hotkey) {
    Sleep(SUPPRESS_WINDOW_MS);
    atomic_store(&g_suppress_hotkey, 0);
  }
}

int copy_to_clipboard_w(const wchar_t *text) {
  if (!OpenClipboard(NULL))
    return 0;
  EmptyClipboard();
  size_t len = (wcslen(text) + 1) * sizeof(wchar_t);
  HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, len);
  if (hMem) {
    memcpy(GlobalLock(hMem), text, len);
    GlobalUnlock(hMem);
    SetClipboardData(CF_UNICODETEXT, hMem);
  }
  CloseClipboard();
  return hMem != NULL;
}

void send_paste_action(void) {
  INPUT inputs[4] = {0};
  inputs[0].type = INPUT_KEYBOARD;
  inputs[0].ki.wVk = VK_CONTROL;

  inputs[1].type = INPUT_KEYBOARD;
  inputs[1].ki.wVk = 'V';

  inputs[2].type = INPUT_KEYBOARD;
  inputs[2].ki.wVk = 'V';
  inputs[2].ki.dwFlags = KEYEVENTF_KEYUP;

  inputs[3].type = INPUT_KEYBOARD;
  inputs[3].ki.wVk = VK_CONTROL;
  inputs[3].ki.dwFlags = KEYEVENTF_KEYUP;

  SendInput(4, inputs, sizeof(INPUT));
}

void send_chat_message(void) {
  wchar_t local_text[512];
  wchar_t final_text[540];

  EnterCriticalSection(&g_chat_lock);
  wcscpy_s(local_text, 512, g_chat_text);
  LeaveCriticalSection(&g_chat_lock);

  if (local_text[0] == L'\0')
    return;

  if (atomic_load(&g_chat_target) == 1) {
    swprintf_s(final_text, 540, L"/all %s", local_text);
  } else {
    wcscpy_s(final_text, 540, local_text);
  }

  if (!copy_to_clipboard_w(final_text))
    return;

  send_extra_key(VK_RETURN);
  Sleep(60 + rand() % 40);

  send_paste_action();
  Sleep(70 + rand() % 50);
  send_extra_key(VK_RETURN);
}

int interruptible_sleep(int total_ms) {
  int waited = 0;
  while (waited < total_ms) {
    if (atomic_load(&g_pressed))
      return 1;
    int chunk = (total_ms - waited < STOP_CHECK_MS) ? (total_ms - waited)
                                                    : STOP_CHECK_MS;
    Sleep(chunk);
    waited += chunk;
  }
  return atomic_load(&g_pressed);
}

// Dedicated Hotkey Listener (Hardware-level query, works across all games and fullscreen modes)
DWORD WINAPI hotkey_thread(LPVOID param) {
  (void)param;
  int was_down = 0;
  while (atomic_load(&g_listener)) {
    int vk = atomic_load(&g_playpause_vk);
    int down = (GetAsyncKeyState(vk) & 0x8000) != 0;

    if (atomic_load(&g_suppress_hotkey)) {
      was_down = down;
    } else {
      if (down && !was_down) {
        atomic_store(&g_pressed, 1);
        PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 1, 0);
      }
      was_down = down;
    }
    Sleep(LISTENER_LOOP_MS);
  }
  return 0;
}

// Temporary short-lived rebind capture thread
static HANDLE g_hRebindThread = NULL;

static DWORD WINAPI rebind_thread_proc(LPVOID param) {
  (void)param;
  // Flush previous key states
  for (int vk = 8; vk <= 254; vk++) {
    GetAsyncKeyState(vk);
  }
  Sleep(80);

  while (atomic_load(&g_is_rebinding) || atomic_load(&g_is_rebinding_afk)) {
    if (atomic_load(&g_is_rebinding)) {
      for (int vk = 8; vk <= 254; vk++) {
        if (vk == VK_LBUTTON || vk == VK_RBUTTON || vk == VK_MBUTTON)
          continue;
        if (GetAsyncKeyState(vk) & 0x8000) {
          if (vk == VK_ESCAPE) {
            atomic_store(&g_is_rebinding, 0);
            while (GetAsyncKeyState(VK_ESCAPE) & 0x8000)
              Sleep(20);
            PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
            return 0;
          }
          if (vk == VK_F5 || vk == VK_F6) {
            send_gui_log(L"[SYSTEM] F5 and F6 are reserved for Auto-Vote and "
                         L"cannot be Play/Pause.");
            Sleep(400);
            break;
          }
          atomic_store(&g_playpause_vk, vk);
          save_config();
          while (GetAsyncKeyState(vk) & 0x8000) {
            Sleep(20);
          }
          atomic_store(&g_is_rebinding, 0);
          wchar_t kname[32];
          get_key_name_w(vk, kname, 32);
          wchar_t logmsg[128];
          swprintf_s(logmsg, 128, L"[CONFIG] Start/Stop hotkey set to: %s", kname);
          send_gui_log(logmsg);
          PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
          return 0;
        }
      }
      Sleep(25);
      continue;
    }

    if (atomic_load(&g_is_rebinding_afk)) {
      for (int vk = 8; vk <= 254; vk++) {
        if (vk == VK_LBUTTON || vk == VK_RBUTTON || vk == VK_MBUTTON)
          continue;
        if (GetAsyncKeyState(vk) & 0x8000) {
          if (vk == VK_ESCAPE) {
            atomic_store(&g_is_rebinding_afk, 0);
            while (GetAsyncKeyState(VK_ESCAPE) & 0x8000)
              Sleep(20);
            PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
            return 0;
          }
          if (vk == atomic_load(&g_playpause_vk)) {
            send_gui_log(L"[CONFIG] Key conflicts with Start/Stop hotkey. Choose another key.");
            Sleep(400);
            break;
          }
          atomic_store(&g_anti_afk_key, vk);
          save_config();
          while (GetAsyncKeyState(vk) & 0x8000) {
            Sleep(20);
          }
          atomic_store(&g_is_rebinding_afk, 0);
          wchar_t kname[32];
          get_key_name_w(vk, kname, 32);
          wchar_t logmsg[128];
          swprintf_s(logmsg, 128, L"[CONFIG] Anti-AFK clicking key set to: %s", kname);
          send_gui_log(logmsg);
          PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
          return 0;
        }
      }
      Sleep(25);
      continue;
    }
  }

  return 0;
}

void trigger_rebind_capture(void) {
  if (g_hRebindThread) {
    DWORD exitCode = 0;
    if (GetExitCodeThread(g_hRebindThread, &exitCode) && exitCode == STILL_ACTIVE) {
      return;
    }
    CloseHandle(g_hRebindThread);
    g_hRebindThread = NULL;
  }
  g_hRebindThread = CreateThread(NULL, 0, rebind_thread_proc, NULL, 0, NULL);
}

DWORD WINAPI spammer_thread_proc(LPVOID param) {
  (void)param;
  status_logger(L"SageBot started.");

  ULONGLONG start_tick = GetTickCount64();
  ULONGLONG last_chat_tick = 0;
  int count = 0;
  int afk_mode = atomic_load(&g_anti_afk_mode);
  int afk_key = atomic_load(&g_anti_afk_key);
  if (afk_key <= 0)
    afk_key = VK_TAB;

  wchar_t key_name[16];
  get_key_name_w(afk_key, key_name, 16);

  int is_holding = 0;
  if (afk_mode == 1) {
    // Hold Mode: press key down continuously
    send_key_down((WORD)afk_key);
    is_holding = 1;
    wchar_t holdMsg[64];
    swprintf_s(holdMsg, 64, L"Hold Mode: Holding down key %s", key_name);
    status_logger(holdMsg);
  }

  while (atomic_load(&g_status)) {
    ULONGLONG elapsed = (GetTickCount64() - start_tick) / 1000;
    if (elapsed >= RUN_SECONDS) {
      status_logger(L"Stopped SageBot");
      atomic_store(&g_status, 0);
      PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
      break;
    }

    if (afk_mode == 1) {
      // HOLD MODE
      int mode = atomic_load(&g_auto_vote_mode);
      if (mode == 1)
        send_extra_key(VK_F5);
      else if (mode == 2)
        send_extra_key(VK_F6);

      ULONGLONG now = GetTickCount64();
      int chat_sec = atomic_load(&g_chat_interval);
      if (chat_sec < 1)
        chat_sec = 60;
      ULONGLONG chat_interval_ms = (ULONGLONG)chat_sec * 1000;

      if (atomic_load(&g_chat_mode) == 1 &&
          (last_chat_tick == 0 ||
           (now - last_chat_tick) >= chat_interval_ms)) {
        last_chat_tick = now;
        send_key_up((WORD)afk_key);
        Sleep(50);
        send_chat_message();
        logger(L"CHAT_MESSAGE", count++);
        Sleep(50);
        send_key_down((WORD)afk_key);
      }

      if (interruptible_sleep(100)) {
        break;
      }
    } else {
      // CLICK MODE
      int interval = atomic_load(&g_slow_mode)
                         ? rand_range(SLOW_MIN_MS, SLOW_RAND_MS)
                         : rand_range(TAB_MIN_MS, TAB_RAND_MS);

      if (interruptible_sleep(interval)) {
        atomic_store(&g_pressed, 0);
        atomic_store(&g_status, 0);
        PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
        break;
      }

      send_key_press((WORD)afk_key);
      logger(key_name, count++);

      int mode = atomic_load(&g_auto_vote_mode);
      if (mode == 1)
        send_extra_key(VK_F5);
      else if (mode == 2)
        send_extra_key(VK_F6);

      ULONGLONG now = GetTickCount64();
      int chat_sec = atomic_load(&g_chat_interval);
      if (chat_sec < 1)
        chat_sec = 60;
      ULONGLONG chat_interval_ms = (ULONGLONG)chat_sec * 1000;

      if (atomic_load(&g_chat_mode) == 1 &&
          (last_chat_tick == 0 ||
           (now - last_chat_tick) >= chat_interval_ms)) {
        last_chat_tick = now;
        send_chat_message();
        logger(L"CHAT_MESSAGE", count++);
      }
    }
  }

  if (is_holding) {
    send_key_up((WORD)afk_key);
    is_holding = 0;
  }

  PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
  return 0;
}

void start_spammer(void) {
  if (atomic_load(&g_status))
    return;
  if (g_hEditLog)
    SetWindowTextW(g_hEditLog, L"");
  log_clear_file();
  status_logger(L"Logs cleared.");

  atomic_store(&g_status, 1);
  atomic_store(&g_pressed, 0);
  g_hSpammerThread = CreateThread(NULL, 0, spammer_thread_proc, NULL, 0, NULL);
  update_status_ui();
}

void stop_spammer(void) {
  if (!atomic_load(&g_status))
    return;
  atomic_store(&g_status, 0);
  atomic_store(&g_pressed, 1);
  int afk_key = atomic_load(&g_anti_afk_key);
  if (afk_key <= 0)
    afk_key = VK_TAB;
  send_key_up((WORD)afk_key);
  update_status_ui();
  status_logger(L"Stopped SageBot");
}

