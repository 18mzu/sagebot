#include "audio.h"

HWND g_hLblMusicHeader = NULL;
HWND g_hLblMusicSub = NULL;
HWND g_hLblMusicTitle = NULL;
HWND g_hLblMusicArtist = NULL;
HWND g_hBtnMusicPlay = NULL;
HWND g_hSliderMusicPos = NULL;
HWND g_hLblMusicTime = NULL;
HWND g_hSliderMusicVol = NULL;
HWND g_hLblMusicVol = NULL;

HBITMAP g_hBmpMusicCover = NULL;
int g_music_playing = 0;
int g_music_opened = 0;
int g_music_length_ms = 0;
int g_music_volume = 80;
int g_music_user_seeking = 0;

HBITMAP load_jpeg_from_resource_or_file(int resId, const wchar_t *fallbackPath,
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

void music_open(void) {
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

void music_play(void) {
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

void music_pause(void) {
  if (g_music_opened && g_music_playing) {
    mciSendStringW(L"pause " MUSIC_ALIAS, NULL, 0, NULL);
    g_music_playing = 0;
    if (g_hBtnMusicPlay) {
      SetWindowTextW(g_hBtnMusicPlay, L"▶  Play");
      InvalidateRect(g_hBtnMusicPlay, NULL, TRUE);
    }
  }
}

void music_toggle(void) {
  if (g_music_playing) {
    music_pause();
  } else {
    music_play();
  }
}

void music_set_volume(int vol) {
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

void music_seek_to(int pos_ms) {
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

void music_update_progress(void) {
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

void music_cleanup(void) {
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

void show_music_controls(int show) {
  int command = show ? SW_SHOW : SW_HIDE;
  ShowWindow(g_hLblMusicTitle, command);
  ShowWindow(g_hSliderMusicPos, command);
  ShowWindow(g_hLblMusicTime, command);
  ShowWindow(g_hBtnMusicPlay, command);
  ShowWindow(g_hSliderMusicVol, command);
  ShowWindow(g_hLblMusicVol, command);
}
