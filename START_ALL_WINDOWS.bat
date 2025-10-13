@echo off
REM ============================================================================
REM  Routing ML v4 - Windows 통합 실행 스크립트
REM  모든 서비스를 한 번에 실행합니다
REM ============================================================================
echo.
echo ========================================================================
echo   Routing ML v4 - Windows All-In-One Launcher
echo   모든 서비스를 동시에 실행합니다
echo ========================================================================
echo.
echo 시작할 서비스:
echo   [Backend]
echo   - Training Service:    http://localhost:8001  (API Docs: /docs)
echo   - Prediction Service:  http://localhost:8002  (API Docs: /docs)
echo.
echo   [Frontend]
echo   - Home Dashboard:      http://localhost:3000
echo   - Prediction UI:       http://localhost:5173
echo   - Training UI:         http://localhost:5174
echo.
echo ========================================================================
echo.

cd /d "%~dp0"

REM 가상환경 확인
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python 가상환경을 찾을 수 없습니다!
    echo.
    echo 다음 명령어로 가상환경을 생성하세요:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

REM Node.js 확인
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js를 찾을 수 없습니다!
    echo https://nodejs.org 에서 Node.js를 설치하세요.
    echo.
    pause
    exit /b 1
)

REM .env 파일 확인
if not exist ".env" (
    echo [WARNING] .env 파일이 없습니다.
    echo .env.example을 참고하여 .env 파일을 생성하세요.
    echo.
    choice /C YN /M "계속 진행하시겠습니까"
    if errorlevel 2 exit /b 1
)

REM 로그 디렉토리 생성
if not exist "logs" mkdir logs

echo.
echo [1/5] Backend Training Service 시작 중... (포트 8001)
start "🔧 Training Service (Port 8001)" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.api.training_app:app --host 0.0.0.0 --port 8001 --reload"
timeout /t 3 /nobreak >nul

echo [2/5] Backend Prediction Service 시작 중... (포트 8002)
start "🎯 Prediction Service (Port 8002)" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.api.prediction_app:app --host 0.0.0.0 --port 8002 --reload"
timeout /t 3 /nobreak >nul

echo [3/5] Frontend Home Dashboard 시작 중... (포트 3000)
start "🏠 Home Dashboard (Port 3000)" cmd /k "cd frontend-home && node server.js"
timeout /t 2 /nobreak >nul

echo [4/5] Frontend Prediction UI 시작 중... (포트 5173)
start "🎯 Prediction Frontend (Port 5173)" cmd /k "cd frontend-prediction && npm run dev"
timeout /t 2 /nobreak >nul

echo [5/5] Frontend Training UI 시작 중... (포트 5174)
start "🔧 Training Frontend (Port 5174)" cmd /k "cd frontend-training && npm run dev"

echo.
echo ========================================================================
echo   ✅ 모든 서비스가 시작되었습니다!
echo ========================================================================
echo.
echo 접속 주소:
echo   📊 홈 대시보드:     http://localhost:3000
echo   🎯 라우팅 생성:     http://localhost:5173
echo   🔧 모델 학습:       http://localhost:5174
echo   📡 Training API:    http://localhost:8001/docs
echo   📡 Prediction API:  http://localhost:8002/docs
echo.
echo 서비스 중지: 각 콘솔 창을 닫거나 Ctrl+C를 누르세요
echo.
echo ========================================================================
echo.
pause
