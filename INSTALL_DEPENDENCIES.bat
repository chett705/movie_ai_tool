@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title CineKhmer AI Studio - One-Click Dependency Installer
color 0A

echo ======================================================================
echo   ⚙️ CineKhmer AI Studio - Dependency Installer (ដំឡើងកម្មវិធីជំនួយ)
echo ======================================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] Node.js is NOT installed! (មិនទាន់មាន Node.js លើកុំព្យូទ័រនេះទេ)
    echo [*] Opening download link: https://nodejs.org/en/download ...
    start https://nodejs.org/en/download
) else (
    for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js version: %%v
)

:: Check Python
set "PYTHON_EXE="
where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=py"
    )
)

if "%PYTHON_EXE%"=="" (
    echo [X] Python is NOT installed! (មិនទាន់មាន Python លើកុំព្យូទ័រនេះទេ)
    echo [*] Opening download link: https://www.python.org/downloads/ ...
    start https://www.python.org/downloads/
    echo.
    echo Please install Python (check "Add python.exe to PATH") and run this installer again.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('"%PYTHON_EXE%" --version') do echo [OK] Python version: %%v
)

echo.
echo [*] Upgrading pip...
"%PYTHON_EXE%" -m pip install --upgrade pip

echo.
echo [*] Installing required Python AI packages (edge-tts, faster-whisper, imageio-ffmpeg, numpy)...
echo [*] កំពុងដំឡើងបណ្ណាល័យ AI ភាសាខ្មែរ...
"%PYTHON_EXE%" -m pip install -r "%~dp0requirements.txt"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo   🎉 SUCCESS! All dependencies are installed and ready to use!
    echo   ការដំឡើងបានជោគជ័យ ១០០%! អ្នកអាចចាប់ផ្តើមប្រើប្រាស់បានហើយ។
    echo.
    echo   👉 Double click "START_APP.bat" to start CineKhmer AI Studio.
    echo   👉 ចុចបើកឯកសារ "START_APP.bat" ដើម្បីចាប់ផ្តើមកម្មវិធី។
    echo ======================================================================
) else (
    echo.
    echo [X] An error occurred during installation. Please check your internet connection.
)

echo.
pause
