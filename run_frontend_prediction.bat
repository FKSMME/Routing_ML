@echo off
echo ========================================
echo   Frontend Prediction UI
echo   라우팅 생성 인터페이스
echo   Port: 5173
echo ========================================
echo.

cd /d "%~dp0\frontend-prediction"

if not exist "node_modules" (
    echo ERROR: node_modules not found!
    echo Please run: npm install
    pause
    exit /b 1
)

echo Starting Prediction Frontend on http://localhost:5173
echo.

npm run dev

pause
