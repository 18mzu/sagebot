#include "round_tracker.h"
#include "webhook.h"
#include "agent_locker.h"

static HANDLE g_hTrackerThread = NULL;
static atomic_int g_tracker_running = 0;
static CRITICAL_SECTION g_round_lock;
static RoundTrackerInfo g_round_info = {
    0, 0, 0, 0, 0, 0,
    L"- | -", L"-", L"-", L"-", L"-", L"-", L"-"
};
static char g_cached_puuid[128] = "";

static const char b64_table[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static int base64_encode(const unsigned char *src, size_t len, char *dst, size_t dst_size) {
  size_t olen = 4 * ((len + 2) / 3);
  if (dst_size < olen + 1) return 0;
  size_t i, j = 0;
  for (i = 0; i < len; i += 3) {
    unsigned int a = src[i];
    unsigned int b = (i + 1 < len) ? src[i + 1] : 0;
    unsigned int c = (i + 2 < len) ? src[i + 2] : 0;
    unsigned int triple = (a << 16) | (b << 8) | c;
    dst[j++] = b64_table[(triple >> 18) & 0x3F];
    dst[j++] = b64_table[(triple >> 12) & 0x3F];
    dst[j++] = (i + 1 < len) ? b64_table[(triple >> 6) & 0x3F] : '=';
    dst[j++] = (i + 2 < len) ? b64_table[triple & 0x3F] : '=';
  }
  dst[j] = '\0';
  return 1;
}

static int base64_decode(const char *src, size_t len, char *dst, size_t dst_size) {
  int dtable[256];
  memset(dtable, -1, sizeof(dtable));
  for (int i = 0; i < 64; i++) dtable[(unsigned char)b64_table[i]] = i;
  size_t i, j = 0;
  unsigned int buf = 0;
  int bits = 0;
  for (i = 0; i < len; i++) {
    unsigned char ch = (unsigned char)src[i];
    if (ch == '=' || ch <= ' ' || ch == '\"' || ch == '\\') continue;
    int val = dtable[ch];
    if (val < 0) continue;
    buf = (buf << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (j + 1 < dst_size) {
        dst[j++] = (char)((buf >> bits) & 0xFF);
      }
    }
  }
  if (j < dst_size) dst[j] = '\0';
  return (int)j;
}

static int get_lockfile_credentials(int *out_port, char *out_password, size_t max_pwd_len) {
  wchar_t localAppData[MAX_PATH];
  if (GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH) == 0) {
    return 0;
  }
  wchar_t lockfilePath[MAX_PATH];
  swprintf_s(lockfilePath, MAX_PATH, L"%s\\Riot Games\\Riot Client\\Config\\lockfile", localAppData);

  HANDLE hFile = CreateFileW(lockfilePath, GENERIC_READ,
                             FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                             NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (hFile == INVALID_HANDLE_VALUE) {
    return 0;
  }

  char line[512] = {0};
  DWORD bytesRead = 0;
  if (!ReadFile(hFile, line, sizeof(line) - 1, &bytesRead, NULL) || bytesRead == 0) {
    CloseHandle(hFile);
    return 0;
  }
  CloseHandle(hFile);
  line[bytesRead] = '\0';

  char *colon1 = strchr(line, ':');
  if (!colon1) return 0;
  char *colon2 = strchr(colon1 + 1, ':');
  if (!colon2) return 0;
  char *colon3 = strchr(colon2 + 1, ':');
  if (!colon3) return 0;
  char *colon4 = strchr(colon3 + 1, ':');
  if (!colon4) return 0;

  *out_port = atoi(colon2 + 1);

  size_t pwd_len = (size_t)(colon4 - (colon3 + 1));
  if (pwd_len >= max_pwd_len) pwd_len = max_pwd_len - 1;
  strncpy_s(out_password, max_pwd_len, colon3 + 1, pwd_len);
  out_password[pwd_len] = '\0';

  return (*out_port > 0 && out_password[0] != '\0');
}

#ifndef SECURITY_FLAG_IGNORE_REVOCATION
#define SECURITY_FLAG_IGNORE_REVOCATION 0x00000080
#endif

static char *fetch_local_endpoint(int port, const char *password, const wchar_t *path) {
  HINTERNET hInternet = InternetOpenW(L"SageBot/2.4", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
  if (!hInternet) return NULL;

  HINTERNET hConnect = InternetConnectW(hInternet, L"127.0.0.1", (INTERNET_PORT)port, NULL, NULL,
                                        INTERNET_SERVICE_HTTP, 0, 0);
  if (!hConnect) {
    InternetCloseHandle(hInternet);
    return NULL;
  }

  DWORD dwOpenFlags = INTERNET_FLAG_SECURE |
                      INTERNET_FLAG_IGNORE_CERT_CN_INVALID |
                      INTERNET_FLAG_IGNORE_CERT_DATE_INVALID |
                      INTERNET_FLAG_RELOAD |
                      INTERNET_FLAG_NO_CACHE_WRITE |
                      INTERNET_FLAG_PRAGMA_NOCACHE;

  HINTERNET hRequest = HttpOpenRequestW(hConnect, L"GET", path, NULL, NULL, NULL, dwOpenFlags, 0);
  if (!hRequest) {
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return NULL;
  }

  DWORD timeoutMs = 1500;
  InternetSetOptionW(hRequest, INTERNET_OPTION_CONNECT_TIMEOUT, &timeoutMs, sizeof(timeoutMs));
  InternetSetOptionW(hRequest, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeoutMs, sizeof(timeoutMs));
  InternetSetOptionW(hRequest, INTERNET_OPTION_SEND_TIMEOUT, &timeoutMs, sizeof(timeoutMs));

  DWORD dwSecFlags = SECURITY_FLAG_IGNORE_UNKNOWN_CA |
                     SECURITY_FLAG_IGNORE_CERT_CN_INVALID |
                     SECURITY_FLAG_IGNORE_CERT_DATE_INVALID |
                     SECURITY_FLAG_IGNORE_WRONG_USAGE |
                     SECURITY_FLAG_IGNORE_REVOCATION;
  InternetSetOptionW(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwSecFlags, sizeof(dwSecFlags));

  char authRaw[256];
  snprintf(authRaw, sizeof(authRaw), "riot:%s", password);
  char authB64[512] = {0};
  base64_encode((const unsigned char *)authRaw, strlen(authRaw), authB64, sizeof(authB64));

  char headerA[600];
  snprintf(headerA, sizeof(headerA), "Authorization: Basic %s\r\n", authB64);
  HttpAddRequestHeadersA(hRequest, headerA, -1, HTTP_ADDREQ_FLAG_ADD | HTTP_ADDREQ_FLAG_REPLACE);

  BOOL sent = HttpSendRequestW(hRequest, NULL, 0, NULL, 0);
  if (!sent) {
    InternetSetOptionW(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwSecFlags, sizeof(dwSecFlags));
    sent = HttpSendRequestW(hRequest, NULL, 0, NULL, 0);
  }

  if (!sent) {
    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return NULL;
  }

  size_t cap = 131072;
  size_t total = 0;
  char *resp = (char *)malloc(cap);
  if (!resp) {
    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    return NULL;
  }

  DWORD bytesRead = 0;
  char chunk[4096];
  while (InternetReadFile(hRequest, chunk, sizeof(chunk), &bytesRead) && bytesRead > 0) {
    if (total + bytesRead + 1 > cap) {
      cap *= 2;
      char *n = (char *)realloc(resp, cap);
      if (!n) {
        free(resp);
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return NULL;
      }
      resp = n;
    }
    memcpy(resp + total, chunk, bytesRead);
    total += bytesRead;
  }
  resp[total] = '\0';

  InternetCloseHandle(hRequest);
  InternetCloseHandle(hConnect);
  InternetCloseHandle(hInternet);
  return resp;
}

static const wchar_t *get_tier_name(int tier) {
  switch (tier) {
  case 3: return L"Iron 1";
  case 4: return L"Iron 2";
  case 5: return L"Iron 3";
  case 6: return L"Bronze 1";
  case 7: return L"Bronze 2";
  case 8: return L"Bronze 3";
  case 9: return L"Silver 1";
  case 10: return L"Silver 2";
  case 11: return L"Silver 3";
  case 12: return L"Gold 1";
  case 13: return L"Gold 2";
  case 14: return L"Gold 3";
  case 15: return L"Platinum 1";
  case 16: return L"Platinum 2";
  case 17: return L"Platinum 3";
  case 18: return L"Diamond 1";
  case 19: return L"Diamond 2";
  case 20: return L"Diamond 3";
  case 21: return L"Ascendant 1";
  case 22: return L"Ascendant 2";
  case 23: return L"Ascendant 3";
  case 24: return L"Immortal 1";
  case 25: return L"Immortal 2";
  case 26: return L"Immortal 3";
  case 27: return L"Radiant";
  default: return L"Unranked";
  }
}

static void resolve_map_name(const char *rawMap, wchar_t *out, size_t out_len) {
  if (!rawMap || !*rawMap) {
    wcscpy_s(out, out_len, L"-");
    return;
  }
  if (strstr(rawMap, "Ascent")) wcscpy_s(out, out_len, L"Ascent");
  else if (strstr(rawMap, "Jam") || strstr(rawMap, "Lotus")) wcscpy_s(out, out_len, L"Lotus");
  else if (strstr(rawMap, "Juliett") || strstr(rawMap, "Jules") || strstr(rawMap, "Sunset")) wcscpy_s(out, out_len, L"Sunset");
  else if (strstr(rawMap, "Triad") || strstr(rawMap, "Haven")) wcscpy_s(out, out_len, L"Haven");
  else if (strstr(rawMap, "Duality") || strstr(rawMap, "Bind")) wcscpy_s(out, out_len, L"Bind");
  else if (strstr(rawMap, "Bonsai") || strstr(rawMap, "Split")) wcscpy_s(out, out_len, L"Split");
  else if (strstr(rawMap, "Foxtrot") || strstr(rawMap, "Breeze")) wcscpy_s(out, out_len, L"Breeze");
  else if (strstr(rawMap, "Port") || strstr(rawMap, "Icebox")) wcscpy_s(out, out_len, L"Icebox");
  else if (strstr(rawMap, "Infinity") || strstr(rawMap, "Abyss")) wcscpy_s(out, out_len, L"Abyss");
  else if (strstr(rawMap, "Pitt") || strstr(rawMap, "Pearl")) wcscpy_s(out, out_len, L"Pearl");
  else if (strstr(rawMap, "Canyon") || strstr(rawMap, "Fracture")) wcscpy_s(out, out_len, L"Fracture");
  else if (strstr(rawMap, "Plummet") || strstr(rawMap, "Summit")) wcscpy_s(out, out_len, L"Summit");
  else if (strstr(rawMap, "Rook") || strstr(rawMap, "Corrode")) wcscpy_s(out, out_len, L"Corrode");
  else if (strstr(rawMap, "Poveglia") || strstr(rawMap, "Range")) wcscpy_s(out, out_len, L"The Range");
  else if (strstr(rawMap, "HURM_Alley") || strstr(rawMap, "District")) wcscpy_s(out, out_len, L"District");
  else if (strstr(rawMap, "HURM_Bowl") || strstr(rawMap, "Kasbah")) wcscpy_s(out, out_len, L"Kasbah");
  else if (strstr(rawMap, "HURM_Helix") || strstr(rawMap, "Drift")) wcscpy_s(out, out_len, L"Drift");
  else if (strstr(rawMap, "HURM_HighTide") || strstr(rawMap, "Glitch")) wcscpy_s(out, out_len, L"Glitch");
  else if (strstr(rawMap, "HURM_Yard") || strstr(rawMap, "Piazza")) wcscpy_s(out, out_len, L"Piazza");
  else if (strstr(rawMap, "HURM")) wcscpy_s(out, out_len, L"Team Deathmatch");
  else if (strstr(rawMap, "AbilityDraft") || strstr(rawMap, "Gauntlet")) wcscpy_s(out, out_len, L"Gauntlet");
  else wcscpy_s(out, out_len, L"-");
}

static void resolve_gamemode_name(const char *queueId, wchar_t *out, size_t out_len) {
  if (!queueId || !*queueId) {
    wcscpy_s(out, out_len, L"-");
    return;
  }
  if (_stricmp(queueId, "competitive") == 0) wcscpy_s(out, out_len, L"Competitive");
  else if (_stricmp(queueId, "unrated") == 0) wcscpy_s(out, out_len, L"Unrated");
  else if (_stricmp(queueId, "swiftplay") == 0) wcscpy_s(out, out_len, L"Swiftplay");
  else if (_stricmp(queueId, "spikerush") == 0) wcscpy_s(out, out_len, L"Spike Rush");
  else if (_stricmp(queueId, "deathmatch") == 0) wcscpy_s(out, out_len, L"Deathmatch");
  else if (_stricmp(queueId, "hurm") == 0) wcscpy_s(out, out_len, L"Team Deathmatch");
  else if (_stricmp(queueId, "ggteam") == 0) wcscpy_s(out, out_len, L"Escalation");
  else if (_stricmp(queueId, "onefa") == 0) wcscpy_s(out, out_len, L"Replication");
  else if (_stricmp(queueId, "newmap") == 0) wcscpy_s(out, out_len, L"New Map Queue");
  else wcscpy_s(out, out_len, L"Custom Game");
}

static void resolve_agent_from_log(wchar_t *out, size_t out_len) {
  wcscpy_s(out, out_len, L"-");

  wchar_t localAppData[MAX_PATH];
  if (GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH) == 0) return;

  wchar_t logPath[MAX_PATH];
  swprintf_s(logPath, MAX_PATH, L"%s\\VALORANT\\Saved\\Logs\\ShooterGame.log", localAppData);

  HANDLE hFile = CreateFileW(logPath, GENERIC_READ,
                             FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                             NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (hFile == INVALID_HANDLE_VALUE) return;

  LARGE_INTEGER fsize;
  if (!GetFileSizeEx(hFile, &fsize) || fsize.QuadPart == 0) {
    CloseHandle(hFile);
    return;
  }

  DWORD bytesToRead = (fsize.QuadPart > 65536) ? 65536 : (DWORD)fsize.QuadPart;
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
    const char *target = "AcknowledgePossession('";
    size_t targetLen = strlen(target);
    char *pLast = NULL;
    char *pSearch = buf;
    while ((pSearch = strstr(pSearch, target)) != NULL) {
      pLast = pSearch;
      pSearch += targetLen;
    }
    if (pLast) {
      char *pPawn = pLast + targetLen;
      char *pQuote = strchr(pPawn, '\'');
      if (pQuote) *pQuote = '\0';

      if (strstr(pPawn, "Sarge") || strstr(pPawn, "Brimstone")) wcscpy_s(out, out_len, L"Brimstone");
      else if (strstr(pPawn, "Rift") || strstr(pPawn, "Astra")) wcscpy_s(out, out_len, L"Astra");
      else if (strstr(pPawn, "Hunter") || strstr(pPawn, "Sova")) wcscpy_s(out, out_len, L"Sova");
      else if (strstr(pPawn, "Thorne") || strstr(pPawn, "Sage")) wcscpy_s(out, out_len, L"Sage");
      else if (strstr(pPawn, "Wushu") || strstr(pPawn, "Jett")) wcscpy_s(out, out_len, L"Jett");
      else if (strstr(pPawn, "Vampire") || strstr(pPawn, "Reyna")) wcscpy_s(out, out_len, L"Reyna");
      else if (strstr(pPawn, "Clay") || strstr(pPawn, "Raze")) wcscpy_s(out, out_len, L"Raze");
      else if (strstr(pPawn, "Wraith") || strstr(pPawn, "Omen")) wcscpy_s(out, out_len, L"Omen");
      else if (strstr(pPawn, "Smonk") || strstr(pPawn, "Clove")) wcscpy_s(out, out_len, L"Clove");
      else if (strstr(pPawn, "Nox") || strstr(pPawn, "Vyse")) wcscpy_s(out, out_len, L"Vyse");
      else if (strstr(pPawn, "Stealth") || strstr(pPawn, "Yoru")) wcscpy_s(out, out_len, L"Yoru");
      else if (strstr(pPawn, "Cashew") || strstr(pPawn, "Tejo")) wcscpy_s(out, out_len, L"Tejo");
      else if (strstr(pPawn, "Sequoia") || strstr(pPawn, "Iso")) wcscpy_s(out, out_len, L"Iso");
      else if (strstr(pPawn, "BountyHunter") || strstr(pPawn, "Fade")) wcscpy_s(out, out_len, L"Fade");
      else if (strstr(pPawn, "Gumshoe") || strstr(pPawn, "Cypher")) wcscpy_s(out, out_len, L"Cypher");
      else if (strstr(pPawn, "Mage") || strstr(pPawn, "Harbor")) wcscpy_s(out, out_len, L"Harbor");
      else if (strstr(pPawn, "Sprinter") || strstr(pPawn, "Neon")) wcscpy_s(out, out_len, L"Neon");
      else if (strstr(pPawn, "Deadeye") || strstr(pPawn, "Chamber")) wcscpy_s(out, out_len, L"Chamber");
      else if (strstr(pPawn, "AggroBot") || strstr(pPawn, "Aggrobot") || strstr(pPawn, "Gekko")) wcscpy_s(out, out_len, L"Gekko");
      else if (strstr(pPawn, "Cable") || strstr(pPawn, "Deadlock")) wcscpy_s(out, out_len, L"Deadlock");
      else if (strstr(pPawn, "Pandemic") || strstr(pPawn, "Viper")) wcscpy_s(out, out_len, L"Viper");
      else if (strstr(pPawn, "Phoenix")) wcscpy_s(out, out_len, L"Phoenix");
      else if (strstr(pPawn, "Breach")) wcscpy_s(out, out_len, L"Breach");
      else if (strstr(pPawn, "Killjoy")) wcscpy_s(out, out_len, L"Killjoy");
      else if (strstr(pPawn, "Guide") || strstr(pPawn, "Skye")) wcscpy_s(out, out_len, L"Skye");
      else if (strstr(pPawn, "Grenadier") || strstr(pPawn, "KAY/O") || strstr(pPawn, "Kayo")) wcscpy_s(out, out_len, L"KAY/O");
      else if (strstr(pPawn, "Iris")) wcscpy_s(out, out_len, L"Miks");
      else if (strstr(pPawn, "Pine") || strstr(pPawn, "Veto")) wcscpy_s(out, out_len, L"Veto");
      else if (strstr(pPawn, "Terra") || strstr(pPawn, "Waylay")) wcscpy_s(out, out_len, L"Waylay");
    }
  }

  free(buf);
  CloseHandle(hFile);
}

static ULONGLONG g_queue_start_tick = 0;

static DWORD WINAPI round_tracker_thread_proc(LPVOID param) {
  (void)param;
  wchar_t last_display[64] = L"";
  int prev_in_game = 0;
  wchar_t last_match_map[64] = L"-";
  wchar_t last_match_agent[64] = L"-";
  wchar_t last_match_gamemode[64] = L"-";
  wchar_t last_match_rank[64] = L"-";
  wchar_t last_match_riot_id[64] = L"-";
  int last_match_ally_score = 0;
  int last_match_enemy_score = 0;

  while (atomic_load(&g_tracker_running)) {
    int port = 0;
    char password[128] = {0};

    if (!get_lockfile_credentials(&port, password, sizeof(password))) {
      if (prev_in_game == 1) {
        webhook_trigger_match_end(last_match_map, last_match_agent, last_match_gamemode,
                                  last_match_ally_score, last_match_enemy_score,
                                  last_match_rank, last_match_riot_id);
        prev_in_game = 0;
        last_match_ally_score = 0;
        last_match_enemy_score = 0;
        wcscpy_s(last_match_map, 64, L"-");
        wcscpy_s(last_match_agent, 64, L"-");
        wcscpy_s(last_match_gamemode, 64, L"-");
      }
      EnterCriticalSection(&g_round_lock);
      g_round_info.is_running = 0;
      g_round_info.in_game = 0;
      g_round_info.round_number = 0;
      g_round_info.ally_score = 0;
      g_round_info.enemy_score = 0;
      g_round_info.competitive_tier = 0;
      wcscpy_s(g_round_info.display_text, 64, L"- | -");
      wcscpy_s(g_round_info.riot_id, 64, L"-");
      wcscpy_s(g_round_info.rank_name, 64, L"-");
      wcscpy_s(g_round_info.map_name, 64, L"-");
      wcscpy_s(g_round_info.gamemode, 64, L"-");
      wcscpy_s(g_round_info.game_phase, 64, L"-");
      wcscpy_s(g_round_info.agent_name, 64, L"-");
      LeaveCriticalSection(&g_round_lock);

      g_cached_puuid[0] = '\0';

      if (wcscmp(last_display, L"- | -") != 0) {
        wcscpy_s(last_display, 64, L"- | -");
        if (g_hWnd) PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
      }
      Sleep(2000);
      continue;
    }

    // 1. Fetch PUUID from /entitlements/v1/token if not cached
    if (g_cached_puuid[0] == '\0') {
      char *entJson = fetch_local_endpoint(port, password, L"/entitlements/v1/token");
      if (entJson) {
        char *pSub = strstr(entJson, "\"subject\":\"");
        if (pSub) {
          pSub += 11;
          char *pEnd = strchr(pSub, '\"');
          if (pEnd && pEnd > pSub) {
            size_t len = (size_t)(pEnd - pSub);
            if (len < sizeof(g_cached_puuid)) {
              strncpy_s(g_cached_puuid, sizeof(g_cached_puuid), pSub, len);
              g_cached_puuid[len] = '\0';
            }
          }
        }
        free(entJson);
      }
    }

    // 2. Fetch presences from /chat/v4/presences
    char *presencesJson = fetch_local_endpoint(port, password, L"/chat/v4/presences");
    if (!presencesJson) {
      EnterCriticalSection(&g_round_lock);
      g_round_info.is_running = 1;
      g_round_info.in_game = 0;
      wcscpy_s(g_round_info.display_text, 64, L"Waiting | -");
      wcscpy_s(g_round_info.game_phase, 64, L"Waiting for game...");
      LeaveCriticalSection(&g_round_lock);

      if (wcscmp(last_display, L"Waiting | -") != 0) {
        wcscpy_s(last_display, 64, L"Waiting | -");
        if (g_hWnd) PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
      }
      Sleep(2000);
      continue;
    }

    int in_game = 0;
    int round_num = 0;
    int ally_score = 0;
    int enemy_score = 0;
    int comp_tier = 0;
    wchar_t new_display[64] = L"Waiting | -";
    wchar_t new_riot_id[64] = L"-";
    wchar_t new_rank[64] = L"Unranked";
    wchar_t new_map[64] = L"-";
    wchar_t new_gamemode[64] = L"-";
    wchar_t new_phase[64] = L"In Lobby";
    wchar_t new_agent[64] = L"-";
    int found_state = 0;

    // Scan through JSON array objects using brace-depth tracking
    char *pArray = strstr(presencesJson, "\"presences\":");
    if (!pArray) pArray = presencesJson;

    int depth = 0;
    char *obj_start = NULL;

    for (char *p = pArray; *p; p++) {
      if (*p == '{') {
        if (depth == 0) obj_start = p;
        depth++;
      } else if (*p == '}') {
        depth--;
        if (depth == 0 && obj_start) {
          size_t objLen = (size_t)(p - obj_start + 1);
          char *obj = (char *)malloc(objLen + 1);
          if (obj) {
            strncpy_s(obj, objLen + 1, obj_start, objLen);
            obj[objLen] = '\0';

            int is_valorant = (strstr(obj, "\"product\":\"valorant\"") != NULL ||
                               strstr(obj, "\"product_id\":\"valorant\"") != NULL);
            int is_my_puuid = (g_cached_puuid[0] != '\0' && strstr(obj, g_cached_puuid) != NULL);

            if (is_valorant && (is_my_puuid || (g_cached_puuid[0] == '\0' && !found_state))) {
              // Extract game_name and game_tag
              char *pName = strstr(obj, "\"game_name\":\"");
              char *pTag = strstr(obj, "\"game_tag\":\"");
              if (pName && pTag) {
                pName += 13;
                char *pNameEnd = strchr(pName, '\"');
                pTag += 12;
                char *pTagEnd = strchr(pTag, '\"');
                if (pNameEnd && pTagEnd) {
                  char rawName[64] = {0}, rawTag[32] = {0};
                  size_t nLen = (size_t)(pNameEnd - pName);
                  size_t tLen = (size_t)(pTagEnd - pTag);
                  if (nLen < sizeof(rawName)) strncpy_s(rawName, sizeof(rawName), pName, nLen);
                  if (tLen < sizeof(rawTag)) strncpy_s(rawTag, sizeof(rawTag), pTag, tLen);

                  wchar_t wName[64] = {0}, wTag[32] = {0};
                  MultiByteToWideChar(CP_UTF8, 0, rawName, -1, wName, 64);
                  MultiByteToWideChar(CP_UTF8, 0, rawTag, -1, wTag, 32);
                  swprintf_s(new_riot_id, 64, L"%ls#%ls", wName, wTag);
                }
              }

              char *pPriv = strstr(obj, "\"private\":\"");
              if (pPriv) {
                pPriv += 11;
                char *pEnd = strchr(pPriv, '\"');
                if (pEnd && pEnd > pPriv) {
                  size_t privLen = (size_t)(pEnd - pPriv);
                  char *b64priv = (char *)malloc(privLen + 1);
                  char *decoded = (char *)malloc(privLen + 64);
                  if (b64priv && decoded) {
                    strncpy_s(b64priv, privLen + 1, pPriv, privLen);
                    b64priv[privLen] = '\0';
                    int declen = base64_decode(b64priv, privLen, decoded, privLen + 64);
                    decoded[declen] = '\0';

                    // Parse competitive tier
                    char *pTier = strstr(decoded, "\"competitiveTier\":");
                    if (pTier) {
                      char *pCol = strchr(pTier, ':');
                      if (pCol) {
                        comp_tier = atoi(pCol + 1);
                        wcscpy_s(new_rank, 64, get_tier_name(comp_tier));
                      }
                    }

                    // Parse map
                    char *pMap = strstr(decoded, "\"matchMap\":\"");
                    if (!pMap) pMap = strstr(decoded, "\"partyOwnerMatchMap\":\"");
                    if (pMap) {
                      char *pCol = strchr(pMap, ':');
                      if (pCol && *(pCol + 1) == '\"') {
                        char rawMap[64] = {0};
                        char *mStart = pCol + 2;
                        char *mEnd = strchr(mStart, '\"');
                        if (mEnd) {
                          size_t mLen = (size_t)(mEnd - mStart);
                          if (mLen < sizeof(rawMap)) strncpy_s(rawMap, sizeof(rawMap), mStart, mLen);
                          resolve_map_name(rawMap, new_map, 64);
                        }
                      }
                    }

                    // Parse gamemode
                    char *pQueue = strstr(decoded, "\"queueId\":\"");
                    if (pQueue) {
                      pQueue += 11;
                      char *qEnd = strchr(pQueue, '\"');
                      if (qEnd) {
                        char rawQueue[32] = {0};
                        size_t qLen = (size_t)(qEnd - pQueue);
                        if (qLen < sizeof(rawQueue)) strncpy_s(rawQueue, sizeof(rawQueue), pQueue, qLen);
                        resolve_gamemode_name(rawQueue, new_gamemode, 64);
                      }
                    }

                    // Parse session loop state
                    if (strstr(decoded, "\"sessionLoopState\":\"INGAME\"") != NULL) {
                      in_game = 1;
                      g_queue_start_tick = 0;
                      agent_locker_reset_session();
                      char *pAlly = strstr(decoded, "\"partyOwnerMatchScoreAllyTeam\":");
                      if (pAlly) {
                        char *pCol = strchr(pAlly, ':');
                        if (pCol) ally_score = atoi(pCol + 1);
                      }
                      char *pEnemy = strstr(decoded, "\"partyOwnerMatchScoreEnemyTeam\":");
                      if (pEnemy) {
                        char *pCol = strchr(pEnemy, ':');
                        if (pCol) enemy_score = atoi(pCol + 1);
                      }
                      round_num = ally_score + enemy_score + 1;
                      swprintf_s(new_display, 64, L"Round %d | %d - %d", round_num, ally_score, enemy_score);
                      wcscpy_s(new_phase, 64, L"In Game");
                      resolve_agent_from_log(new_agent, 64);
                      found_state = 1;
                    } else if (strstr(decoded, "\"sessionLoopState\":\"MENUS\"") != NULL) {
                      if (strstr(decoded, "\"partyState\":\"MATCHMAKING\"") != NULL) {
                        if (g_queue_start_tick == 0) {
                          g_queue_start_tick = GetTickCount64();
                        }
                        // Time Elapsed
                        DWORD elapsed = (DWORD)((GetTickCount64() - g_queue_start_tick) / 1000) + 1.5;
                        swprintf_s(new_display, 64, L"In Queue (%02u:%02u) | -", elapsed / 60, elapsed % 60);
                        swprintf_s(new_phase, 64, L"In Queue (%02u:%02u)", elapsed / 60, elapsed % 60);
                      } else {
                        g_queue_start_tick = 0;
                        agent_locker_reset_session();
                        wcscpy_s(new_display, 64, L"Lobby | -");
                        wcscpy_s(new_phase, 64, L"In Lobby");
                      }
                      in_game = 0;
                      round_num = 0;
                      wcscpy_s(new_agent, 64, L"-");
                      found_state = 1;
                    } else if (strstr(decoded, "\"sessionLoopState\":\"PREGAME\"") != NULL) {
                      g_queue_start_tick = 0;
                      wcscpy_s(new_display, 64, L"Agent Select | -");
                      wcscpy_s(new_phase, 64, L"Agent Select");
                      in_game = 0;
                      round_num = 0;
                      resolve_agent_from_log(new_agent, 64);
                      found_state = 1;
                      agent_locker_on_pregame_tick(port, password, g_cached_puuid);
                    } else if (strstr(decoded, "\"sessionLoopState\"") != NULL) {
                      g_queue_start_tick = 0;
                      wcscpy_s(new_display, 64, L"In Queue | -");
                      wcscpy_s(new_phase, 64, L"In Queue");
                      in_game = 0;
                      round_num = 0;
                      found_state = 1;
                    }
                  }
                  if (b64priv) free(b64priv);
                  if (decoded) free(decoded);
                }
              }
            }
            free(obj);
            if (found_state && is_my_puuid) break;
          }
        }
      }
    }

    free(presencesJson);

    EnterCriticalSection(&g_round_lock);
    g_round_info.is_running = 1;
    g_round_info.in_game = in_game;
    g_round_info.round_number = round_num;
    g_round_info.ally_score = ally_score;
    g_round_info.enemy_score = enemy_score;
    g_round_info.competitive_tier = comp_tier;
    wcscpy_s(g_round_info.display_text, 64, new_display);
    wcscpy_s(g_round_info.riot_id, 64, new_riot_id);
    wcscpy_s(g_round_info.rank_name, 64, new_rank);
    wcscpy_s(g_round_info.map_name, 64, new_map);
    wcscpy_s(g_round_info.gamemode, 64, new_gamemode);
    wcscpy_s(g_round_info.game_phase, 64, new_phase);
    wcscpy_s(g_round_info.agent_name, 64, new_agent);
    LeaveCriticalSection(&g_round_lock);

    if (wcscmp(last_display, new_display) != 0) {
      wcscpy_s(last_display, 64, new_display);
      if (g_hWnd) PostMessageW(g_hWnd, WM_APP_UPDATE_STATUS, 0, 0);
    }

    if (in_game) {
      if (new_map[0] != L'-') wcscpy_s(last_match_map, 64, new_map);
      if (new_agent[0] != L'-') wcscpy_s(last_match_agent, 64, new_agent);
      if (new_gamemode[0] != L'-') wcscpy_s(last_match_gamemode, 64, new_gamemode);
      if (new_rank[0] != L'-') wcscpy_s(last_match_rank, 64, new_rank);
      if (new_riot_id[0] != L'-') wcscpy_s(last_match_riot_id, 64, new_riot_id);
      if (ally_score > 0 || enemy_score > 0) {
        if (ally_score + enemy_score >= last_match_ally_score + last_match_enemy_score) {
          last_match_ally_score = ally_score;
          last_match_enemy_score = enemy_score;
        }
      }
    }

    if (prev_in_game == 1 && in_game == 0) {
      webhook_trigger_match_end(last_match_map, last_match_agent, last_match_gamemode,
                                last_match_ally_score, last_match_enemy_score,
                                last_match_rank, last_match_riot_id);
      last_match_ally_score = 0;
      last_match_enemy_score = 0;
      wcscpy_s(last_match_map, 64, L"-");
      wcscpy_s(last_match_agent, 64, L"-");
      wcscpy_s(last_match_gamemode, 64, L"-");
    }
    prev_in_game = in_game;
    
    // TOO MANY REQUESTS SHOULD EDIT TS
    Sleep(1000);
  }

  return 0;
}

static int g_lock_initialized = 0;

void round_tracker_init(void) {
  if (!g_lock_initialized) {
    InitializeCriticalSection(&g_round_lock);
    g_lock_initialized = 1;
  }
  atomic_store(&g_tracker_running, 1);
  if (!g_hTrackerThread) {
    g_hTrackerThread = CreateThread(NULL, 0, round_tracker_thread_proc, NULL, 0, NULL);
  }
}

void round_tracker_cleanup(void) {
  atomic_store(&g_tracker_running, 0);
  if (g_hTrackerThread) {
    WaitForSingleObject(g_hTrackerThread, 1000);
    CloseHandle(g_hTrackerThread);
    g_hTrackerThread = NULL;
  }
  if (g_lock_initialized) {
    DeleteCriticalSection(&g_round_lock);
    g_lock_initialized = 0;
  }
}

void get_round_display_text(wchar_t *buf, size_t size) {
  if (!g_lock_initialized) {
    wcscpy_s(buf, size, L"- | -");
    return;
  }
  EnterCriticalSection(&g_round_lock);
  wcscpy_s(buf, size, g_round_info.display_text);
  LeaveCriticalSection(&g_round_lock);
}

int get_current_round_number(void) {
  if (!g_lock_initialized) return 0;
  EnterCriticalSection(&g_round_lock);
  int r = g_round_info.in_game ? g_round_info.round_number : 0;
  LeaveCriticalSection(&g_round_lock);
  return r;
}

void get_round_tracker_snapshot(RoundTrackerInfo *out_info) {
  if (!out_info) return;
  if (!g_lock_initialized) {
    memset(out_info, 0, sizeof(RoundTrackerInfo));
    wcscpy_s(out_info->display_text, 64, L"- | -");
    wcscpy_s(out_info->riot_id, 64, L"-");
    wcscpy_s(out_info->rank_name, 64, L"-");
    wcscpy_s(out_info->map_name, 64, L"-");
    wcscpy_s(out_info->gamemode, 64, L"-");
    wcscpy_s(out_info->game_phase, 64, L"-");
    wcscpy_s(out_info->agent_name, 64, L"-");
    return;
  }
  EnterCriticalSection(&g_round_lock);
  memcpy(out_info, &g_round_info, sizeof(RoundTrackerInfo));
  LeaveCriticalSection(&g_round_lock);
}
