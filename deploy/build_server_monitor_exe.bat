@echo off
REM =============================================================================
REM  Build script for Routing ML Service Monitor (Tkinter) executable
REM =============================================================================
setlocal ENABLEDELAYEDEXPANSION

REM Navigate to repository root (one level above this script)
cd /d "%~dp0.."

echo.
echo ============================================================================
echo   Routing ML v4 - Service Monitor EXE Builder
echo ============================================================================
echo.

REM -----------------------------------------------------------------------------
REM 1. Ensure virtual environment exists
REM -----------------------------------------------------------------------------
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Project virtual environment (.venv) not found.
    echo         Please create it first:
    echo            python -m venv .venv
    echo            .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

set PYTHON=.venv\Scripts\python.exe
set PIP=.venv\Scripts\pip.exe
set PYINSTALLER=.venv\Scripts\pyinstaller.exe

REM -----------------------------------------------------------------------------
REM 2. Install / upgrade PyInstaller if missing
REM -----------------------------------------------------------------------------
if not exist "%PYINSTALLER%" (
    echo [INFO] PyInstaller not detected in .venv - installing...
    "%PYTHON%" -m pip install --upgrade pip >nul
    if errorlevel 1 (
        echo [ERROR] Failed to upgrade pip.
        pause
        exit /b 1
    )
    "%PYTHON%" -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller.
        pause
        exit /b 1
    )
) else (
    echo [INFO] PyInstaller already installed.
)

REM -----------------------------------------------------------------------------
REM 3. Run PyInstaller to build single-file GUI executable
REM -----------------------------------------------------------------------------
echo.
echo [INFO] Building executable...
"%PYINSTALLER%" --noconfirm --clean --windowed --onefile ^
    --name RoutingMLMonitor ^
    scripts\server_monitor_dashboard.py

if errorlevel 1 (
    echo [ERROR] Build failed. Check the PyInstaller output above.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] EXE created at: dist\RoutingMLMonitor.exe
echo          Supporting files (if any) are under the build\ directory.
echo.
echo Tips:
echo   - Copy dist\RoutingMLMonitor.exe wherever you need.
echo   - Re-run this script whenever scripts\server_monitor_dashboard.py changes.
echo.
pause
