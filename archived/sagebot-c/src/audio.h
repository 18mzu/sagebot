#ifndef AUDIO_H
#define AUDIO_H

#include "common.h"

#define MUSIC_ALIAS L"sagebot_bgm"
#define MUSIC_FILE L"assets\\music.mp3"

// Music Player UI Handles & State
extern HWND g_hLblMusicHeader;
extern HWND g_hLblMusicSub;
extern HWND g_hLblMusicTitle;
extern HWND g_hLblMusicArtist;
extern HWND g_hBtnMusicPlay;
extern HWND g_hSliderMusicPos;
extern HWND g_hLblMusicTime;
extern HWND g_hSliderMusicVol;
extern HWND g_hLblMusicVol;

extern HBITMAP g_hBmpMusicCover;
extern int g_music_playing;
extern int g_music_opened;
extern int g_music_length_ms;
extern int g_music_volume;
extern int g_music_user_seeking;

HBITMAP load_jpeg_from_resource_or_file(int resId, const wchar_t *fallbackPath,
                                       int targetW, int targetH);
void music_open(void);
void music_play(void);
void music_pause(void);
void music_toggle(void);
void music_set_volume(int vol);
void music_seek_to(int pos_ms);
void music_update_progress(void);
void music_cleanup(void);
void show_music_controls(int show);

#endif // AUDIO_H
