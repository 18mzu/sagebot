#ifndef SPAMMER_H
#define SPAMMER_H

#include "common.h"

// Key Injection & Clipboard Helpers
void send_key_press(WORD vk);
void send_key_down(WORD vk);
void send_key_up(WORD vk);
void send_extra_key(WORD vk);
int copy_to_clipboard_w(const wchar_t *text);
void send_paste_action(void);
void send_chat_message(void);
int interruptible_sleep(int total_ms);

// Spammer & Hotkey Functions
DWORD WINAPI hotkey_thread(LPVOID param);
void trigger_rebind_capture(void);
DWORD WINAPI spammer_thread_proc(LPVOID param);
void start_spammer(void);
void stop_spammer(void);

#endif // SPAMMER_H
