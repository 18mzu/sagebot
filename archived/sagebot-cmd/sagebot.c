#include <conio.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <windows.h>

// Defines
#define RUN_SECONDS 4800

#define CONFIG_FILE_NAME "config.ini"

#define TAB_MIN_MS 900
#define TAB_RAND_MS 400

#define LISTENER_LOOP_MS 50
#define STOP_CHECK_MS 50
#define PANEL_RELOAD_MS 2000
#define STARTUP_DELAY_MS 3000
#define SUPPRESS_WINDOW_MS 80

#define UNCLE_BEN_INTERVAL_MS 180000

#define LOG_DIR "log"
#define LOG_FILE "log\\log.txt"

// Global Variables
static atomic_int g_status = 0;
static atomic_int g_pressed = 0;
static atomic_int g_listener = 0;
static atomic_int g_playpause_vk = VK_F9; // configurable via Settings
static atomic_int g_auto_vote_mode =
    0; // 0 = off, 1 = Yes (adds F5), 2 = No (adds F6)
static atomic_int g_uncle_ben_mode = 0; // 0 = off, 1 = on
static atomic_int g_suppress_hotkey =
    0; // 1 while we're simulating a key that might equal the hotkey
static char g_config_path[MAX_PATH] = CONFIG_FILE_NAME;

// Utils

static void init_config_path(void) {
  DWORD len = GetModuleFileNameA(NULL, g_config_path, MAX_PATH);
  if (len == 0 || len >= MAX_PATH) {
    strcpy(g_config_path, CONFIG_FILE_NAME);
    return;
  }
  for (int i = (int)len - 1; i >= 0; --i) {
    if (g_config_path[i] == '\\' || g_config_path[i] == '/') {
      g_config_path[i + 1] = '\0';
      break;
    }
  }
  strncat(g_config_path, CONFIG_FILE_NAME,
          MAX_PATH - strlen(g_config_path) - 1);
}

static void save_config(void) {
  char buf[32];

  sprintf(buf, "%d", atomic_load(&g_playpause_vk));
  WritePrivateProfileStringA("Settings", "PlayPause", buf, g_config_path);

  sprintf(buf, "%d", atomic_load(&g_auto_vote_mode));
  WritePrivateProfileStringA("Settings", "AutoVote", buf, g_config_path);

  sprintf(buf, "%d", atomic_load(&g_uncle_ben_mode));
  WritePrivateProfileStringA("Settings", "UncleBenQuote", buf, g_config_path);
}

static void load_config(void) {
  int playpause =
      GetPrivateProfileIntA("Settings", "PlayPause", VK_F9, g_config_path);

  int autovote =
      GetPrivateProfileIntA("Settings", "AutoVote", 0, g_config_path);

  int uncleben =
      GetPrivateProfileIntA("Settings", "UncleBenQuote", 0, g_config_path);

  if (playpause < 8 || playpause > 254 || playpause == VK_LBUTTON ||
      playpause == VK_RBUTTON || playpause == VK_MBUTTON) {
    playpause = VK_F9;
  }
  if (autovote < 0 || autovote > 2) {
    autovote = 0;
  }
  if (uncleben < 0 || uncleben > 1) {
    uncleben = 0;
  }

  atomic_store(&g_playpause_vk, playpause);
  atomic_store(&g_auto_vote_mode, autovote);
  atomic_store(&g_uncle_ben_mode, uncleben);
}
static void create_default_config(void) {
  DWORD attr = GetFileAttributesA(g_config_path);

  if (attr == INVALID_FILE_ATTRIBUTES) {
    save_config();
  }
}

static void current_time_str(char *buf, size_t size) {
  SYSTEMTIME st;
  GetLocalTime(&st);
  int h = st.wHour % 12;
  if (h == 0)
    h = 12;
  snprintf(buf, size, "%02d:%02d:%02d%s", h, st.wMinute, st.wSecond,
           st.wHour < 12 ? "AM" : "PM");
}

static int rand_range(int min, int extra) {
  return min + (rand() % (extra + 1));
}

static void flush_input() {
  FlushConsoleInputBuffer(GetStdHandle(STD_INPUT_HANDLE));
  while (_kbhit())
    _getch();
}

// change from a vk to a readable name
static void get_key_name(int vk, char *buf, size_t size) {
  LONG scan = (LONG)MapVirtualKeyA((UINT)vk, MAPVK_VK_TO_VSC) << 16;
  if (!scan || !GetKeyNameTextA(scan, buf, (int)size)) {
    snprintf(buf, size, "VK_0x%02X", vk);
  }
}

// capture a key using for hotkey change
static int capture_key_press(void) {
  for (int vk = 8; vk <= 254; vk++)
    GetAsyncKeyState(vk); // clear stale "was pressed" latches
  Sleep(50);
  while (1) {
    for (int vk = 8; vk <= 254; vk++) {
      if (vk == VK_LBUTTON || vk == VK_RBUTTON || vk == VK_MBUTTON)
        continue;
      if (GetAsyncKeyState(vk) & 0x8000)
        return vk;
    }
    Sleep(20);
  }
}

// Sleep in small chunks so we notice the hotkey almost immediately instead
// of waiting out the whole interval. Returns 1 if it fired during the wait.
static int interruptible_sleep(int total_ms) {
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

// Logs

static void check_files() {
  CreateDirectoryA(LOG_DIR, NULL);
  FILE *f = fopen(LOG_FILE, "a");
  if (f)
    fclose(f);
}

static void log_write(const char *text) {
  check_files();
  FILE *f = fopen(LOG_FILE, "a");
  if (f) {
    fprintf(f, "%s\n", text);
    fclose(f);
  }
}

static void logger(const char *ts, const char *action, int count) {
  char buf[256];
  snprintf(buf, sizeof(buf), "[%s] action: %s -> %d", ts, action, count);
  log_write(buf);
}

static void status_logger(const char *text) { log_write(text); }

// Keyboard

static void send_key_press(WORD vk) {
  INPUT inp = {0};
  inp.type = INPUT_KEYBOARD;
  inp.ki.wVk = vk;
  SendInput(1, &inp, sizeof(INPUT));
  Sleep(50 + rand() % 50);
  inp.ki.dwFlags = KEYEVENTF_KEYUP;
  SendInput(1, &inp, sizeof(INPUT));
}

// just an extra layer to avoid same hotkey
static void send_extra_key(WORD vk) {
  int is_hotkey = ((int)vk == atomic_load(&g_playpause_vk));
  if (is_hotkey)
    atomic_store(&g_suppress_hotkey, 1);
  send_key_press(vk);
  if (is_hotkey) {
    Sleep(SUPPRESS_WINDOW_MS);
    atomic_store(&g_suppress_hotkey, 0);
  }
}

static void copy_to_clipboard(const char *text) {
  if (!OpenClipboard(NULL))
    return;
  EmptyClipboard();
  size_t len = strlen(text) + 1;
  HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, len);
  if (hMem) {
    memcpy(GlobalLock(hMem), text, len);
    GlobalUnlock(hMem);
    SetClipboardData(CF_TEXT, hMem);
  }
  CloseClipboard();
}

static void send_paste_action(void) {
  INPUT inputs[4] = {0};

  inputs[0].type = INPUT_KEYBOARD;
  inputs[0].ki.wVk = VK_CONTROL;

  inputs[1].type = INPUT_KEYBOARD;
  inputs[1].ki.wVk = 'V';

  inputs[2].type = INPUT_KEYBOARD;
  inputs[2].ki.wVk = 'V';
  inputs[2].ki.dwFlags = KEYEVENTF_KEYUP;

  inputs[3].type = INPUT_KEYBOARD;
  inputs[3].ki.dwFlags = KEYEVENTF_KEYUP;
  inputs[3].ki.wVk = VK_CONTROL;

  SendInput(4, inputs, sizeof(INPUT));
}

// Thread

DWORD WINAPI hotkey_thread(LPVOID param) {
  (void)param;
  int was_down = 0;
  while (1) {
    if (atomic_load(&g_listener)) {
      int vk = atomic_load(&g_playpause_vk);
      int down = (GetAsyncKeyState(vk) & 0x8000) != 0;

      if (atomic_load(&g_suppress_hotkey)) {
        // We're the ones pressing this key right now — track state
        // but don't fire, so our own Auto Vote key press can't
        // masquerade as a manual stop/start.
        was_down = down;
      } else {
        // Rising edge only — fire once per physical keypress
        if (down && !was_down)
          atomic_store(&g_pressed, 1);
        was_down = down;
      }
    } else {
      was_down = 0; // reset edge state when not listening
    }
    Sleep(LISTENER_LOOP_MS);
  }
  return 0;
}

// Input helpers

static int read_menu_choice(int max_option) {
  flush_input();
  while (1) {
    if (_kbhit()) {
      int c = _getch();
      if (c >= '1' && c <= ('0' + max_option))
        return c - '0';
    }
    Sleep(30);
  }
}

// UI

static void print_main_menu(void) {
  system("cls");
  SetConsoleTitleA("sagebot");
  printf("SageBot v1.1\n\n");
  printf("  [1]  Start\n");
  printf("  [2]  Settings\n");
  printf("  [3]  Exit\n\n> ");
}

static void load_start_panel(void) {
  char keyname[32];
  get_key_name(atomic_load(&g_playpause_vk), keyname, sizeof(keyname));

  system("cls");
  SetConsoleTitleA("sagebot");
  printf("SageBot v1.1\n\n");
  printf("\nPress %s to start.\n", keyname);
  printf("Press %s again to stop.\n", keyname);
  printf("Press ESC to return to menu.\n");
  printf("Close this window to exit.\n\n> ");
}

static int wait_for_start_or_back(void) {
  while (1) {
    if (atomic_load(&g_pressed))
      return 1;
    if (_kbhit()) {
      int c = _getch();
      if (c == 27)
        return 0; // ESC
    }
    Sleep(LISTENER_LOOP_MS);
  }
}

static void change_playpause_key(void) {
  system("cls");
  SetConsoleTitleA("settings");
  printf("SageBot v1.1 - Settings\n\n");
  printf("Press any key to set as the new Play/Pause key...\n");
  flush_input();

  while (1) {
    int vk = capture_key_press();
    if (vk == VK_F5 || vk == VK_F6) {
      char keyname[32];
      get_key_name(vk, keyname, sizeof(keyname));
      printf(
          "\n%s cannot be used as the Play/Pause key. Press another key...\n",
          keyname);
      Sleep(1000);
      continue;
    }

    atomic_store(&g_playpause_vk, vk);
    save_config();

    char keyname[32];
    get_key_name(vk, keyname, sizeof(keyname));
    printf("\nPlay/Pause key set to: %s\n", keyname);
    Sleep(1200);
    break;
  }
}

static void show_autovote_menu(void) {
  system("cls");
  SetConsoleTitleA("sagebot - auto vote");
  printf("SageBot v1.1 - Auto Vote\n\n");
  printf("Automatically vote for Surrender.\n\n");
  printf("  [1]  Yes (Surrender) - adds F5\n");
  printf("  [2]  No - adds F6\n");
  printf("  [3]  Deactivate\n\n> ");

  int choice = read_menu_choice(3);
  if (choice == 1)
    atomic_store(&g_auto_vote_mode, 1);
  else if (choice == 2)
    atomic_store(&g_auto_vote_mode, 2);
  else
    atomic_store(&g_auto_vote_mode, 0);
  save_config();

  printf("\nSaved. Returning to main menu...\n");
  Sleep(1000);
}

static void show_uncle_ben_menu(void) {
  system("cls");
  SetConsoleTitleA("sagebot - uncle ben's quote");
  printf("SageBot v1.1 - Uncle Ben's Quote\n\n");
  printf("Auto send in Chat the Famous from Uncle Ben each 180 seconds.\n\n");
  printf("  [1]  Activate\n");
  printf("  [2]  Deactivate\n\n> ");

  int choice = read_menu_choice(2);
  if (choice == 1)
    atomic_store(&g_uncle_ben_mode, 1);
  else
    atomic_store(&g_uncle_ben_mode, 0);
  save_config();

  printf("\nSaved. Returning to main menu...\n");
  Sleep(1000);
}

static void show_settings_menu(void) {
  while (1) {
    char keyname[32];
    get_key_name(atomic_load(&g_playpause_vk), keyname, sizeof(keyname));

    int mode = atomic_load(&g_auto_vote_mode);
    const char *vote_str = mode == 1   ? "Yes (F5)"
                           : mode == 2 ? "No (F6)"
                                       : "Deactivated";

    int uncle_ben = atomic_load(&g_uncle_ben_mode);
    const char *uncle_ben_str = uncle_ben == 1 ? "Activated" : "Deactivated";

    system("cls");
    SetConsoleTitleA("sagebot - settings");
    printf("SageBot v1.1 - Settings\n\n");
    printf("Play/Pause key    : %s\n", keyname);
    printf("Auto Vote         : %s\n", vote_str);
    printf("Uncle Ben's Quote : %s\n\n", uncle_ben_str);
    printf("  [1]  Change Play/Pause Key\n");
    printf("  [2]  Auto Vote\n");
    printf("  [3]  Uncle Ben's Quote\n");
    printf("  [4]  Back to Menu\n\n> ");

    int choice = read_menu_choice(4);
    if (choice == 1) {
      change_playpause_key();
      // loop back around to show the Settings menu again
    } else if (choice == 2) {
      show_autovote_menu();
      return; // Auto Vote always drops back to the main menu
    } else if (choice == 3) {
      show_uncle_ben_menu();
      return; // Drops back to main menu
    } else {
      return; // Back to Menu
    }
  }
}

static int run_tab_spammer(void) {
  char ts[32], logbuf[128];
  current_time_str(ts, sizeof(ts));

  printf("\n[%s] SageBot started.\n", ts);
  printf("[%s] Created logs at: %s\n", ts, LOG_FILE);

  snprintf(logbuf, sizeof(logbuf), "[%s] SageBot started.", ts);
  status_logger(logbuf);

  ULONGLONG start_tick = GetTickCount64();
  ULONGLONG last_quote_tick = 0;
  int count = 0;
  atomic_store(&g_status, 1);

  while (atomic_load(&g_status)) {
    int interval = rand_range(TAB_MIN_MS, TAB_RAND_MS);

    if (interruptible_sleep(interval)) {
      atomic_store(&g_pressed, 0);
      current_time_str(ts, sizeof(ts));
      snprintf(logbuf, sizeof(logbuf), "[%s] SageBot stopped (hotkey)", ts);
      status_logger(logbuf);
      printf("\n[%s] Stopped by hotkey\n", ts);
      atomic_store(&g_status, 0);
      return 1;
    }

    // Time limit
    ULONGLONG elapsed = (GetTickCount64() - start_tick) / 1000;
    if (elapsed >= RUN_SECONDS) {
      current_time_str(ts, sizeof(ts));
      snprintf(logbuf, sizeof(logbuf),
               "[%s] SageBot stopped (time limit reached)", ts);
      status_logger(logbuf);
      printf("\n[%s] Time limit reached.\n", ts);
      atomic_store(&g_status, 0);
      return 0;
    }

    send_key_press(VK_TAB);
    current_time_str(ts, sizeof(ts));
    logger(ts, "TAB", count++);

    int mode = atomic_load(&g_auto_vote_mode);
    if (mode == 1)
      send_extra_key(VK_F5);
    else if (mode == 2)
      send_extra_key(VK_F6);

    ULONGLONG now = GetTickCount64();
    if (atomic_load(&g_uncle_ben_mode) == 1 &&
        (last_quote_tick == 0 ||
         (now - last_quote_tick) >= UNCLE_BEN_INTERVAL_MS)) {
      last_quote_tick = now;
      send_extra_key(VK_RETURN);
      copy_to_clipboard("With great Power comes great Responsibility");
      send_paste_action();
      Sleep(50 + rand() % 50);
      send_extra_key(VK_RETURN);
      current_time_str(ts, sizeof(ts));
      logger(ts, "UNCLE_BEN_QUOTE", count++);
    }
  }
  return 0;
}

void set_color(int color) {
  SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), color);
}

static void run_start_once(void) {
  atomic_store(&g_listener, 1);

  while (1) {
    atomic_store(&g_pressed, 0);
    atomic_store(&g_status, 0);

    load_start_panel();
    flush_input();

    if (!wait_for_start_or_back())
      break;
    atomic_store(&g_pressed, 0);

    int stopped_by_hotkey = run_tab_spammer();
    atomic_store(&g_pressed, 0);
    flush_input();

    if (stopped_by_hotkey) {
      printf(
          "[Paused] Press Play/Pause to resume, or ESC to return to menu.\n");
    } else {
      printf("[Done] Press Play/Pause to start again, or ESC to return to "
             "menu.\n");
    }
    Sleep(PANEL_RELOAD_MS);
  }

  atomic_store(&g_listener, 0);
  atomic_store(&g_pressed, 0);
  flush_input();
}

int main(void) {
  // YAP
  SetConsoleTitleA("sagebot.exe");
  system("cls");
  set_color(12); // Red
  printf("DISCLAIMER:\n");
  set_color(7); // White
  printf("I do not take any responsible for your account suspensions.\nYou "
         "have been warned. ");
  for (int i = 3; i > 0; i--) {
    printf("%d", i);
    fflush(stdout);
    Sleep(1000);
    printf("\b \b");
  } // just an extra layer to avoid same hotkey

  printf("\n");
  printf("\nProceed? [Y/N]: ");

  char choice;
  while (1) {
    if (_kbhit()) {
      choice = (char)_getch();
      if (choice == 'y' || choice == 'Y') {
        break;
      } else if (choice == 'n' || choice == 'N') {
        printf("\nExiting...");
        Sleep(500);
        system("cls");
        return 0;
      }
    }
    Sleep(50);
  }

  // FINALLY START
  srand((unsigned)time(NULL));

  system("cls");
  SetConsoleTitleA("sagebot");
  printf("Initializing...\n");
  Sleep(STARTUP_DELAY_MS);

  check_files();
  init_config_path();
  create_default_config();
  load_config();

  FILE *log = fopen(LOG_FILE, "w");
  if (log) {
    char ts[32];
    current_time_str(ts, sizeof(ts));
    fprintf(log, "[%s] sagebot is ready.\n", ts);
    fclose(log);
  }

  HANDLE hHotkeyThread = CreateThread(NULL, 0, hotkey_thread, NULL, 0, NULL);
  if (hHotkeyThread)
    CloseHandle(hHotkeyThread);

  while (1) {
    print_main_menu();
    int choice_num = read_menu_choice(3);

    if (choice_num == 1) {
      run_start_once();
    } else if (choice_num == 2) {
      show_settings_menu();
    } else {
      printf("\nExiting...");
      Sleep(500);
      system("cls");
      break;
    }
  }

  return 0;
}