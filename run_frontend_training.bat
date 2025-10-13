@echo off
echo ========================================
echo   Frontend Training UI
echo   모델 학습 인터페이스
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
