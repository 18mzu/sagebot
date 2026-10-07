#ifndef COMMON_H
#define COMMON_H

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <commctrl.h>
#include <dwmapi.h>
#include <mmsystem.h>
#include <shellapi.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <uxtheme.h>
#include <wininet.h>
#include <olectl.h>

#ifdef _MSC_VER
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "uxtheme.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "winmm.lib")
#endif

// Defines & Constants
#define RUN_SECONDS 4800

#define TAB_MIN_MS 900
#define TAB_RAND_MS 400

#define SLOW_MIN_MS 3700
#define SLOW_RAND_MS 500

#define LISTENER_LOOP_MS 50
#define STOP_CHECK_MS 50
#define SUPPRESS_WINDOW_MS 80

#define LOG_DIR "log"
#define LOG_FILE "log\\log.txt"
#define CHANGELOG_FILE "changelog.txt"

// Version & Updater
#define APP_VERSION L"2.4"
#define GITHUB_API_URL L"https://api.github.com/repos/18mzu/sagebot/releases/latest"

// Custom Windows Messages
#define WM_APP_LOG (WM_USER + 2)
#define WM_APP_UPDATE_STATUS (WM_USER + 3)
#define WM_APP_UPDATE_CHECK_RESULT (WM_USER + 4)
#define WM_APP_UPDATE_DOWNLOAD_DONE (WM_USER + 5)

// Control IDs
#define ID_NAV_CHANGELOGS 1000
#define ID_NAV_MAIN 1001
#define ID_NAV_STATUS 1007
#define ID_NAV_CONFIG 1006
#define ID_NAV_CHAT 1002
#define ID_NAV_AUTO_VOTING 1003
#define ID_NAV_MUSIC 1005
#define ID_NAV_WEBHOOK 1008
#define ID_NAV_SETTINGS 1004

#define ID_RADIO_MODE_CLICK 1070
#define ID_RADIO_MODE_HOLD 1071
#define ID_RADIO_MODE_MOVE ID_RADIO_MODE_HOLD
#define ID_BTN_KEY_BADGE 1072
#define ID_BTN_DELAY_BADGE 1073
#define ID_CHK_SLOW_MODE 1074

#define ID_EDIT_WEBHOOK_URL 1080
#define ID_EDIT_WEBHOOK_USER_ID 1081
#define ID_BTN_WEBHOOK_SAVE 1082
#define ID_BTN_WEBHOOK_TEST 1083

#define ID_BTN_START_STOP 1010
#define ID_EDIT_LOG 1011
#define ID_EDIT_CHANGELOGS 1012

#define ID_CHK_CHAT 1020
#define ID_COMBO_CHAT_TARGET 1021
#define ID_MENU_CHAT_TEAM 1022
#define ID_MENU_CHAT_ALL 1028
#define ID_EDIT_CHAT_INTERVAL 1023
#define ID_EDIT_CHAT_TEXT 1024
#define ID_BTN_CHAT_SAVE 1025
#define ID_BTN_CHAT_EXAMPLE_1 1026
#define ID_BTN_CHAT_EXAMPLE_2 1027

#define ID_RADIO_VOTE_OFF 1030
#define ID_RADIO_VOTE_YES 1031
#define ID_RADIO_VOTE_NO 1032

#define ID_BTN_REBIND 1040
#define ID_BTN_CHECK_UPDATE 1041
#define HOTKEY_PLAYPAUSE_ID 101

#define ID_BTN_MUSIC_PLAY 1050
#define ID_SLIDER_MUSIC_POS 1051
#define ID_SLIDER_MUSIC_VOL 1052
#define ID_TIMER_MUSIC 1053

#define ID_TIMER_TOAST 1060
#define ID_TIMER_ROUND_UPDATE 1061

// Modern Clean Gaming Dark Palette
#define COLOR_BASE_BG RGB(26, 26, 26)        // #1a1a1a Deep dark canvas
#define COLOR_SIDEBAR_BG RGB(18, 18, 18)     // #121212 Sidebar panel
#define COLOR_CARD_BG RGB(34, 34, 34)        // #222222 Elevated card surface
#define COLOR_CARD_BORDER RGB(54, 54, 54)    // #363636 Card outline
#define COLOR_SIDEBAR_BORDER RGB(42, 42, 42) // #2a2a2a Divider line

#define COLOR_ACCENT_PURPLE RGB(138, 92, 246) // #8a5cf6 Primary active tab
#define COLOR_ACCENT_HOVER RGB(40, 40, 40)    // #282828 Sidebar item hover
#define COLOR_BTN_START RGB(34, 197, 94)      // #22c55e Emerald green start
#define COLOR_BTN_START_HVR RGB(22, 163, 74)  // #16a34a Darker green
#define COLOR_BTN_STOP RGB(239, 68, 68)       // #ef4444 Crimson red stop
#define COLOR_BTN_STOP_HVR RGB(220, 38, 38)   // #dc2626 Darker red

#define COLOR_TEXT_PRIMARY RGB(241, 245, 249)   // #f1f5f9 Crisp white
#define COLOR_TEXT_SECONDARY RGB(156, 163, 175) // #9ca3af Muted slate
#define COLOR_TEXT_MUTED RGB(107, 114, 128)     // #6b7280 Subtle helper
#define COLOR_INPUT_BG RGB(20, 20, 20)          // #141414 Dark input field

// Shared Extern Global State Variables
extern HWND g_hWnd;
extern HWND g_hEditLog;
extern HWND g_hBtnStart;
extern HWND g_hLblStatusVal;
extern HWND g_hLblHotkeyVal;
extern HWND g_hLblRoundVal;
extern HWND g_hBtnRebind;
extern HWND g_hLblUpdateStatus;

extern atomic_int g_status;
extern atomic_int g_pressed;
extern atomic_int g_listener;
extern atomic_int g_playpause_vk;
extern atomic_int g_auto_vote_mode;
extern atomic_int g_anti_afk_mode;
extern atomic_int g_anti_afk_key;
extern atomic_int g_slow_mode;
extern atomic_int g_chat_mode;
extern atomic_int g_chat_target;
extern atomic_int g_chat_interval;
extern wchar_t g_chat_text[512];
extern CRITICAL_SECTION g_chat_lock;
extern atomic_int g_suppress_hotkey;
extern atomic_int g_is_rebinding;
extern atomic_int g_is_rebinding_afk;
extern int g_current_tab;

extern wchar_t g_webhook_url[512];
extern wchar_t g_webhook_user_id[64];
extern CRITICAL_SECTION g_webhook_lock;

extern wchar_t g_config_path[MAX_PATH];

// Shared Utility Prototypes
void current_time_str_w(wchar_t *buf, size_t size);
int rand_range(int min, int extra);
void get_key_name_w(int vk, wchar_t *buf, size_t size);
void log_write(const char *text);
void log_clear_file(void);
void send_gui_log(const wchar_t *msg);
void logger(const wchar_t *action, int count);
void status_logger(const wchar_t *text);
void append_log_ui(const wchar_t *text);
void update_status_ui(void);
void draw_rounded_rect(HDC hdc, RECT *r, int radius, COLORREF fill,
                       COLORREF border, int borderWidth);

// Rebind Prototype
void trigger_rebind_capture(void);

#endif // COMMON_H
