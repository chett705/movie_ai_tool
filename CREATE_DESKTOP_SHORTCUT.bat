@echo off
chcp 65001 >nul
title CineKhmer AI Studio - Create Desktop Shortcut
color 0E

echo [*] Creating Desktop Shortcut for CineKhmer AI Studio...
echo [*] កំពុងបង្កើតផ្លូវកាត់ (Shortcut) លើ Desktop របស់អ្នក...

set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%START_APP.bat"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [System.Environment]::GetFolderPath('Desktop'); " ^
  "$sc = $ws.CreateShortcut($desktop + '\🎬 CineKhmer AI Studio.lnk'); " ^
  "$sc.TargetPath = '%TARGET_BAT%'; " ^
  "$sc.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$sc.Description = 'CineKhmer AI Studio - Movie Subtitle & Voice Dubbing'; " ^
  "$sc.WindowStyle = 1; " ^
  "$sc.Save()"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo   🎉 Shortcut created successfully on your Desktop:
    echo   👉 "🎬 CineKhmer AI Studio.lnk"
    echo   បានបង្កើត Shortcut លើ Desktop រួចរាល់ដោយជោគជ័យ!
    echo ======================================================================
) else (
    echo [X] Could not create shortcut automatically.
)

echo.
pause
