#ifndef UI_SLIDER_H
#define UI_SLIDER_H

#include "common.h"

LRESULT CALLBACK CustomSliderProc(HWND hWnd, UINT uMsg, WPARAM wParam,
                                 LPARAM lParam);
LRESULT CALLBACK EditSubclassProc(HWND hWnd, UINT uMsg, WPARAM wParam,
                                 LPARAM lParam, UINT_PTR uIdSubclass,
                                 DWORD_PTR dwRefData);

#endif // UI_SLIDER_H
