#include "config.h"

void init_config_path(void) {
  DWORD len = GetModuleFileNameW(NULL, g_config_path, MAX_PATH);
  if (len == 0 || len >= MAX_PATH) {
    wcscpy_s(g_config_path, MAX_PATH, L"config.ini");
    return;
  }
  for (int i = (int)len - 1; i >= 0; --i) {
    if (g_config_path[i] == L'\\' || g_config_path[i] == L'/') {
      g_config_path[i + 1] = L'\0';
      break;
    }
  }
  wcsncat_s(g_config_path, MAX_PATH, L"config.ini",
            MAX_PATH - wcslen(g_config_path) - 1);
}

void save_config(void) {
  wchar_t buf[32];

  swprintf_s(buf, 32, L"%d", atomic_load(&g_playpause_vk));
  WritePrivateProfileStringW(L"Settings", L"PlayPause", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_auto_vote_mode));
  WritePrivateProfileStringW(L"Settings", L"AutoVote", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_anti_afk_mode));
  WritePrivateProfileStringW(L"AntiAFK", L"Method", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_anti_afk_key));
  WritePrivateProfileStringW(L"AntiAFK", L"Key", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_slow_mode));
  WritePrivateProfileStringW(L"AntiAFK", L"SlowMode", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_chat_mode));
  WritePrivateProfileStringW(L"Chat", L"Enabled", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_chat_target));
  WritePrivateProfileStringW(L"Chat", L"Target", buf, g_config_path);

  swprintf_s(buf, 32, L"%d", atomic_load(&g_chat_interval));
  WritePrivateProfileStringW(L"Chat", L"Interval", buf, g_config_path);

  EnterCriticalSection(&g_chat_lock);
  WritePrivateProfileStringW(L"Chat", L"Text", g_chat_text, g_config_path);
  LeaveCriticalSection(&g_chat_lock);

  EnterCriticalSection(&g_webhook_lock);
  WritePrivateProfileStringW(L"Webhook", L"Url", g_webhook_url, g_config_path);
  WritePrivateProfileStringW(L"Webhook", L"UserId", g_webhook_user_id, g_config_path);
  LeaveCriticalSection(&g_webhook_lock);
}

void load_config(void) {
  int playpause =
      GetPrivateProfileIntW(L"Settings", L"PlayPause", VK_F9, g_config_path);
  int autovote =
      GetPrivateProfileIntW(L"Settings", L"AutoVote", 0, g_config_path);
  int afk_mode =
      GetPrivateProfileIntW(L"AntiAFK", L"Method", 0, g_config_path);
  int afk_key =
      GetPrivateProfileIntW(L"AntiAFK", L"Key", VK_TAB, g_config_path);
  int slow_mode =
      GetPrivateProfileIntW(L"AntiAFK", L"SlowMode", 0, g_config_path);
  int chat_mode =
      GetPrivateProfileIntW(L"Chat", L"Enabled", 0, g_config_path);
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
  if (afk_mode < 0 || afk_mode > 1)
    afk_mode = 0;
  if (afk_key < 8 || afk_key > 254)
    afk_key = VK_TAB;
  if (slow_mode < 0 || slow_mode > 1)
    slow_mode = 0;
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
  atomic_store(&g_anti_afk_mode, afk_mode);
  atomic_store(&g_anti_afk_key, afk_key);
  atomic_store(&g_slow_mode, slow_mode);
  atomic_store(&g_chat_mode, chat_mode);
  atomic_store(&g_chat_target, chat_target);
  atomic_store(&g_chat_interval, chat_interval);
  EnterCriticalSection(&g_chat_lock);
  wcscpy_s(g_chat_text, 512, chat_text);
  LeaveCriticalSection(&g_chat_lock);

  wchar_t webhook_url[512] = {0};
  wchar_t webhook_user_id[64] = {0};
  GetPrivateProfileStringW(L"Webhook", L"Url", L"", webhook_url, 512, g_config_path);
  GetPrivateProfileStringW(L"Webhook", L"UserId", L"", webhook_user_id, 64, g_config_path);
  EnterCriticalSection(&g_webhook_lock);
  wcscpy_s(g_webhook_url, 512, webhook_url);
  wcscpy_s(g_webhook_user_id, 64, webhook_user_id);
  LeaveCriticalSection(&g_webhook_lock);
}
