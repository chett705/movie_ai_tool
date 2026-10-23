@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title CineKhmer AI Studio - ឧបករណ៍បកប្រែភាពយន្តខ្មែរ
color 0B

echo ======================================================================
echo   🎬 CineKhmer AI Studio - Movie Subtitle ^& Voice Dubbing
echo   ឧបករណ៍បកប្រែភាពយន្ត និងបញ្ចូលសំឡេងនិយាយភាសាខ្មែរ (Piseth ^& Sreymom)
echo ======================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] Node.js is NOT installed! (មិនទាន់មាន Node.js លើកុំព្យូទ័រនេះទេ)
    echo [*] Opening official download page: https://nodejs.org/ ...
    start https://nodejs.org/en/download
    echo.
    echo Please download and install Node.js (LTS), then run this file again!
    echo សូមទាញយក និងដំឡើង Node.js រួចចុចបើកឯកសារនេះម្តងទៀត។
    echo.
    pause
    exit /b 1
)

:: 2. Check Python
set "PYTHON_EXE="
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
    echo [*] Using local Python virtual environment (.venv)
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        where py >nul 2>nul
        if %errorlevel% equ 0 (
            set "PYTHON_EXE=py"
        )
    )
)

if "%PYTHON_EXE%"=="" (
    echo [X] Python is NOT installed! (មិនទាន់មាន Python លើកុំព្យូទ័រនេះទេ)
    echo [*] Opening official download page: https://www.python.org/downloads/ ...
    start https://www.python.org/downloads/
    echo.
    echo [IMPORTANT] When installing Python, make sure to check:
    echo   [x] "Add python.exe to PATH"
    echo.
    echo Please install Python and run this file again!
    echo សូមដំឡើង Python ដោយគូសធិកលើ "Add python.exe to PATH" រួចបើកឯកសារនេះម្តងទៀត។
    echo.
    pause
    exit /b 1
)

:: 3. Check and install Python dependencies
echo [*] Checking required AI libraries (កំពុងត្រួតពិនិត្យបណ្ណាល័យជំនួយ)...
"%PYTHON_EXE%" -c "import edge_tts, faster_whisper, imageio_ffmpeg, numpy" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing required Python AI packages from requirements.txt...
    echo [*] កំពុងដំឡើងបណ្ណាល័យ AI (edge-tts, faster-whisper, imageio-ffmpeg)...
    "%PYTHON_EXE%" -m pip install -r "%~dp0requirements.txt"
    if %errorlevel% neq 0 (
        echo.
        echo [!] Could not install packages automatically. Please check your internet connection.
        echo [!] បរាជ័យក្នុងការដំឡើង សូមពិនិត្យមើលការតភ្ជាប់អ៊ីនធឺណិតរបស់អ្នក។
        pause
        exit /b 1
    )
)

:: 4. Ensure directories exist
if not exist "%~dp0cache_audio" mkdir "%~dp0cache_audio"
if not exist "%~dp0temp_uploads" mkdir "%~dp0temp_uploads"

:: 5. Launch browser
echo [*] Launching web browser (កំពុងបើកផ្ទាំងកម្មវិធីលើ Browser)...
start "" "http://localhost:3000"

:: 6. Run server
echo.
echo ======================================================================
echo   ✅ CineKhmer AI Server is RUNNING at: http://localhost:3000
echo   [!] Do NOT close this command window while using the studio.
echo   [!] កុំបិទផ្ទាំង Command នេះពេលកំពុងប្រើប្រាស់កម្មវិធី។
echo   [!] ចុច Ctrl+C ឬបិទផ្ទាំងនេះ ដើម្បីបញ្ឈប់ដំណើរការ។
echo ======================================================================
echo.
cd /d "%~dp0"
node server.js
pause
