@echo off
echo ========================================
echo   Frontend Home Dashboard
echo   통합 대시보드
echo   Port: 3000
echo ========================================
echo.

cd /d "%~dp0\frontend-home"

if not exist "node_modules" (
    echo ERROR: node_modules not found!
    echo Please run: npm install
    pause
    exit /b 1
)

echo Starting Home Dashboard on http://localhost:3000
echo.

node server.js

pause
