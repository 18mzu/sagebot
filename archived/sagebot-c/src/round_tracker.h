#ifndef ROUND_TRACKER_H
#define ROUND_TRACKER_H

#include "common.h"

typedef struct {
  int is_running;          // 1 if Riot Client is active
  int in_game;             // 1 if in a live match
  int round_number;        // Current round (ally + enemy + 1)
  int ally_score;          // Ally team score
  int enemy_score;         // Enemy team score
  int competitive_tier;    // Tier index (e.g. 4 for Iron 2)
  wchar_t display_text[64];// Formatted display string e.g. "Round 5 | 3 - 1"
  wchar_t riot_id[64];     // In-game name and tag, e.g. "Sage#001"
  wchar_t rank_name[64];   // Rank name, e.g. "Iron 2", "Immortal 1"
  wchar_t map_name[64];    // Map name, e.g. "Ascent", "Lotus"
  wchar_t gamemode[64];    // Game mode, e.g. "Competitive", "Unrated"
  wchar_t game_phase[64];  // Phase, e.g. "In-Game", "In Lobby", "In Queue", "Agent Select"
  wchar_t agent_name[64];  // Agent name, e.g. "Sova", "Sage", or "-"
} RoundTrackerInfo;

void round_tracker_init(void);
void round_tracker_cleanup(void);
void get_round_display_text(wchar_t *buf, size_t size);
int get_current_round_number(void);
void get_round_tracker_snapshot(RoundTrackerInfo *out_info);

#endif // ROUND_TRACKER_H
