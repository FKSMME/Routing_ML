@echo off
REM ============================================================================
REM MCS Server Dashboard v5.0.0 Build Script
REM Modern UI with Material Design 3 + Fluent Design
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo  MCS Server Dashboard v5.0.0 - Build Script
echo  Material Design 3 + Fluent Design UI
echo ============================================================================
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found!
    echo Please create a virtual environment first: python -m venv .venv
    pause
    exit /b 1
)

echo [Step 1/5] Checking dependencies...
echo.

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Check if PyInstaller is installed
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [INFO] PyInstaller not found. Installing...
    pip install pyinstaller
)

REM Check if psutil is installed
pip show psutil >nul 2>&1
if errorlevel 1 (
    echo [INFO] psutil not found. Installing...
    pip install psutil
)

echo [OK] Dependencies check complete.
echo.

echo [Step 2/5] Cleaning old build files...
echo.

if exist "build\" (
    echo Removing build\ directory...
    rmdir /s /q build
)

if exist "dist\" (
    echo Removing dist\ directory...
    rmdir /s /q dist
)

if exist "MCS_Server_Dashboard_v5.0.0.exe" (
    echo Removing old executable...
    del /f /q MCS_Server_Dashboard_v5.0.0.exe
)

echo [OK] Cleanup complete.
echo.

echo [Step 3/5] Building executable with PyInstaller...
echo.

REM Build with PyInstaller
pyinstaller --clean RoutingMLMonitor_v5.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    echo Check the output above for error messages.
    pause
    exit /b 1
)

echo.
echo [OK] Build complete.
echo.

echo [Step 4/5] Moving executable to project root...
echo.

if exist "dist\MCS_Server_Dashboard_v5.0.0.exe" (
    move /y "dist\MCS_Server_Dashboard_v5.0.0.exe" "MCS_Server_Dashboard_v5.0.0.exe"
    echo [OK] Executable moved successfully.
) else (
    echo [ERROR] Executable not found in dist\ folder!
    pause
    exit /b 1
)

echo.

echo [Step 5/5] Final cleanup...
echo.

REM Optional: Remove build artifacts
if exist "build\" (
    rmdir /s /q build
)

if exist "dist\" (
    rmdir /s /q dist
)

echo [OK] Cleanup complete.
echo.

echo ============================================================================
echo  Build Complete!
echo ============================================================================
echo.
echo Executable: MCS_Server_Dashboard_v5.0.0.exe
echo Version: 5.0.0
echo Design: Material Design 3 + Fluent Design
echo.
echo You can now run the dashboard with:
echo   MCS_Server_Dashboard_v5.0.0.exe
echo.
echo ============================================================================

pause
