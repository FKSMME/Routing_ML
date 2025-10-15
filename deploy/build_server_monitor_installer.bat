@echo off
chcp 65001 >nul
REM =============================================================================
REM  Build script for Routing ML Service Monitor - INSTALLER PACKAGE
REM  Version: 4.0.0
REM  Build Date: 2025-10-14
REM  This creates a directory-based installer package
REM =============================================================================
setlocal ENABLEDELAYEDEXPANSION

REM Navigate to repository root (one level above this script)
cd /d "%~dp0.."

echo.
echo ============================================================================
echo   Routing ML v4.0.0 - Installer Package Builder
echo   Build Type: Directory-based Installation
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
REM 3. Install psutil if not already installed
REM -----------------------------------------------------------------------------
echo.
echo [INFO] Checking dependencies...
"%PIP%" show psutil >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing psutil...
    "%PIP%" install psutil
)

REM -----------------------------------------------------------------------------
REM 4. Run PyInstaller to build directory-based installer
REM -----------------------------------------------------------------------------
echo.
echo [INFO] Building installer package...
"%PYINSTALLER%" --noconfirm --clean ^
    RoutingMLMonitor_Installer.spec

if errorlevel 1 (
    echo [ERROR] Build failed. Check the PyInstaller output above.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   [SUCCESS] Installer Package Build Complete!
echo ============================================================================
echo.
echo   Output: dist\RoutingMLMonitor_v4.0.0\ (directory)
echo   Type: Installation package with all dependencies
echo
echo   This package:
echo   - Contains all required DLLs and dependencies
echo   - Faster startup time (no extraction needed)
echo   - Better for permanent installation
echo   - Can be distributed as a folder or zipped
echo.
echo   Build artifacts:
echo   - Installer folder: dist\RoutingMLMonitor_v4.0.0\
echo   - Main executable: dist\RoutingMLMonitor_v4.0.0\RoutingMLMonitor_v4.0.0.exe
echo   - Build files: build\ (can be deleted)
echo.
echo   To create a distributable package:
echo   - Option 1: Zip the entire dist\RoutingMLMonitor_v4.0.0\ folder
echo   - Option 2: Create an NSIS or Inno Setup installer from this folder
echo.
pause
