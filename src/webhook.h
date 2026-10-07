#ifndef WEBHOOK_H
#define WEBHOOK_H

#include "common.h"

int is_valid_discord_user_id(const wchar_t *input, char *out_clean_id, size_t max_out_len);
void webhook_send_test(const wchar_t *url, const wchar_t *user_id);
void webhook_trigger_match_end(const wchar_t *map_name, const wchar_t *agent_name,
                               const wchar_t *gamemode, int ally_score, int enemy_score,
                               const wchar_t *rank_name, const wchar_t *riot_id);

#endif // WEBHOOK_H
