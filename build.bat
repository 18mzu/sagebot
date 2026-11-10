@echo off
setlocal enabledelayedexpansion

echo Building
echo.

cd /d "%~dp0sagebot-tauri"

echo [1/2] Building SageBot (Tauri release build with embedded frontend)...
call npm.cmd run tauri build -- --no-bundle
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Tauri release build failed with exit code %ERRORLEVEL%!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Packaging executable...
set VERSION=4.0.1

set "SRC_EXE="
if exist "src-tauri\target\release\sagebot.exe" set "SRC_EXE=src-tauri\target\release\sagebot.exe"
if not defined SRC_EXE if exist "src-tauri\target\release\sagebot-tauri.exe" set "SRC_EXE=src-tauri\target\release\sagebot-tauri.exe"

if defined SRC_EXE (
    del /f /q "..\sagebot.old.exe" >nul 2>&1
    copy /y "!SRC_EXE!" "..\sagebot.exe" >nul 2>&1
    if errorlevel 1 (
        move /y "..\sagebot.exe" "..\sagebot.old.exe" >nul 2>&1
        copy /y "!SRC_EXE!" "..\sagebot.exe" >nul 2>&1
    )
)

if not exist "..\sagebot.exe" (
    echo [ERROR] Failed to package executable to ..\sagebot.exe
    pause
    exit /b 1
)

echo.
echo ======================================================
echo               Build Completed Successfully!
echo ======================================================
echo Version : v!VERSION!
echo Output  : sagebot\sagebot.exe
echo ======================================================
echo.
pause
