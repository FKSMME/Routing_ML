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

REM Set environment variables from .env
set JWT_SECRET_KEY=2wyfu6bayRPtzyJCpyYOnTub7nqB7zyJNKOhNBMvaNE
set JWT_ALGORITHM=HS256
set JWT_ACCESS_TOKEN_TTL_SECONDS=3600

.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload

pause
