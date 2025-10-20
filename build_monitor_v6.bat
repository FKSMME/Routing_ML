@echo off
REM Build script for Routing ML Monitor v6.0.0
REM Uses PyInstaller to create standalone executable

echo ================================================
echo  Routing ML Monitor v6.0.0 Build Script
echo ================================================
echo.

REM Check if virtual environment is activated
if not defined VIRTUAL_ENV (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
)

REM Check if PyInstaller is installed
echo Checking PyInstaller installation...
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo PyInstaller not found. Installing...
    pip install pyinstaller
) else (
    echo PyInstaller is already installed.
)

echo.
echo Starting build process...
echo.

REM Clean previous build artifacts
if exist "build\server_monitor_v6" (
    echo Cleaning previous build directory...
    rmdir /s /q "build\server_monitor_v6"
)

REM Run PyInstaller
echo Running PyInstaller...
pyinstaller RoutingMLMonitor_v6.0.0.spec

if errorlevel 1 (
    echo.
    echo ================================================
    echo  BUILD FAILED!
    echo ================================================
    exit /b 1
)

echo.
echo ================================================
echo  BUILD COMPLETED SUCCESSFULLY!
echo ================================================
echo.
echo Executable location: dist\RoutingMLMonitor_v6.0.0.exe
echo.

REM Archive old version if exists
if exist "dist\RoutingMLMonitor_v6.0.0.exe" (
    echo Build successful! Executable ready.

    REM Create old versions directory if it doesn't exist
    if not exist "dist\old" mkdir "dist\old"

    REM Move old builds to archive (if any)
    if exist "dist\old\RoutingMLMonitor_v6.0.0_old.exe" (
        del "dist\old\RoutingMLMonitor_v6.0.0_old.exe"
    )
)

echo.
echo Build process complete.
pause
