@echo off
echo ========================================
echo   Routing-ML Main Backend Service
echo   통합 백엔드 서비스 (훈련 + 예측)
echo   Port: 8000
echo ========================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv .venv
    pause
    exit /b 1
)

echo Starting Main Backend Service on http://0.0.0.0:8000
echo API Docs: http://localhost:8000/docs
echo.
echo 내부망 접속 주소: http://10.204.2.28:8000
echo.

.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload

pause
