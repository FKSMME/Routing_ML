@echo off
chcp 65001 >nul
REM ============================================================================
REM MCS Server Dashboard v5.0.0 - Complete Build Script
REM Builds both Portable and Installer versions
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo  MCS Server Dashboard v5.0.0 - Complete Build
echo  Building: Portable + Installer
echo ============================================================================
echo.

REM Change to project root
cd /d "%~dp0\.."

REM Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found!
    echo Please create a virtual environment first: python -m venv .venv
    pause
    exit /b 1
)

echo [Step 1/7] Activating virtual environment...
echo.
call .venv\Scripts\activate.bat

echo [Step 2/7] Checking dependencies...
echo.

REM Check PyInstaller
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)

REM Check psutil
pip show psutil >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing psutil...
    pip install psutil
)

echo [OK] Dependencies ready.
echo.

echo [Step 3/7] Cleaning old build artifacts...
echo.

if exist "build\" (
    echo Removing build\ directory...
    rmdir /s /q build
)

if exist "dist\" (
    echo Removing dist\ directory...
    rmdir /s /q dist
)

echo [OK] Cleanup complete.
echo.

REM ============================================================================
REM Build Portable Version
REM ============================================================================

echo.
echo ============================================================================
echo  Building Portable Version (Single EXE)
echo ============================================================================
echo.

echo [Step 4/7] Running PyInstaller for Portable...
echo.

pyinstaller --clean --noconfirm RoutingMLMonitor_v5_Portable.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Portable build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Portable build complete.
echo.

REM Check if portable exe exists
if exist "dist\MCS_Server_Dashboard_v5.0.0_Portable.exe" (
    echo [OK] Portable executable found: dist\MCS_Server_Dashboard_v5.0.0_Portable.exe

    REM Get file size
    for %%F in ("dist\MCS_Server_Dashboard_v5.0.0_Portable.exe") do set size=%%~zF
    set /a sizeMB=!size! / 1048576
    echo [INFO] File size: !sizeMB! MB
) else (
    echo [ERROR] Portable executable not found!
    pause
    exit /b 1
)

REM ============================================================================
REM Build Installer Version
REM ============================================================================

echo.
echo ============================================================================
echo  Building Installer Version (Directory)
echo ============================================================================
echo.

echo [Step 5/7] Running PyInstaller for Installer...
echo.

REM Clean build directory for installer
if exist "build\" (
    rmdir /s /q build
)

pyinstaller --clean --noconfirm RoutingMLMonitor_v5_Installer.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Installer build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Installer directory build complete.
echo.

REM Check if installer directory exists
if exist "dist\MCS_Server_Dashboard_v5.0.0\" (
    echo [OK] Installer directory found: dist\MCS_Server_Dashboard_v5.0.0\

    REM Count files
    for /f %%A in ('dir /b /s "dist\MCS_Server_Dashboard_v5.0.0\*" ^| find /c /v ""') do set filecount=%%A
    echo [INFO] Total files: !filecount!
) else (
    echo [ERROR] Installer directory not found!
    pause
    exit /b 1
)

REM ============================================================================
REM Create Installer with Inno Setup (Optional)
REM ============================================================================

echo.
echo [Step 6/7] Creating Windows Installer with Inno Setup...
echo.

REM Check if Inno Setup is installed
set INNO_PATH=
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set INNO_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe
) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set INNO_PATH=C:\Program Files\Inno Setup 6\ISCC.exe
)

if defined INNO_PATH (
    echo [INFO] Inno Setup found: !INNO_PATH!
    echo [INFO] Building installer package...

    REM Create output directory
    if not exist "dist\installer" mkdir "dist\installer"

    REM Run Inno Setup
    "!INNO_PATH!" "setup_installer_v5.iss"

    if errorlevel 1 (
        echo [WARNING] Inno Setup build failed or was cancelled.
    ) else (
        echo [OK] Installer package created successfully.

        if exist "dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe" (
            echo [OK] Setup executable: dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe

            REM Get setup file size
            for %%F in ("dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe") do set setupsize=%%~zF
            set /a setupsizeMB=!setupsize! / 1048576
            echo [INFO] Setup size: !setupsizeMB! MB
        )
    )
) else (
    echo [WARNING] Inno Setup not found. Skipping installer creation.
    echo [INFO] You can manually create installer with Inno Setup later.
    echo [INFO] Install from: https://jrsoftware.org/isdl.php
)

echo.

REM ============================================================================
REM Final Summary
REM ============================================================================

echo [Step 7/7] Build Summary
echo.

echo ============================================================================
echo  Build Complete!
echo ============================================================================
echo.

echo Available builds:
echo.

if exist "dist\MCS_Server_Dashboard_v5.0.0_Portable.exe" (
    echo 1. Portable Version (Single EXE):
    echo    dist\MCS_Server_Dashboard_v5.0.0_Portable.exe
    echo    - No installation required
    echo    - Double-click to run
    echo    - Size: !sizeMB! MB
    echo.
)

if exist "dist\MCS_Server_Dashboard_v5.0.0\" (
    echo 2. Installer Version (Directory):
    echo    dist\MCS_Server_Dashboard_v5.0.0\
    echo    - Contains all dependencies
    echo    - Files: !filecount!
    echo.
)

if exist "dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe" (
    echo 3. Setup Installer (EXE):
    echo    dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe
    echo    - Professional installer
    echo    - Uninstaller included
    echo    - Size: !setupsizeMB! MB
    echo.
)

echo ============================================================================
echo.

echo Quick Start:
echo   Portable:  dist\MCS_Server_Dashboard_v5.0.0_Portable.exe
echo   Installer: dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe
echo.

echo ============================================================================

pause
