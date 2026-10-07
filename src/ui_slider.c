#include "ui_slider.h"

// Custom Slider Window Procedure (Zero Windows Trackbar Artifacts)
LRESULT CALLBACK CustomSliderProc(HWND hWnd, UINT uMsg, WPARAM wParam,
                                         LPARAM lParam) {
  switch (uMsg) {
  case WM_CREATE: {
    SetWindowLongPtr(hWnd, GWLP_USERDATA, 0);
    return 0;
  }

  case WM_ERASEBKGND:
    return 1;

  case WM_LBUTTONDOWN:
  case WM_MOUSEMOVE: {
    if (uMsg == WM_LBUTTONDOWN || (wParam & MK_LBUTTON)) {
      if (uMsg == WM_LBUTTONDOWN) {
        SetCapture(hWnd);
      }
      int mouseX = GET_X_LPARAM(lParam);
      RECT rc;
      GetClientRect(hWnd, &rc);
      int padX = 8;
      int trackW = rc.right - rc.left - (padX * 2);
      if (trackW > 0) {
        int clampedX = mouseX - padX;
        if (clampedX < 0)
          clampedX = 0;
        if (clampedX > trackW)
          clampedX = trackW;

        int minVal = (int)(INT_PTR)GetPropW(hWnd, L"MinVal");
        int maxVal = (int)(INT_PTR)GetPropW(hWnd, L"MaxVal");
        if (maxVal <= minVal)
          maxVal = 100;

        int curPos = (int)GetWindowLongPtr(hWnd, GWLP_USERDATA);
        int newPos = minVal + (clampedX * (maxVal - minVal)) / trackW;
        if (newPos != curPos || uMsg == WM_LBUTTONDOWN) {
          SetWindowLongPtr(hWnd, GWLP_USERDATA, (LONG_PTR)newPos);

          HWND hParent = GetParent(hWnd);
          if (hParent) {
            SendMessageW(hParent, WM_HSCROLL,
                         MAKEWPARAM(TB_THUMBTRACK, newPos), (LPARAM)hWnd);
          }
          InvalidateRect(hWnd, NULL, FALSE);
        }
      }
      return 0;
    }
    break;
  }

  case WM_LBUTTONUP: {
    if (GetCapture() == hWnd) {
      ReleaseCapture();
    }
    int pos = (int)GetWindowLongPtr(hWnd, GWLP_USERDATA);
    HWND hParent = GetParent(hWnd);
    if (hParent) {
      SendMessageW(hParent, WM_HSCROLL,
                   MAKEWPARAM(TB_ENDTRACK, pos), (LPARAM)hWnd);
    }
    RedrawWindow(hWnd, NULL, NULL, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ERASE);
    return 0;
  }

  case TBM_GETPOS:
    return GetWindowLongPtr(hWnd, GWLP_USERDATA);

  case TBM_SETPOS: {
    BOOL redraw = (BOOL)wParam;
    SetWindowLongPtr(hWnd, GWLP_USERDATA, (LONG_PTR)lParam);
    if (redraw) {
      RedrawWindow(hWnd, NULL, NULL, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ERASE);
    }
    return 0;
  }

  case TBM_SETRANGE: {
    int minVal = LOWORD(lParam);
    int maxVal = HIWORD(lParam);
    SetPropW(hWnd, L"MinVal", (HANDLE)(INT_PTR)minVal);
    SetPropW(hWnd, L"MaxVal", (HANDLE)(INT_PTR)maxVal);
    return 0;
  }

  case TBM_GETRANGEMIN:
    return (LRESULT)(INT_PTR)GetPropW(hWnd, L"MinVal");

  case TBM_GETRANGEMAX: {
    int maxVal = (int)(INT_PTR)GetPropW(hWnd, L"MaxVal");
    return (maxVal <= 0) ? 100 : maxVal;
  }

  case WM_PAINT: {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hWnd, &ps);

    RECT rcClient;
    GetClientRect(hWnd, &rcClient);

    // Double buffer full control area
    HDC hdcMem = CreateCompatibleDC(hdc);
    HBITMAP hbmMem = CreateCompatibleBitmap(hdc, rcClient.right, rcClient.bottom);
    HBITMAP hbmOld = (HBITMAP)SelectObject(hdcMem, hbmMem);

    // Dark solid card background
    HBRUSH hBrBg = CreateSolidBrush(COLOR_CARD_BG);
    FillRect(hdcMem, &rcClient, hBrBg);
    DeleteObject(hBrBg);

    int pos = (int)GetWindowLongPtr(hWnd, GWLP_USERDATA);
    int minVal = (int)(INT_PTR)GetPropW(hWnd, L"MinVal");
    int maxVal = (int)(INT_PTR)GetPropW(hWnd, L"MaxVal");
    if (maxVal <= minVal)
      maxVal = 100;

    int padX = 8;
    int trackW = rcClient.right - rcClient.left - (padX * 2);
    int cy = (rcClient.top + rcClient.bottom) / 2;
    int trackH = 4;
    RECT rcTrack = {padX, cy - (trackH / 2), padX + trackW, cy + (trackH / 2)};

    // Dark slate background line
    draw_rounded_rect(hdcMem, &rcTrack, 2, RGB(45, 45, 60), RGB(65, 65, 85), 0);

    // Calculate filled width
    int fillW = ((pos - minVal) * trackW) / (maxVal - minVal);
    if (fillW < 0)
      fillW = 0;
    if (fillW > trackW)
      fillW = trackW;

    // Filled vibrant purple glow line
    if (fillW > 0) {
      RECT rcFill = {rcTrack.left, rcTrack.top, rcTrack.left + fillW, rcTrack.bottom};
      draw_rounded_rect(hdcMem, &rcFill, 2, RGB(139, 92, 246), RGB(167, 139, 250), 0);
    }

    // Centered Circle Thumb
    int thumbX = rcTrack.left + fillW;
    int r = 6;

    // Outer Purple Ring
    HBRUSH hBrRing = CreateSolidBrush(RGB(139, 92, 246));
    HPEN hPenRing = CreatePen(PS_SOLID, 1, RGB(167, 139, 250));
    HBRUSH hOldBr = (HBRUSH)SelectObject(hdcMem, hBrRing);
    HPEN hOldPen = (HPEN)SelectObject(hdcMem, hPenRing);
    Ellipse(hdcMem, thumbX - r, cy - r, thumbX + r, cy + r);

    // Inner White Dot
    HBRUSH hBrWhite = CreateSolidBrush(RGB(255, 255, 255));
    HPEN hPenWhite = CreatePen(PS_SOLID, 1, RGB(255, 255, 255));
    SelectObject(hdcMem, hBrWhite);
    SelectObject(hdcMem, hPenWhite);
    Ellipse(hdcMem, thumbX - (r - 2), cy - (r - 2), thumbX + (r - 2), cy + (r - 2));

    SelectObject(hdcMem, hOldBr);
    SelectObject(hdcMem, hOldPen);
    DeleteObject(hBrRing);
    DeleteObject(hPenRing);
    DeleteObject(hBrWhite);
    DeleteObject(hPenWhite);

    BitBlt(hdc, 0, 0, rcClient.right, rcClient.bottom, hdcMem, 0, 0, SRCCOPY);
    SelectObject(hdcMem, hbmOld);
    DeleteObject(hbmMem);
    DeleteDC(hdcMem);
    EndPaint(hWnd, &ps);
    return 0;
  }

  case WM_DESTROY:
    RemovePropW(hWnd, L"MinVal");
    RemovePropW(hWnd, L"MaxVal");
    break;
  }
  return DefWindowProcW(hWnd, uMsg, wParam, lParam);
}

// Drawing Helper
LRESULT CALLBACK EditSubclassProc(HWND hWnd, UINT uMsg, WPARAM wParam,
                                         LPARAM lParam, UINT_PTR uIdSubclass,
                                         DWORD_PTR dwRefData) {
  (void)uIdSubclass;
  (void)dwRefData;
  if (uMsg == WM_KEYDOWN) {
    if (wParam == 'A' && (GetKeyState(VK_CONTROL) & 0x8000)) {
      SendMessageW(hWnd, EM_SETSEL, 0, -1);
      return 0;
    }
  } else if (uMsg == WM_CHAR) {
    // Suppress beep on Ctrl+A
    if (wParam == 1) {
      return 0;
    }
  } else if (uMsg == WM_NCDESTROY) {
    RemoveWindowSubclass(hWnd, EditSubclassProc, uIdSubclass);
  }
  return DefSubclassProc(hWnd, uMsg, wParam, lParam);
}
