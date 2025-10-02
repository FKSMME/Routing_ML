@echo off
echo ========================================
echo   Routing-ML Prediction Service
echo   라우팅 생성 및 예측 서비스
echo   Port: 8002
echo ========================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv .venv
    pause
    exit /b 1
)

echo Starting Prediction Service on http://localhost:8002
echo API Docs: http://localhost:8002/docs
echo.

.venv\Scripts\python.exe -m uvicorn backend.api.prediction_app:app --host 0.0.0.0 --port 8002 --reload

pause
