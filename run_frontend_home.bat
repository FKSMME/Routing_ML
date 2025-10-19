@echo off
chcp 65001 >nul
echo ========================================
echo   Frontend Home Dashboard
echo   Integrated Dashboard
echo   Port: 3000
echo ========================================
echo.

cd /d "%~dp0\frontend-home"

if not exist "node_modules" (
    if exist "package.json" (
        echo node_modules not found. Running npm install...
        echo.
        call npm install
        if errorlevel 1 (
            echo.
            echo ERROR: npm install failed.
            pause
            exit /b 1
        )
    ) else (
        echo [INFO] node_modules directory not found, but no package.json present.
        echo [INFO] Skipping dependency install and starting static server directly.
        echo.
    )
)

echo Starting Home Dashboard (HTTPS enforced)
echo   - Local:  https://localhost:3000
echo   - Domain: https://rtml.ksm.co.kr:3000
echo.

set USE_HTTPS=true
node server.js

pause
