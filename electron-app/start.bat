@echo off
chcp 65001 >nul
echo ========================================
echo Routing ML Auto-Generation Monitor v5.2.0
echo Electron Edition
echo ========================================
echo.
echo Starting Electron app...
echo.

cd /d "%~dp0"
call npm start

pause
