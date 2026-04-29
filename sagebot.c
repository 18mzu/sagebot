#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <windows.h>
#include <conio.h>

// Defines
#define RUN_SECONDS          4800

#define MOVE_HOLD_MIN_MS     1800
#define MOVE_HOLD_RAND_MS    400   

#define MOVE_PAUSE_MIN_MS    800
#define MOVE_PAUSE_RAND_MS   400   

#define TAB_MIN_MS           900
#define TAB_RAND_MS          400   

#define LISTENER_LOOP_MS     50
#define PANEL_RELOAD_MS      2000
#define STARTUP_DELAY_MS     3000

#define LOG_DIR              "log"
#define LOG_FILE             "log\\log.txt"

// Movement actions
typedef struct {
    const char* name;
    WORD        vk;
} MoveAction;

static MoveAction MOVE_ACTIONS[] = {
    { "FORWARD",   'W'      },
    { "BACKWARDS", 'S'      },
    { "LEFT",      'A'      },
    { "RIGHT",     'D'      },
    { "UP",        VK_SPACE },
};
#define NUM_ACTIONS (sizeof(MOVE_ACTIONS) / sizeof(MOVE_ACTIONS[0]))

// Globals
static volatile int g_status      = 0;
static volatile int g_f6_pressed  = 0;
static volatile int g_waiting_f6  = 0;

// Utils

static void current_time_str(char* buf, size_t size) {
    SYSTEMTIME st;
    GetLocalTime(&st);
    int h = st.wHour % 12;
    if (h == 0) h = 12;
    snprintf(buf, size, "%02d:%02d:%02d%s",
        h, st.wMinute, st.wSecond,
        st.wHour < 12 ? "AM" : "PM");
}

static int rand_range(int min, int extra) {
    return min + (rand() % (extra + 1));
}

static void flush_input() {
    FlushConsoleInputBuffer(GetStdHandle(STD_INPUT_HANDLE));
    while (_kbhit()) _getch();
}

// Logs

static void check_files() {
    CreateDirectoryA(LOG_DIR, NULL);
    FILE* f = fopen(LOG_FILE, "a");
    if (f) fclose(f);
}

static void log_write(const char* text) {
    check_files();
    FILE* f = fopen(LOG_FILE, "a");
    if (f) { fprintf(f, "%s\n", text); fclose(f); }
}

static void logger(const char* ts, const char* action, int count) {
    char buf[256];
    snprintf(buf, sizeof(buf), "[%s] action: %s -> %d", ts, action, count);
    log_write(buf);
}

static void status_logger(const char* text) { log_write(text); }

// Keyboard

static void send_key_press(WORD vk) {
    INPUT inp = {0};
    inp.type = INPUT_KEYBOARD; inp.ki.wVk = vk;
    SendInput(1, &inp, sizeof(INPUT));
    Sleep(50 + rand() % 50);
    inp.ki.dwFlags = KEYEVENTF_KEYUP;
    SendInput(1, &inp, sizeof(INPUT));
}

static void send_key_hold(WORD vk, int hold_ms) {
    INPUT inp = {0};
    inp.type = INPUT_KEYBOARD; inp.ki.wVk = vk;
    SendInput(1, &inp, sizeof(INPUT));
    Sleep(hold_ms);
    inp.ki.dwFlags = KEYEVENTF_KEYUP;
    SendInput(1, &inp, sizeof(INPUT));
}

static const char* do_move(int index) {
    if (index < 0 || index >= (int)NUM_ACTIONS) return "ERROR";
    int hold  = rand_range(MOVE_HOLD_MIN_MS,  MOVE_HOLD_RAND_MS);
    int pause = rand_range(MOVE_PAUSE_MIN_MS, MOVE_PAUSE_RAND_MS);
    send_key_hold(MOVE_ACTIONS[index].vk, hold);
    Sleep(pause);
    return MOVE_ACTIONS[index].name;
}

// Thread

DWORD WINAPI hotkey_thread(LPVOID param) {
    (void)param;
    int f6_was_down = 0;
    while (1) {
        if (g_waiting_f6) {
            int f6_down = (GetAsyncKeyState(VK_F6) & 0x8000) != 0;
            // Rising edge only — fire once per physical keypress
            if (f6_down && !f6_was_down) {
                g_f6_pressed = 1;
            }
            f6_was_down = f6_down;
        } else {
            f6_was_down = 0; // reset edge state when not listening
        }
        Sleep(LISTENER_LOOP_MS);
    }
    return 0;
}

// UI

static void load_menu() {
    system("cls");
    SetConsoleTitleA("sagebot");
    printf("SageBot v1.0\n");
    printf("\nChoose a method:\n");
    printf("  [1]  TAB Spam\n");
    printf("  [2]  Random movement\n");
    printf("\nClose this window to stop.\n");
    printf("\n>> ");
}

static void load_start_panel(int mode) {
    system("cls");
    SetConsoleTitleA("sagebot");
    printf("SageBot v1.0\n\n");
    if (mode == 1)
        printf("CURRENT: TAB Spam\n");
    else
        printf("CURRENT: Random movement\n");
    printf("\nPress F6 to start.\n");
    printf("Press F6 again to stop.\n");
    printf("Close this window to exit.\n\n> ");
}

// Mode1

static void run_tab_spammer() {
    char ts[32], logbuf[128];
    current_time_str(ts, sizeof(ts));

    printf("\n[%s] TAB Spammer started.\n", ts);
    printf("[%s] Created logs at: %s\n", ts, LOG_FILE);

    snprintf(logbuf, sizeof(logbuf), "[%s] TAB Spammer started.", ts);
    status_logger(logbuf);

    ULONGLONG start_tick = GetTickCount64();
    int count = 0;
    g_status = 1;

    while (g_status) {
        int interval = rand_range(TAB_MIN_MS, TAB_RAND_MS);
        Sleep(interval);

        // F6 stop
        if (g_f6_pressed) {
            g_f6_pressed = 0;
            current_time_str(ts, sizeof(ts));
            snprintf(logbuf, sizeof(logbuf), "[%s] TAB Spammer stopped (F6)", ts);
            status_logger(logbuf);
            printf("\n[%s] Stopped by F6\n", ts);
            g_status = 0;
            break;
        }

        // Time limit
        ULONGLONG elapsed = (GetTickCount64() - start_tick) / 1000;
        if (elapsed >= RUN_SECONDS) {
            current_time_str(ts, sizeof(ts));
            snprintf(logbuf, sizeof(logbuf), "[%s] TAB Spammer stopped (time limit reached)", ts);
            status_logger(logbuf);
            printf("\n[%s] Time limit reached.\n", ts);
            g_status = 0;
            break;
        }

        send_key_press(VK_TAB);
        current_time_str(ts, sizeof(ts));
        logger(ts, "TAB", count++);
    }
}

// Mode2

static void run_sagebot() {
    char ts[32], logbuf[128];
    current_time_str(ts, sizeof(ts));

    printf("\n[%s] Random movement started.\n", ts);
    printf("[%s] Created logs at: %s\n", ts, LOG_FILE);
    printf("[%s] Runs 80 min, press F6 to stop early\n", ts);

    snprintf(logbuf, sizeof(logbuf), "[%s] Random movement started.", ts);
    status_logger(logbuf);

    srand((unsigned)time(NULL));

    ULONGLONG start_tick = GetTickCount64();
    int count = 0;
    g_status = 1;

    while (g_status) {
        // F6 stop
        if (g_f6_pressed) {
            g_f6_pressed = 0;
            current_time_str(ts, sizeof(ts));
            snprintf(logbuf, sizeof(logbuf), "[%s] Random movement stopped (F6)", ts);
            status_logger(logbuf);
            printf("\n[%s] Stopped by F6\n", ts);
            g_status = 0;
            break;
        }

        // Time limit
        ULONGLONG elapsed = (GetTickCount64() - start_tick) / 1000;
        if (elapsed >= RUN_SECONDS) {
            current_time_str(ts, sizeof(ts));
            snprintf(logbuf, sizeof(logbuf), "[%s] Random movement stopped (time limit reached)", ts);
            status_logger(logbuf);
            printf("\n[%s] Time limit reached.\n", ts);
            g_status = 0;
            break;
        }

        int index = rand() % (int)NUM_ACTIONS;
        const char* action = do_move(index);

        current_time_str(ts, sizeof(ts));
        logger(ts, action, count++);
    }
}

void set_color(int color) {
    SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), color);
}


int main(void) {
    // YAP
    SetConsoleTitleA("a warning");
    system("cls");
    set_color(12); // Red
    printf("DISCLAIMER:\n");
    set_color(7); // White
    
    printf("1. This program is designed and intended for anti-AFK purposes for a short amount of time,\n");
    printf("   not for purposefully deranking, botting, or throwing a game.\n");
    printf("   If you can't play a match from the beginning, or just don't feel like playing to win,\n");
    printf("   then do not queue.\n");
    printf("2. Even though this has been tested carefully, using this program to AFK a whole match\n");
    printf("   can risk having your account banned, and ");
    
    set_color(12);
    printf("YOU");
    set_color(7);
    
    printf(" are responsible for this.\n");
    printf("   (Just play the game, bruh!)\n\n");

    printf("You have been warned. ");
    for (int i = 3; i > 0; i--) {
        printf("%d", i);   
        fflush(stdout);
        Sleep(1000);
        printf("\b \b");
    }

    printf("\n");
    printf("\nProceed? [Y/N]: ");
    
    char choice;
    while (1) {
        if (_kbhit()) {
            choice = (char)_getch();
            if (choice == 'y' || choice == 'Y') {
                break;
            } 
            else if (choice == 'n' || choice == 'N') {
                printf("\nExiting...");
                Sleep(500);
                return 0;
            }
        }
        Sleep(50); 
    }

    // FINALLY START
    srand((unsigned)time(NULL));

    system("cls");
    SetConsoleTitleA("sagebot");
    printf("Initializing...\n");
    Sleep(STARTUP_DELAY_MS);

    check_files();

    FILE* log = fopen(LOG_FILE, "w");
    if (log) {
        char ts[32];
        current_time_str(ts, sizeof(ts));
        fprintf(log, "[%s] sagebot is ready.\n", ts);
        fclose(log);
    }

    CreateThread(NULL, 0, hotkey_thread, NULL, 0, NULL);

    while (1) {
        g_waiting_f6 = 0;
        g_f6_pressed = 0;

        load_menu();
        flush_input();

        int mode = 0;
        while (mode != 1 && mode != 2) {
            if (_kbhit()) {
                char c = (char)_getch();
                if      (c == '1') mode = 1;
                else if (c == '2') mode = 2;
                else printf("\n  [!] Invalid input. Press 1 or 2.\n>> ");
            }
            Sleep(50);
        }

        g_f6_pressed = 0;
        g_status     = 0;
        g_waiting_f6 = 1;

        load_start_panel(mode);
        flush_input();

        while (!g_f6_pressed) Sleep(LISTENER_LOOP_MS);
        g_f6_pressed = 0;

        if (mode == 1) run_tab_spammer();
        else           run_sagebot();

        g_waiting_f6 = 0;
        g_f6_pressed = 0;
        flush_input();

        printf("\n[Done] Returning to menu in 2 seconds...\n");
        Sleep(PANEL_RELOAD_MS);
    }

    return 0;
}                                               