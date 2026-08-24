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
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <uxtheme.h>

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "uxtheme.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "winmm.lib")

// Defines & Constants
#define RUN_SECONDS 4800
#define CONFIG_FILE_NAME "config.ini"

#define TAB_MIN_MS 900
#define TAB_RAND_MS 400

#define LISTENER_LOOP_MS 50
#define STOP_CHECK_MS 50
#define SUPPRESS_WINDOW_MS 80

#define LOG_DIR "log"
#define LOG_FILE "log\\log.txt"
#define CHANGELOG_FILE "changelog.txt"

// Custom Windows Messages
#define WM_APP_LOG (WM_USER + 2)
#define WM_APP_UPDATE_STATUS (WM_USER + 3)

// Control IDs
#define ID_NAV_CHANGELOGS 1000
#define ID_NAV_MAIN 1001
#define ID_NAV_CHAT 1002
#define ID_NAV_AUTO_VOTING 1003
#define ID_NAV_MUSIC 1005
#define ID_NAV_SETTINGS 1004

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

#define ID_BTN_MUSIC_PLAY 1050
#define ID_SLIDER_MUSIC_POS 1051
#define ID_SLIDER_MUSIC_VOL 1052
#define ID_TIMER_MUSIC 1053

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

// Global State Variables
static HWND g_hWnd = NULL;
static HWND g_hNavMain = NULL;
static HWND g_hNavChat = NULL;
static HWND g_hNavAutoVoting = NULL;
static HWND g_hNavMusic = NULL;
static HWND g_hNavChangelogs = NULL;
static HWND g_hNavSettings = NULL;

// Main Tab Controls
static HWND g_hLblStatusTitle = NULL;
static HWND g_hLblStatusVal = NULL;
static HWND g_hLblHotkeyTitle = NULL;
static HWND g_hLblHotkeyVal = NULL;
static HWND g_hBtnStart = NULL;
static HWND g_hEditLog = NULL;

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
static HWND g_hBtnChatSave = NULL;
static HWND g_hLblPresets = NULL;
static HWND g_hBtnChatExample1 = NULL;
static HWND g_hBtnChatExample2 = NULL;

// Toast Notification State
static int g_show_toast = 0;
static wchar_t g_toast_text[64] = L"";
#define ID_TIMER_TOAST 999

// Auto-Vote Tab Controls
static HWND g_hLblVoteHeader = NULL;
static HWND g_hLblVoteSub = NULL;
static HWND g_hRadioVoteOff = NULL;
static HWND g_hRadioVoteYes = NULL;
static HWND g_hRadioVoteNo = NULL;

// Music Player Tab Controls & State
static HWND g_hLblMusicHeader = NULL;
static HWND g_hLblMusicSub = NULL;
static HWND g_hLblMusicTitle = NULL;
static HWND g_hLblMusicArtist = NULL;
static HWND g_hBtnMusicPlay = NULL;
static HWND g_hSliderMusicPos = NULL;
static HWND g_hLblMusicTime = NULL;
static HWND g_hSliderMusicVol = NULL;
static HWND g_hLblMusicVol = NULL;
static HBITMAP g_hBmpMusicCover = NULL;
static int g_music_playing = 0;
static int g_music_opened = 0;
static int g_music_length_ms = 0;
static int g_music_volume = 80; // 0 to 100
static int g_music_user_seeking = 0;

// Settings Tab Controls
static HWND g_hLblSettingsHeader = NULL;
static HWND g_hLblSettingsHelp = NULL;
static HWND g_hLblSettingsKeyTitle = NULL;
static HWND g_hLblSettingsKeyBadge = NULL;
static HWND g_hBtnRebind = NULL;
static HWND g_hLblSettingsNote = NULL;

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

static atomic_int g_status = 0;
static atomic_int g_pressed = 0;
static atomic_int g_listener = 1;
static atomic_int g_playpause_vk = VK_F9;
static atomic_int g_auto_vote_mode = 0; // 0=off, 1=Yes (F5), 2=No (F6)
static atomic_int g_chat_mode = 0;      // 0=off, 1=on
static atomic_int g_chat_target = 0;    // 0=team, 1=all
static atomic_int g_chat_interval = 180;
static wchar_t g_chat_text[512] =
    L"With great Power comes great Responsibility";
static CRITICAL_SECTION g_chat_lock;
static atomic_int g_suppress_hotkey = 0;
static atomic_int g_is_rebinding = 0;
static int g_current_tab =
    0; // 0=MAIN, 1=CHANGELOG, 2=CHAT, 3=AUTO VOTING, 4=SETTINGS

static wchar_t g_config_path[MAX_PATH] = L"config.ini";
static HANDLE g_hSpammerThread = NULL;
static HANDLE g_hHotkeyThread = NULL;

// Forward Declarations
static void init_config_path(void);
static void load_config(void);
static void save_config(void);
static void append_log_ui(const wchar_t *text);
static void update_status_ui(void);
static void start_spammer(void);
static void stop_spammer(void);
static void switch_tab(int tab_id);
static void load_changelog_ui(void);
static void get_key_name_w(int vk, wchar_t *buf, size_t size);
static void draw_rounded_rect(HDC hdc, RECT *r, int radius, COLORREF fill,
                              COLORREF border, int borderWidth);

#include <olectl.h>

static HBITMAP load_jpeg_from_resource_or_file(int resId, const wchar_t *fallbackPath,
                                               int targetW, int targetH) {
  IStream *pStream = NULL;
  DWORD dwSize = 0;

  // 1. Try loading directly from embedded exe resources
  HRSRC hRes = FindResourceW(NULL, MAKEINTRESOURCEW(resId), RT_RCDATA);
  if (hRes) {
    HGLOBAL hResData = LoadResource(NULL, hRes);
    if (hResData) {
      dwSize = SizeofResource(NULL, hRes);
      void *pData = LockResource(hResData);
      if (pData && dwSize > 0) {
        HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, dwSize);
        if (hMem) {
          void *pMemData = GlobalLock(hMem);
          if (pMemData) {
            memcpy(pMemData, pData, dwSize);
            GlobalUnlock(hMem);
            CreateStreamOnHGlobal(hMem, TRUE, &pStream);
          } else {
            GlobalFree(hMem);
          }
        }
      }
    }
  }

  // 2. Fallback to reading file from disk if not found in resources
  if (!pStream && fallbackPath) {
    wchar_t fullPath[MAX_PATH];
    if (GetFullPathNameW(fallbackPath, MAX_PATH, fullPath, NULL) == 0) {
      wcsncpy_s(fullPath, MAX_PATH, fallbackPath, _TRUNCATE);
    }
    HANDLE hFile = CreateFileW(fullPath, GENERIC_READ, FILE_SHARE_READ, NULL,
                               OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hFile != INVALID_HANDLE_VALUE) {
      dwSize = GetFileSize(hFile, NULL);
      if (dwSize > 0 && dwSize != INVALID_FILE_SIZE) {
        HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, dwSize);
        if (hMem) {
          void *pMemData = GlobalLock(hMem);
          if (pMemData) {
            DWORD dwRead = 0;
            ReadFile(hFile, pMemData, dwSize, &dwRead, NULL);
            GlobalUnlock(hMem);
            CreateStreamOnHGlobal(hMem, TRUE, &pStream);
          } else {
            GlobalFree(hMem);
          }
        }
      }
      CloseHandle(hFile);
    }
  }

  if (!pStream) {
    return NULL;
  }

  IPicture *pPicture = NULL;
  HRESULT hr = OleLoadPicture(pStream, dwSize, FALSE, &IID_IPicture, (void **)&pPicture);
  pStream->lpVtbl->Release(pStream);

  if (FAILED(hr) || !pPicture) {
    return NULL;
  }

  long hmWidth = 0;
  long hmHeight = 0;
  pPicture->lpVtbl->get_Width(pPicture, &hmWidth);
  pPicture->lpVtbl->get_Height(pPicture, &hmHeight);

  HDC hdcScreen = GetDC(NULL);
  HDC hdcMem = CreateCompatibleDC(hdcScreen);
  HBITMAP hBmp = CreateCompatibleBitmap(hdcScreen, targetW, targetH);
  HBITMAP hOldBmp = (HBITMAP)SelectObject(hdcMem, hBmp);

  RECT rc = {0, 0, targetW, targetH};
  HBRUSH hBr = CreateSolidBrush(COLOR_CARD_BG);
  FillRect(hdcMem, &rc, hBr);
  DeleteObject(hBr);

  pPicture->lpVtbl->Render(pPicture, hdcMem, 0, 0, targetW, targetH, 0,
                           hmHeight, hmWidth, -hmHeight, NULL);

  SelectObject(hdcMem, hOldBmp);
  DeleteDC(hdcMem);
  ReleaseDC(NULL, hdcScreen);
  pPicture->lpVtbl->Release(pPicture);

  return hBmp;
}

// Custom Slider Window Procedure (Zero Windows Trackbar Artifacts)
static LRESULT CALLBACK CustomSliderProc(HWND hWnd, UINT uMsg, WPARAM wParam,
                                         LPARAM lParam) {
  switch (uMsg) {
  case WM_CREATE: {
    SetWindowLongPtr(hWnd, GWLP_USERDATA, 0);
    return 0;
  }

  case WM_ERASEBKGND:
    return 1;

  case WM_LBUTTONDOWN:
  case WM_MOUSEMOVE: {
    if (uMsg == WM_LBUTTONDOWN || (wParam & MK_LBUTTON)) {
      if (uMsg == WM_LBUTTONDOWN) {
        SetCapture(hWnd);
      }
      int mouseX = GET_X_LPARAM(lParam);
      RECT rc;
      GetClientRect(hWnd, &rc);
      int padX = 8;
      int trackW = rc.right - rc.left - (padX * 2);
      if (trackW > 0) {
        int clampedX = mouseX - padX;
        if (clampedX < 0)
          clampedX = 0;
        if (clampedX > trackW)
          clampedX = trackW;

        int minVal = (int)(INT_PTR)GetPropW(hWnd, L"MinVal");
        int maxVal = (int)(INT_PTR)GetPropW(hWnd, L"MaxVal");
        if (maxVal <= minVal)
          maxVal = 100;

        int curPos = (int)GetWindowLongPtr(hWnd, GWLP_USERDATA);
        int newPos = minVal + (clampedX * (maxVal - minVal)) / trackW;
        if (newPos != curPos || uMsg == WM_LBUTTONDOWN) {
          SetWindowLongPtr(hWnd, GWLP_USERDATA, (LONG_PTR)newPos);

          HWND hParent = GetParent(hWnd);
          if (hParent) {
            SendMessageW(hParent, WM_HSCROLL,
                         MAKEWPARAM(TB_THUMBTRACK, newPos), (LPARAM)hWnd);
          }
          InvalidateRect(hWnd, NULL, FALSE);
        }
      }
      return 0;
    }
    break;
  }

  case WM_LBUTTONUP: {
    if (GetCapture() == hWnd) {
      ReleaseCapture();
    }
    int pos = (int)GetWindowLongPtr(hWnd, GWLP_USERDATA);
    HWND hParent = GetParent(hWnd);
    if (hParent) {
      SendMessageW(hParent, WM_HSCROLL,
                   MAKEWPARAM(TB_ENDTRACK, pos), (LPARAM)hWnd);
    }
    RedrawWindow(hWnd, NULL, NULL, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ERASE);
    return 0;
  }

  case TBM_GETPOS:
    return GetWindowLongPtr(hWnd, GWLP_USERDATA);

  case TBM_SETPOS: {
    BOOL redraw = (BOOL)wParam;
    SetWindowLongPtr(hWnd, GWLP_USERDATA, (LONG_PTR)lParam);
    if (redraw) {
      RedrawWindow(hWnd, NULL, NULL, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ERASE);
    }
    return 0;
  }

  case TBM_SETRANGE: {
    int minVal = LOWORD(lParam);
    int maxVal = HIWORD(lParam);
    SetPropW(hWnd, L"MinVal", (HANDLE)(INT_PTR)minVal);
    SetPropW(hWnd, L"MaxVal", (HANDLE)(INT_PTR)maxVal);
    return 0;
  }

  case TBM_GETRANGEMIN:
    return (LRESULT)(INT_PTR)GetPropW(hWnd, L"MinVal");

  case TBM_GETRANGEMAX: {
    int maxVal = (int)(INT_PTR)GetPropW(hWnd, L"MaxVal");
    return (maxVal <= 0) ? 100 : maxVal;
  }

  case WM_PAINT: {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hWnd, &ps);

    RECT rcClient;
    GetClientRect(hWnd, &rcClient);

    // Double buffer full control area
    HDC hdcMem = CreateCompatibleDC(hdc);
    HBITMAP hbmMem = CreateCompatibleBitmap(hdc, rcClient.right, rcClient.bottom);
    HBITMAP hbmOld = (HBITMAP)SelectObject(hdcMem, hbmMem);

    // Dark solid card background
    HBRUSH hBrBg = CreateSolidBrush(COLOR_CARD_BG);
    FillRect(hdcMem, &rcClient, hBrBg);
    DeleteObject(hBrBg);

    int pos = (int)GetWindowLongPtr(hWnd, GWLP_USERDATA);
    int minVal = (int)(INT_PTR)GetPropW(hWnd, L"MinVal");
    int maxVal = (int)(INT_PTR)GetPropW(hWnd, L"MaxVal");
    if (maxVal <= minVal)
      maxVal = 100;

    int padX = 8;
    int trackW = rcClient.right - rcClient.left - (padX * 2);
    int cy = (rcClient.top + rcClient.bottom) / 2;
    int trackH = 4;
    RECT rcTrack = {padX, cy - (trackH / 2), padX + trackW, cy + (trackH / 2)};

    // Dark slate background line
    draw_rounded_rect(hdcMem, &rcTrack, 2, RGB(45, 45, 60), RGB(65, 65, 85), 0);

    // Calculate filled width
    int fillW = ((pos - minVal) * trackW) / (maxVal - minVal);
    if (fillW < 0)
      fillW = 0;
    if (fillW > trackW)
      fillW = trackW;

    // Filled vibrant purple glow line
    if (fillW > 0) {
      RECT rcFill = {rcTrack.left, rcTrack.top, rcTrack.left + fillW, rcTrack.bottom};
      draw_rounded_rect(hdcMem, &rcFill, 2, RGB(139, 92, 246), RGB(167, 139, 250), 0);
    }

    // Centered Circle Thumb
    int thumbX = rcTrack.left + fillW;
    int r = 6;

    // Outer Purple Ring
    HBRUSH hBrRing = CreateSolidBrush(RGB(139, 92, 246));
    HPEN hPenRing = CreatePen(PS_SOLID, 1, RGB(167, 139, 250));
    HBRUSH hOldBr = (HBRUSH)SelectObject(hdcMem, hBrRing);
    HPEN hOldPen = (HPEN)SelectObject(hdcMem, hPenRing);
    Ellipse(hdcMem, thumbX - r, cy - r, thumbX + r, cy + r);

    // Inner White Dot
    HBRUSH hBrWhite = CreateSolidBrush(RGB(255, 255, 255));
    HPEN hPenWhite = CreatePen(PS_SOLID, 1, RGB(255, 255, 255));
    SelectObject(hdcMem, hBrWhite);
    SelectObject(hdcMem, hPenWhite);
    Ellipse(hdcMem, thumbX - (r - 2), cy - (r - 2), thumbX + (r - 2), cy + (r - 2));

    SelectObject(hdcMem, hOldBr);
    SelectObject(hdcMem, hOldPen);
    DeleteObject(hBrRing);
    DeleteObject(hPenRing);
    DeleteObject(hBrWhite);
    DeleteObject(hPenWhite);

    BitBlt(hdc, 0, 0, rcClient.right, rcClient.bottom, hdcMem, 0, 0, SRCCOPY);
    SelectObject(hdcMem, hbmOld);
    DeleteObject(hbmMem);
    DeleteDC(hdcMem);
    EndPaint(hWnd, &ps);
    return 0;
  }

  case WM_DESTROY:
    RemovePropW(hWnd, L"MinVal");
    RemovePropW(hWnd, L"MaxVal");
    break;
  }
  return DefWindowProcW(hWnd, uMsg, wParam, lParam);
}

// Drawing Helper
static LRESULT CALLBACK EditSubclassProc(HWND hWnd, UINT uMsg, WPARAM wParam,
                                         LPARAM lParam, UINT_PTR uIdSubclass,
                                         DWORD_PTR dwRefData) {
  (void)uIdSubclass;
  (void)dwRefData;
  if (uMsg == WM_KEYDOWN) {
    if (wParam == 'A' && (GetKeyState(VK_CONTROL) & 0x8000)) {
      SendMessageW(hWnd, EM_SETSEL, 0, -1);
      return 0;
    }
  } else if (uMsg == WM_CHAR) {
    // Suppress beep on Ctrl+A
    if (wParam == 1) {
      return 0;
    }
  } else if (uMsg == WM_NCDESTROY) {
    RemoveWindowSubclass(hWnd, EditSubclassProc, uIdSubclass);
  }
  return DefSubclassProc(hWnd, uMsg, wParam, lParam);
}

static void draw_rounded_rect(HDC hdc, RECT *r, int radius, COLORREF fill,
                              COLORREF border, int borderWidth) {
  HBRUSH hBrush = CreateSolidBrush(fill);
  HPEN hPen = (borderWidth > 0) ? CreatePen(PS_SOLID, borderWidth, border)
                                : CreatePen(PS_NULL, 0, 0);
  HBRUSH hOldBrush = (HBRUSH)SelectObject(hdc, hBrush);
  HPEN hOldPen = (HPEN)SelectObject(hdc, hPen);

  RoundRect(hdc, r->left, r->top, r->right, r->bottom, radius, radius);

  SelectObject(hdc, hOldBrush);
  SelectObject(hdc, hOldPen);
  DeleteObject(hBrush);
  DeleteObject(hPen);
}

// Path & Config Utilities
static void init_config_path(void) {
  wchar_t exePath[MAX_PATH];
  DWORD len = GetModuleFileNameW(NULL, exePath, MAX_PATH);
  if (len == 0 || len >= MAX_PATH) {
    wcscpy_s(g_config_path, MAX_PATH, L"config.ini");
    return;
  }
  for (int i = (int)len - 1; i >= 0; --i) {
    if (exePath[i] == L'\\' || exePath[i] == L'/') {
      exePath[i + 1] = L'\0';
      break;
    }
  }
  wcscpy_s(g_config_path, MAX_PATH, exePath);
  wcscat_s(g_config_path, MAX_PATH, L"config.ini");
}

static void save_config(void) {
  wchar_t buf[32];
  wchar_t chat_text[512];

  swprintf_s(buf, 32, L"%d", atomic_load(&g_playpause_vk));
  WritePrivateProfileStringW(L"Settings", L"PlayPause", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_auto_vote_mode));
  WritePrivateProfileStringW(L"Settings", L"AutoVote", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_chat_mode));
  WritePrivateProfileStringW(L"Chat", L"Enabled", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_chat_target));
  WritePrivateProfileStringW(L"Chat", L"Target", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_chat_interval));
  WritePrivateProfileStringW(L"Chat", L"Interval", buf, g_config_path);

  EnterCriticalSection(&g_chat_lock);
  wcscpy_s(chat_text, 512, g_chat_text);
  LeaveCriticalSection(&g_chat_lock);
  WritePrivateProfileStringW(L"Chat", L"Text", chat_text, g_config_path);
}

static void load_config(void) {
  int playpause =
      GetPrivateProfileIntW(L"Settings", L"PlayPause", VK_F9, g_config_path);
  int autovote =
      GetPrivateProfileIntW(L"Settings", L"AutoVote", 0, g_config_path);
  int chat_mode = GetPrivateProfileIntW(
      L"Chat", L"Enabled",
      GetPrivateProfileIntW(L"Settings", L"UncleBenQuote", 0, g_config_path),
      g_config_path);
  int chat_target = GetPrivateProfileIntW(L"Chat", L"Target", 0, g_config_path);
  int chat_interval =
      GetPrivateProfileIntW(L"Chat", L"Interval", 180, g_config_path);
  wchar_t chat_text[512];

  if (playpause < 8 || playpause > 254 || playpause == VK_LBUTTON ||
      playpause == VK_RBUTTON || playpause == VK_MBUTTON) {
    playpause = VK_F9;
  }
  if (autovote < 0 || autovote > 2)
    autovote = 0;
  if (chat_mode < 0 || chat_mode > 1)
    chat_mode = 0;
  if (chat_target < 0 || chat_target > 1)
    chat_target = 0;
  if (chat_interval < 1 || chat_interval > 86400)
    chat_interval = 180;
  GetPrivateProfileStringW(L"Chat", L"Text",
                           L"With great Power comes great Responsibility",
                           chat_text, 512, g_config_path);

  atomic_store(&g_playpause_vk, playpause);
  atomic_store(&g_auto_vote_mode, autovote);
  atomic_store(&g_chat_mode, chat_mode);
  atomic_store(&g_chat_target, chat_target);
  atomic_store(&g_chat_interval, chat_interval);
  EnterCriticalSection(&g_chat_lock);
  wcscpy_s(g_chat_text, 512, chat_text);
  LeaveCriticalSection(&g_chat_lock);
}

// Time & Formatting
static void current_time_str_w(wchar_t *buf, size_t size) {
  SYSTEMTIME st;
  GetLocalTime(&st);
  int h = st.wHour % 12;
  if (h == 0)
    h = 12;
  swprintf_s(buf, size, L"%02d:%02d:%02d %s", h, st.wMinute, st.wSecond,
             st.wHour < 12 ? L"AM" : L"PM");
}

static int rand_range(int min, int extra) {
  return min + (rand() % (extra + 1));
}

static void get_key_name_w(int vk, wchar_t *buf, size_t size) {
  LONG scan = (LONG)MapVirtualKeyW((UINT)vk, MAPVK_VK_TO_VSC) << 16;
  if (!scan || !GetKeyNameTextW(scan, buf, (int)size)) {
    swprintf_s(buf, size, L"VK_0x%02X", vk);
  }
}

// File Logging
static void check_files(void) {
  CreateDirectoryA(LOG_DIR, NULL);
  FILE *f = NULL;
  fopen_s(&f, LOG_FILE, "a");
  if (f)
    fclose(f);
}

static void log_write(const char *text) {
  check_files();
  FILE *f = NULL;
  fopen_s(&f, LOG_FILE, "a");
  if (f) {
    fprintf(f, "%s\n", text);
    fclose(f);
  }
}

static void send_gui_log(const wchar_t *msg) {
  if (g_hWnd && IsWindow(g_hWnd)) {
    wchar_t *heapMsg = _wcsdup(msg);
    PostMessageW(g_hWnd, WM_APP_LOG, 0, (LPARAM)heapMsg);
  }
}

static void logger(const wchar_t *action, int count) {
  wchar_t ts[32];
  current_time_str_w(ts, 32);
  wchar_t buf[256];
  swprintf_s(buf, 256, L"[%s] action: %s -> %d", ts, action, count);
  send_gui_log(buf);

  char ansiBuf[512];
  WideCharToMultiByte(CP_UTF8, 0, buf, -1, ansiBuf, sizeof(ansiBuf), NULL,
                      NULL);
  log_write(ansiBuf);
}

static void status_logger(const wchar_t *text) {
  wchar_t ts[32];
  current_time_str_w(ts, 32);
  wchar_t buf[256];
  swprintf_s(buf, 256, L"[%s] %s", ts, text);
  send_gui_log(buf);

  char ansiBuf[512];
  WideCharToMultiByte(CP_UTF8, 0, buf, -1, ansiBuf, sizeof(ansiBuf), NULL,
                      NULL);
  log_write(ansiBuf);
}

// Key Injection Helpers
static void send_key_press(WORD vk) {
  INPUT inp = {0};
  inp.type = INPUT_KEYBOARD;
  inp.ki.wVk = vk;
  SendInput(1, &inp, sizeof(INPUT));
  Sleep(50 + rand() % 50);
  inp.ki.dwFlags = KEYEVENTF_KEYUP;
  SendInput(1, &inp, sizeof(INPUT));
}

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

static int copy_to_clipboard_w(const wchar_t *text) {
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
  inputs[3].ki.wVk = VK_CONTROL;
  inputs[3].ki.dwFlags = KEYEVENTF_KEYUP;

  SendInput(4, inputs, sizeof(INPUT));
}

static void send_chat_message(void) {
  wchar_t local_text[512];

  EnterCriticalSection(&g_chat_lock);
  wcscpy_s(local_text, 512, g_chat_text);
  LeaveCriticalSection(&g_chat_lock);

  if (local_text[0] == L'\0')
    return;

  if (!copy_to_clipboard_w(local_text))
    return;

  if (atomic_load(&g_chat_target) == 1) {
    INPUT inputs[4] = {0};
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = VK_SHIFT;
    inputs[1].type = INPUT_KEYBOARD;
    inputs[1].ki.wVk = VK_RETURN;
    inputs[2].type = INPUT_KEYBOARD;
    inputs[2].ki.wVk = VK_RETURN;
    inputs[2].ki.dwFlags = KEYEVENTF_KEYUP;
    inputs[3].type = INPUT_KEYBOARD;
    inputs[3].ki.wVk = VK_SHIFT;
    inputs[3].ki.dwFlags = KEYEVENTF_KEYUP;
    SendInput(4, inputs, sizeof(INPUT));
  } else {
    send_extra_key(VK_RETURN);
  }

  send_paste_action();
  Sleep(50 + rand() % 50);
  send_extra_key(VK_RETURN);
}

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

// Background Threads
DWORD WINAPI hotkey_thread(LPVOID param) {
  (void)param;
  int was_down = 0;
  while (atomic_load(&g_listener)) {
    if (atomic_load(&g_is_rebinding)) {
      for (int vk = 8; vk <= 254; vk++) {
        if (vk == VK_LBUTTON || vk == VK_RBUTTON || vk == VK_MBUTTON)
          continue;
        if (GetAsyncKeyState(vk) & 0x8000) {
          if (vk == VK_F5 || vk == VK_F6) {
            send_gui_log(L"[SYSTEM] F5 and F6 are reserved for Auto-Vote and "
                         L"cannot be Play/Pause.");
            Sleep(500);
            break;
          }
          atomic_store(&g_playpause_vk, vk);
          save_config();
          // Wait for key release to prevent triggering start immediately
          while (GetAsyncKeyState(vk) & 0x8000) {
            Sleep(20);
          }
          was_down = 1;
          atomic_store(&g_is_rebinding, 0);
          PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
          break;
        }
      }
      Sleep(30);
      continue;
    }

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

DWORD WINAPI spammer_thread_proc(LPVOID param) {
  (void)param;
  status_logger(L"SageBot started.");

  ULONGLONG start_tick = GetTickCount64();
  ULONGLONG last_chat_tick = 0;
  int count = 0;

  while (atomic_load(&g_status)) {
    int interval = rand_range(TAB_MIN_MS, TAB_RAND_MS);

    if (interruptible_sleep(interval)) {
      atomic_store(&g_pressed, 0);
      atomic_store(&g_status, 0);
      PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
      return 0;
    }

    ULONGLONG elapsed = (GetTickCount64() - start_tick) / 1000;
    if (elapsed >= RUN_SECONDS) {
      status_logger(L"Stopped SageBot");
      atomic_store(&g_status, 0);
      PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
      return 0;
    }

    send_key_press(VK_TAB);
    logger(L"TAB", count++);

    int mode = atomic_load(&g_auto_vote_mode);
    if (mode == 1)
      send_extra_key(VK_F5);
    else if (mode == 2)
      send_extra_key(VK_F6);

    ULONGLONG now = GetTickCount64();
    int chat_interval_ms = atomic_load(&g_chat_interval) * 1000;
    if (chat_interval_ms < 1000)
      chat_interval_ms = 180000;

    if (atomic_load(&g_chat_mode) == 1 &&
        (last_chat_tick == 0 ||
         (now - last_chat_tick) >= (ULONGLONG)chat_interval_ms)) {
      last_chat_tick = now;
      send_chat_message();
      logger(L"CHAT_MESSAGE", count++);
    }
  }

  PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
  return 0;
}

static void start_spammer(void) {
  if (atomic_load(&g_status))
    return;
  if (g_hEditLog)
    SetWindowTextW(g_hEditLog, L"");
  status_logger(L"Logs cleared.");

  atomic_store(&g_status, 1);
  atomic_store(&g_pressed, 0);
  g_hSpammerThread = CreateThread(NULL, 0, spammer_thread_proc, NULL, 0, NULL);
  update_status_ui();
}

static void stop_spammer(void) {
  if (!atomic_load(&g_status))
    return;
  atomic_store(&g_status, 0);
  atomic_store(&g_pressed, 1);
  update_status_ui();
  status_logger(L"Stopped SageBot");
}

// GUI Helper Functions
static void append_log_ui(const wchar_t *text) {
  if (!g_hEditLog)
    return;
  int len = GetWindowTextLengthW(g_hEditLog);
  SendMessageW(g_hEditLog, EM_SETSEL, (WPARAM)len, (LPARAM)len);
  SendMessageW(g_hEditLog, EM_REPLACESEL, FALSE, (LPARAM)text);
  SendMessageW(g_hEditLog, EM_REPLACESEL, FALSE, (LPARAM)L"\r\n");
}

static void update_status_ui(void) {
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

  InvalidateRect(g_hBtnStart, NULL, TRUE);
  InvalidateRect(g_hBtnRebind, NULL, TRUE);
  InvalidateRect(g_hLblStatusVal, NULL, TRUE);
  InvalidateRect(g_hLblHotkeyVal, NULL, TRUE);
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
  ShowWindow(g_hBtnChatSave, command);
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

static wchar_t g_extracted_mp3_path[MAX_PATH] = L"";

static const wchar_t *get_playable_mp3_path(void) {
  if (g_extracted_mp3_path[0] != L'\0') {
    return g_extracted_mp3_path;
  }

  // 1. Try extracting from embedded resource ID 3
  HRSRC hRes = FindResourceW(NULL, MAKEINTRESOURCEW(3), RT_RCDATA);
  if (hRes) {
    HGLOBAL hResData = LoadResource(NULL, hRes);
    if (hResData) {
      DWORD dwSize = SizeofResource(NULL, hRes);
      void *pData = LockResource(hResData);
      if (pData && dwSize > 0) {
        wchar_t tempPath[MAX_PATH];
        GetTempPathW(MAX_PATH, tempPath);
        swprintf_s(g_extracted_mp3_path, MAX_PATH, L"%ssagebot_bgm.mp3", tempPath);

        HANDLE hFile = CreateFileW(g_extracted_mp3_path, GENERIC_WRITE, 0, NULL,
                                   CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (hFile != INVALID_HANDLE_VALUE) {
          DWORD dwWritten = 0;
          WriteFile(hFile, pData, dwSize, &dwWritten, NULL);
          CloseHandle(hFile);
          return g_extracted_mp3_path;
        }
      }
    }
  }

  // 2. Fallback to local asset file
  return MUSIC_FILE;
}

static void music_open(void) {
  if (g_music_opened)
    return;

  const wchar_t *mp3Path = get_playable_mp3_path();
  wchar_t cmd[512];
  swprintf_s(cmd, 512, L"open \"%s\" type mpegvideo alias %s", mp3Path,
             MUSIC_ALIAS);
  MCIERROR err = mciSendStringW(cmd, NULL, 0, NULL);
  if (err == 0) {
    g_music_opened = 1;
    mciSendStringW(L"set " MUSIC_ALIAS L" time format milliseconds", NULL, 0,
                   NULL);

    wchar_t lenBuf[64];
    mciSendStringW(L"status " MUSIC_ALIAS L" length", lenBuf, 64, NULL);
    g_music_length_ms = wcstol(lenBuf, NULL, 10);
    if (g_music_length_ms <= 0)
      g_music_length_ms = 180000;

    // Apply volume (0 - 1000)
    int vol1000 = g_music_volume * 10;
    swprintf_s(cmd, 512, L"setaudio " MUSIC_ALIAS L" volume to %d", vol1000);
    mciSendStringW(cmd, NULL, 0, NULL);
  }
}

static void music_play(void) {
  if (!g_music_opened)
    music_open();

  if (g_music_opened) {
    mciSendStringW(L"play " MUSIC_ALIAS L" repeat", NULL, 0, NULL);
    g_music_playing = 1;
    if (g_hBtnMusicPlay) {
      SetWindowTextW(g_hBtnMusicPlay, L"⏸  Pause");
      InvalidateRect(g_hBtnMusicPlay, NULL, TRUE);
    }
  }
}

static void music_pause(void) {
  if (g_music_opened && g_music_playing) {
    mciSendStringW(L"pause " MUSIC_ALIAS, NULL, 0, NULL);
    g_music_playing = 0;
    if (g_hBtnMusicPlay) {
      SetWindowTextW(g_hBtnMusicPlay, L"▶  Play");
      InvalidateRect(g_hBtnMusicPlay, NULL, TRUE);
    }
  }
}

static void music_toggle(void) {
  if (g_music_playing) {
    music_pause();
  } else {
    music_play();
  }
}

static void music_set_volume(int vol) {
  if (vol < 0)
    vol = 0;
  if (vol > 100)
    vol = 100;
  g_music_volume = vol;
  if (g_music_opened) {
    wchar_t cmd[64];
    swprintf_s(cmd, 64, L"setaudio " MUSIC_ALIAS L" volume to %d", vol * 10);
    mciSendStringW(cmd, NULL, 0, NULL);
  }
  if (g_hLblMusicVol) {
    wchar_t buf[32];
    swprintf_s(buf, 32, L"Volume: %d%%", vol);
    SetWindowTextW(g_hLblMusicVol, buf);
  }
}

static void music_seek_to(int pos_ms) {
  if (!g_music_opened)
    music_open();

  if (g_music_opened) {
    wchar_t cmd[64];
    swprintf_s(cmd, 64, L"seek " MUSIC_ALIAS L" to %d", pos_ms);
    mciSendStringW(cmd, NULL, 0, NULL);
    if (g_music_playing) {
      mciSendStringW(L"play " MUSIC_ALIAS L" repeat", NULL, 0, NULL);
    }
  }
}

static void music_update_progress(void) {
  if (!g_music_opened || !g_hSliderMusicPos || !g_hLblMusicTime)
    return;

  wchar_t posBuf[64];
  mciSendStringW(L"status " MUSIC_ALIAS L" position", posBuf, 64, NULL);
  int cur_ms = wcstol(posBuf, NULL, 10);
  if (cur_ms < 0)
    cur_ms = 0;

  if (!g_music_user_seeking) {
    SendMessageW(g_hSliderMusicPos, TBM_SETPOS, TRUE, cur_ms / 1000);
  }

  int cur_s = cur_ms / 1000;
  int tot_s = g_music_length_ms / 1000;
  wchar_t timeBuf[64];
  swprintf_s(timeBuf, 64, L"%02d:%02d / %02d:%02d", cur_s / 60, cur_s % 60,
             tot_s / 60, tot_s % 60);
  SetWindowTextW(g_hLblMusicTime, timeBuf);
}

static void music_cleanup(void) {
  if (g_music_opened) {
    mciSendStringW(L"stop " MUSIC_ALIAS, NULL, 0, NULL);
    mciSendStringW(L"close " MUSIC_ALIAS, NULL, 0, NULL);
    g_music_opened = 0;
    g_music_playing = 0;
  }
  if (g_extracted_mp3_path[0] != L'\0') {
    DeleteFileW(g_extracted_mp3_path);
    g_extracted_mp3_path[0] = L'\0';
  }
  if (g_hBmpMusicCover) {
    DeleteObject(g_hBmpMusicCover);
    g_hBmpMusicCover = NULL;
  }
}

static void show_music_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hSliderMusicPos, command);
  ShowWindow(g_hLblMusicTime, command);
  ShowWindow(g_hBtnMusicPlay, command);
  ShowWindow(g_hSliderMusicVol, command);
  ShowWindow(g_hLblMusicVol, command);
}

static void show_settings_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblSettingsHeader, command);
  ShowWindow(g_hLblSettingsHelp, command);
  ShowWindow(g_hLblSettingsKeyTitle, command);
  ShowWindow(g_hBtnRebind, command);
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

static void switch_tab(int tab_id) {
  g_current_tab = tab_id;

  show_main_controls(tab_id == 0);
  ShowWindow(g_hEditChangelogs, tab_id == 1 ? SW_SHOW : SW_HIDE);
  show_chat_controls(tab_id == 2);
  show_vote_controls(tab_id == 3);
  show_settings_controls(tab_id == 4);
  show_music_controls(tab_id == 5);

  if (tab_id == 1) {
    load_changelog_ui();
  }

  // Repaint window cleanly
  InvalidateRect(g_hNavChangelogs, NULL, TRUE);
  InvalidateRect(g_hNavMain, NULL, TRUE);
  InvalidateRect(g_hNavChat, NULL, TRUE);
  InvalidateRect(g_hNavAutoVoting, NULL, TRUE);
  InvalidateRect(g_hNavMusic, NULL, TRUE);
  InvalidateRect(g_hNavSettings, NULL, TRUE);
  InvalidateRect(g_hWnd, NULL, TRUE);
}

// Custom Draw Helper for Owner-Drawn Buttons
static void handle_draw_item(HWND hWnd, const DRAWITEMSTRUCT *pDIS) {
  HDC hdc = pDIS->hDC;
  RECT rc = pDIS->rcItem;
  UINT id = pDIS->CtlID;
  BOOL isSelected = (pDIS->itemState & ODS_SELECTED);
  SetBkMode(hdc, TRANSPARENT);

  // 1. Sidebar Navigation Buttons
  if (id == ID_NAV_CHANGELOGS || id == ID_NAV_MAIN || id == ID_NAV_CHAT ||
      id == ID_NAV_AUTO_VOTING || id == ID_NAV_MUSIC || id == ID_NAV_SETTINGS) {
    int tab_index = 0;
    const wchar_t *text = L"";

    switch (id) {
    case ID_NAV_MAIN:
      tab_index = 0;
      text = L"▶  Main";
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

  // 4. Chat Save Button (Modern Purple Accent)
  if (id == ID_BTN_CHAT_SAVE) {
    COLORREF bgCol = isSelected ? RGB(109, 40, 217) : RGB(124, 58, 237);
    draw_rounded_rect(hdc, &rc, 8, bgCol, RGB(167, 139, 250), 1);

    wchar_t btnText[64];
    GetWindowTextW(pDIS->hwndItem, btnText, 64);
    SelectObject(hdc, g_hFontHeader);
    SetTextColor(hdc, RGB(255, 255, 255));
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
  if (id == ID_CHK_CHAT) {
    int is_on = (atomic_load(&g_chat_mode) == 1);
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
}

// Window Procedure
LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  switch (msg) {
  case WM_CREATE: {
    g_hWnd = hWnd;
    init_config_path();
    InitializeCriticalSection(&g_chat_lock);
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

    // ----------------------------------------------------
    // SIDEBAR NAVIGATION (Left Panel 0 to 145px)
    // ----------------------------------------------------

    // MAIN Tab Button (Primary)
    g_hNavMain = CreateWindowW(L"BUTTON", L"▶  Main",
                               WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 16,
                               124, 36, hWnd, (HMENU)ID_NAV_MAIN, NULL, NULL);

    // Chat Tab Button
    g_hNavChat = CreateWindowW(L"BUTTON", L"💬  Chat",
                               WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 58,
                               124, 36, hWnd, (HMENU)ID_NAV_CHAT, NULL, NULL);

    // Auto Voting Tab Button
    g_hNavAutoVoting = CreateWindowW(
        L"BUTTON", L"🗳️  Auto Voting", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        100, 124, 36, hWnd, (HMENU)ID_NAV_AUTO_VOTING, NULL, NULL);

    // Music Player Tab Button
    g_hNavMusic = CreateWindowW(L"BUTTON", L"🎵  Music",
                                WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12, 142,
                                124, 36, hWnd, (HMENU)ID_NAV_MUSIC, NULL, NULL);

    // CHANGELOG Tab Button (Positioned right above Settings)
    g_hNavChangelogs = CreateWindowW(
        L"BUTTON", L"📝  Changelog", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        358, 124, 36, hWnd, (HMENU)ID_NAV_CHANGELOGS, NULL, NULL);

    // Settings Button (Pinned at Bottom)
    g_hNavSettings = CreateWindowW(
        L"BUTTON", L"⚙  Settings", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 12,
        400, 124, 36, hWnd, (HMENU)ID_NAV_SETTINGS, NULL, NULL);

    // Load Huge Music Album Cover Bitmap (270x230) directly from embedded resource or disk
    g_hBmpMusicCover = load_jpeg_from_resource_or_file(2, L"assets\\musicplayer.jpg", 270, 230);

    // ----------------------------------------------------
    // MAIN TAB CONTROLS
    // ----------------------------------------------------

    // STATUS:                                STOPPED
    g_hLblStatusTitle =
        CreateWindowW(L"STATIC", L"STATUS:", WS_CHILD | WS_VISIBLE | SS_LEFT,
                      176, 28, 100, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblStatusTitle, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblStatusVal =
        CreateWindowW(L"STATIC", L"STOPPED", WS_CHILD | WS_VISIBLE | SS_RIGHT,
                      356, 28, 110, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblStatusVal, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    // HOTKEY:                                F9
    g_hLblHotkeyTitle =
        CreateWindowW(L"STATIC", L"HOTKEY:", WS_CHILD | WS_VISIBLE | SS_LEFT,
                      176, 54, 100, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblHotkeyTitle, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    g_hLblHotkeyVal =
        CreateWindowW(L"STATIC", L"F9", WS_CHILD | WS_VISIBLE | SS_RIGHT, 356,
                      54, 110, 20, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblHotkeyVal, WM_SETFONT, (WPARAM)g_hFontHeader, TRUE);

    // Large Modern Start/Stop Action Button
    g_hBtnStart = CreateWindowW(
        L"BUTTON", L"▶  START SAGEBOT", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
        160, 95, 325, 46, hWnd, (HMENU)ID_BTN_START_STOP, NULL, NULL);

    // Modern Activity Log Box
    g_hEditLog = CreateWindowW(
        L"EDIT", L"",
        WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_AUTOVSCROLL | ES_READONLY,
        162, 160, 321, 275, hWnd, (HMENU)ID_EDIT_LOG, NULL, NULL);
    SendMessageW(g_hEditLog, WM_SETFONT, (WPARAM)g_hFontMonospace, TRUE);
    SetWindowSubclass(g_hEditLog, EditSubclassProc, 1, 0);

    // ----------------------------------------------------
    // CHANGELOG TAB CONTROLS
    // ----------------------------------------------------

    g_hEditChangelogs = CreateWindowW(
        L"EDIT", L"", WS_CHILD | ES_MULTILINE | ES_READONLY, 162, 22, 321, 414,
        hWnd, (HMENU)ID_EDIT_CHANGELOGS, NULL, NULL);
    SendMessageW(g_hEditChangelogs, WM_SETFONT, (WPARAM)g_hFontMonospace, TRUE);
    SetWindowSubclass(g_hEditChangelogs, EditSubclassProc, 2, 0);

    // ----------------------------------------------------
    // CHAT TAB CONTROLS (Minimal & Modern)
    // ----------------------------------------------------

    // Header & Subtitle
    g_hLblChatHeader = CreateWindowW(L"STATIC", L"Chat Automation", WS_CHILD,
                                     176, 24, 290, 24, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatHeader, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

    g_hLblChatDescription = CreateWindowW(
        L"STATIC", L"Broadcast automated messages during match play.", WS_CHILD,
        176, 50, 290, 18, hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblChatDescription, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Row 1: Enable Automation Toggle Switch
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
        68, hWnd, (HMENU)ID_EDIT_CHAT_TEXT, NULL, NULL);
    SendMessageW(g_hEditChatText, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
    SendMessageW(g_hEditChatText, EM_LIMITTEXT, 500, 0);
    SetWindowSubclass(g_hEditChatText, EditSubclassProc, 3, 0);

    // Row 5: Preset Pills & Save Button
    g_hLblPresets = NULL;

    g_hBtnChatExample1 = CreateWindowW(
        L"BUTTON", L"Uncle Ben", WS_CHILD | BS_OWNERDRAW, 176, 280, 140, 28,
        hWnd, (HMENU)ID_BTN_CHAT_EXAMPLE_1, NULL, NULL);

    g_hBtnChatExample2 = CreateWindowW(
        L"BUTTON", L"Wintrading", WS_CHILD | BS_OWNERDRAW, 326, 280, 140, 28,
        hWnd, (HMENU)ID_BTN_CHAT_EXAMPLE_2, NULL, NULL);

    g_hBtnChatSave =
        CreateWindowW(L"BUTTON", L"Save Settings", WS_CHILD | BS_OWNERDRAW, 176,
                      318, 290, 34, hWnd, (HMENU)ID_BTN_CHAT_SAVE, NULL, NULL);

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
    // AUTO VOTING TAB CONTROLS (Minimal & Modern)
    // ----------------------------------------------------

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

    // ----------------------------------------------------
    // MUSIC PLAYER TAB CONTROLS (Standalone Modern Tab)
    // ----------------------------------------------------

    // Track Progress Slider (Centered full width under image)
    g_hSliderMusicPos = CreateWindowW(
        L"SageBotSlider", L"", WS_CHILD,
        170, 266, 305, 24, hWnd, (HMENU)ID_SLIDER_MUSIC_POS, NULL, NULL);
    SendMessageW(g_hSliderMusicPos, TBM_SETRANGE, TRUE, MAKELPARAM(0, 180));
    SendMessageW(g_hSliderMusicPos, TBM_SETPOS, TRUE, 0);

    // Track Timestamp (e.g. 00:00 / 03:20)
    g_hLblMusicTime = CreateWindowW(L"STATIC", L"00:00 / 00:00",
                                    WS_CHILD | SS_RIGHT, 355, 294, 120, 18,
                                    hWnd, NULL, NULL, NULL);
    SendMessageW(g_hLblMusicTime, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    // Modern Triangle Play Button (Border-free Icon Play Button at y=318)
    g_hBtnMusicPlay = CreateWindowW(
        L"BUTTON", L"", WS_CHILD | BS_OWNERDRAW, 295, 316, 55, 48, hWnd,
        (HMENU)ID_BTN_MUSIC_PLAY, NULL, NULL);

    // Volume Slider & Label (y=374)
    g_hLblMusicVol = CreateWindowW(L"STATIC", L"Volume: 80%",
                                   WS_CHILD | SS_LEFT, 174, 376, 96, 18, hWnd,
                                   NULL, NULL, NULL);
    SendMessageW(g_hLblMusicVol, WM_SETFONT, (WPARAM)g_hFontSmall, TRUE);

    g_hSliderMusicVol = CreateWindowW(
        L"SageBotSlider", L"", WS_CHILD,
        270, 372, 205, 24, hWnd, (HMENU)ID_SLIDER_MUSIC_VOL, NULL, NULL);
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

    g_hLblSettingsKeyBadge = NULL;
    g_hLblSettingsNote = NULL;

    switch_tab(0);
    update_status_ui();

    append_log_ui(L"[SYSTEM] SageBot initialized.");
    append_log_ui(L"[SYSTEM] Settings loaded from config.ini.");

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
      // Main Tab: Status Header Card
      RECT rcStatusCard = {160, 16, 485, 82};
      draw_rounded_rect(hdc, &rcStatusCard, 12, COLOR_CARD_BG,
                        COLOR_CARD_BORDER, 1);

      // Main Tab: Activity Log Card
      RECT rcLogCard = {160, 152, 485, 437};
      draw_rounded_rect(hdc, &rcLogCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER,
                        1);
    } else if (g_current_tab == 1) {
      // Changelog Card
      RECT rcCard = {160, 16, 485, 437};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 2) {
      // Chat Settings Card (Sleek Modern Surface)
      RECT rcCard = {160, 14, 485, 364};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      // Input field backgrounds
      RECT rcIntervalBox = {402, 140, 469, 168};
      draw_rounded_rect(hdc, &rcIntervalBox, 6, COLOR_INPUT_BG,
                        COLOR_CARD_BORDER, 1);

      RECT rcTextBox = {172, 196, 469, 272};
      draw_rounded_rect(hdc, &rcTextBox, 6, COLOR_INPUT_BG, COLOR_CARD_BORDER,
                        1);
    } else if (g_current_tab == 3) {
      // Auto Voting Card (Minimal & Modern)
      RECT rcCard = {160, 14, 485, 220};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 4) {
      // Settings Card (Minimal & Slim)
      RECT rcCard = {160, 14, 485, 130};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);
    } else if (g_current_tab == 5) {
      // Music Player Card (Sleek Modern Surface)
      RECT rcCard = {160, 10, 485, 415};
      draw_rounded_rect(hdc, &rcCard, 12, COLOR_CARD_BG, COLOR_CARD_BORDER, 1);

      // Centered Huge Album Art (x=187, y=24, w=270, h=230)
      int artX = 187;
      int artY = 24;
      int artW = 270;
      int artH = 230;

      if (g_hBmpMusicCover) {
        HDC hdcMem = CreateCompatibleDC(hdc);
        HBITMAP hOldBmp = (HBITMAP)SelectObject(hdcMem, g_hBmpMusicCover);
        BitBlt(hdc, artX, artY, artW, artH, hdcMem, 0, 0, SRCCOPY);
        SelectObject(hdcMem, hOldBmp);
        DeleteDC(hdcMem);

        RECT rcArtBorder = {artX - 1, artY - 1, artX + artW + 1,
                            artY + artH + 1};
        HPEN hPenArt = CreatePen(PS_SOLID, 1, RGB(138, 92, 246));
        HPEN hOldPenArt = (HPEN)SelectObject(hdc, hPenArt);
        HBRUSH hOldBrArt = (HBRUSH)SelectObject(hdc, GetStockObject(NULL_BRUSH));
        RoundRect(hdc, rcArtBorder.left, rcArtBorder.top, rcArtBorder.right,
                  rcArtBorder.bottom, 10, 10);
        SelectObject(hdc, hOldBrArt);
        SelectObject(hdc, hOldPenArt);
        DeleteObject(hPenArt);
      } else {
        // Fallback decorative album square
        RECT rcCover = {artX, artY, artX + artW, artY + artH};
        draw_rounded_rect(hdc, &rcCover, 10, RGB(22, 22, 30),
                          RGB(138, 92, 246), 1);
        SelectObject(hdc, g_hFontTitle);
        SetTextColor(hdc, RGB(167, 139, 250));
        DrawTextW(hdc, L"🎵", -1, &rcCover,
                  DT_CENTER | DT_VCENTER | DT_SINGLELINE);
      }
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

    case ID_NAV_CHAT:
      switch_tab(2);
      break;

    case ID_NAV_AUTO_VOTING:
      switch_tab(3);
      break;

    case ID_NAV_MUSIC:
      switch_tab(5);
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
      if (!atomic_load(&g_is_rebinding)) {
        for (int vk = 8; vk <= 254; vk++)
          GetAsyncKeyState(vk);
        atomic_store(&g_is_rebinding, 1);
        update_status_ui();
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

    case ID_CHK_CHAT: {
      int new_mode = (atomic_load(&g_chat_mode) == 1) ? 0 : 1;
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

    case ID_BTN_CHAT_SAVE: {
      wchar_t interval_text[32];
      wchar_t chat_text[512];
      GetWindowTextW(g_hEditChatInterval, interval_text, 32);
      long interval = wcstol(interval_text, NULL, 10);
      if (interval < 1 || interval > 86400) {
        interval = 180;
        SetWindowTextW(g_hEditChatInterval, L"180");
        MessageBoxW(hWnd, L"Enter a time between 1 and 86400 seconds.",
                    L"Invalid chat interval", MB_ICONWARNING | MB_OK);
      }
      GetWindowTextW(g_hEditChatText, chat_text, 512);
      if (chat_text[0] == L'\0') {
        MessageBoxW(hWnd, L"Enter a message before saving.",
                    L"Empty chat message", MB_ICONWARNING | MB_OK);
        break;
      }
      atomic_store(&g_chat_interval, (int)interval);
      EnterCriticalSection(&g_chat_lock);
      wcscpy_s(g_chat_text, 512, chat_text);
      LeaveCriticalSection(&g_chat_lock);
      save_config();
      send_gui_log(L"[CHAT] Chat settings saved.");
      trigger_toast(hWnd, L"Saved!");
      break;
    }

    case ID_EDIT_CHAT_TEXT:
      if (HIWORD(wParam) == EN_CHANGE) {
        update_char_count_ui();
      }
      break;

    case ID_BTN_CHAT_EXAMPLE_1:
      SetWindowTextW(g_hEditChatText,
                     L"With great Power comes great Responsibility.");
      update_char_count_ui();
      break;

    case ID_BTN_CHAT_EXAMPLE_2:
      SetWindowTextW(
          g_hEditChatText,
          L"Wintrading refers to any actions that a player or group of players "
          L"may take in order to fix the outcome of a match, usually to boost "
          L"a player’s MMR, rank, or account level. Wintrading undermines the "
          L"integrity of the competitive experience and dilutes the value of "
          L"ranked play by predetermining the results of a match. "
          L"Additionally, players who find themselves in a fixed game are "
          L"thrust into a deeply negative experience over which they have no "
          L"control.");
      update_char_count_ui();
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

    if (hCtl == g_hLblStatusTitle || hCtl == g_hLblHotkeyTitle) {
      SetTextColor(hdcStatic, COLOR_TEXT_SECONDARY);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblChatHeader || hCtl == g_hLblVoteHeader ||
        hCtl == g_hLblSettingsHeader || hCtl == g_hLblMusicHeader ||
        hCtl == g_hLblMusicTitle) {
      SetTextColor(hdcStatic, COLOR_TEXT_PRIMARY);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hLblChatDescription || hCtl == g_hLblSettingsHelp ||
        hCtl == g_hLblPresets || hCtl == g_hLblVoteSub ||
        hCtl == g_hLblChatCharCount || hCtl == g_hLblMusicSub ||
        hCtl == g_hLblMusicArtist || hCtl == g_hLblMusicTime ||
        hCtl == g_hLblMusicVol) {
      SetTextColor(hdcStatic, COLOR_TEXT_MUTED);
      return (INT_PTR)g_hCardBgBrush;
    }

    if (hCtl == g_hChkChat || hCtl == g_hLblChatToggle ||
        hCtl == g_hLblChatChannel || hCtl == g_hRadioVoteOff ||
        hCtl == g_hRadioVoteYes || hCtl == g_hRadioVoteNo ||
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

    if (hCtl == g_hEditChatInterval || hCtl == g_hEditChatText) {
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

  return (int)msg.wParam;
}
