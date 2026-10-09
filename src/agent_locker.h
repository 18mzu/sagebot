#ifndef AGENT_LOCKER_H
#define AGENT_LOCKER_H

#include "common.h"

#define MAX_AGENTS 26

typedef struct {
  const wchar_t *name;
  const char *uuid;
  int is_starter;
} AgentInfo;

extern const AgentInfo g_agents[MAX_AGENTS];
extern atomic_int g_instalock_enabled;
extern atomic_int g_starter_fallback_enabled;

void agent_locker_init(void);
int get_agent_count(void);
const AgentInfo *get_agent_by_index(int idx);
int find_agent_index_by_name(const wchar_t *name);

// Priority Selection Management
void agent_selection_clear(void);
int agent_selection_toggle(int agent_idx);
int agent_selection_is_selected(int agent_idx);
int agent_selection_get_rank(int agent_idx);
int agent_selection_get_count(void);
int agent_selection_get_at(int order_idx);
void agent_selection_get_priority_string(wchar_t *out, size_t out_len);
void agent_selection_to_config_string(wchar_t *out, size_t out_len);
void agent_selection_from_config_string(const wchar_t *str);

// Pre-game auto-lock execution
void agent_locker_on_pregame_tick(int port, const char *password, const char *puuid);
void agent_locker_reset_session(void);

#endif // AGENT_LOCKER_H
