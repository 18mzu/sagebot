#include "updater.h"

wchar_t g_latest_version_tag[64] = L"";
wchar_t g_latest_download_url[512] = L"";
atomic_int g_is_updating = 0;

int is_newer_version(const wchar_t *vCur, const wchar_t *vNew) {
  if (!vCur || !vNew)
    return 0;
  if (*vCur == L'v' || *vCur == L'V')
    vCur++;
  if (*vNew == L'v' || *vNew == L'V')
    vNew++;

  int c1 = 0, c2 = 0, c3 = 0;
  int n1 = 0, n2 = 0, n3 = 0;
  swscanf_s(vCur, L"%d.%d.%d", &c1, &c2, &c3);
  swscanf_s(vNew, L"%d.%d.%d", &n1, &n2, &n3);

  if (n1 != c1)
    return n1 > c1;
  if (n2 != c2)
    return n2 > c2;
  return n3 > c3;
}

typedef struct {
  int manual;
} UpdateCheckParams;

static DWORD WINAPI update_check_thread(LPVOID param) {
  UpdateCheckParams *pParams = (UpdateCheckParams *)param;
  int is_manual = pParams ? pParams->manual : 0;
  if (pParams)
    free(pParams);

  HINTERNET hInternet = InternetOpenW(L"SageBot-Updater",
                                     INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
  if (!hInternet) {
    if (is_manual && g_hWnd)
      PostMessageW(g_hWnd, WM_APP_UPDATE_CHECK_RESULT, (WPARAM)is_manual, (LPARAM)0);
    return 0;
  }

  DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE |
                INTERNET_FLAG_SECURE;
  HINTERNET hUrl = InternetOpenUrlW(hInternet, GITHUB_API_URL, NULL, 0, flags, 0);
  if (!hUrl) {
    InternetCloseHandle(hInternet);
    if (is_manual && g_hWnd)
      PostMessageW(g_hWnd, WM_APP_UPDATE_CHECK_RESULT, (WPARAM)is_manual, (LPARAM)0);
    return 0;
  }

  char *respBuf = (char *)malloc(131072);
  if (!respBuf) {
    InternetCloseHandle(hUrl);
    InternetCloseHandle(hInternet);
    return 0;
  }

  DWORD totalRead = 0;
  DWORD bytesRead = 0;
  while (InternetReadFile(hUrl, respBuf + totalRead, 4096, &bytesRead) && bytesRead > 0) {
    totalRead += bytesRead;
    if (totalRead >= 130000)
      break;
  }
  respBuf[totalRead] = '\0';

  InternetCloseHandle(hUrl);
  InternetCloseHandle(hInternet);

  wchar_t foundTag[64] = L"";
  wchar_t downloadUrl[512] = L"";

  char *pTag = strstr(respBuf, "\"tag_name\"");
  if (pTag) {
    char *colon = strchr(pTag, ':');
    if (colon) {
      char *q1 = strchr(colon, '\"');
      if (q1) {
        char *q2 = strchr(q1 + 1, '\"');
        if (q2) {
          int len = (int)(q2 - (q1 + 1));
          if (len > 0 && len < 60) {
            char tagA[64] = {0};
            strncpy_s(tagA, 64, q1 + 1, len);
            MultiByteToWideChar(CP_UTF8, 0, tagA, -1, foundTag, 64);
          }
        }
      }
    }
  }

  char *pExe = strstr(respBuf, "sagebot_gui.exe");
  if (pExe) {
    char *pUrlKey = strstr(respBuf, "\"browser_download_url\"");
    while (pUrlKey && pUrlKey < pExe) {
      char *nextUrlKey = strstr(pUrlKey + 1, "\"browser_download_url\"");
      if (nextUrlKey && nextUrlKey < pExe)
        pUrlKey = nextUrlKey;
      else
        break;
    }
    if (pUrlKey) {
      char *q1 = strchr(pUrlKey + 22, '\"');
      if (q1) {
        char *q2 = strchr(q1 + 1, '\"');
        if (q2) {
          int ulen = (int)(q2 - (q1 + 1));
          if (ulen > 0 && ulen < 500) {
            char urlA[512] = {0};
            strncpy_s(urlA, 512, q1 + 1, ulen);
            MultiByteToWideChar(CP_UTF8, 0, urlA, -1, downloadUrl, 512);
          }
        }
      }
    }
  }

  if (downloadUrl[0] == L'\0' && foundTag[0] != L'\0') {
    swprintf_s(downloadUrl, 512,
               L"https://github.com/18mzu/sagebot/releases/download/%s/sagebot_gui.exe",
               foundTag);
  }

  free(respBuf);

  if (foundTag[0] != L'\0') {
    wcscpy_s(g_latest_version_tag, 64, foundTag);
    wcscpy_s(g_latest_download_url, 512, downloadUrl);

    int hasNewer = is_newer_version(APP_VERSION, foundTag);
    if (g_hWnd) {
      PostMessageW(g_hWnd, WM_APP_UPDATE_CHECK_RESULT, (WPARAM)is_manual,
                   (LPARAM)(hasNewer ? 1 : 2));
    }
  } else {
    if (is_manual && g_hWnd) {
      PostMessageW(g_hWnd, WM_APP_UPDATE_CHECK_RESULT, (WPARAM)is_manual, (LPARAM)0);
    }
  }
  return 0;
}

void check_for_updates_async(int show_up_to_date_dialog) {
  UpdateCheckParams *p = (UpdateCheckParams *)malloc(sizeof(UpdateCheckParams));
  if (p) {
    p->manual = show_up_to_date_dialog;
    CreateThread(NULL, 0, update_check_thread, p, 0, NULL);
  }
}

static DWORD WINAPI update_download_thread(LPVOID param) {
  (void)param;
  atomic_store(&g_is_updating, 1);

  if (g_hLblUpdateStatus) {
    SetWindowTextW(g_hLblUpdateStatus, L"Downloading latest update...");
  }

  HINTERNET hInternet = InternetOpenW(L"SageBot-Updater",
                                     INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
  if (!hInternet) {
    atomic_store(&g_is_updating, 0);
    if (g_hWnd)
      PostMessageW(g_hWnd, WM_APP_UPDATE_DOWNLOAD_DONE, 0, 0);
    return 0;
  }

  DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
  HINTERNET hUrl = InternetOpenUrlW(hInternet, g_latest_download_url, NULL, 0, flags, 0);
  if (!hUrl) {
    InternetCloseHandle(hInternet);
    atomic_store(&g_is_updating, 0);
    if (g_hWnd)
      PostMessageW(g_hWnd, WM_APP_UPDATE_DOWNLOAD_DONE, 0, 0);
    return 0;
  }

  FILE *fOut = NULL;
  _wfopen_s(&fOut, L"sagebot_gui_new.exe", L"wb");
  if (!fOut) {
    InternetCloseHandle(hUrl);
    InternetCloseHandle(hInternet);
    atomic_store(&g_is_updating, 0);
    if (g_hWnd)
      PostMessageW(g_hWnd, WM_APP_UPDATE_DOWNLOAD_DONE, 0, 0);
    return 0;
  }

  char buf[8192];
  DWORD bytesRead = 0;
  DWORD totalBytes = 0;
  while (InternetReadFile(hUrl, buf, sizeof(buf), &bytesRead) && bytesRead > 0) {
    fwrite(buf, 1, bytesRead, fOut);
    totalBytes += bytesRead;
  }

  fclose(fOut);
  InternetCloseHandle(hUrl);
  InternetCloseHandle(hInternet);

  if (totalBytes < 500000) {
    DeleteFileW(L"sagebot_gui_new.exe");
    atomic_store(&g_is_updating, 0);
    if (g_hWnd)
      PostMessageW(g_hWnd, WM_APP_UPDATE_DOWNLOAD_DONE, 0, 0);
    return 0;
  }

  if (g_hWnd) {
    PostMessageW(g_hWnd, WM_APP_UPDATE_DOWNLOAD_DONE, 1, 0);
  }
  return 0;
}

void start_download_update(void) {
  if (atomic_load(&g_is_updating))
    return;
  CreateThread(NULL, 0, update_download_thread, NULL, 0, NULL);
}

void apply_update_and_restart(void) {
  wchar_t currentExe[MAX_PATH];
  GetModuleFileNameW(NULL, currentExe, MAX_PATH);

  wchar_t cmdParams[1024];
  swprintf_s(cmdParams, 1024,
             L"/c ping 127.0.0.1 -n 2 > nul & move /y \"sagebot_gui_new.exe\" \"%s\" > nul & start \"\" \"%s\"",
             currentExe, currentExe);

  SHELLEXECUTEINFOW sei = {0};
  sei.cbSize = sizeof(SHELLEXECUTEINFOW);
  sei.lpVerb = L"open";
  sei.lpFile = L"cmd.exe";
  sei.lpParameters = cmdParams;
  sei.nShow = SW_HIDE;
  ShellExecuteExW(&sei);

  ExitProcess(0);
}
