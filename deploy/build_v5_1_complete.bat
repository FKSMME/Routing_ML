@echo off
chcp 65001 >nul
REM ============================================================================
REM Routing ML Auto-Generation System Monitor v5.1.0 - Complete Build
REM - Move old builds to 'old' folder
REM - Build Portable + Installer versions
REM - Version: 5.1.0
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo  Routing ML Auto-Generation System Monitor v5.1.0 Build
echo  Node-based Workflow + Compact Design
echo ============================================================================
echo.

cd /d "%~dp0\.."

REM ============================================================================
REM Step 1: Move old builds to 'old' folder
REM ============================================================================

echo [Step 1/8] Moving old builds to old folder...
echo.

if not exist "dist\old" mkdir "dist\old"

REM Move old portable executables
for %%F in (dist\*_Portable.exe) do (
    if exist "%%F" (
        echo Moving %%~nxF to old folder...
        move /y "%%F" "dist\old\" >nul 2>&1
    )
)

REM Move old directories
for /d %%D in (dist\MCS_Server_Dashboard_*) do (
    if exist "%%D" (
        echo Moving %%~nxD to old folder...
        move /y "%%D" "dist\old\" >nul 2>&1
    )
)

REM Move old installer
if exist "dist\installer" (
    for %%F in (dist\installer\*.exe) do (
        if exist "%%F" (
            echo Moving %%~nxF to old folder...
            if not exist "dist\old\installer" mkdir "dist\old\installer"
            move /y "%%F" "dist\old\installer\" >nul 2>&1
        )
    )
)

echo [OK] Old builds moved successfully
echo.

REM ============================================================================
REM Step 2: Activate virtual environment
REM ============================================================================

echo [Step 2/8] Activating virtual environment...
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found!
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

REM ============================================================================
REM Step 3: Check dependencies
REM ============================================================================

echo [Step 3/8] Checking dependencies...
echo.

pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)

pip show psutil >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing psutil...
    pip install psutil
)

echo [OK] Dependencies checked
echo.

REM ============================================================================
REM Step 4: Clean build artifacts
REM ============================================================================

echo [Step 4/8] Cleaning build artifacts...
echo.

if exist "build\" (
    rmdir /s /q build
)

if exist "dist\" (
    REM Keep old folder
    for /d %%D in (dist\*) do (
        if /i not "%%~nxD"=="old" (
            if /i not "%%~nxD"=="installer" (
                rmdir /s /q "%%D"
            )
        )
    )
)

echo [OK] Cleanup complete
echo.

REM ============================================================================
REM Step 5: Update version in VERSION.txt
REM ============================================================================

echo [Step 5/8] Updating version info...
echo.

echo 5.1.0 > VERSION.txt

echo [OK] Version info updated
echo.

REM ============================================================================
REM Step 6: Build Portable version
REM ============================================================================

echo.
echo ============================================================================
echo  Building Portable version (Executable)
echo ============================================================================
echo.

echo [Step 6/8] Running PyInstaller...
echo.

pyinstaller --clean --noconfirm RoutingMLMonitor_v5_1_Portable.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Portable build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Portable build complete
echo.

if exist "dist\RoutingML_AutoGen_v5.1.0_Portable.exe" (
    echo [OK] Executable created: dist\RoutingML_AutoGen_v5.1.0_Portable.exe

    for %%F in ("dist\RoutingML_AutoGen_v5.1.0_Portable.exe") do set size=%%~zF
    set /a sizeMB=!size! / 1048576
    echo [INFO] File size: !sizeMB! MB
) else (
    echo [ERROR] Executable not found!
    pause
    exit /b 1
)

REM ============================================================================
REM Step 7: Build Installer version
REM ============================================================================

echo.
echo ============================================================================
echo  Building Installer version (Directory)
echo ============================================================================
echo.

echo [Step 7/8] Running PyInstaller...
echo.

if exist "build\" (
    rmdir /s /q build
)

pyinstaller --clean --noconfirm RoutingMLMonitor_v5_1_Installer.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Installer build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Installer build complete
echo.

if exist "dist\RoutingML_AutoGen_v5.1.0\" (
    echo [OK] Installation directory created: dist\RoutingML_AutoGen_v5.1.0\

    for /f %%A in ('dir /b /s "dist\RoutingML_AutoGen_v5.1.0\*" ^| find /c /v ""') do set filecount=%%A
    echo [INFO] File count: !filecount! files
) else (
    echo [ERROR] Installation directory not found!
    pause
    exit /b 1
)

REM ============================================================================
REM Step 8: Summary
REM ============================================================================

echo.
echo [Step 8/8] Build summary
echo.

echo ============================================================================
echo  Build Complete!
echo ============================================================================
echo.

echo Generated files:
echo.

if exist "dist\RoutingML_AutoGen_v5.1.0_Portable.exe" (
    echo 1. Portable version (Executable):
    echo    dist\RoutingML_AutoGen_v5.1.0_Portable.exe
    echo    - File size: !sizeMB! MB
    echo    - No installation required, double-click to run
    echo.
)

if exist "dist\RoutingML_AutoGen_v5.1.0\" (
    echo 2. Installer version (Directory):
    echo    dist\RoutingML_AutoGen_v5.1.0\
    echo    - File count: !filecount! files
    echo    - Deploy entire directory
    echo.
)

echo Old builds:
echo    Saved in dist\old\ folder
echo.

echo ============================================================================
echo.

echo Quick start:
echo   Portable: dist\RoutingML_AutoGen_v5.1.0_Portable.exe
echo   Installer: dist\RoutingML_AutoGen_v5.1.0\RoutingML_AutoGen.exe
echo.

echo ============================================================================

pause
