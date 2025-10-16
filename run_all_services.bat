@echo off
chcp 65001 >nul
echo ========================================
echo   Routing-ML All Services
echo   Start all services simultaneously
echo ========================================
echo.
echo Starting services...
echo   - Training Service: http://localhost:8001
echo   - Prediction Service: http://localhost:8002
echo.

cd /d "%~dp0"

REM Launch each service in a new console window
start "Training Service (Port 8001)" cmd /k "run_training_service.bat"
timeout /t 2 /nobreak >nul

start "Prediction Service (Port 8002)" cmd /k "run_prediction_service.bat"

echo.
echo All services started!
echo Press any key to exit (services will keep running in separate windows)
pause
