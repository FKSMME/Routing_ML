@echo off
REM ============================================================================
REM Environment Setup Fix Script
REM Fixes package conflicts and encoding issues
REM ============================================================================

chcp 65001 >nul

cd /d "%~dp0"

echo.
echo ============================================================================
echo   Environment Setup Fix
echo   Routing ML Auto-Generation System
echo ============================================================================
echo.

echo [1/5] Activating virtual environment...
if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please create it first: python -m venv .venv
    pause
    exit /b 1
)

call .venv\Scripts\activate
echo [OK] Virtual environment activated
echo.

echo [2/5] Upgrading pip...
python -m pip install --upgrade pip --quiet
if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip
    pause
    exit /b 1
)
echo [OK] pip upgraded
echo.

echo [3/5] Installing requirements...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install requirements
    pause
    exit /b 1
)
echo [OK] Requirements installed
echo.

echo [4/5] Checking for package conflicts...
pip check
if errorlevel 1 (
    echo.
    echo [WARNING] Package conflicts detected
    echo Please review the conflicts above
    echo.
) else (
    echo [OK] No package conflicts
)
echo.

echo [5/5] Verifying installation...
python -c "import fastapi, uvicorn, sqlalchemy, pydantic; print('[OK] Core packages imported successfully')"
if errorlevel 1 (
    echo [ERROR] Failed to import core packages
    pause
    exit /b 1
)
echo.

echo ============================================================================
echo Setup complete!
echo ============================================================================
echo.
echo Next steps:
echo   1. Set UTF-8 environment variables (run as Administrator):
echo      setx PYTHONUTF8 1
echo      setx PYTHONIOENCODING utf-8
echo.
echo   2. Verify database connectivity:
echo      python scripts/check_odbc.py
echo.
echo   3. Run tests:
echo      pytest --maxfail=1 -q
echo.
echo   4. Start backend server:
echo      run_backend_main.bat
echo.

pause
