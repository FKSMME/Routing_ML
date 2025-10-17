@echo off
chcp 65001 >nul
REM ============================================================================
REM  Routing ML v4 - Windows Integrated Launch Script
REM  Start all services at once
REM ============================================================================
echo.
echo ========================================================================
echo   Routing ML v4 - Windows All-In-One Launcher
echo   Start all services simultaneously
echo ========================================================================
echo.
echo Services to start:
echo   [Backend]
echo   - Main Backend API:    https://localhost:8000  (API Docs: /docs)
echo   - Network Access:      https://10.204.2.28:8000
echo   - Domain Access:       https://rtml.ksm.co.kr:8000
echo.
echo   [Frontend]
echo   - Home Dashboard:      https://localhost:3000  (Network: https://10.204.2.28:3000)
echo   - Prediction UI:       https://localhost:5173  (Network: https://10.204.2.28:5173)
echo   - Training UI:         https://localhost:5174  (Network: https://10.204.2.28:5174)
echo.
echo ========================================================================
echo.

cd /d "%~dp0"

REM Check virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found!
    echo.
    echo Please create virtual environment:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Check .env file
if not exist ".env" (
    echo [WARNING] .env file not found.
    echo Please create .env file referring to .env.example
    echo.
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
)

REM Create logs directory
if not exist "logs" mkdir logs

echo.
echo [1/4] Starting Backend Main Service with HTTPS... (Port 8000)
start "Backend-Main-8000" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --ssl-keyfile=certs/rtml.ksm.co.kr.key --ssl-certfile=certs/rtml.ksm.co.kr.crt --reload"
timeout /t 5 /nobreak >nul

echo [2/4] Starting Frontend Home Dashboard with HTTPS... (Port 3000)
start "Frontend-Home-3000" cmd /k "set USE_HTTPS=true && cd frontend-home && node server.js"
timeout /t 2 /nobreak >nul

echo [3/4] Starting Frontend Prediction UI... (Port 5173)
start "Frontend-Prediction-5173" cmd /k "cd frontend-prediction && npm run dev"
timeout /t 2 /nobreak >nul

echo [4/4] Starting Frontend Training UI... (Port 5174)
start "Frontend-Training-5174" cmd /k "cd frontend-training && npm run dev"

echo.
echo ========================================================================
echo   All services started successfully with HTTPS!
echo ========================================================================
echo.
echo Local access (HTTPS):
echo   Home Dashboard:     https://localhost:3000
echo   Routing Creation:   https://localhost:5173
echo   Model Training:     https://localhost:5174
echo   Backend API:        https://localhost:8000/docs
echo.
echo Internal network access (from other PCs):
echo   Home Dashboard:     https://10.204.2.28:3000
echo   Routing Creation:   https://10.204.2.28:5173
echo   Model Training:     https://10.204.2.28:5174
echo   Backend API:        https://10.204.2.28:8000/docs
echo.
echo Domain access:
echo   Home Dashboard:     https://rtml.ksm.co.kr:3000
echo   Routing Creation:   https://rtml.ksm.co.kr:5173
echo   Model Training:     https://rtml.ksm.co.kr:5174
echo   Backend API:        https://rtml.ksm.co.kr:8000/docs
echo.
echo To stop services: Close each console window or press Ctrl+C
echo.
echo ========================================================================
echo.
pause
