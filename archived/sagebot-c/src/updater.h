#ifndef UPDATER_H
#define UPDATER_H

#include "common.h"

extern wchar_t g_latest_version_tag[64];
extern wchar_t g_latest_download_url[512];
extern atomic_int g_is_updating;

int is_newer_version(const wchar_t *vCur, const wchar_t *vNew);
void check_for_updates_async(int show_up_to_date_dialog);
void start_download_update(void);
void apply_update_and_restart(void);

#endif // UPDATER_H
