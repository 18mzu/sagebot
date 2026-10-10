#include "common.h"

void draw_rounded_rect(HDC hdc, RECT *r, int radius, COLORREF fill,
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

void current_time_str_w(wchar_t *buf, size_t size) {
  SYSTEMTIME st;
  GetLocalTime(&st);
  int h = st.wHour % 12;
  if (h == 0)
    h = 12;
  swprintf_s(buf, size, L"%02d:%02d:%02d %s", h, st.wMinute, st.wSecond,
             st.wHour < 12 ? L"AM" : L"PM");
}

int rand_range(int min, int extra) {
  return min + (rand() % (extra + 1));
}

void get_key_name_w(int vk, wchar_t *buf, size_t size) {
  LONG scan = (LONG)MapVirtualKeyW((UINT)vk, MAPVK_VK_TO_VSC) << 16;
  if (!scan || !GetKeyNameTextW(scan, buf, (int)size)) {
    swprintf_s(buf, size, L"VK_0x%02X", vk);
  }
}

static void check_files(void) {
  CreateDirectoryA(LOG_DIR, NULL);
  FILE *f = NULL;
  fopen_s(&f, LOG_FILE, "a");
  if (f)
    fclose(f);
}

void log_clear_file(void) {
  CreateDirectoryA(LOG_DIR, NULL);
  FILE *f = NULL;
  fopen_s(&f, LOG_FILE, "w");
  if (f)
    fclose(f);
}

void log_write(const char *text) {
  check_files();
  FILE *f = NULL;
  fopen_s(&f, LOG_FILE, "a");
  if (f) {
    fprintf(f, "%s\n", text);
    fclose(f);
  }
}

void send_gui_log(const wchar_t *msg) {
  if (g_hWnd && IsWindow(g_hWnd)) {
    wchar_t *heapMsg = _wcsdup(msg);
    PostMessageW(g_hWnd, WM_APP_LOG, 0, (LPARAM)heapMsg);
  }
}

void logger(const wchar_t *action, int count) {
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

void status_logger(const wchar_t *text) {
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
