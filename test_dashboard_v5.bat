@echo off
echo Starting MCS Server Dashboard v5.0.0 Test...
echo.

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Run the dashboard directly (without building)
python scripts\server_monitor_dashboard_v2.py

pause
