@echo off
chcp 65001 >nul
powershell.exe -NoProfile -File "%~dp0scripts\install-follow.ps1"
if errorlevel 1 pause
