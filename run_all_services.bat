@echo off
echo ========================================
echo   Routing-ML All Services
echo   모든 서비스 동시 실행
echo ========================================
echo.
echo Starting services...
echo   - Training Service: http://localhost:8001
echo   - Prediction Service: http://localhost:8002
echo.

cd /d "%~dp0"

REM 새 콘솔 창에서 각 서비스 실행
start "Training Service (Port 8001)" cmd /k "run_training_service.bat"
timeout /t 2 /nobreak >nul

start "Prediction Service (Port 8002)" cmd /k "run_prediction_service.bat"

echo.
echo All services started!
echo Press any key to exit (services will keep running in separate windows)
pause
