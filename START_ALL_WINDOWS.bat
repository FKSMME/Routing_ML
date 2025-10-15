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
echo   - Main Backend API:    http://localhost:8000  (API Docs: /docs)
echo   - Network Access:      http://10.204.2.28:8000
echo.
echo   [Frontend]
echo   - Home Dashboard:      http://localhost:3000  (Network: http://10.204.2.28:3000)
echo   - Prediction UI:       http://localhost:5173  (Network: http://10.204.2.28:5173)
echo   - Training UI:         http://localhost:5174  (Network: http://10.204.2.28:5174)
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
echo [1/4] Starting Backend Main Service... (Port 8000)
start "Backend-Main-8000" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 5 /nobreak >nul

echo [2/4] Starting Frontend Home Dashboard... (Port 3000)
start "Frontend-Home-3000" cmd /k "cd frontend-home && node server.js"
timeout /t 2 /nobreak >nul

echo [3/4] Starting Frontend Prediction UI... (Port 5173)
start "Frontend-Prediction-5173" cmd /k "cd frontend-prediction && npm run dev"
timeout /t 2 /nobreak >nul

echo [4/4] Starting Frontend Training UI... (Port 5174)
start "Frontend-Training-5174" cmd /k "cd frontend-training && npm run dev"

echo.
echo ========================================================================
echo   All services started successfully!
echo ========================================================================
echo.
echo Local access:
echo   Home Dashboard:     http://localhost:3000
echo   Routing Creation:   http://localhost:5173
echo   Model Training:     http://localhost:5174
echo   Backend API:        http://localhost:8000/docs
echo.
echo Internal network access (from other PCs):
echo   Home Dashboard:     http://10.204.2.28:3000
echo   Routing Creation:   http://10.204.2.28:5173
echo   Model Training:     http://10.204.2.28:5174
echo   Backend API:        http://10.204.2.28:8000/docs
echo.
echo To stop services: Close each console window or press Ctrl+C
echo.
echo ========================================================================
echo.
pause
