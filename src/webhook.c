#include "webhook.h"

// Check if a Discord user ID snowflake is valid (15 to 22 numeric digits)
int is_valid_discord_user_id(const wchar_t *input, char *out_clean_id, size_t max_out_len) {
  if (out_clean_id && max_out_len > 0) out_clean_id[0] = '\0';
  if (!input) return 0;

  // Trim leading whitespace
  while (*input == L' ' || *input == L'\t' || *input == L'\r' || *input == L'\n') input++;
  if (!*input) return 0;

  const wchar_t *p = input;
  // Handle possible formatting like <@12345> or <@!12345>
  if (p[0] == L'<' && p[1] == L'@') {
    p += 2;
    if (*p == L'!') p++;
  }

  char digits[32] = {0};
  size_t dcount = 0;
  while (*p >= L'0' && *p <= L'9') {
    if (dcount + 1 < sizeof(digits)) {
      digits[dcount++] = (char)(*p);
    }
    p++;
  }
  digits[dcount] = '\0';

  if (*p == L'>') p++;
  while (*p == L' ' || *p == L'\t' || *p == L'\r' || *p == L'\n') p++;

  // A valid snowflake contains only digits and is between 15 and 22 digits long
  if (*p == L'\0' && dcount >= 15 && dcount <= 22) {
    if (out_clean_id && max_out_len > dcount) {
      strcpy_s(out_clean_id, max_out_len, digits);
    }
    return 1;
  }
  return 0;
}

static void json_escape(const char *src, char *dst, size_t dst_len) {
  size_t j = 0;
  for (size_t i = 0; src[i] && j + 2 < dst_len; i++) {
    if (src[i] == '\"' || src[i] == '\\') {
      dst[j++] = '\\';
      dst[j++] = src[i];
    } else if (src[i] == '\n') {
      dst[j++] = '\\';
      dst[j++] = 'n';
    } else if (src[i] == '\r') {
      // skip
    } else if (src[i] == '\t') {
      dst[j++] = '\\';
      dst[j++] = 't';
    } else {
      dst[j++] = src[i];
    }
  }
  dst[j] = '\0';
}

static void wchar_to_json_str(const wchar_t *wstr, char *dst, size_t dst_len) {
  char utf8[256] = {0};
  WideCharToMultiByte(CP_UTF8, 0, wstr, -1, utf8, sizeof(utf8), NULL, NULL);
  json_escape(utf8, dst, dst_len);
}

typedef struct {
  wchar_t url[512];
  char *payload;
} WebhookTask;

static DWORD WINAPI webhook_post_thread(LPVOID param) {
  WebhookTask *task = (WebhookTask *)param;
  if (!task) return 0;

  URL_COMPONENTSW urlComp = {0};
  urlComp.dwStructSize = sizeof(urlComp);
  wchar_t hostName[256] = {0};
  wchar_t urlPath[1024] = {0};
  urlComp.lpszHostName = hostName;
  urlComp.dwHostNameLength = 256;
  urlComp.lpszUrlPath = urlPath;
  urlComp.dwUrlPathLength = 1024;

  if (!InternetCrackUrlW(task->url, 0, 0, &urlComp)) {
    send_gui_log(L"[WEBHOOK] Invalid Webhook URL format.");
    free(task->payload);
    free(task);
    return 0;
  }

  HINTERNET hInternet = InternetOpenW(L"SageBot/2.4", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
  if (hInternet) {
    INTERNET_PORT port = urlComp.nPort ? urlComp.nPort :
                         (urlComp.nScheme == INTERNET_SCHEME_HTTPS ? INTERNET_DEFAULT_HTTPS_PORT : INTERNET_DEFAULT_HTTP_PORT);
    HINTERNET hConnect = InternetConnectW(hInternet, hostName, port, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (hConnect) {
      DWORD dwOpenFlags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_PRAGMA_NOCACHE;
      if (urlComp.nScheme == INTERNET_SCHEME_HTTPS) {
        dwOpenFlags |= INTERNET_FLAG_SECURE;
      }

      HINTERNET hRequest = HttpOpenRequestW(hConnect, L"POST", urlPath, NULL, NULL, NULL, dwOpenFlags, 0);
      if (hRequest) {
        DWORD timeoutMs = 5000;
        InternetSetOptionW(hRequest, INTERNET_OPTION_CONNECT_TIMEOUT, &timeoutMs, sizeof(timeoutMs));
        InternetSetOptionW(hRequest, INTERNET_OPTION_SEND_TIMEOUT, &timeoutMs, sizeof(timeoutMs));
        InternetSetOptionW(hRequest, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeoutMs, sizeof(timeoutMs));

        DWORD dwSecFlags = SECURITY_FLAG_IGNORE_UNKNOWN_CA |
                           SECURITY_FLAG_IGNORE_CERT_CN_INVALID |
                           SECURITY_FLAG_IGNORE_CERT_DATE_INVALID |
                           SECURITY_FLAG_IGNORE_WRONG_USAGE;
        InternetSetOptionW(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwSecFlags, sizeof(dwSecFlags));

        const wchar_t *headers = L"Content-Type: application/json; charset=utf-8\r\n";
        BOOL sent = HttpSendRequestW(hRequest, headers, (DWORD)wcslen(headers),
                                     (LPVOID)task->payload, (DWORD)strlen(task->payload));
        if (sent) {
          DWORD statusCode = 0;
          DWORD statusSize = sizeof(statusCode);
          if (HttpQueryInfoW(hRequest, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER,
                             &statusCode, &statusSize, NULL)) {
            if (statusCode == 200 || statusCode == 204) {
              send_gui_log(L"[WEBHOOK] Discord notification delivered successfully.");
            } else {
              wchar_t msg[128];
              swprintf_s(msg, 128, L"[WEBHOOK] Delivery failed (HTTP %lu). Check Webhook URL.", statusCode);
              send_gui_log(msg);
            }
          } else {
            send_gui_log(L"[WEBHOOK] Request sent to Discord.");
          }
        } else {
          send_gui_log(L"[WEBHOOK] Failed to connect to Discord endpoint.");
        }
        InternetCloseHandle(hRequest);
      }
      InternetCloseHandle(hConnect);
    }
    InternetCloseHandle(hInternet);
  }

  free(task->payload);
  free(task);
  return 0;
}

static void send_webhook_async(const wchar_t *url, const char *json_payload) {
  if (!url || !*url || !json_payload || !*json_payload) return;

  WebhookTask *task = (WebhookTask *)malloc(sizeof(WebhookTask));
  if (!task) return;

  wcscpy_s(task->url, 512, url);
  size_t plen = strlen(json_payload) + 1;
  task->payload = (char *)malloc(plen);
  if (!task->payload) {
    free(task);
    return;
  }
  strcpy_s(task->payload, plen, json_payload);

  HANDLE hThread = CreateThread(NULL, 0, webhook_post_thread, task, 0, NULL);
  if (hThread) {
    CloseHandle(hThread);
  } else {
    free(task->payload);
    free(task);
  }
}

void webhook_send_test(const wchar_t *url, const wchar_t *user_id) {
  if (!url || !*url) {
    send_gui_log(L"[WEBHOOK] Webhook URL is empty.");
    return;
  }

  char clean_id[32] = {0};
  int has_valid_user = is_valid_discord_user_id(user_id, clean_id, sizeof(clean_id));

  // Current UTC ISO 8601 timestamp
  time_t now = time(NULL);
  struct tm tm_utc;
  gmtime_s(&tm_utc, &now);
  char ts[32];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", &tm_utc);

  char payload[4096];
  if (has_valid_user) {
    snprintf(payload, sizeof(payload),
             "{"
             "\"content\":\"<@%s>\","
             "\"embeds\":[{"
             "\"title\":\"🧪 Discord Webhook Connected!\","
             "\"description\":\"This is a test notification from **SageBot**.\\nMatch conclusion alerts will automatically appear here.\","
             "\"color\":9067766,"
             "\"fields\":["
             "{\"name\":\"🔔 Ping Status\",\"value\":\"Enabled (<@%s>)\",\"inline\":true},"
             "{\"name\":\"🟢 Status\",\"value\":\"Online & Connected\",\"inline\":true}"
             "],"
             "\"footer\":{\"text\":\"SageBot\"},"
             "\"timestamp\":\"%s\""
             "}]"
             "}",
             clean_id, clean_id, ts);
  } else {
    snprintf(payload, sizeof(payload),
             "{"
             "\"embeds\":[{"
             "\"title\":\"🧪 Discord Webhook Connected!\","
             "\"description\":\"This is a test notification from **SageBot**.\\nMatch conclusion alerts will automatically appear here.\","
             "\"color\":9067766,"
             "\"fields\":["
             "{\"name\":\"🔕 Ping Status\",\"value\":\"No User Mention (User ID empty/invalid)\",\"inline\":true},"
             "{\"name\":\"🟢 Status\",\"value\":\"Online & Connected\",\"inline\":true}"
             "],"
             "\"footer\":{\"text\":\"SageBot\"},"
             "\"timestamp\":\"%s\""
             "}]"
             "}",
             ts);
  }

  send_webhook_async(url, payload);
}

void webhook_trigger_match_end(const wchar_t *map_name, const wchar_t *agent_name,
                               const wchar_t *gamemode, int ally_score, int enemy_score,
                               const wchar_t *rank_name, const wchar_t *riot_id) {
  wchar_t url[512] = {0};
  wchar_t user_id[64] = {0};

  EnterCriticalSection(&g_webhook_lock);
  wcscpy_s(url, 512, g_webhook_url);
  wcscpy_s(user_id, 64, g_webhook_user_id);
  LeaveCriticalSection(&g_webhook_lock);

  // If webhook is disabled or no URL configured, skip silently
  if (!atomic_load(&g_webhook_enabled) || !url[0]) return;

  char clean_id[32] = {0};
  int has_valid_user = is_valid_discord_user_id(user_id, clean_id, sizeof(clean_id));

  // Determine outcome
  int is_victory = (ally_score > enemy_score);
  int is_defeat = (ally_score < enemy_score);
  int is_draw = (ally_score == enemy_score && (ally_score > 0 || enemy_score > 0));

  const char *result_title = is_victory ? "🟢 **Victory**" :
                             (is_defeat ? "🔴 **Defeat**" :
                             (is_draw ? "⚪ **Draw**" : "🏁 **Match Concluded**"));

  // Emerald Green (#22c55e = 2278750), Crimson Red (#ef4444 = 15680580), Purple (#8a5cf6 = 9067766)
  int color = is_victory ? 2278750 : (is_defeat ? 15680580 : 9067766);

  char map_esc[128] = {0};
  char agent_esc[128] = {0};
  char mode_esc[128] = {0};
  char rank_esc[128] = {0};
  char riot_esc[128] = {0};

  wchar_to_json_str(map_name ? map_name : L"-", map_esc, sizeof(map_esc));
  wchar_to_json_str(agent_name ? agent_name : L"-", agent_esc, sizeof(agent_esc));
  wchar_to_json_str(gamemode ? gamemode : L"-", mode_esc, sizeof(mode_esc));
  wchar_to_json_str(rank_name ? rank_name : L"-", rank_esc, sizeof(rank_esc));
  wchar_to_json_str(riot_id ? riot_id : L"-", riot_esc, sizeof(riot_esc));

  time_t now = time(NULL);
  struct tm tm_utc;
  gmtime_s(&tm_utc, &now);
  char ts[32];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", &tm_utc);

  char payload[4096];
  char content_part[64] = {0};
  if (has_valid_user) {
    snprintf(content_part, sizeof(content_part), "\"content\":\"<@%s>\",", clean_id);
  }

  snprintf(payload, sizeof(payload),
           "{"
           "%s"
           "\"embeds\":[{"
           "\"title\":\"🎮 Match Concluded!\","
           "\"description\":\"**Result:** %s (%d - %d)\","
           "\"color\":%d,"
           "\"fields\":["
           "{\"name\":\"🗺️ Map\",\"value\":\"%s\",\"inline\":true},"
           "{\"name\":\"👤 Agent\",\"value\":\"%s\",\"inline\":true},"
           "{\"name\":\"🎯 Mode\",\"value\":\"%s\",\"inline\":true},"
           "{\"name\":\"📊 Score\",\"value\":\"%d - %d\",\"inline\":true},"
           "{\"name\":\"🏆 Rank\",\"value\":\"%s\",\"inline\":true},"
           "{\"name\":\"🆔 Account\",\"value\":\"%s\",\"inline\":true}"
           "],"
           "\"footer\":{\"text\":\"SageBot\"},"
           "\"timestamp\":\"%s\""
           "}]"
           "}",
           content_part,
           result_title, ally_score, enemy_score,
           color,
           map_esc, agent_esc, mode_esc,
           ally_score, enemy_score,
           rank_esc, riot_esc,
           ts);

  send_gui_log(L"[WEBHOOK] Sending match end notification to Discord...");
  send_webhook_async(url, payload);
}
