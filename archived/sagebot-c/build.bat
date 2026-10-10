@echo off
@echo Killing Sagebot
taskkill /f /im sagebot_gui.exe >nul 2>&1
@echo Building...
windres -i src/resource.rc -O coff -o src/resource.res
gcc -mwindows -O2 src/*.c src/resource.res -o sagebot_gui.exe -lole32 -loleaut32 -luuid -lcomctl32 -luxtheme -ldwmapi -lwinmm -lgdi32 -lwininet -lshell32
if %ERRORLEVEL% EQU 0 (
    echo BUILD SUCCESSFUL
) else (
    echo BUILD FAILED with error %ERRORLEVEL%
)
