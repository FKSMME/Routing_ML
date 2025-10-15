@echo off
chcp 65001 >nul
echo ========================================
echo   Frontend Training UI
echo   Model Training Interface
echo   Port: 5174
echo ========================================
echo.

cd /d "%~dp0\frontend-training"

if not exist "node_modules" (
    echo ERROR: node_modules not found!
    echo Please run: npm install
    pause
    exit /b 1
)

echo Starting Training Frontend on http://localhost:5174
echo.

npm run dev

pause
