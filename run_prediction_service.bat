@echo off
chcp 65001 >nul
echo ========================================
echo   Routing-ML Prediction Service
echo   Routing Creation and Prediction
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

echo Starting Prediction Service on https://localhost:8002
echo API Docs: https://localhost:8002/docs
echo.

.venv\Scripts\python.exe -m uvicorn backend.api.prediction_app:app --host 0.0.0.0 --port 8002 --ssl-keyfile=certs/rtml.ksm.co.kr.key --ssl-certfile=certs/rtml.ksm.co.kr.crt --reload

pause
