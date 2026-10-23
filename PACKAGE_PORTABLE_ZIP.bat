@echo off
chcp 65001 >nul
title CineKhmer AI Studio - Portable ZIP Packager
color 0B

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0package_tool.ps1"

echo.
pause
