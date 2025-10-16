@echo off
chcp 65001 >nul
echo ========================================
echo   Routing-ML Training Service
echo   Model Training and Data Management
echo   Port: 8001
echo ========================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv .venv
    pause
    exit /b 1
)

echo Starting Training Service on http://localhost:8001
echo API Docs: http://localhost:8001/docs
echo.

.venv\Scripts\python.exe -m uvicorn backend.api.training_app:app --host 0.0.0.0 --port 8001 --reload

pause
