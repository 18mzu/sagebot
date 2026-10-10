#include "agent_locker.h"
#include <wininet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const AgentInfo g_agents[MAX_AGENTS] = {
    {L"Astra", "41fb69c1-4189-7b37-f117-bcaf1e96f1bf", 0},
    {L"Breach", "5f8d3a7f-467b-97f3-062c-13acf203c006", 0},
    {L"Brimstone", "9f0d8ba9-4140-b941-57d3-a7ad57c6b417", 1},
    {L"Chamber", "22697a3d-45bf-8dd7-4fec-84a9e28c69d7", 0},
    {L"Clove", "1dbf2edd-4729-0984-3115-daa5eed44993", 0},
    {L"Cypher", "117ed9e3-49f3-6512-3ccf-0cada7e3823b", 0},
    {L"Deadlock", "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235", 0},
    {L"Fade", "dade69b4-4f5a-8528-247b-219e5a1facd6", 0},
    {L"Gekko", "e370fa57-4757-3604-3648-499e1f642d3f", 0},
    {L"Harbor", "95b78ed7-4637-86d9-7e41-71ba8c293152", 0},
    {L"Iso", "0e38b510-41a8-5780-5e8f-568b2a4f2d6c", 0},
    {L"Jett", "add6443a-41bd-e414-f6ad-e58d267f4e95", 1},
    {L"KAY/O", "601dbbe7-43ce-be57-2a40-4abd24953621", 0},
    {L"Killjoy", "1e58de9c-4950-5125-93e9-a0aee9f98746", 0},
    {L"Neon", "bb2a4828-46eb-8cd1-e765-15848195d751", 0},
    {L"Omen", "8e253930-4c05-31dd-1b6c-968525494517", 0},
    {L"Phoenix", "eb93336a-449b-9c1b-0a54-a891f7921d69", 1},
    {L"Raze", "f94c3b30-42be-e959-889c-5aa313dba261", 0},
    {L"Reyna", "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc", 0},
    {L"Sage", "569fdd95-4d10-43ab-ca70-79becc718b46", 1},
    {L"Skye", "6f2a04ca-43e0-be17-7f36-b3908627744d", 0},
    {L"Sova", "320b2a48-4d9b-a075-30f1-1f93a9b638fa", 1},
    {L"Tejo", "b444168c-4e35-8076-db47-ef9bf368f384", 0},
    {L"Viper", "707eab51-4836-f488-046a-cda6bf494859", 0},
    {L"Vyse", "efba5359-4016-a1e5-7626-b1ae76895940", 0},
    {L"Yoru", "7f94d92c-4234-0a36-9646-3a87eb8b5c89", 0},
};

atomic_int g_instalock_enabled = 0;
atomic_int g_starter_fallback_enabled = 0;

static int s_selected_agents[MAX_AGENTS];
static int s_selected_count = 0;
static CRITICAL_SECTION s_selection_lock;
static int s_lock_inited = 0;
static int s_has_locked_this_match = 0;
static char s_cached_glz_host[128] = "glz-ap-1.ap.a.pvp.net";

void agent_locker_init(void) {
  if (!s_lock_inited) {
    InitializeCriticalSection(&s_selection_lock);
    s_lock_inited = 1;
  }
}

int get_agent_count(void) {
  return MAX_AGENTS;
}

const AgentInfo *get_agent_by_index(int idx) {
  if (idx < 0 || idx >= MAX_AGENTS) return NULL;
  return &g_agents[idx];
}

int find_agent_index_by_name(const wchar_t *name) {
  if (!name || !*name) return -1;
  for (int i = 0; i < MAX_AGENTS; ++i) {
    if (_wcsicmp(g_agents[i].name, name) == 0) return i;
  }
  return -1;
}

void agent_selection_clear(void) {
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  s_selected_count = 0;
  LeaveCriticalSection(&s_selection_lock);
}

int agent_selection_is_selected(int agent_idx) {
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  int found = 0;
  for (int i = 0; i < s_selected_count; ++i) {
    if (s_selected_agents[i] == agent_idx) {
      found = 1;
      break;
    }
  }
  LeaveCriticalSection(&s_selection_lock);
  return found;
}

int agent_selection_toggle(int agent_idx) {
  if (agent_idx < 0 || agent_idx >= MAX_AGENTS) return 0;
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  int existing_pos = -1;
  for (int i = 0; i < s_selected_count; ++i) {
    if (s_selected_agents[i] == agent_idx) {
      existing_pos = i;
      break;
    }
  }

  int added = 0;
  if (existing_pos >= 0) {
    for (int i = existing_pos; i < s_selected_count - 1; ++i) {
      s_selected_agents[i] = s_selected_agents[i + 1];
    }
    s_selected_count--;
    added = 0;
  } else {
    if (s_selected_count < MAX_AGENTS) {
      s_selected_agents[s_selected_count++] = agent_idx;
      added = 1;
    }
  }
  LeaveCriticalSection(&s_selection_lock);
  return added;
}

int agent_selection_get_rank(int agent_idx) {
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  int rank = 0;
  for (int i = 0; i < s_selected_count; ++i) {
    if (s_selected_agents[i] == agent_idx) {
      rank = i + 1;
      break;
    }
  }
  LeaveCriticalSection(&s_selection_lock);
  return rank;
}

int agent_selection_get_count(void) {
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  int count = s_selected_count;
  LeaveCriticalSection(&s_selection_lock);
  return count;
}

int agent_selection_get_at(int order_idx) {
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  int val = -1;
  if (order_idx >= 0 && order_idx < s_selected_count) {
    val = s_selected_agents[order_idx];
  }
  LeaveCriticalSection(&s_selection_lock);
  return val;
}

void agent_selection_get_priority_string(wchar_t *out, size_t out_len) {
  if (!out || out_len == 0) return;
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  if (s_selected_count == 0) {
    wcscpy_s(out, out_len, L"Queue: None (Click agents above to queue)");
  } else {
    out[0] = L'\0';
    for (int i = 0; i < s_selected_count; ++i) {
      int idx = s_selected_agents[i];
      if (idx >= 0 && idx < MAX_AGENTS) {
        wchar_t itemBuf[64];
        if (i > 0) {
          swprintf_s(itemBuf, 64, L"  ➜  %d. %s", i + 1, g_agents[idx].name);
        } else {
          swprintf_s(itemBuf, 64, L"1. %s", g_agents[idx].name);
        }
        wcsncat_s(out, out_len, itemBuf, out_len - wcslen(out) - 1);
      }
    }
  }
  LeaveCriticalSection(&s_selection_lock);
}

void agent_selection_to_config_string(wchar_t *out, size_t out_len) {
  if (!out || out_len == 0) return;
  agent_locker_init();
  EnterCriticalSection(&s_selection_lock);
  out[0] = L'\0';
  for (int i = 0; i < s_selected_count; ++i) {
    int idx = s_selected_agents[i];
    if (idx >= 0 && idx < MAX_AGENTS) {
      if (i > 0) wcsncat_s(out, out_len, L",", out_len - wcslen(out) - 1);
      wcsncat_s(out, out_len, g_agents[idx].name, out_len - wcslen(out) - 1);
    }
  }
  LeaveCriticalSection(&s_selection_lock);
}

void agent_selection_from_config_string(const wchar_t *str) {
  agent_locker_init();
  agent_selection_clear();
  if (!str || !*str) return;

  wchar_t copy[512];
  wcsncpy_s(copy, 512, str, 511);
  copy[511] = L'\0';

  wchar_t *context = NULL;
  wchar_t *token = wcstok_s(copy, L",", &context);
  while (token) {
    while (*token == L' ') token++;
    int idx = find_agent_index_by_name(token);
    if (idx >= 0) {
      EnterCriticalSection(&s_selection_lock);
      if (s_selected_count < MAX_AGENTS) {
        s_selected_agents[s_selected_count++] = idx;
      }
      LeaveCriticalSection(&s_selection_lock);
    }
    token = wcstok_s(NULL, L",", &context);
  }
}

void agent_locker_reset_session(void) {
  s_has_locked_this_match = 0;
}

static void discover_glz_host(void) {
  wchar_t localAppData[MAX_PATH];
  if (!GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH)) return;

  wchar_t logPath[MAX_PATH];
  swprintf_s(logPath, MAX_PATH, L"%ls\\VALORANT\\Saved\\Logs\\ShooterGame.log", localAppData);

  HANDLE hFile = CreateFileW(logPath, GENERIC_READ,
                             FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                             NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (hFile == INVALID_HANDLE_VALUE) return;

  LARGE_INTEGER fsize;
  if (!GetFileSizeEx(hFile, &fsize) || fsize.QuadPart == 0) {
    CloseHandle(hFile);
    return;
  }

  DWORD bytesToRead = (fsize.QuadPart > 120000) ? 120000 : (DWORD)fsize.QuadPart;
  LARGE_INTEGER offset;
  offset.QuadPart = fsize.QuadPart - bytesToRead;
  SetFilePointerEx(hFile, offset, NULL, FILE_BEGIN);

  char *buf = (char *)malloc(bytesToRead + 1);
  if (!buf) {
    CloseHandle(hFile);
    return;
  }

  DWORD bytesRead = 0;
  if (ReadFile(hFile, buf, bytesToRead, &bytesRead, NULL) && bytesRead > 0) {
    buf[bytesRead] = '\0';
    const char *pGlz = strstr(buf, "https://glz-");
    if (pGlz) {
      pGlz += 8;
      const char *pEnd = strstr(pGlz, ".a.pvp.net");
      if (pEnd) {
        size_t len = (size_t)(pEnd - pGlz + 10);
        if (len < sizeof(s_cached_glz_host)) {
          strncpy_s(s_cached_glz_host, sizeof(s_cached_glz_host), pGlz, len);
          s_cached_glz_host[len] = '\0';
        }
      }
    }
  }

  free(buf);
  CloseHandle(hFile);
}

static int send_glz_request(const char *host, const wchar_t *path, const char *verb,
                            const char *access_token, const char *entitlements_jwt,
                            char *out_buf, size_t out_buf_size) {
  if (out_buf && out_buf_size > 0) out_buf[0] = '\0';

  HINTERNET hInternet = InternetOpenW(L"RiotClient/release-13.06-shipping-18-5590001",
                                      INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
  if (!hInternet) return -1;

  wchar_t wHost[128] = {0};
  MultiByteToWideChar(CP_UTF8, 0, host, -1, wHost, 128);

  HINTERNET hConnect = InternetConnectW(hInternet, wHost, INTERNET_DEFAULT_HTTPS_PORT,
                                        NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
  if (!hConnect) {
    InternetCloseHandle(hInternet);
    return -1;
  }

  DWORD dwFlags = INTERNET_FLAG_SECURE |
                  INTERNET_FLAG_RELOAD |
                  INTERNET_FLAG_NO_CACHE_WRITE |
                  INTERNET_FLAG_PRAGMA_NOCACHE;

  wchar_t wVerb[16] = {0};
  MultiByteToWideChar(CP_UTF8, 0, verb, -1, wVerb, 16);

  HINTERNET hRequest = HttpOpenRequestW(hConnect, wVerb, path, NULL, NULL, NULL, dwFlags, 0);
  if (!hRequest) {
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return -1;
  }

  DWORD timeoutMs = 2000;
  InternetSetOptionW(hRequest, INTERNET_OPTION_CONNECT_TIMEOUT, &timeoutMs, sizeof(timeoutMs));
  InternetSetOptionW(hRequest, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeoutMs, sizeof(timeoutMs));
  InternetSetOptionW(hRequest, INTERNET_OPTION_SEND_TIMEOUT, &timeoutMs, sizeof(timeoutMs));

  char headers[4096];
  snprintf(headers, sizeof(headers),
           "Authorization: Bearer %s\r\n"
           "X-Riot-Entitlements-JWT: %s\r\n"
           "X-Riot-ClientPlatform: ewogICJwbGF0Zm9ybVR5cGUiOiAiUEMiLAogICJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLAogICJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwKICAicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iCn0=\r\n"
           "X-Riot-ClientVersion: release-13.06-shipping-18-5590001\r\n"
           "Content-Type: application/json\r\n",
           access_token, entitlements_jwt);

  HttpAddRequestHeadersA(hRequest, headers, -1, HTTP_ADDREQ_FLAG_ADD | HTTP_ADDREQ_FLAG_REPLACE);

  BOOL sent = HttpSendRequestW(hRequest, NULL, 0, NULL, 0);
  if (!sent) {
    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return -1;
  }

  DWORD statusCode = 0;
  DWORD statusSize = sizeof(statusCode);
  HttpQueryInfoW(hRequest, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER,
                 &statusCode, &statusSize, NULL);

  if (out_buf && out_buf_size > 0) {
    DWORD bytesRead = 0;
    DWORD totalRead = 0;
    char chunk[2048];
    while (InternetReadFile(hRequest, chunk, sizeof(chunk) - 1, &bytesRead) && bytesRead > 0) {
      if (totalRead + bytesRead < out_buf_size) {
        memcpy(out_buf + totalRead, chunk, bytesRead);
        totalRead += bytesRead;
        out_buf[totalRead] = '\0';
      } else {
        break;
      }
    }
  }

  InternetCloseHandle(hRequest);
  InternetCloseHandle(hConnect);
  InternetCloseHandle(hInternet);
  return (int)statusCode;
}

static void base64_encode_str(const unsigned char *src, size_t len, char *out, size_t out_len) {
  static const char tbl[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t i = 0, j = 0;
  while (i < len && j + 4 < out_len) {
    unsigned int a = src[i++];
    unsigned int b = (i < len) ? src[i++] : 0;
    unsigned int c = (i < len) ? src[i++] : 0;
    unsigned int triple = (a << 16) + (b << 8) + c;
    out[j++] = tbl[(triple >> 18) & 0x3F];
    out[j++] = tbl[(triple >> 12) & 0x3F];
    out[j++] = (i > len + 1) ? '=' : tbl[(triple >> 6) & 0x3F];
    out[j++] = (i > len) ? '=' : tbl[triple & 0x3F];
  }
  out[j] = '\0';
}

void agent_locker_on_pregame_tick(int port, const char *password, const char *puuid) {
  if (!atomic_load(&g_instalock_enabled)) return;
  if (s_has_locked_this_match) return;
  if (!puuid || !*puuid) return;

  // 1. Get tokens from local Riot Client /entitlements/v1/token
  HINTERNET hInternet = InternetOpenW(L"SageBot/2.4", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
  if (!hInternet) return;
  HINTERNET hConnect = InternetConnectW(hInternet, L"127.0.0.1", (INTERNET_PORT)port, NULL, NULL,
                                        INTERNET_SERVICE_HTTP, 0, 0);
  if (!hConnect) {
    InternetCloseHandle(hInternet);
    return;
  }

  DWORD dwFlags = INTERNET_FLAG_SECURE |
                  INTERNET_FLAG_IGNORE_CERT_CN_INVALID |
                  INTERNET_FLAG_IGNORE_CERT_DATE_INVALID |
                  INTERNET_FLAG_RELOAD |
                  INTERNET_FLAG_NO_CACHE_WRITE;
  HINTERNET hReq = HttpOpenRequestW(hConnect, L"GET", L"/entitlements/v1/token", NULL, NULL, NULL, dwFlags, 0);
  if (!hReq) {
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return;
  }

  DWORD dwSecFlags = 0x00000100 | 0x00001000 | 0x00002000 | 0x00000200 | 0x00000080;
  InternetSetOptionW(hReq, INTERNET_OPTION_SECURITY_FLAGS, &dwSecFlags, sizeof(dwSecFlags));

  char authRaw[256];
  snprintf(authRaw, sizeof(authRaw), "riot:%s", password);
  char authB64[512] = {0};
  base64_encode_str((const unsigned char *)authRaw, strlen(authRaw), authB64, sizeof(authB64));

  char authHdr[600];
  snprintf(authHdr, sizeof(authHdr), "Authorization: Basic %s\r\n", authB64);
  HttpAddRequestHeadersA(hReq, authHdr, -1, HTTP_ADDREQ_FLAG_ADD | HTTP_ADDREQ_FLAG_REPLACE);

  if (!HttpSendRequestW(hReq, NULL, 0, NULL, 0)) {
    InternetCloseHandle(hReq);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return;
  }

  char tokenJson[8192] = {0};
  DWORD bytesRead = 0;
  DWORD total = 0;
  char chunk[1024];
  while (InternetReadFile(hReq, chunk, sizeof(chunk) - 1, &bytesRead) && bytesRead > 0) {
    if (total + bytesRead < sizeof(tokenJson) - 1) {
      memcpy(tokenJson + total, chunk, bytesRead);
      total += bytesRead;
      tokenJson[total] = '\0';
    }
  }
  InternetCloseHandle(hReq);
  InternetCloseHandle(hConnect);
  InternetCloseHandle(hInternet);

  char access_token[2048] = {0};
  char entitlements_jwt[2048] = {0};

  char *pAcc = strstr(tokenJson, "\"accessToken\":\"");
  if (pAcc) {
    pAcc += 15;
    char *pEnd = strchr(pAcc, '\"');
    if (pEnd) {
      size_t len = (size_t)(pEnd - pAcc);
      if (len < sizeof(access_token)) {
        strncpy_s(access_token, sizeof(access_token), pAcc, len);
        access_token[len] = '\0';
      }
    }
  }

  char *pTok = strstr(tokenJson, "\"token\":\"");
  if (pTok) {
    pTok += 9;
    char *pEnd = strchr(pTok, '\"');
    if (pEnd) {
      size_t len = (size_t)(pEnd - pTok);
      if (len < sizeof(entitlements_jwt)) {
        strncpy_s(entitlements_jwt, sizeof(entitlements_jwt), pTok, len);
        entitlements_jwt[len] = '\0';
      }
    }
  }

  if (!access_token[0] || !entitlements_jwt[0]) return;

  // 2. Discover GLZ host from log
  discover_glz_host();

  // 3. Get Pre-Game Player info to find MatchID
  wchar_t playerPath[256];
  wchar_t wPuuid[128] = {0};
  MultiByteToWideChar(CP_UTF8, 0, puuid, -1, wPuuid, 128);
  swprintf_s(playerPath, 256, L"/pregame/v1/players/%ls", wPuuid);

  char playerResp[4096] = {0};
  int code = send_glz_request(s_cached_glz_host, playerPath, "GET",
                              access_token, entitlements_jwt,
                              playerResp, sizeof(playerResp));

  if (code != 200 || !playerResp[0]) return;

  char match_id[128] = {0};
  char *pMatch = strstr(playerResp, "\"MatchID\":\"");
  if (pMatch) {
    pMatch += 11;
    char *pEnd = strchr(pMatch, '\"');
    if (pEnd) {
      size_t len = (size_t)(pEnd - pMatch);
      if (len < sizeof(match_id)) {
        strncpy_s(match_id, sizeof(match_id), pMatch, len);
        match_id[len] = '\0';
      }
    }
  }

  if (!match_id[0]) return;

  // 4. Try locking prioritized selected agents
  int count = agent_selection_get_count();
  for (int i = 0; i < count; ++i) {
    int agent_idx = agent_selection_get_at(i);
    if (agent_idx < 0 || agent_idx >= MAX_AGENTS) continue;

    const AgentInfo *info = &g_agents[agent_idx];
    wchar_t lockPath[512];
    wchar_t wMatch[128] = {0};
    wchar_t wUuid[128] = {0};
    MultiByteToWideChar(CP_UTF8, 0, match_id, -1, wMatch, 128);
    MultiByteToWideChar(CP_UTF8, 0, info->uuid, -1, wUuid, 128);
    swprintf_s(lockPath, 512, L"/pregame/v1/matches/%ls/lock/%ls", wMatch, wUuid);

    char lockResp[1024] = {0};
    int lockCode = send_glz_request(s_cached_glz_host, lockPath, "POST",
                                    access_token, entitlements_jwt,
                                    lockResp, sizeof(lockResp));

    if (lockCode == 200) {
      s_has_locked_this_match = 1;
      wchar_t msg[128];
      swprintf_s(msg, 128, L"[INSTALOCK] Successfully locked %ls!", info->name);
      status_logger(msg);
      return;
    }
  }

  // 5. If all selected agents failed, check starter agent fallback
  if (atomic_load(&g_starter_fallback_enabled)) {
    for (int i = 0; i < MAX_AGENTS; ++i) {
      if (!g_agents[i].is_starter) continue;

      const AgentInfo *info = &g_agents[i];
      wchar_t lockPath[512];
      wchar_t wMatch[128] = {0};
      wchar_t wUuid[128] = {0};
      MultiByteToWideChar(CP_UTF8, 0, match_id, -1, wMatch, 128);
      MultiByteToWideChar(CP_UTF8, 0, info->uuid, -1, wUuid, 128);
      swprintf_s(lockPath, 512, L"/pregame/v1/matches/%ls/lock/%ls", wMatch, wUuid);

      char lockResp[1024] = {0};
      int lockCode = send_glz_request(s_cached_glz_host, lockPath, "POST",
                                      access_token, entitlements_jwt,
                                      lockResp, sizeof(lockResp));

      if (lockCode == 200) {
        s_has_locked_this_match = 1;
        wchar_t msg[128];
        swprintf_s(msg, 128, L"[INSTALOCK] Fallback locked starter agent %ls!", info->name);
        status_logger(msg);
        return;
      }
    }
  }
}
