#include "common.h"
#include "config.h"
#include "audio.h"
#include "spammer.h"
#include "ui_slider.h"
#include "updater.h"
#include "round_tracker.h"
#include "webhook.h"

// Global State Variables
HWND g_hWnd = NULL;
static HWND g_hNavMain = NULL;
static HWND g_hNavConfig = NULL;
static HWND g_hNavChat = NULL;
static HWND g_hNavAutoVoting = NULL;
static HWND g_hNavMusic = NULL;
static HWND g_hNavWebhook = NULL;
static HWND g_hNavChangelogs = NULL;
static HWND g_hNavSettings = NULL;

// Config Tab Controls (Anti-AFK Method)
static HWND g_hLblConfigHeader = NULL;
static HWND g_hLblConfigSub = NULL;
static HWND g_hRadioModeClick = NULL;
static HWND g_hRadioModeMove = NULL;
static HWND g_hLblClickSettingsTitle = NULL;
static HWND g_hLblClickSettingsSub = NULL;
static HWND g_hLblClickKeyTitle = NULL;
static HWND g_hBtnKeyBadge = NULL;
static HWND g_hLblIntervalTitle = NULL;
static HWND g_hBtnDelayBadge = NULL;
static HWND g_hLblIntervalNote = NULL;
static HWND g_hLblSlowModeTitle = NULL;
static HWND g_hChkSlowMode = NULL;
static HWND g_hLblSlowModeDesc = NULL;

// Main Tab Controls
static HWND g_hLblStatusTitle = NULL;
HWND g_hLblStatusVal = NULL;
static HWND g_hLblHotkeyTitle = NULL;
HWND g_hLblHotkeyVal = NULL;
static HWND g_hLblRoundTitle = NULL;
HWND g_hLblRoundVal = NULL;
HWND g_hBtnStart = NULL;
HWND g_hEditLog = NULL;

// Changelogs Tab Control
static HWND g_hEditChangelogs = NULL;

// Chat Tab Controls
static HWND g_hLblChatHeader = NULL;
static HWND g_hLblChatDescription = NULL;
static HWND g_hChkChat = NULL;
static HWND g_hLblChatToggle = NULL;
static HWND g_hLblChatChannel = NULL;
static HWND g_hBtnChatChannel = NULL;
static HWND g_hLblChatInterval = NULL;
static HWND g_hEditChatInterval = NULL;
static HWND g_hLblChatText = NULL;
static HWND g_hLblChatCharCount = NULL;
static HWND g_hEditChatText = NULL;
static HWND g_hLblPresets = NULL;
static HWND g_hBtnChatExample1 = NULL;
static HWND g_hBtnChatExample2 = NULL;

// Toast Notification State
static int g_show_toast = 0;
static wchar_t g_toast_text[64] = L"";

// Auto-Vote Tab Controls
static HWND g_hLblVoteHeader = NULL;
static HWND g_hLblVoteSub = NULL;
static HWND g_hRadioVoteOff = NULL;
static HWND g_hRadioVoteYes = NULL;
static HWND g_hRadioVoteNo = NULL;

// Settings Tab Controls
static HWND g_hLblSettingsHeader = NULL;
static HWND g_hLblSettingsHelp = NULL;
static HWND g_hLblSettingsKeyTitle = NULL;
HWND g_hBtnRebind = NULL;
static HWND g_hLblUpdateHeader = NULL;
static HWND g_hLblUpdateVersion = NULL;
static HWND g_hBtnCheckUpdate = NULL;
HWND g_hLblUpdateStatus = NULL;

// Status Tab Controls
static HWND g_hNavStatus = NULL;
static HWND g_hLblBox1Header = NULL;
static HWND g_hLblRiotIdTitle = NULL;
static HWND g_hLblRiotIdVal = NULL;
static HWND g_hLblRankTitle = NULL;
static HWND g_hLblRankVal = NULL;
static HWND g_hLblBox2Header = NULL;
static HWND g_hLblMapTitle = NULL;
static HWND g_hLblMapVal = NULL;
static HWND g_hLblGamemodeTitle = NULL;
static HWND g_hLblGamemodeVal = NULL;
static HWND g_hLblPhaseTitle = NULL;
static HWND g_hLblPhaseVal = NULL;
static HWND g_hLblAgentTitle = NULL;
static HWND g_hLblAgentVal = NULL;

// Webhook Tab Controls
static HWND g_hLblWebhookHeader = NULL;
static HWND g_hLblWebhookSub = NULL;
static HWND g_hLblWebhookUrl = NULL;
static HWND g_hLblWebhookUrlNote = NULL;
static HWND g_hEditWebhookUrl = NULL;
static HWND g_hLblWebhookUserId = NULL;
static HWND g_hLblWebhookUserIdNote = NULL;
static HWND g_hEditWebhookUserId = NULL;
static HWND g_hLblWebhookHint = NULL;
static HWND g_hBtnWebhookSave = NULL;
static HWND g_hBtnWebhookTest = NULL;
static HWND g_hLblWebhookStatus = NULL;

wchar_t g_webhook_url[512] = L"";
wchar_t g_webhook_user_id[64] = L"";
CRITICAL_SECTION g_webhook_lock;

// Styling Brushes & Fonts
static HBRUSH g_hBaseBgBrush = NULL;
static HBRUSH g_hSidebarBgBrush = NULL;
static HBRUSH g_hCardBgBrush = NULL;
static HBRUSH g_hInputBgBrush = NULL;

static HICON g_hAppIcon = NULL;

static HFONT g_hFontBrand = NULL;
static HFONT g_hFontTitle = NULL;
static HFONT g_hFontHeader = NULL;
static HFONT g_hFontNormal = NULL;
static HFONT g_hFontSmall = NULL;
static HFONT g_hFontMonospace = NULL;
static HFONT g_hFontStatusLabel = NULL;
static HFONT g_hFontStatusValue = NULL;

atomic_int g_status = 0;
atomic_int g_pressed = 0;
atomic_int g_listener = 1;
atomic_int g_playpause_vk = VK_F9;
atomic_int g_auto_vote_mode = 0;
atomic_int g_anti_afk_mode = 0;
atomic_int g_anti_afk_key = VK_TAB;
atomic_int g_slow_mode = 0;
atomic_int g_chat_mode = 0;
atomic_int g_chat_target = 0;
atomic_int g_chat_interval = 180;
wchar_t g_chat_text[512] = L"With great Power comes great Responsibility";
CRITICAL_SECTION g_chat_lock;
atomic_int g_suppress_hotkey = 0;
atomic_int g_is_rebinding = 0;
atomic_int g_is_rebinding_afk = 0;
int g_current_tab = 0;

wchar_t g_config_path[MAX_PATH] = L"config.ini";
static HANDLE g_hHotkeyThread = NULL;

// Forward Declarations
void append_log_ui(const wchar_t *text);
void update_status_ui(void);
static void switch_tab(int tab_id);
static void load_changelog_ui(void);
static void handle_draw_item(HWND hWnd, const DRAWITEMSTRUCT *pDIS);

void append_log_ui(const wchar_t *text) {
  if (!g_hEditLog)
    return;
  int len = GetWindowTextLengthW(g_hEditLog);
  SendMessageW(g_hEditLog, EM_SETSEL, (WPARAM)len, (LPARAM)len);
  SendMessageW(g_hEditLog, EM_REPLACESEL, FALSE, (LPARAM)text);
  SendMessageW(g_hEditLog, EM_REPLACESEL, FALSE, (LPARAM)L"\r\n");
}

void update_status_ui(void) {
  wchar_t keyname[32];
  get_key_name_w(atomic_load(&g_playpause_vk), keyname, 32);

  int is_running = atomic_load(&g_status);
  int is_rebinding = atomic_load(&g_is_rebinding);

  if (is_running) {
    SetWindowTextW(g_hLblStatusVal, L"RUNNING");
    SetWindowTextW(g_hBtnStart, L"⏹  STOP SAGEBOT");
  } else {
    SetWindowTextW(g_hLblStatusVal, L"STOPPED");
    SetWindowTextW(g_hBtnStart, L"▶  START SAGEBOT");
  }
  SetWindowTextW(g_hLblHotkeyVal, keyname);

  if (is_rebinding) {
    SetWindowTextW(g_hBtnRebind, L"Press Key...");
  } else {
    SetWindowTextW(g_hBtnRebind, keyname);
  }

  wchar_t afkKeyName[32];
  get_key_name_w(atomic_load(&g_anti_afk_key), afkKeyName, 32);
  if (atomic_load(&g_is_rebinding_afk)) {
    SetWindowTextW(g_hBtnKeyBadge, L"Press...");
  } else {
    SetWindowTextW(g_hBtnKeyBadge, afkKeyName);
  }

  InvalidateRect(g_hBtnStart, NULL, TRUE);
  InvalidateRect(g_hBtnRebind, NULL, TRUE);
  InvalidateRect(g_hBtnKeyBadge, NULL, TRUE);
  InvalidateRect(g_hLblStatusVal, NULL, TRUE);
  InvalidateRect(g_hLblHotkeyVal, NULL, TRUE);

  wchar_t roundText[64];
  get_round_display_text(roundText, 64);
  if (g_hLblRoundVal) {
    SetWindowTextW(g_hLblRoundVal, roundText);
    InvalidateRect(g_hLblRoundVal, NULL, TRUE);
  }

  InvalidateRect(g_hWnd, NULL, TRUE);
}

static void trigger_toast(HWND hWnd, const wchar_t *msg) {
  wcscpy_s(g_toast_text, 64, msg);
  g_show_toast = 1;
  SetTimer(hWnd, ID_TIMER_TOAST, 2200, NULL);
  InvalidateRect(hWnd, NULL, TRUE);
}

static void update_char_count_ui(void) {
  if (!g_hEditChatText || !g_hLblChatCharCount)
    return;
  int len = GetWindowTextLengthW(g_hEditChatText);
  if (len > 500)
    len = 500;
  wchar_t buf[32];
  swprintf_s(buf, 32, L"%d/500", len);
  SetWindowTextW(g_hLblChatCharCount, buf);
}

static void load_changelog_ui(void) {
  if (!g_hEditChangelogs)
    return;

  // 1. Read from embedded PE Resource (Resource ID 4)
  HRSRC hRes = FindResourceW(NULL, MAKEINTRESOURCEW(4), RT_RCDATA);
  if (hRes) {
    HGLOBAL hResData = LoadResource(NULL, hRes);
    if (hResData) {
      DWORD size = SizeofResource(NULL, hRes);
      const char *pData = (const char *)LockResource(hResData);
      if (pData && size > 0) {
        size_t norm_cap = size * 2 + 1;
        char *norm_buf = (char *)malloc(norm_cap);
        if (norm_buf) {
          size_t j = 0;
          for (size_t i = 0; i < size; i++) {
            if (pData[i] == '\n' && (i == 0 || pData[i - 1] != '\r')) {
              norm_buf[j++] = '\r';
            }
            norm_buf[j++] = pData[i];
          }
          norm_buf[j] = '\0';

          int wlen = MultiByteToWideChar(CP_UTF8, 0, norm_buf, -1, NULL, 0);
          if (wlen > 0) {
            wchar_t *wbuf = (wchar_t *)malloc(wlen * sizeof(wchar_t));
            if (wbuf) {
              MultiByteToWideChar(CP_UTF8, 0, norm_buf, -1, wbuf, wlen);
              SetWindowTextW(g_hEditChangelogs, wbuf);
              free(wbuf);
              free(norm_buf);
              return;
            }
          }
          free(norm_buf);
        }
      }
    }
  }

  // 2. Fallback to reading changelog.txt from disk
  FILE *f = NULL;
  fopen_s(&f, CHANGELOG_FILE, "rb");
  if (f) {
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (size > 0) {
      char *buf = (char *)malloc(size + 1);
      if (buf) {
        size_t read_bytes = fread(buf, 1, size, f);
        buf[read_bytes] = '\0';
        fclose(f);

        size_t norm_cap = read_bytes * 2 + 1;
        char *norm_buf = (char *)malloc(norm_cap);
        if (norm_buf) {
          size_t j = 0;
          for (size_t i = 0; i < read_bytes; i++) {
            if (buf[i] == '\n' && (i == 0 || buf[i - 1] != '\r')) {
              norm_buf[j++] = '\r';
            }
            norm_buf[j++] = buf[i];
          }
          norm_buf[j] = '\0';
          free(buf);

          int wlen = MultiByteToWideChar(CP_UTF8, 0, norm_buf, -1, NULL, 0);
          if (wlen > 0) {
            wchar_t *wbuf = (wchar_t *)malloc(wlen * sizeof(wchar_t));
            if (wbuf) {
              MultiByteToWideChar(CP_UTF8, 0, norm_buf, -1, wbuf, wlen);
              SetWindowTextW(g_hEditChangelogs, wbuf);
              free(wbuf);
              free(norm_buf);
              return;
            }
          }
          free(norm_buf);
        }
      }
    } else {
      fclose(f);
    }
  }

  SetWindowTextW(g_hEditChangelogs, L"Changelog is currently empty.");
}

static void show_chat_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblChatHeader, command);
  ShowWindow(g_hLblChatDescription, command);
  ShowWindow(g_hChkChat, command);
  ShowWindow(g_hLblChatToggle, command);
  ShowWindow(g_hLblChatChannel, command);
  ShowWindow(g_hBtnChatChannel, command);
  ShowWindow(g_hLblChatInterval, command);
  ShowWindow(g_hEditChatInterval, command);
  ShowWindow(g_hLblChatText, command);
  ShowWindow(g_hLblChatCharCount, command);
  ShowWindow(g_hEditChatText, command);
  ShowWindow(g_hBtnChatExample1, command);
  ShowWindow(g_hBtnChatExample2, command);
}

static void show_vote_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblVoteHeader, command);
  ShowWindow(g_hLblVoteSub, command);
  ShowWindow(g_hRadioVoteOff, command);
  ShowWindow(g_hRadioVoteYes, command);
  ShowWindow(g_hRadioVoteNo, command);
}

#define MUSIC_ALIAS L"sagebot_bgm"
#define MUSIC_FILE L"assets\\music.mp3"

static void show_settings_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblSettingsHeader, command);
  ShowWindow(g_hLblSettingsHelp, command);
  ShowWindow(g_hLblSettingsKeyTitle, command);
  ShowWindow(g_hBtnRebind, command);
  ShowWindow(g_hLblUpdateHeader, command);
  ShowWindow(g_hLblUpdateVersion, command);
  ShowWindow(g_hBtnCheckUpdate, command);
  ShowWindow(g_hLblUpdateStatus, command);
}

static void update_config_mode_ui(void) {
  int mode = atomic_load(&g_anti_afk_mode); // 0 = Click, 1 = Hold
  if (mode == 1) {
    SetWindowTextW(g_hLblClickSettingsTitle, L"Hold Mode Settings");
    SetWindowTextW(g_hLblClickSettingsSub, L"Continuously holds down the selected key.");
    SetWindowTextW(g_hLblClickKeyTitle, L"Holding Key");
    SetWindowTextW(g_hLblIntervalNote, L"Tips: The W key makes you move forward!");

    ShowWindow(g_hLblIntervalTitle, SW_HIDE);
    ShowWindow(g_hBtnDelayBadge, SW_HIDE);
    ShowWindow(g_hLblSlowModeTitle, SW_HIDE);
    ShowWindow(g_hChkSlowMode, SW_HIDE);
    ShowWindow(g_hLblSlowModeDesc, SW_HIDE);

    SetWindowPos(g_hLblIntervalNote, NULL, 176, 296, 290, 36, SWP_NOZORDER);
  } else {
    SetWindowTextW(g_hLblClickSettingsTitle, L"Click Mode Settings");
    SetWindowTextW(g_hLblClickSettingsSub, L"Randomly clicks the selected key.");
    SetWindowTextW(g_hLblClickKeyTitle, L"Clicking Key");
    SetWindowTextW(g_hLblIntervalNote, L"Interval between clicks is randomized.");

    SetWindowPos(g_hLblIntervalNote, NULL, 176, 322, 290, 16, SWP_NOZORDER);

    if (g_current_tab == 6) {
      ShowWindow(g_hLblIntervalTitle, SW_SHOW);
      ShowWindow(g_hBtnDelayBadge, SW_SHOW);
      ShowWindow(g_hLblSlowModeTitle, SW_SHOW);
      ShowWindow(g_hChkSlowMode, SW_SHOW);
      ShowWindow(g_hLblSlowModeDesc, SW_SHOW);
    }
  }

  InvalidateRect(g_hRadioModeClick, NULL, TRUE);
  InvalidateRect(g_hRadioModeMove, NULL, TRUE);
  InvalidateRect(g_hWnd, NULL, TRUE);
}

static void show_config_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblConfigHeader, command);
  ShowWindow(g_hLblConfigSub, command);
  ShowWindow(g_hRadioModeClick, command);
  ShowWindow(g_hRadioModeMove, command);
  ShowWindow(g_hLblClickSettingsTitle, command);
  ShowWindow(g_hLblClickSettingsSub, command);
  ShowWindow(g_hLblClickKeyTitle, command);
  ShowWindow(g_hBtnKeyBadge, command);
  ShowWindow(g_hLblIntervalNote, command);

  if (show) {
    update_config_mode_ui();
  } else {
    ShowWindow(g_hLblIntervalTitle, SW_HIDE);
    ShowWindow(g_hBtnDelayBadge, SW_HIDE);
    ShowWindow(g_hLblSlowModeTitle, SW_HIDE);
    ShowWindow(g_hChkSlowMode, SW_HIDE);
    ShowWindow(g_hLblSlowModeDesc, SW_HIDE);
  }
}

static void show_main_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblStatusTitle, command);
  ShowWindow(g_hLblStatusVal, command);
  ShowWindow(g_hLblHotkeyTitle, command);
  ShowWindow(g_hLblHotkeyVal, command);
  ShowWindow(g_hBtnStart, command);
  ShowWindow(g_hEditLog, command);
}

static void update_status_tab_ui(void) {
  if (!g_hLblRiotIdVal) return;
  RoundTrackerInfo info;
  get_round_tracker_snapshot(&info);
  SetWindowTextW(g_hLblRiotIdVal, info.riot_id);
  SetWindowTextW(g_hLblRankVal, info.rank_name);
  SetWindowTextW(g_hLblMapVal, info.map_name);
  SetWindowTextW(g_hLblGamemodeVal, info.gamemode);
  SetWindowTextW(g_hLblPhaseVal, info.game_phase);
  SetWindowTextW(g_hLblAgentVal, info.agent_name);
  SetWindowTextW(g_hLblRoundVal, info.display_text);
  InvalidateRect(g_hLblRiotIdVal, NULL, TRUE);
  InvalidateRect(g_hLblRankVal, NULL, TRUE);
  InvalidateRect(g_hLblMapVal, NULL, TRUE);
  InvalidateRect(g_hLblGamemodeVal, NULL, TRUE);
  InvalidateRect(g_hLblPhaseVal, NULL, TRUE);
  InvalidateRect(g_hLblAgentVal, NULL, TRUE);
  InvalidateRect(g_hLblRoundVal, NULL, TRUE);
}

static void show_status_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblBox1Header, command);
  ShowWindow(g_hLblRiotIdTitle, command);
  ShowWindow(g_hLblRiotIdVal, command);
  ShowWindow(g_hLblRankTitle, command);
  ShowWindow(g_hLblRankVal, command);
  ShowWindow(g_hLblBox2Header, command);
  ShowWindow(g_hLblMapTitle, command);
  ShowWindow(g_hLblMapVal, command);
  ShowWindow(g_hLblGamemodeTitle, command);
  ShowWindow(g_hLblGamemodeVal, command);
  ShowWindow(g_hLblPhaseTitle, command);
  ShowWindow(g_hLblPhaseVal, command);
  ShowWindow(g_hLblAgentTitle, command);
  ShowWindow(g_hLblAgentVal, command);
  ShowWindow(g_hLblRoundTitle, command);
  ShowWindow(g_hLblRoundVal, command);
  if (show) {
    update_status_tab_ui();
  }
}

static void show_webhook_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblWebhookHeader, command);
  ShowWindow(g_hLblWebhookSub, command);
  ShowWindow(g_hLblWebhookUrl, command);
  ShowWindow(g_hLblWebhookUrlNote, command);
  ShowWindow(g_hEditWebhookUrl, command);
  ShowWindow(g_hLblWebhookUserId, command);
  ShowWindow(g_hLblWebhookUserIdNote, command);
  ShowWindow(g_hEditWebhookUserId, command);
  ShowWindow(g_hLblWebhookHint, command);
  ShowWindow(g_hBtnWebhookSave, command);
  ShowWindow(g_hBtnWebhookTest, command);
  ShowWindow(g_hLblWebhookStatus, command);
}

static void switch_tab(int tab_id) {
  g_current_tab = tab_id;
  atomic_store(&g_is_rebinding, 0);
  atomic_store(&g_is_rebinding_afk, 0);

  show_main_controls(tab_id == 0);
  ShowWindow(g_hEditChangelogs, tab_id == 1 ? SW_SHOW : SW_HIDE);
  show_chat_controls(tab_id == 2);
  show_vote_controls(tab_id == 3);
  show_settings_controls(tab_id == 4);
  show_music_controls(tab_id == 5);
  show_config_controls(tab_id == 6);
  show_status_controls(tab_id == 7);
  show_webhook_controls(tab_id == 8);

  if (tab_id == 1) {
    load_changelog_ui();
  }

  // Repaint window cleanly
  InvalidateRect(g_hNavChangelogs, NULL, TRUE);
  InvalidateRect(g_hNavMain, NULL, TRUE);
  InvalidateRect(g_hNavStatus, NULL, TRUE);
  InvalidateRect(g_hNavConfig, NULL, TRUE);
  InvalidateRect(g_hNavChat, NULL, TRUE);
  InvalidateRect(g_hNavAutoVoting, NULL, TRUE);
  InvalidateRect(g_hNavMusic, NULL, TRUE);
  InvalidateRect(g_hNavWebhook, NULL, TRUE);
  InvalidateRect(g_hNavSettings, NULL, TRUE);
  InvalidateRect(g_hWnd, NULL, TRUE);
}

// Custom Draw Helper for Owner-Drawn Buttons

static void handle_draw_item(HWND hWnd, const DRAWITEMSTRUCT *pDIS) {
  (void)hWnd;
  HDC hdc = pDIS->hDC;
  RECT rc = pDIS->rcItem;
  UINT id = pDIS->CtlID;
  BOOL isSelected = (pDIS->itemState & ODS_SELECTED);
  SetBkMode(hdc, TRANSPARENT);

  // 1. Sidebar Navigation Buttons
  if (id == ID_NAV_CHANGELOGS || id == ID_NAV_MAIN || id == ID_NAV_STATUS ||
      id == ID_NAV_CONFIG || id == ID_NAV_CHAT || id == ID_NAV_AUTO_VOTING ||
      id == ID_NAV_MUSIC || id == ID_NAV_WEBHOOK || id == ID_NAV_SETTINGS) {
    int tab_index = 0;
    const wchar_t *text = L"";

    switch (id) {
    case ID_NAV_MAIN:
      tab_index = 0;
      text = L"▶  Main";
      break;
    case ID_NAV_STATUS:
      tab_index = 7;
      text = L"📊  Status";
      break;
    case ID_NAV_CONFIG:
      tab_index = 6;
      text = L"🛠️  Config";
      break;
    case ID_NAV_CHAT:
      tab_index = 2;
      text = L"💬  Chat";
      break;
    case ID_NAV_AUTO_VOTING:
      tab_index = 3;
      text = L"🗳️  Auto Voting";
      break;
    case ID_NAV_MUSIC:
      tab_index = 5;
      text = L"🎵  Music";
      break;
    case ID_NAV_WEBHOOK:
      tab_index = 8;
      text = L"🔔  Webhook";
      break;
    case ID_NAV_CHANGELOGS:
      tab_index = 1;
      text = L"📝  Changelog";
      break;
    case ID_NAV_SETTINGS:
      tab_index = 4;
      text = L"⚙  Settings";
      break;
    }

    BOOL isActive = (g_current_tab == tab_index);

    COLORREF bgCol;
    COLORREF borderCol;
    COLORREF textCol;

    if (isActive) {
      bgCol = RGB(124, 58, 237);      // #7c3aed Vibrant Indigo/Purple
      borderCol = RGB(167, 139, 250); // #a78bfa Soft glowing outline
      textCol = RGB(255, 255, 255);   // Crisp pure white
    } else if (isSelected) {
      bgCol = RGB(32, 32, 38);     // #202026 Sleek dark hover
      borderCol = RGB(65, 65, 80); // #414150 Subtle hover border
      textCol = RGB(241, 245, 249);
    } else {
      bgCol = RGB(18, 18, 18);      // #121212 Matches sidebar
      borderCol = RGB(34, 34, 40);  // Very subtle border
      textCol = RGB(148, 163, 184); // #94a3b8 Smooth muted slate
    }

    // Draw smooth rounded pill background
    draw_rounded_rect(hdc, &rc, 8, bgCol, borderCol, 1);

    // Draw text with crisp typography
    SelectObject(hdc, isActive ? g_hFontHeader : g_hFontNormal);
    SetTextColor(hdc, textCol);
    RECT rcText = rc;
    rcText.left += 14;
    DrawTextW(hdc, text, -1, &rcText, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 2. Start / Stop Primary Button
  if (id == ID_BTN_START_STOP) {
    int is_running = atomic_load(&g_status);
    COLORREF bgCol;
    if (is_running) {
      bgCol = isSelected ? COLOR_BTN_STOP_HVR : COLOR_BTN_STOP;
    } else {
      bgCol = isSelected ? COLOR_BTN_START_HVR : COLOR_BTN_START;
    }

    draw_rounded_rect(hdc, &rc, 12, bgCol, RGB(255, 255, 255), 0);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontHeader);
    SetTextColor(hdc, RGB(255, 255, 255));
    DrawTextW(hdc, btnText, -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 3. Rebind Hotkey Button (Minimal Key Badge)
  if (id == ID_BTN_REBIND) {
    int is_rebinding = atomic_load(&g_is_rebinding);
    COLORREF bgCol = is_rebinding
                         ? RGB(180, 83, 9)
                         : (isSelected ? RGB(35, 35, 48) : RGB(22, 22, 30));
    COLORREF borderCol =
        is_rebinding ? RGB(251, 191, 36)
                     : (isSelected ? RGB(138, 92, 246) : COLOR_CARD_BORDER);

    draw_rounded_rect(hdc, &rc, 6, bgCol, borderCol, 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontNormal);
    SetTextColor(hdc, is_rebinding ? RGB(255, 255, 255) : RGB(196, 181, 253));
    DrawTextW(hdc, btnText, -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 3.1 Check For Updates Button (Modern Slate Pill)
  if (id == ID_BTN_CHECK_UPDATE) {
    COLORREF bgCol = isSelected ? RGB(55, 48, 75) : RGB(35, 30, 48);
    COLORREF borderCol = isSelected ? RGB(167, 139, 250) : RGB(138, 92, 246);
    draw_rounded_rect(hdc, &rc, 8, bgCol, borderCol, 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontNormal);
    SetTextColor(hdc, RGB(221, 214, 254));
    DrawTextW(hdc, btnText, -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 3.2 Webhook Action Buttons (Save / Test)
  if (id == ID_BTN_WEBHOOK_SAVE || id == ID_BTN_WEBHOOK_TEST) {
    COLORREF bgCol = isSelected ? RGB(45, 38, 65) : RGB(30, 26, 44);
    COLORREF borderCol = isSelected ? RGB(167, 139, 250) : RGB(138, 92, 246);
    draw_rounded_rect(hdc, &rc, 6, bgCol, borderCol, 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontNormal);
    SetTextColor(hdc, isSelected ? RGB(255, 255, 255) : RGB(221, 214, 254));
    DrawTextW(hdc, btnText, -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }


  // 4.1 Music Play/Pause Button (Clean Glowing Triangle / Pause Icon)
  if (id == ID_BTN_MUSIC_PLAY) {
    // Transparent or subtle glowing pill hover
    if (isSelected) {
      draw_rounded_rect(hdc, &rc, 10, RGB(38, 38, 52), RGB(138, 92, 246), 1);
    }

    if (!g_music_playing) {
      // Draw vibrant purple play triangle ▶
      POINT pts[3];
      pts[0].x = rc.left + 20;
      pts[0].y = rc.top + 12;
      pts[1].x = rc.left + 20;
      pts[1].y = rc.bottom - 12;
      pts[2].x = rc.right - 16;
      pts[2].y = (rc.top + rc.bottom) / 2;

      COLORREF triCol = isSelected ? RGB(196, 181, 253) : RGB(139, 92, 246);
      HBRUSH hBrTri = CreateSolidBrush(triCol);
      HPEN hPenTri = CreatePen(PS_SOLID, 1, triCol);
      HBRUSH hOldBr = (HBRUSH)SelectObject(hdc, hBrTri);
      HPEN hOldPen = (HPEN)SelectObject(hdc, hPenTri);

      Polygon(hdc, pts, 3);

      SelectObject(hdc, hOldBr);
      SelectObject(hdc, hOldPen);
      DeleteObject(hBrTri);
      DeleteObject(hPenTri);
    } else {
      // Draw two pause bars ⏸
      COLORREF barCol = isSelected ? RGB(252, 165, 165) : RGB(239, 68, 68);
      HBRUSH hBrBar = CreateSolidBrush(barCol);

      RECT rcBar1 = {rc.left + 18, rc.top + 13, rc.left + 24, rc.bottom - 13};
      RECT rcBar2 = {rc.right - 24, rc.top + 13, rc.right - 18, rc.bottom - 13};

      FillRect(hdc, &rcBar1, hBrBar);
      FillRect(hdc, &rcBar2, hBrBar);
      DeleteObject(hBrBar);
    }
    return;
  }

  // 5. Preset Pill Buttons (Sleek Minimal Badge Buttons)
  if (id == ID_BTN_CHAT_EXAMPLE_1 || id == ID_BTN_CHAT_EXAMPLE_2) {
    COLORREF bgCol = isSelected ? RGB(35, 35, 48) : RGB(22, 22, 30);
    COLORREF borderCol = isSelected ? RGB(138, 92, 246) : COLOR_CARD_BORDER;
    draw_rounded_rect(hdc, &rc, 6, bgCol, borderCol, 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontNormal);
    SetTextColor(hdc, isSelected ? RGB(255, 255, 255) : RGB(203, 213, 225));
    DrawTextW(hdc, btnText, -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 6. Modern On/Off Slider Switch Toggle
  if (id == ID_CHK_CHAT || id == ID_CHK_SLOW_MODE) {
    int is_on = (id == ID_CHK_CHAT)
                    ? (atomic_load(&g_chat_mode) == 1)
                    : (atomic_load(&g_slow_mode) == 1);
    COLORREF trackBg = is_on ? RGB(34, 197, 94) : RGB(50, 50, 65);
    COLORREF trackBorder = is_on ? RGB(74, 222, 128) : RGB(70, 70, 90);

    // Draw pill track
    draw_rounded_rect(hdc, &rc, 22, trackBg, trackBorder, 1);

    // Draw thumb knob
    RECT rcKnob;
    rcKnob.top = rc.top + 2;
    rcKnob.bottom = rc.bottom - 2;
    if (is_on) {
      rcKnob.left = rc.right - (rc.bottom - rc.top) + 2;
      rcKnob.right = rc.right - 2;
    } else {
      rcKnob.left = rc.left + 2;
      rcKnob.right = rc.left + (rc.bottom - rc.top) - 2;
    }

    draw_rounded_rect(hdc, &rcKnob, (rcKnob.bottom - rcKnob.top),
                      RGB(255, 255, 255), RGB(200, 200, 200), 0);
    return;
  }

  // 7. Auto-Vote Option Cards
  if (id == ID_RADIO_VOTE_OFF || id == ID_RADIO_VOTE_YES ||
      id == ID_RADIO_VOTE_NO) {
    int vMode = atomic_load(&g_auto_vote_mode);
    int is_active = (id == ID_RADIO_VOTE_OFF && vMode == 0) ||
                    (id == ID_RADIO_VOTE_YES && vMode == 1) ||
                    (id == ID_RADIO_VOTE_NO && vMode == 2);

    COLORREF bgCol = is_active
                         ? RGB(35, 35, 52)
                         : (isSelected ? RGB(28, 28, 38) : RGB(20, 20, 26));
    COLORREF borderCol =
        is_active ? RGB(138, 92, 246)
                  : (isSelected ? RGB(70, 70, 90) : COLOR_CARD_BORDER);

    draw_rounded_rect(hdc, &rc, 8, bgCol, borderCol, is_active ? 2 : 1);

    // Draw selection indicator circle
    RECT rcCircle = {rc.left + 12, rc.top + (rc.bottom - rc.top - 12) / 2,
                     rc.left + 24, rc.top + (rc.bottom - rc.top - 12) / 2 + 12};
    draw_rounded_rect(hdc, &rcCircle, 12,
                      is_active ? RGB(138, 92, 246) : RGB(40, 40, 50),
                      is_active ? RGB(167, 139, 250) : RGB(70, 70, 85), 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, is_active ? g_hFontHeader : g_hFontNormal);
    SetTextColor(hdc, is_active ? RGB(255, 255, 255) : COLOR_TEXT_SECONDARY);
    RECT rcText = rc;
    rcText.left += 32;
    DrawTextW(hdc, btnText, -1, &rcText, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 8. Modern Channel Selector Pill Button
  if (id == ID_COMBO_CHAT_TARGET) {
    COLORREF bgCol = isSelected ? RGB(35, 35, 48) : RGB(22, 22, 30);
    COLORREF borderCol = isSelected ? RGB(138, 92, 246) : COLOR_CARD_BORDER;
    draw_rounded_rect(hdc, &rc, 6, bgCol, borderCol, 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontNormal);
    SetTextColor(hdc, isSelected ? RGB(255, 255, 255) : RGB(203, 213, 225));

    // Text on the left
    RECT rcText = rc;
    rcText.left += 10;
    rcText.right -= 20;
    DrawTextW(hdc, btnText, -1, &rcText, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    // Subtle dropdown chevron on the right
    RECT rcChevron = rc;
    rcChevron.left = rc.right - 18;
    rcChevron.right = rc.right - 6;
    SetTextColor(hdc, RGB(148, 163, 184));
    DrawTextW(hdc, L"▾", -1, &rcChevron,
              DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 9. Anti-AFK Method Radio Cards (Config Tab)
  if (id == ID_RADIO_MODE_CLICK || id == ID_RADIO_MODE_MOVE) {
    int afk_mode = atomic_load(&g_anti_afk_mode);
    int is_click = (id == ID_RADIO_MODE_CLICK);
    int is_active = (is_click && afk_mode == 0) || (!is_click && afk_mode == 1);

    COLORREF bgCol;
    COLORREF borderCol;
    if (is_active) {
      bgCol = isSelected ? RGB(45, 38, 65) : RGB(36, 32, 52);
      borderCol = RGB(138, 92, 246);
    } else {
      bgCol = isSelected ? RGB(32, 32, 42) : RGB(22, 22, 28);
      borderCol = isSelected ? RGB(80, 80, 100) : COLOR_CARD_BORDER;
    }

    draw_rounded_rect(hdc, &rc, 8, bgCol, borderCol, is_active ? 2 : 1);

    // Left indicator circle
    int cy = (rc.top + rc.bottom) / 2;
    RECT rcOuterCircle = {rc.left + 14, cy - 8, rc.left + 30, cy + 8};
    draw_rounded_rect(hdc, &rcOuterCircle, 16,
                      is_active ? RGB(30, 24, 45) : RGB(26, 26, 32),
                      is_active ? RGB(138, 92, 246) : RGB(60, 60, 72), 1);
    if (is_active) {
      RECT rcInnerDot = {rc.left + 18, cy - 4, rc.left + 26, cy + 4};
      draw_rounded_rect(hdc, &rcInnerDot, 8, RGB(167, 139, 250), RGB(167, 139, 250), 0);
    }

    // Title Text
    SelectObject(hdc, is_active ? g_hFontHeader : g_hFontNormal);
    SetTextColor(hdc, is_active ? RGB(255, 255, 255) : COLOR_TEXT_SECONDARY);
    RECT rcText = {rc.left + 38, rc.top, rc.right - 90, rc.bottom};
    DrawTextW(hdc, is_click ? L"Click Mode" : L"Hold Mode", -1, &rcText,
              DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    // Right Chip Badge
    RECT rcChip = {rc.right - 84, cy - 11, rc.right - 12, cy + 11};
    if (is_active) {
      draw_rounded_rect(hdc, &rcChip, 12, RGB(18, 42, 28), RGB(34, 197, 94), 1);
      SelectObject(hdc, g_hFontSmall);
      SetTextColor(hdc, RGB(74, 222, 128));
      DrawTextW(hdc, L"● ACTIVE", -1, &rcChip, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    }
    return;
  }

  // 10. Key Badge Display (Mechanical Keycap style / Rebinding state)
  if (id == ID_BTN_KEY_BADGE) {
    int is_rebinding = atomic_load(&g_is_rebinding_afk);
    COLORREF bgCol = is_rebinding
                         ? RGB(180, 83, 9)
                         : (isSelected ? RGB(50, 42, 75) : RGB(35, 30, 52));
    COLORREF borderCol =
        is_rebinding ? RGB(251, 191, 36)
                     : (isSelected ? RGB(167, 139, 250) : RGB(138, 92, 246));

    draw_rounded_rect(hdc, &rc, 6, bgCol, borderCol, 1);

    wchar_t btnText[64];
    if (is_rebinding) {
      wcscpy_s(btnText, 64, L"Press...");
    } else {
      get_key_name_w(atomic_load(&g_anti_afk_key), btnText, 64);
    }

    SelectObject(hdc, is_rebinding ? g_hFontSmall : g_hFontNormal);
    SetTextColor(hdc, RGB(255, 255, 255));
    DrawTextW(hdc, btnText, -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }

  // 11. Delay Badge Display
  if (id == ID_BTN_DELAY_BADGE) {
    int is_slow = (atomic_load(&g_slow_mode) == 1);
    COLORREF bgCol = is_slow ? RGB(45, 30, 20) : RGB(24, 24, 30);
    COLORREF borderCol = is_slow ? RGB(245, 158, 11) : RGB(55, 55, 68);
    draw_rounded_rect(hdc, &rc, 6, bgCol, borderCol, 1);
    SelectObject(hdc, g_hFontSmall);
    SetTextColor(hdc, is_slow ? RGB(251, 191, 36) : RGB(196, 181, 253));
    DrawTextW(hdc, is_slow ? L"3.7 – 4.2 s" : L"900 – 1300 ms", -1, &rc,
              DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    return;
  }
}

// Window Procedure

LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  switch (msg) {
  case WM_CREATE: {
    g_hWnd = hWnd;
    init_config_path();
    InitializeCriticalSection(&g_chat_lock);
    InitializeCriticalSection(&g_webhook_lock);
    round_tracker_init();
    load_config();

    // Styling Brushes
    g_hBaseBgBrush = CreateSolidBrush(COLOR_BASE_BG);
    g_hSidebarBgBrush = CreateSolidBrush(COLOR_SIDEBAR_BG);
    g_hCardBgBrush = CreateSolidBrush(COLOR_CARD_BG);
    g_hInputBgBrush = CreateSolidBrush(COLOR_INPUT_BG);

    // Modern High-Quality Segoe UI Typography
    g_hFontBrand =
        CreateFontW(17, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                    OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                    DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

    g_hFontTitle =
        CreateFontW(20, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                    OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                    DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

    g_hFontHeader = CreateFontW(15, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE,
                                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

    g_hFontNormal = CreateFontW(14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

    g_hFontSmall = CreateFontW(12, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                               DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                               CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                               DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

    g_hFontMonospace = CreateFontW(13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                   DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                                   CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                   DEFAULT_PITCH | FF_DONTCARE, L"Consolas");

    g_hFontStatusLabel = CreateFontW(16, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE,
                                     DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                                     CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                     DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

    g_hFontStatusValue = CreateFontW(16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                     DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                                     CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                     DEFAULT_PITCH | FF_DONTCARE, L"Bahnschrift");

    // MAIN Tab Button (Primary)
    g_hNavMain = CreateWindowW(L"BUTTON", L"▶  Main",
                               WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 16,
                               124, 36, hWnd, (HMENU)ID_NAV_MAIN, NULL, NULL);

    // STATUS Tab Button (Between Main and Config)
    g_hNavStatus = CreateWindowW(L"BUTTON", L"📊  Status",
                                 WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 58,
                                 124, 36, hWnd, (HMENU)ID_NAV_STATUS, NULL, NULL);

    // CONFIG Tab Button (Between Status and Chat)
    g_hNavConfig = CreateWindowW(L"BUTTON", L"🛠️  Config",
                                 WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 100,
                                 124, 36, hWnd, (HMENU)ID_NAV_CONFIG, NULL, NULL);

    // Chat Tab Button
    g_hNavChat = CreateWindowW(L"BUTTON", L"💬  Chat",
                               WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 142,
                               124, 36, hWnd, (HMENU)ID_NAV_CHAT, NULL, NULL);

    // Auto Voting Tab Button
    g_hNavAutoVoting = CreateWindowW(
        L"BUTTON", L"🗳️  Auto Voting", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        184, 124, 36, hWnd, (HMENU)ID_NAV_AUTO_VOTING, NULL, NULL);

    // Music Player Tab Button
    g_hNavMusic = CreateWindowW(L"BUTTON", L"🎵  Music",
                                WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 226,
                                124, 36, hWnd, (HMENU)ID_NAV_MUSIC, NULL, NULL);

    // WEBHOOK Tab Button
    g_hNavWebhook = CreateWindowW(
        L"BUTTON", L"🔔  Webhook", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        268, 124, 36, hWnd, (HMENU)ID_NAV_WEBHOOK, NULL, NULL);

    // CHANGELOG Tab Button (Positioned right above Settings)
    g_hNavChangelogs = CreateWindowW(
        L"BUTTON", L"📝  Changelog", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        358, 124, 36, hWnd, (HMENU)ID_NAV_CHANGELOGS, NULL, NULL);

    // Settings Button (Pinned at Bottom)
    g_hNavSettings = CreateWindowW(
        L"BUTTON", L"⚙  Settings", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        400, 124, 36, hWnd, (HMENU)ID_NAV_SETTINGS, NULL, NULL);

    g_hLblStatusTitle =
        CreateWindowW(L"STATIC", L"STATUS:", WS_CHILD | WS_VISIBLE | SS_LEFT,
                      176, 24, 100, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblStatusTitle, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblStatusVal =
        CreateWindowW(L"STATIC", L"STOPPED", WS_CHILD | WS_VISIBLE | SS_RIGHT,
                      336, 24, 130, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblStatusVal, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    // HOTKEY:                                F9
    g_hLblHotkeyTitle =
        CreateWindowW(L"STATIC", L"HOTKEY:", WS_CHILD | WS_VISIBLE | SS_LEFT,
                      176, 50, 100, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblHotkeyTitle, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblHotkeyVal =
        CreateWindowW(L"STATIC", L"F9", WS_CHILD | WS_VISIBLE | SS_RIGHT, 336,
                      50, 130, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblHotkeyVal, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    // Large Modern Start/Stop Action Button
    g_hBtnStart = CreateWindowW(
        L"BUTTON", L"▶  START SAGEBOT", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
        160, 86, 325, 42, hWnd, (HMENU)ID_BTN_START_STOP, NULL, NULL);

    // Modern Activity Log Box
    g_hEditLog = CreateWindowW(
        L"EDIT", L"",
        WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_AUTOVSCROLL | ES_READONLY,
        162, 144, 321, 290, hWnd, (HMENU)ID_EDIT_LOG, NULL, NULL);
    SendMessageW(g_hEditLog, WM_SETFONT, (WPARAM)g_hFontMonospace, TRUE);
    SetWindowSubclass(g_hEditLog, EditSubclassProc, 1, 0);

    g_hEditChangelogs = CreateWindowW(
        L"EDIT", L"", WS_CHILD | ES_MULTILINE | ES_READONLY, 162, 22, 321, 414,
        hWnd, (HMENU)ID_EDIT_CHANGELOGS, NULL, NULL);
    SendMessageW(g_hEditChangelogs, WM_SETFONT, (WPARAM)g_hFontMonospace, TRUE);
    SetWindowSubclass(g_hEditChangelogs, EditSubclassProc, 2, 0);

    // Header & Subtitle
    g_hLblChatHeader = CreateWindowW(L"STATIC", L"Auto Chat", WS_CHILD,
                                     176, 24, 290, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    g_hLblChatDescription = CreateWindowW(
        L"STATIC", L"Send a message through in-game chat.", WS_CHILD,
        176, 50, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatDescription, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hLblChatToggle =
        CreateWindowW(L"STATIC", L"Enable Chat", WS_CHILD | SS_LEFT, 176, 84,
                      180, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatToggle, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    g_hChkChat = CreateWindowW(L"BUTTON", L"", WS_CHILD | BS_OWNERDRAW, 426, 82,
                               40, 20, hWnd, (HMENU)ID_CHK_CHAT, NULL, NULL);

    // Row 2: Channel Selection (Modern Custom Dropdown Pill)
    g_hLblChatChannel =
        CreateWindowW(L"STATIC", L"Channel", WS_CHILD | SS_LEFT, 176, 115, 120,
                      20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatChannel, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    int cur_target = atomic_load(&g_chat_target);
    g_hBtnChatChannel = CreateWindowW(
        L"BUTTON", cur_target == 1 ? L"All Chat (/all)" : L"Team Chat",
        WS_CHILD | BS_OWNERDRAW, 346, 111, 120, 26, hWnd,
        (HMENU)ID_COMBO_CHAT_TARGET, NULL, NULL);

    // Row 3: Interval Input
    g_hLblChatInterval =
        CreateWindowW(L"STATIC", L"Interval (seconds)", WS_CHILD, 176, 146, 180,
                      20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatInterval, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    g_hEditChatInterval = CreateWindowW(
        L"EDIT", L"180", WS_CHILD | ES_AUTOHSCROLL | ES_NUMBER | ES_CENTER, 406,
        143, 60, 22, hWnd, (HMENU)ID_EDIT_CHAT_INTERVAL, NULL, NULL);
    SendMessageW(g_hEditChatInterval, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    // Row 4: Custom Message Area & Real-time Char Counter
    g_hLblChatText = CreateWindowW(
        L"STATIC", L"Message Content (max. 500 chars.)", WS_CHILD | SS_LEFT,
        176, 178, 220, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatText, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    g_hLblChatCharCount =
        CreateWindowW(L"STATIC", L"0/500", WS_CHILD | SS_RIGHT, 400, 178, 66,
                      18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatCharCount, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hEditChatText = CreateWindowW(
        L"EDIT", L"With great Power comes great Responsibility",
        WS_CHILD | ES_MULTILINE | ES_AUTOVSCROLL | WS_VSCROLL, 176, 200, 290,
        96, hWnd, (HMENU)ID_EDIT_CHAT_TEXT, NULL, NULL);
    SendMessageW(g_hEditChatText, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
    SendMessageW(g_hEditChatText, EM_LIMITTEXT, 500, 0);
    SetWindowSubclass(g_hEditChatText, EditSubclassProc, 3, 0);

    // Row 5: Preset Pills
    g_hLblPresets = NULL;

    g_hBtnChatExample1 = CreateWindowW(
        L"BUTTON", L"Uncle Ben", WS_CHILD | BS_OWNERDRAW, 176, 308, 140, 28,
        hWnd, (HMENU)ID_BTN_CHAT_EXAMPLE_1, NULL, NULL);

    g_hBtnChatExample2 = CreateWindowW(
        L"BUTTON", L"Wintrading", WS_CHILD | BS_OWNERDRAW, 326, 308, 140, 28,
        hWnd, (HMENU)ID_BTN_CHAT_EXAMPLE_2, NULL, NULL);

    {
      wchar_t chat_interval[16];
      wchar_t chat_text[512];
      swprintf_s(chat_interval, 16, L"%d", atomic_load(&g_chat_interval));
      SetWindowTextW(g_hEditChatInterval, chat_interval);
      EnterCriticalSection(&g_chat_lock);
      wcscpy_s(chat_text, 512, g_chat_text);
      LeaveCriticalSection(&g_chat_lock);
      SetWindowTextW(g_hEditChatText, chat_text);
      update_char_count_ui();
    }

    // ----------------------------------------------------
    // CONFIG TAB CONTROLS (Anti-AFK Method)
    // ----------------------------------------------------
    // Card 1: Method Selection
    g_hLblConfigHeader = CreateWindowW(L"STATIC", L"Anti-AFK Method", WS_CHILD,
                                       176, 26, 290, 22, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblConfigHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    g_hLblConfigSub = CreateWindowW(
        L"STATIC", L"Choose the automation technique for anti-AFK.", WS_CHILD,
        176, 50, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblConfigSub, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hRadioModeClick =
        CreateWindowW(L"BUTTON", L"Click Mode", WS_CHILD | BS_OWNERDRAW, 176,
                      74, 290, 42, hWnd, (HMENU)ID_RADIO_MODE_CLICK, NULL, NULL);

    g_hRadioModeMove =
        CreateWindowW(L"BUTTON", L"Hold Mode",
                      WS_CHILD | BS_OWNERDRAW, 176, 124, 290, 42, hWnd,
                      (HMENU)ID_RADIO_MODE_HOLD, NULL, NULL);

    // Card 2: Click Mode Parameters
    g_hLblClickSettingsTitle =
        CreateWindowW(L"STATIC", L"Click Mode Settings", WS_CHILD, 176,
                      206, 290, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblClickSettingsTitle, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblClickSettingsSub =
        CreateWindowW(L"STATIC", L"Randomly clicks the selected key.", WS_CHILD,
                      176, 228, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblClickSettingsSub, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hLblClickKeyTitle =
        CreateWindowW(L"STATIC", L"Clicking Key", WS_CHILD | SS_LEFT,
                      176, 260, 180, 22, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblClickKeyTitle, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    wchar_t initAfkKey[32];
    get_key_name_w(atomic_load(&g_anti_afk_key), initAfkKey, 32);
    g_hBtnKeyBadge =
        CreateWindowW(L"BUTTON", initAfkKey, WS_CHILD | BS_OWNERDRAW, 385, 254,
                      80, 28, hWnd, (HMENU)ID_BTN_KEY_BADGE, NULL, NULL);

    g_hLblIntervalTitle =
        CreateWindowW(L"STATIC", L"Interval", WS_CHILD | SS_LEFT,
                      176, 296, 160, 22, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblIntervalTitle, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    g_hBtnDelayBadge =
        CreateWindowW(L"BUTTON", L"900 - 1300 ms", WS_CHILD | BS_OWNERDRAW, 360, 292,
                      105, 26, hWnd, (HMENU)ID_BTN_DELAY_BADGE, NULL, NULL);

    g_hLblIntervalNote =
        CreateWindowW(L"STATIC", L"Interval between clicks is randomized.",
                      WS_CHILD | SS_LEFT, 176, 322, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblIntervalNote, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Slow Mode Section
    g_hLblSlowModeTitle =
        CreateWindowW(L"STATIC", L"Slow Mode", WS_CHILD | SS_LEFT,
                      176, 348, 180, 22, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblSlowModeTitle, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    g_hChkSlowMode =
        CreateWindowW(L"BUTTON", L"", WS_CHILD | BS_OWNERDRAW,
                      425, 348, 40, 20, hWnd, (HMENU)ID_CHK_SLOW_MODE, NULL, NULL);

    g_hLblSlowModeDesc =
        CreateWindowW(L"STATIC", L"When active, sets click interval to 3.7s – 4.2s.",
                      WS_CHILD | SS_LEFT, 176, 372, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblSlowModeDesc, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hLblVoteHeader = CreateWindowW(L"STATIC", L"Auto Voting", WS_CHILD, 176,
                                     24, 290, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblVoteHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    g_hLblVoteSub =
        CreateWindowW(L"STATIC", L"Automatically cast match surrender votes.",
                      WS_CHILD, 176, 50, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblVoteSub, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hRadioVoteOff =
        CreateWindowW(L"BUTTON", L"Disabled", WS_CHILD | BS_OWNERDRAW, 176, 80,
                      290, 36, hWnd, (HMENU)ID_RADIO_VOTE_OFF, NULL, NULL);

    g_hRadioVoteYes =
        CreateWindowW(L"BUTTON", L"Vote YES (F5)", WS_CHILD | BS_OWNERDRAW, 176,
                      124, 290, 36, hWnd, (HMENU)ID_RADIO_VOTE_YES, NULL, NULL);

    g_hRadioVoteNo =
        CreateWindowW(L"BUTTON", L"Vote NO (F6)", WS_CHILD | BS_OWNERDRAW, 176,
                      168, 290, 36, hWnd, (HMENU)ID_RADIO_VOTE_NO, NULL, NULL);

    // Music Track Name / Title
    g_hLblMusicTitle = CreateWindowW(
        L"STATIC",
        L"Stereo Madness x Lord Verity x Ice Ice Baby x Rap God x Time of your Life x Eyes Without A Face x We Will Never Die x Somebody's Watching Me x Shut Up and Dance x Beverly Hills x Stayin' Alive x Dancing With Myself",
        WS_CHILD | SS_LEFT,
        176, 28, 290, 110, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblMusicTitle, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

    // Track Progress Slider (Centered full width under track name)
    g_hSliderMusicPos = CreateWindowW(
        L"SageBotSlider", L"", WS_CHILD,
        170, 146, 305, 24, hWnd, (HMENU)ID_SLIDER_MUSIC_POS, NULL, NULL);
    SendMessageW(g_hSliderMusicPos, TBM_SETRANGE, TRUE, MAKELPARAM(0, 180));
    SendMessageW(g_hSliderMusicPos, TBM_SETPOS, TRUE, 0);

    // Track Timestamp (e.g. 00:00 / 03:20)
    g_hLblMusicTime = CreateWindowW(L"STATIC", L"00:00 / 00:00",
                                    WS_CHILD | SS_RIGHT, 355, 174, 120, 18,
                                    hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblMusicTime, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Modern Triangle Play Button (Border-free Icon Play Button at y=198)
    g_hBtnMusicPlay = CreateWindowW(
        L"BUTTON", L"", WS_CHILD | BS_OWNERDRAW, 295, 198, 55, 48, hWnd,
        (HMENU)ID_BTN_MUSIC_PLAY, NULL, NULL);

    // Volume Slider & Label (y=256)
    g_hLblMusicVol = CreateWindowW(L"STATIC", L"Volume: 80%",
                                   WS_CHILD | SS_LEFT, 174, 258, 96, 18, hWnd,
                                   NULL, NULL, NULL);
    SendMessageW(g_hLblMusicVol, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hSliderMusicVol = CreateWindowW(
        L"SageBotSlider", L"", WS_CHILD,
        270, 254, 205, 24, hWnd, (HMENU)ID_SLIDER_MUSIC_VOL, NULL, NULL);
    SendMessageW(g_hSliderMusicVol, TBM_SETRANGE, TRUE, MAKELPARAM(0, 100));
    SendMessageW(g_hSliderMusicVol, TBM_SETPOS, TRUE, 80);

    // Setup periodic timer for music slider update (every 500ms)
    SetTimer(hWnd, ID_TIMER_MUSIC, 500, NULL);

    // ----------------------------------------------------
    // SETTINGS TAB CONTROLS (Minimal & Clean)
    // ----------------------------------------------------

    g_hLblSettingsHeader = CreateWindowW(L"STATIC", L"Hotkey", WS_CHILD, 176,
                                         24, 290, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblSettingsHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    g_hLblSettingsHelp =
        CreateWindowW(L"STATIC", L"Global shortcut to start/stop SageBot.",
                      WS_CHILD, 176, 50, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblSettingsHelp, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hLblSettingsKeyTitle =
        CreateWindowW(L"STATIC", L"Toggle Hotkey", WS_CHILD, 176, 88, 140, 22,
                      hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblSettingsKeyTitle, WM_SETFONT, (WPARAM)g_hFontNormal,
                 TRUE);

    g_hBtnRebind =
        CreateWindowW(L"BUTTON", L"F9", WS_CHILD | BS_OWNERDRAW, 385, 84, 80,
                      28, hWnd, (HMENU)ID_BTN_REBIND, NULL, NULL);

    // Updates Section
    g_hLblUpdateHeader = CreateWindowW(L"STATIC", L"Updates", WS_CHILD, 176,
                                       136, 290, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblUpdateHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    wchar_t verStr[64];
    swprintf_s(verStr, 64, L"Current Version: v%s", APP_VERSION);
    g_hLblUpdateVersion =
        CreateWindowW(L"STATIC", verStr, WS_CHILD, 176,
                      164, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblUpdateVersion, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hBtnCheckUpdate =
        CreateWindowW(L"BUTTON", L"Check for Updates", WS_CHILD | BS_OWNERDRAW,
                      176, 192, 160, 32, hWnd, (HMENU)ID_BTN_CHECK_UPDATE,
                      NULL, NULL);

    g_hLblUpdateStatus =
        CreateWindowW(L"STATIC", L"", WS_CHILD, 176, 232, 290, 18, hWnd,
                      NULL, NULL, NULL);
    SendMessageW(g_hLblUpdateStatus, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // ----------------------------------------------------
    // STATUS TAB CONTROLS (Live Ingame & Profile Information)
    // ----------------------------------------------------
    // Box 1: Player Profile Card
    g_hLblBox1Header = CreateWindowW(
        L"STATIC", L"PLAYER PROFILE", WS_CHILD,
        176, 26, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblBox1Header, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblRiotIdTitle = CreateWindowW(
        L"STATIC", L"Riot ID:", WS_CHILD | SS_LEFT,
        176, 56, 74, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblRiotIdTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblRiotIdVal = CreateWindowW(
        L"STATIC", L"-", WS_CHILD | SS_RIGHT,
        252, 56, 216, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblRiotIdVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    g_hLblRankTitle = CreateWindowW(
        L"STATIC", L"Rank:", WS_CHILD | SS_LEFT,
        176, 88, 74, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblRankTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblRankVal = CreateWindowW(
        L"STATIC", L"-", WS_CHILD | SS_RIGHT,
        252, 88, 216, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblRankVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    // Box 2: Match Information Card
    g_hLblBox2Header = CreateWindowW(
        L"STATIC", L"MATCH INFORMATION", WS_CHILD,
        176, 148, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblBox2Header, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblMapTitle = CreateWindowW(
        L"STATIC", L"Map:", WS_CHILD | SS_LEFT,
        176, 176, 108, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblMapTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblMapVal = CreateWindowW(
        L"STATIC", L"-", WS_CHILD | SS_RIGHT,
        286, 176, 182, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblMapVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    g_hLblGamemodeTitle = CreateWindowW(
        L"STATIC", L"Gamemode:", WS_CHILD | SS_LEFT,
        176, 208, 108, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblGamemodeTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblGamemodeVal = CreateWindowW(
        L"STATIC", L"-", WS_CHILD | SS_RIGHT,
        286, 208, 182, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblGamemodeVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    g_hLblPhaseTitle = CreateWindowW(
        L"STATIC", L"Game Phase:", WS_CHILD | SS_LEFT,
        176, 240, 108, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblPhaseTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblPhaseVal = CreateWindowW(
        L"STATIC", L"-", WS_CHILD | SS_RIGHT,
        286, 240, 182, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblPhaseVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    g_hLblAgentTitle = CreateWindowW(
        L"STATIC", L"Agent:", WS_CHILD | SS_LEFT,
        176, 272, 108, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblAgentTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblAgentVal = CreateWindowW(
        L"STATIC", L"-", WS_CHILD | SS_RIGHT,
        286, 272, 182, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblAgentVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    g_hLblRoundTitle = CreateWindowW(
        L"STATIC", L"Round:", WS_CHILD | SS_LEFT,
        176, 304, 108, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblRoundTitle, WM_SETFONT, (WPARAM)g_hFontStatusLabel, TRUE);

    g_hLblRoundVal = CreateWindowW(
        L"STATIC", L"- | -", WS_CHILD | SS_RIGHT,
        286, 304, 182, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblRoundVal, WM_SETFONT, (WPARAM)g_hFontStatusValue, TRUE);

    // ----------------------------------------------------
    // WEBHOOK TAB CONTROLS (Discord Match Notifications)
    // ----------------------------------------------------
    g_hLblWebhookHeader = CreateWindowW(
        L"STATIC", L"Discord Webhook", WS_CHILD,
        176, 26, 290, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    g_hLblWebhookSub = CreateWindowW(
        L"STATIC", L"Get pinged on Discord when your match concludes.", WS_CHILD,
        176, 52, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookSub, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Row 1: Channel URL
    g_hLblWebhookUrl = CreateWindowW(
        L"STATIC", L"Channel URL", WS_CHILD | SS_LEFT,
        176, 78, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookUrl, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblWebhookUrlNote = CreateWindowW(
        L"STATIC", L"Discord Channel -> Integrations -> Webhooks", WS_CHILD | SS_LEFT,
        176, 98, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookUrlNote, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hEditWebhookUrl = CreateWindowW(
        L"EDIT", L"", WS_CHILD | ES_AUTOHSCROLL,
        176, 122, 290, 22, hWnd, (HMENU)ID_EDIT_WEBHOOK_URL, NULL, NULL);
    SendMessageW(g_hEditWebhookUrl, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
    SetWindowSubclass(g_hEditWebhookUrl, EditSubclassProc, 4, 0);

    // Row 2: User ID
    g_hLblWebhookUserId = CreateWindowW(
        L"STATIC", L"User ID", WS_CHILD | SS_LEFT,
        176, 154, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookUserId, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblWebhookUserIdNote = CreateWindowW(
        L"STATIC", L"If User ID is invalid or empty, no @ping will be sent.", WS_CHILD | SS_LEFT,
        176, 174, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookUserIdNote, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hEditWebhookUserId = CreateWindowW(
        L"EDIT", L"", WS_CHILD | ES_AUTOHSCROLL,
        176, 198, 290, 22, hWnd, (HMENU)ID_EDIT_WEBHOOK_USER_ID, NULL, NULL);
    SendMessageW(g_hEditWebhookUserId, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
    SetWindowSubclass(g_hEditWebhookUserId, EditSubclassProc, 5, 0);

    g_hLblWebhookHint = CreateWindowW(
        L"STATIC", L"Tip: Right-click your profile in Discord -> Copy User ID", WS_CHILD | SS_LEFT,
        176, 228, 290, 16, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookHint, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Action Buttons
    g_hBtnWebhookSave = CreateWindowW(
        L"BUTTON", L"💾  Save", WS_CHILD | BS_OWNERDRAW,
        176, 258, 138, 32, hWnd, (HMENU)ID_BTN_WEBHOOK_SAVE, NULL, NULL);

    g_hBtnWebhookTest = CreateWindowW(
        L"BUTTON", L"🧪  Test Webhook", WS_CHILD | BS_OWNERDRAW,
        326, 258, 140, 32, hWnd, (HMENU)ID_BTN_WEBHOOK_TEST, NULL, NULL);

    g_hLblWebhookStatus = CreateWindowW(
        L"STATIC", L"", WS_CHILD | SS_LEFT,
        176, 300, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblWebhookStatus, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Populate loaded config
    EnterCriticalSection(&g_webhook_lock);
    SetWindowTextW(g_hEditWebhookUrl, g_webhook_url);
    SetWindowTextW(g_hEditWebhookUserId, g_webhook_user_id);
    LeaveCriticalSection(&g_webhook_lock);

    switch_tab(0);
    update_status_ui();
    SetTimer(hWnd, ID_TIMER_ROUND_UPDATE, 1000, NULL);

    append_log_ui(L"[SYSTEM] SageBot initialized.");
    append_log_ui(L"[SYSTEM] Settings loaded from config.ini.");

    // Automatic silent update check on startup
    check_for_updates_async(0);

    g_hHotkeyThread = CreateThread(NULL, 0, hotkey_thread, NULL, 0, NULL);
    return 0;
  }

  case WM_PAINT: {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hWnd, &ps);

    // 1. Fill base dark canvas
    RECT rcClient;
    GetClientRect(hWnd, &rcClient);
    FillRect(hdc, &rcClient, g_hBaseBgBrush);

    // 2. Draw Sidebar Panel (Left: 0 to 148px)
    RECT rcSidebar = {0, 0, 148, rcClient.bottom};
    FillRect(hdc, &rcSidebar, g_hSidebarBgBrush);

    // Sidebar Divider Line
    HPEN hPenDivider = CreatePen(PS_SOLID, 1, COLOR_SIDEBAR_BORDER);
    HPEN hOldPen = (HPEN)SelectObject(hdc, hPenDivider);
    MoveToEx(hdc, 148, 0, NULL);
    LineTo(hdc, 148, rcClient.bottom);
    SelectObject(hdc, hOldPen);
    DeleteObject(hPenDivider);

    // 3. Tab-Specific Background Cards
    if (g_current_tab == 0) {
      // Main Tab: Status Header Card (enclosing Status, Hotkey)
      RECT rcStatusCard = {160, 14, 485, 78};
      draw_rounded_rect(hdc, &rcStatusCard, 12, COLOR_CARD_BG,
                        COLOR_CARD_BORDER, 1);

      // Main Tab: Activity Log Card
      RECT rcLogCard = {160, 136, 485, 439};
      draw_rounded_rect(hdc, &rcLogCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER,
                        1);
    } else if (g_current_tab == 1) {
      // Changelog Card
      RECT rcCard = {160, 16, 485, 437};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 2) {
      // Chat Settings Card (Sleek Modern Surface)
      RECT rcCard = {160, 14, 485, 350};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      // Input field backgrounds
      RECT rcIntervalBox = {402, 140, 469, 168};
      draw_rounded_rect(hdc, &rcIntervalBox, 6, COLOR_INPUT_BG,
                        COLOR_CARD_BORDER, 1);

      RECT rcTextBox = {172, 196, 469, 300};
      draw_rounded_rect(hdc, &rcTextBox, 6, COLOR_INPUT_BG, COLOR_CARD_BORDER,
                        1);
    } else if (g_current_tab == 3) {
      // Auto Voting Card (Minimal & Modern)
      RECT rcCard = {160, 14, 485, 220};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 4) {
      // Settings Cards (Hotkey Card & Update Card)
      RECT rcKeyCard = {160, 14, 485, 124};
      draw_rounded_rect(hdc, &rcKeyCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      RECT rcUpdateCard = {160, 130, 485, 260};
      draw_rounded_rect(hdc, &rcUpdateCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 5) {
      // Music Player Card (Sleek Modern Surface)
      RECT rcCard = {160, 14, 485, 304};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 6) {
      // Config: Method Selection Card (Top Card)
      RECT rcMethodCard = {160, 14, 485, 180};
      draw_rounded_rect(hdc, &rcMethodCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      // Config: Settings Card (Bottom Card)
      int mode = atomic_load(&g_anti_afk_mode);
      int bottomY = (mode == 1) ? 342 : 402;
      RECT rcParamsCard = {160, 194, 485, bottomY};
      draw_rounded_rect(hdc, &rcParamsCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 7) {
      // Status Tab: Box 1 (Player Profile Card)
      RECT rcProfileCard = {160, 16, 485, 124};
      draw_rounded_rect(hdc, &rcProfileCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      // Status Tab: Box 2 (Match Information Card)
      RECT rcMatchCard = {160, 138, 485, 340};
      draw_rounded_rect(hdc, &rcMatchCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 8) {
      // Webhook Tab: Discord Webhook Card
      RECT rcWebhookCard = {160, 14, 485, 336};
      draw_rounded_rect(hdc, &rcWebhookCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      // Input field backgrounds
      RECT rcUrlBox = {172, 118, 470, 148};
      draw_rounded_rect(hdc, &rcUrlBox, 6, COLOR_INPUT_BG, COLOR_CARD_BORDER, 1);

      RECT rcIdBox = {172, 194, 470, 224};
      draw_rounded_rect(hdc, &rcIdBox, 6, COLOR_INPUT_BG, COLOR_CARD_BORDER, 1);
    }

    // 4. Toast Notification Badge (Bottom-Right Corner)
    if (g_show_toast) {
      RECT rcToast = {rcClient.right - 100, rcClient.bottom - 36,
                      rcClient.right - 14, rcClient.bottom - 10};
      draw_rounded_rect(hdc, &rcToast, 12, RGB(16, 185, 129), RGB(52, 211, 153),
                        1);

      SelectObject(hdc, g_hFontNormal);
      SetTextColor(hdc, RGB(255, 255, 255));
      SetBkMode(hdc, TRANSPARENT);
      DrawTextW(hdc, g_toast_text, -1, &rcToast,
                DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    }

    EndPaint(hWnd, &ps);
    return 0;
  }

  case WM_DRAWITEM: {
    DRAWITEMSTRUCT *pDIS = (DRAWITEMSTRUCT *)lParam;
    if (pDIS) {
      handle_draw_item(hWnd, pDIS);
      return TRUE;
    }
    break;
  }

  case WM_COMMAND: {
    int wmId = LOWORD(wParam);
    switch (wmId) {
    case ID_NAV_CHANGELOGS:
      switch_tab(1);
      break;

    case ID_NAV_MAIN:
      switch_tab(0);
      break;

    case ID_NAV_STATUS:
      switch_tab(7);
      break;

    case ID_NAV_CONFIG:
      switch_tab(6);
      break;

    case ID_NAV_CHAT:
      switch_tab(2);
      break;

    case ID_NAV_AUTO_VOTING:
      switch_tab(3);
      break;

    case ID_NAV_MUSIC:
      switch_tab(5);
      break;

    case ID_NAV_WEBHOOK:
      switch_tab(8);
      break;

    case ID_NAV_SETTINGS:
      switch_tab(4);
      break;

    case ID_BTN_MUSIC_PLAY:
      music_toggle();
      break;

    case ID_BTN_START_STOP:
      if (atomic_load(&g_status))
        stop_spammer();
      else
        start_spammer();
      break;

    case ID_BTN_REBIND:
      if (atomic_load(&g_is_rebinding)) {
        atomic_store(&g_is_rebinding, 0);
        update_status_ui();
      } else {
        atomic_store(&g_is_rebinding_afk, 0);
        atomic_store(&g_is_rebinding, 1);
        trigger_rebind_capture();
        update_status_ui();
      }
      break;

    case ID_BTN_KEY_BADGE:
      if (atomic_load(&g_is_rebinding_afk)) {
        atomic_store(&g_is_rebinding_afk, 0);
        update_status_ui();
      } else {
        atomic_store(&g_is_rebinding, 0);
        atomic_store(&g_is_rebinding_afk, 1);
        trigger_rebind_capture();
        update_status_ui();
      }
      break;

    case ID_BTN_CHECK_UPDATE:
      if (!atomic_load(&g_is_updating)) {
        SetWindowTextW(g_hLblUpdateStatus, L"Checking for updates...");
        check_for_updates_async(1);
      }
      break;

    case ID_RADIO_VOTE_OFF:
      atomic_store(&g_auto_vote_mode, 0);
      save_config();
      InvalidateRect(g_hRadioVoteOff, NULL, TRUE);
      InvalidateRect(g_hRadioVoteYes, NULL, TRUE);
      InvalidateRect(g_hRadioVoteNo, NULL, TRUE);
      send_gui_log(L"[SETTINGS] Auto-Vote disabled.");
      break;

    case ID_RADIO_VOTE_YES:
      atomic_store(&g_auto_vote_mode, 1);
      save_config();
      InvalidateRect(g_hRadioVoteOff, NULL, TRUE);
      InvalidateRect(g_hRadioVoteYes, NULL, TRUE);
      InvalidateRect(g_hRadioVoteNo, NULL, TRUE);
      send_gui_log(L"[SETTINGS] Auto-Vote set to YES (F5).");
      break;

    case ID_RADIO_VOTE_NO:
      atomic_store(&g_auto_vote_mode, 2);
      save_config();
      InvalidateRect(g_hRadioVoteOff, NULL, TRUE);
      InvalidateRect(g_hRadioVoteYes, NULL, TRUE);
      InvalidateRect(g_hRadioVoteNo, NULL, TRUE);
      send_gui_log(L"[SETTINGS] Auto-Vote set to NO (F6).");
      break;

    case ID_RADIO_MODE_CLICK:
      atomic_store(&g_anti_afk_mode, 0);
      save_config();
      update_config_mode_ui();
      send_gui_log(L"[CONFIG] Anti-AFK Method set to Click Mode.");
      break;

    case ID_RADIO_MODE_HOLD:
      atomic_store(&g_anti_afk_mode, 1);
      save_config();
      update_config_mode_ui();
      send_gui_log(L"[CONFIG] Anti-AFK Method set to Hold Mode.");
      break;

    case ID_CHK_SLOW_MODE:
    case ID_BTN_DELAY_BADGE: {
      int cur = atomic_load(&g_slow_mode);
      int next = cur ? 0 : 1;
      atomic_store(&g_slow_mode, next);
      save_config();
      InvalidateRect(g_hChkSlowMode, NULL, TRUE);
      InvalidateRect(g_hBtnDelayBadge, NULL, TRUE);
      if (next) {
        send_gui_log(L"[CONFIG] Slow Mode activated: interval changed to 3.7s - 4.2s");
      } else {
        send_gui_log(L"[CONFIG] Slow Mode deactivated: interval returned to normal (900 – 1300 ms).");
      }
      break;
    }

    case ID_CHK_CHAT: {
      int cur_mode = atomic_load(&g_chat_mode);
      int new_mode = (cur_mode == 1) ? 0 : 1;
      if (new_mode == 1) {
        MessageBoxW(
            hWnd,
            L"Warning: Spamming Chat can lead to ingame ban for botting/Text Abuse.",
            L"Warning",
            MB_ICONWARNING | MB_OK);
      }
      atomic_store(&g_chat_mode, new_mode);
      save_config();
      InvalidateRect(g_hChkChat, NULL, TRUE);
      send_gui_log(new_mode ? L"[CHAT] Chat automation activated."
                            : L"[CHAT] Chat automation deactivated.");
      break;
    }

    case ID_COMBO_CHAT_TARGET: {
      HMENU hMenu = CreatePopupMenu();
      int cur_target = atomic_load(&g_chat_target);
      AppendMenuW(hMenu, MF_STRING | (cur_target == 0 ? MF_CHECKED : 0),
                  ID_MENU_CHAT_TEAM, L"Team Chat");
      AppendMenuW(hMenu, MF_STRING | (cur_target == 1 ? MF_CHECKED : 0),
                  ID_MENU_CHAT_ALL, L"All Chat (/all)");

      RECT rcBtn;
      GetWindowRect(g_hBtnChatChannel, &rcBtn);

      int cmd = TrackPopupMenu(
          hMenu, TPM_LEFTALIGN | TPM_TOPALIGN | TPM_RETURNCMD | TPM_NONOTIFY,
          rcBtn.left, rcBtn.bottom, 0, hWnd, NULL);
      DestroyMenu(hMenu);

      if (cmd == ID_MENU_CHAT_TEAM) {
        atomic_store(&g_chat_target, 0);
        save_config();
        SetWindowTextW(g_hBtnChatChannel, L"Team Chat");
        InvalidateRect(g_hBtnChatChannel, NULL, TRUE);
        send_gui_log(L"[CHAT] Target set to Team chat.");
      } else if (cmd == ID_MENU_CHAT_ALL) {
        atomic_store(&g_chat_target, 1);
        save_config();
        SetWindowTextW(g_hBtnChatChannel, L"All Chat (/all)");
        InvalidateRect(g_hBtnChatChannel, NULL, TRUE);
        send_gui_log(L"[CHAT] Target set to All chat.");
      }
      break;
    }

    case ID_EDIT_CHAT_INTERVAL:
      if (HIWORD(wParam) == EN_CHANGE) {
        wchar_t interval_text[32];
        GetWindowTextW(g_hEditChatInterval, interval_text, 32);
        long interval = wcstol(interval_text, NULL, 10);
        if (interval >= 1 && interval <= 86400) {
          atomic_store(&g_chat_interval, (int)interval);
          save_config();
        }
      } else if (HIWORD(wParam) == EN_KILLFOCUS) {
        wchar_t interval_text[32];
        GetWindowTextW(g_hEditChatInterval, interval_text, 32);
        long interval = wcstol(interval_text, NULL, 10);
        if (interval < 1 || interval > 86400) {
          interval = 180;
          SetWindowTextW(g_hEditChatInterval, L"180");
        }
        atomic_store(&g_chat_interval, (int)interval);
        save_config();
      }
      break;

    case ID_EDIT_CHAT_TEXT:
      if (HIWORD(wParam) == EN_CHANGE) {
        update_char_count_ui();
        wchar_t chat_text[512];
        GetWindowTextW(g_hEditChatText, chat_text, 512);
        EnterCriticalSection(&g_chat_lock);
        wcscpy_s(g_chat_text, 512, chat_text);
        LeaveCriticalSection(&g_chat_lock);
        save_config();
      }
      break;

    case ID_BTN_CHAT_EXAMPLE_1:
      SetWindowTextW(g_hEditChatText,
                     L"With great Power comes great Responsibility");
      update_char_count_ui();
      EnterCriticalSection(&g_chat_lock);
      wcscpy_s(g_chat_text, 512,
               L"With great Power comes great Responsibility");
      LeaveCriticalSection(&g_chat_lock);
      save_config();
      break;

    case ID_BTN_CHAT_EXAMPLE_2: {
      const wchar_t *preset2 =
          L"Wintrading refers to any actions that a player or group of players "
          L"may take in order to fix the outcome of a match, usually to boost "
          L"a player’s MMR, rank, or account level. Wintrading undermines the "
          L"integrity of the competitive experience and dilutes the value of "
          L"ranked play by predetermining the results of a match. "
          L"Additionally, players who find themselves in a fixed game are "
          L"thrust into a deeply negative experience over which they have no "
          L"control.";
      SetWindowTextW(g_hEditChatText, preset2);
      update_char_count_ui();
      EnterCriticalSection(&g_chat_lock);
      wcscpy_s(g_chat_text, 512, preset2);
      LeaveCriticalSection(&g_chat_lock);
      save_config();
      break;
    }

    case ID_BTN_WEBHOOK_SAVE: {
      wchar_t url[512] = {0};
      wchar_t uid[64] = {0};
      GetWindowTextW(g_hEditWebhookUrl, url, 512);
      GetWindowTextW(g_hEditWebhookUserId, uid, 64);
      EnterCriticalSection(&g_webhook_lock);
      wcscpy_s(g_webhook_url, 512, url);
      wcscpy_s(g_webhook_user_id, 64, uid);
      LeaveCriticalSection(&g_webhook_lock);
      save_config();
      SetWindowTextW(g_hLblWebhookStatus, L"✓ Webhook settings saved.");
      trigger_toast(hWnd, L"Saved");
      send_gui_log(L"[WEBHOOK] Settings saved to config.ini.");
      break;
    }

    case ID_BTN_WEBHOOK_TEST: {
      wchar_t url[512] = {0};
      wchar_t uid[64] = {0};
      GetWindowTextW(g_hEditWebhookUrl, url, 512);
      GetWindowTextW(g_hEditWebhookUserId, uid, 64);
      EnterCriticalSection(&g_webhook_lock);
      wcscpy_s(g_webhook_url, 512, url);
      wcscpy_s(g_webhook_user_id, 64, uid);
      LeaveCriticalSection(&g_webhook_lock);
      save_config();

      if (url[0] == L'\0') {
        SetWindowTextW(g_hLblWebhookStatus, L"Please enter a Webhook URL first.");
        send_gui_log(L"[WEBHOOK] Please enter a Webhook URL first.");
      } else {
        SetWindowTextW(g_hLblWebhookStatus, L"Sending test notification to Discord...");
        webhook_send_test(url, uid);
        trigger_toast(hWnd, L"Test Sent");
      }
      break;
    }

    case ID_EDIT_WEBHOOK_URL:
      if (HIWORD(wParam) == EN_CHANGE) {
        wchar_t url[512] = {0};
        GetWindowTextW(g_hEditWebhookUrl, url, 512);
        EnterCriticalSection(&g_webhook_lock);
        wcscpy_s(g_webhook_url, 512, url);
        LeaveCriticalSection(&g_webhook_lock);
        save_config();
      }
      break;

    case ID_EDIT_WEBHOOK_USER_ID:
      if (HIWORD(wParam) == EN_CHANGE) {
        wchar_t uid[64] = {0};
        GetWindowTextW(g_hEditWebhookUserId, uid, 64);
        EnterCriticalSection(&g_webhook_lock);
        wcscpy_s(g_webhook_user_id, 64, uid);
        LeaveCriticalSection(&g_webhook_lock);
        save_config();
      }
      break;
    }
    return 0;
  }

  case WM_APP_UPDATE_STATUS: {
    int triggered_by_hotkey = (int)wParam;
    if (triggered_by_hotkey) {
      if (atomic_load(&g_status)) {
        stop_spammer();
      } else {
        start_spammer();
      }
    } else {
      update_status_ui();
      if (g_current_tab == 7) {
        update_status_tab_ui();
      }
    }
    return 0;
  }

  case WM_APP_UPDATE_CHECK_RESULT: {
    int is_manual = (int)wParam;
    int status = (int)lParam; // 0 = error, 1 = newer version available, 2 = up-to-date

    if (status == 1) {
      // Newer version available!
      wchar_t prompt[256];
      swprintf_s(prompt, 256,
                 L"A new version (%s) of SageBot is available!\n\nWould you like to download and update now?",
                 g_latest_version_tag);

      if (g_hLblUpdateStatus) {
        wchar_t stBuf[128];
        swprintf_s(stBuf, 128, L"Update available: %s", g_latest_version_tag);
        SetWindowTextW(g_hLblUpdateStatus, stBuf);
      }

      int res = MessageBoxW(hWnd, prompt, L"Update Available",
                            MB_ICONINFORMATION | MB_YESNO | MB_DEFBUTTON1);
      if (res == IDYES) {
        start_download_update();
      }
    } else if (status == 2) {
      if (g_hLblUpdateStatus) {
        SetWindowTextW(g_hLblUpdateStatus, L"You are up to date.");
      }
      if (is_manual) {
        MessageBoxW(hWnd, L"You are already running the latest version of SageBot.",
                    L"No Updates", MB_ICONINFORMATION | MB_OK);
      }
    } else {
      if (g_hLblUpdateStatus) {
        SetWindowTextW(g_hLblUpdateStatus, L"Failed to check for updates.");
      }
      if (is_manual) {
        MessageBoxW(hWnd, L"Unable to connect to GitHub releases.\nPlease check your internet connection.",
                    L"Update Check Failed", MB_ICONWARNING | MB_OK);
      }
    }
    return 0;
  }

  case WM_APP_UPDATE_DOWNLOAD_DONE: {
    int success = (int)wParam;
    atomic_store(&g_is_updating, 0);

    if (success) {
      if (g_hLblUpdateStatus) {
        SetWindowTextW(g_hLblUpdateStatus, L"Update complete! Restarting...");
      }
      MessageBoxW(hWnd, L"Update downloaded successfully!\nSageBot will now restart to apply the update.",
                  L"Updating", MB_ICONINFORMATION | MB_OK);
      apply_update_and_restart();
    } else {
      if (g_hLblUpdateStatus) {
        SetWindowTextW(g_hLblUpdateStatus, L"Update download failed.");
      }
      MessageBoxW(hWnd, L"Failed to download the update.\nPlease try again later or download from GitHub.",
                  L"Update Failed", MB_ICONERROR | MB_OK);
    }
    return 0;
  }

  case WM_HSCROLL: {
    HWND hScroll = (HWND)lParam;
    if (hScroll == g_hSliderMusicPos) {
      int code = LOWORD(wParam);
      if (code == TB_THUMBTRACK) {
        g_music_user_seeking = 1;
        int cur_s = HIWORD(wParam);
        int tot_s = g_music_length_ms / 1000;
        wchar_t timeBuf[64];
        swprintf_s(timeBuf, 64, L"%02d:%02d / %02d:%02d", cur_s / 60, cur_s % 60,
                   tot_s / 60, tot_s % 60);
        SetWindowTextW(g_hLblMusicTime, timeBuf);
      } else if (code == TB_THUMBPOSITION || code == TB_ENDTRACK) {
        int pos_s = (int)SendMessageW(g_hSliderMusicPos, TBM_GETPOS, 0, 0);
        music_seek_to(pos_s * 1000);
        g_music_user_seeking = 0;
      }
    } else if (hScroll == g_hSliderMusicVol) {
      int vol = (int)SendMessageW(g_hSliderMusicVol, TBM_GETPOS, 0, 0);
      music_set_volume(vol);
    }
    return 0;
  }

  case WM_TIMER: {
    if (wParam == ID_TIMER_TOAST) {
      KillTimer(hWnd, ID_TIMER_TOAST);
      g_show_toast = 0;
      InvalidateRect(hWnd, NULL, TRUE);
    } else if (wParam == ID_TIMER_MUSIC) {
      if (g_music_playing) {
        music_update_progress();
      }
    } else if (wParam == ID_TIMER_ROUND_UPDATE) {
      wchar_t roundText[64];
      get_round_display_text(roundText, 64);
      if (g_hLblRoundVal) {
        wchar_t curText[64];
        GetWindowTextW(g_hLblRoundVal, curText, 64);
        if (wcscmp(curText, roundText) != 0) {
          SetWindowTextW(g_hLblRoundVal, roundText);
          InvalidateRect(g_hLblRoundVal, NULL, TRUE);
        }
      }
      if (g_current_tab == 7) {
        update_status_tab_ui();
      }
    }
    return 0;
  }

  case WM_APP_LOG: {
    wchar_t *heapMsg = (wchar_t *)lParam;
    if (heapMsg) {
      append_log_ui(heapMsg);
      free(heapMsg);
    }
    return 0;
  }

  case WM_CTLCOLORSTATIC:
  case WM_CTLCOLORBTN: {
    HDC hdcStatic = (HDC)wParam;
    HWND hCtl = (HWND)lParam;

    SetBkMode(hdcStatic, TRANSPARENT);

    if (hCtl == g_hLblStatusVal || hCtl == g_hLblHotkeyVal) {
      if (atomic_load(&g_status)) {
        SetTextColor(hdcStatic, RGB(52, 211, 153)); // Neon Emerald (#34d399)
      } else {
        SetTextColor(hdcStatic, RGB(248, 113, 113)); // Light Coral (#f87171)
      }
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblRoundVal) {
      SetTextColor(hdcStatic, RGB(167, 139, 250)); // Sleek Light Purple (#a78bfa)
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblStatusTitle || hCtl == g_hLblHotkeyTitle || hCtl == g_hLblRoundTitle) {
      SetTextColor(hdcStatic, COLOR_TEXT_SECONDARY);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblRiotIdVal) {
      SetTextColor(hdcStatic, RGB(255, 255, 255));
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblRankVal) {
      SetTextColor(hdcStatic, RGB(245, 158, 11)); // Amber/Gold
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblMapVal) {
      SetTextColor(hdcStatic, RGB(52, 211, 153)); // Emerald
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblGamemodeVal) {
      SetTextColor(hdcStatic, RGB(96, 165, 250)); // Sky Blue
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblPhaseVal) {
      SetTextColor(hdcStatic, RGB(244, 114, 182)); // Rose
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblAgentVal) {
      SetTextColor(hdcStatic, RGB(167, 139, 250)); // Sleek Purple
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblBox1Header || hCtl == g_hLblBox2Header) {
      SetTextColor(hdcStatic, RGB(167, 139, 250));
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblRiotIdTitle || hCtl == g_hLblRankTitle ||
        hCtl == g_hLblMapTitle || hCtl == g_hLblGamemodeTitle ||
        hCtl == g_hLblPhaseTitle || hCtl == g_hLblAgentTitle) {
      SetTextColor(hdcStatic, COLOR_TEXT_SECONDARY);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblWebhookStatus) {
      SetTextColor(hdcStatic, RGB(167, 139, 250)); // Soft purple
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblChatHeader || hCtl == g_hLblVoteHeader ||
        hCtl == g_hLblConfigHeader || hCtl == g_hLblClickSettingsTitle ||
        hCtl == g_hLblSettingsHeader || hCtl == g_hLblMusicHeader ||
        hCtl == g_hLblMusicTitle || hCtl == g_hLblWebhookHeader ||
        hCtl == g_hLblWebhookUrl || hCtl == g_hLblWebhookUserId) {
      SetTextColor(hdcStatic, COLOR_TEXT_PRIMARY);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblChatDescription || hCtl == g_hLblSettingsHelp ||
        hCtl == g_hLblPresets || hCtl == g_hLblVoteSub ||
        hCtl == g_hLblConfigSub || hCtl == g_hLblClickSettingsSub ||
        hCtl == g_hLblIntervalNote || hCtl == g_hLblSlowModeDesc ||
        hCtl == g_hLblChatCharCount || hCtl == g_hLblMusicSub ||
        hCtl == g_hLblMusicArtist || hCtl == g_hLblMusicTime ||
        hCtl == g_hLblMusicVol || hCtl == g_hLblWebhookSub ||
        hCtl == g_hLblWebhookUrlNote || hCtl == g_hLblWebhookUserIdNote ||
        hCtl == g_hLblWebhookHint) {
      SetTextColor(hdcStatic, COLOR_TEXT_MUTED);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hChkChat || hCtl == g_hLblChatToggle ||
        hCtl == g_hLblChatChannel || hCtl == g_hRadioVoteOff ||
        hCtl == g_hRadioVoteYes || hCtl == g_hRadioVoteNo ||
        hCtl == g_hLblClickKeyTitle || hCtl == g_hLblIntervalTitle ||
        hCtl == g_hLblSlowModeTitle || hCtl == g_hChkSlowMode ||
        hCtl == g_hLblSettingsKeyTitle) {
      SetTextColor(hdcStatic, COLOR_TEXT_PRIMARY);
      return (INT_PTR)g_hCardBgBrush;
    }

    SetTextColor(hdcStatic, COLOR_TEXT_SECONDARY);
    return (INT_PTR)g_hCardBgBrush;
  }

  case WM_CTLCOLOREDIT: {
    HDC hdcEdit = (HDC)wParam;
    HWND hCtl = (HWND)lParam;

    if (hCtl == g_hEditChatInterval || hCtl == g_hEditChatText ||
        hCtl == g_hEditWebhookUrl || hCtl == g_hEditWebhookUserId) {
      SetBkColor(hdcEdit, COLOR_INPUT_BG);
      SetTextColor(hdcEdit, COLOR_TEXT_PRIMARY);
      return (INT_PTR)g_hInputBgBrush;
    }

    SetBkColor(hdcEdit, COLOR_CARD_BG);
    SetTextColor(hdcEdit, RGB(203, 213, 225)); // Slate 300
    return (INT_PTR)g_hCardBgBrush;
  }

  case WM_DESTROY: {
    atomic_store(&g_status, 0);
    atomic_store(&g_listener, 0);
    atomic_store(&g_is_rebinding, 0);
    atomic_store(&g_is_rebinding_afk, 0);
    round_tracker_cleanup();
    KillTimer(hWnd, ID_TIMER_ROUND_UPDATE);
    music_cleanup();

    if (g_hAppIcon) {
      DestroyIcon(g_hAppIcon);
      g_hAppIcon = NULL;
    }

    DeleteObject(g_hBaseBgBrush);
    DeleteObject(g_hSidebarBgBrush);
    DeleteObject(g_hCardBgBrush);
    DeleteObject(g_hInputBgBrush);

    DeleteObject(g_hFontBrand);
    DeleteObject(g_hFontTitle);
    DeleteObject(g_hFontHeader);
    DeleteObject(g_hFontNormal);
    DeleteObject(g_hFontSmall);
    DeleteObject(g_hFontMonospace);
    DeleteCriticalSection(&g_chat_lock);

    PostQuitMessage(0);
    return 0;
  }
  }
  return DefWindowProcW(hWnd, msg, wParam, lParam);
}

// Entry Point
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                   LPSTR lpCmdLine, int nCmdShow) {
  (void)hPrevInstance;
  (void)lpCmdLine;

  INITCOMMONCONTROLSEX icex;
  icex.dwSize = sizeof(INITCOMMONCONTROLSEX);
  icex.dwICC = ICC_STANDARD_CLASSES | ICC_PROGRESS_CLASS;
  InitCommonControlsEx(&icex);
  // Single Instance Protection
  HANDLE hMutex = CreateMutexW(NULL, TRUE, L"SageBot_SingleInstance_Mutex");
  if (GetLastError() == ERROR_ALREADY_EXISTS) {
    if (hMutex) {
      CloseHandle(hMutex);
    }
    HWND hExistingWnd = FindWindowW(L"SageBotGUIClass", NULL);
    if (hExistingWnd) {
      if (IsIconic(hExistingWnd)) {
        ShowWindow(hExistingWnd, SW_RESTORE);
      } else {
        ShowWindow(hExistingWnd, SW_SHOW);
      }
      SetForegroundWindow(hExistingWnd);
    }
    return 0;
  }

  OleInitialize(NULL);

  srand((unsigned int)time(NULL));

  HICON hAppIcon = (HICON)LoadImageW(
      hInstance, MAKEINTRESOURCEW(1), IMAGE_ICON, 32, 32, LR_DEFAULTCOLOR);
  if (!hAppIcon) {
    hAppIcon = (HICON)LoadImageW(
        NULL, L"assets\\sage.ico", IMAGE_ICON, 32, 32, LR_LOADFROMFILE);
  }

  HICON hAppIconSm = (HICON)LoadImageW(
      hInstance, MAKEINTRESOURCEW(1), IMAGE_ICON, 16, 16, LR_DEFAULTCOLOR);
  if (!hAppIconSm) {
    hAppIconSm = (HICON)LoadImageW(
        NULL, L"assets\\sage.ico", IMAGE_ICON, 16, 16, LR_LOADFROMFILE);
  }

  WNDCLASSEXW wcSlider = {0};
  wcSlider.cbSize = sizeof(WNDCLASSEXW);
  wcSlider.style = CS_HREDRAW | CS_VREDRAW;
  wcSlider.lpfnWndProc = CustomSliderProc;
  wcSlider.hInstance = hInstance;
  wcSlider.hCursor = LoadCursor(NULL, IDC_HAND);
  wcSlider.lpszClassName = L"SageBotSlider";
  RegisterClassExW(&wcSlider);

  WNDCLASSEXW wc = {0};
  wc.cbSize = sizeof(WNDCLASSEXW);
  wc.style = CS_HREDRAW | CS_VREDRAW;
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInstance;
  wc.hIcon = hAppIcon;
  wc.hIconSm = hAppIconSm;
  wc.hCursor = LoadCursor(NULL, IDC_ARROW);
  wc.hbrBackground = CreateSolidBrush(COLOR_BASE_BG);
  wc.lpszClassName = L"SageBotGUIClass";

  if (!RegisterClassExW(&wc)) {
    MessageBoxW(NULL, L"Window Registration Failed!", L"Error",
                MB_ICONEXCLAMATION | MB_OK);
    return 0;
  }

  DWORD dwStyle = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX;
  RECT rect = {0, 0, 505, 455};
  AdjustWindowRect(&rect, dwStyle, FALSE);

  HWND hWnd = CreateWindowExW(0, L"SageBotGUIClass",
                              L"SageBot", dwStyle, CW_USEDEFAULT, CW_USEDEFAULT,
                              rect.right - rect.left, rect.bottom - rect.top,
                              NULL, NULL, hInstance, NULL);

  if (!hWnd) {
    MessageBoxW(NULL, L"Window Creation Failed!", L"Error",
                MB_ICONEXCLAMATION | MB_OK);
    return 0;
  }

  // Set Window & Taskbar Icon
  if (hAppIcon) {
    SendMessageW(hWnd, WM_SETICON, ICON_BIG, (LPARAM)hAppIcon);
  }
  if (hAppIconSm) {
    SendMessageW(hWnd, WM_SETICON, ICON_SMALL, (LPARAM)hAppIconSm);
  }

  // Enable Windows Immersive Dark Mode for Title Bar
  BOOL darkMode = TRUE;
  DwmSetWindowAttribute(hWnd, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, &darkMode,
                        sizeof(darkMode));
  DwmSetWindowAttribute(hWnd,
                        19 /* DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 */,
                        &darkMode, sizeof(darkMode));

  ShowWindow(hWnd, nCmdShow);
  UpdateWindow(hWnd);

  MSG msg;
  while (GetMessageW(&msg, NULL, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }

  if (hMutex) {
    CloseHandle(hMutex);
  }

  OleUninitialize();
  return (int)msg.wParam;
}
