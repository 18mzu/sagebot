
# SageBot

Windows console app that sends simple keyboard input (TAB spam or random WASD/Space movement) for short anti-idle / input-testing sessions.

## Disclaimer

This project performs keyboard automation.

- Only use it where you have permission to automate input.
- It may violate the Terms of Service / rules of some apps or games.
- You are responsible for how you use it.

## Build (Windows)

Requirements:

- Git for Windows (optional)
- GCC on Windows (e.g. MinGW-w64)

From the `sagebot/` folder:

```powershell
gcc .\src\sagebot.c -o sagebot.exe -luser32
```

If your source file is at the repo root instead:

```powershell
gcc .\sagebot.c -o sagebot.exe -luser32
```

## Run

```powershell
.\sagebot.exe
```

When prompted:

1. Type `Y` to proceed (or `N` to quit).
2. Choose a mode:
	- `[1] TAB Spam`
	- `[2] Random movement` (W/A/S/D/Space)
3. Press `F6` to start.
4. Press `F6` again to stop early.

Notes:

- Default run time limit is 80 minutes (`RUN_SECONDS = 4800`).
- Logs are written to `log/log.txt` (created automatically).

