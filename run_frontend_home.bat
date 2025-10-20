@echo off
chcp 65001 >nul
echo ========================================
echo   Frontend Home Dashboard
echo   Integrated Dashboard
echo   Port: 5176
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

REM Set SSL certificate paths (relative to project root)
set SSL_KEY_PATH=%~dp0certs\rtml.ksm.co.kr.key
set SSL_CERT_PATH=%~dp0certs\rtml.ksm.co.kr.crt

if not exist "%SSL_KEY_PATH%" (
    echo [ERROR] SSL key file not found: %SSL_KEY_PATH%
    echo         Update SSL_KEY_PATH or copy the key into the certs folder.
    goto :END
)

if not exist "%SSL_CERT_PATH%" (
    echo [ERROR] SSL certificate file not found: %SSL_CERT_PATH%
    echo         Update SSL_CERT_PATH or copy the certificate into the certs folder.
    goto :END
)

REM Enable HTTPS
set USE_HTTPS=true

REM Optional: enable HTTP->HTTPS redirect (change port as needed, 0 disables redirect)
set HTTP_REDIRECT_PORT=0

REM Set API target to match protocol
set API_TARGET=https://localhost:8000

REM Override default server port
set PORT=5176

echo Starting Home Dashboard (HTTPS enforced)
echo   - Local:   https://localhost:5176
echo   - Domain:  https://rtml.ksm.co.kr:5176
if NOT "%HTTP_REDIRECT_PORT%"=="0" (
    echo   - Redirect: http://localhost:%HTTP_REDIRECT_PORT% ^> https://localhost:5176
)
echo.

node server.js

:END
pause
