@echo off
REM ============================================================================
REM Routing ML Auto-Generation System Monitor v5.1.0 - Complete Build
REM - Move old builds to 'old' folder
REM - Build Portable + Installer versions
REM - Version: 5.1.0
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo  라우팅 자동생성 시스템 모니터 v5.1.0 빌드
echo  Node-based Workflow + Compact Design
echo ============================================================================
echo.

cd /d "%~dp0\.."

REM ============================================================================
REM Step 1: Move old builds to 'old' folder
REM ============================================================================

echo [Step 1/8] 기존 빌드를 old 폴더로 이동...
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

echo [OK] 기존 빌드 이동 완료
echo.

REM ============================================================================
REM Step 2: Activate virtual environment
REM ============================================================================

echo [Step 2/8] 가상환경 활성화...
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] 가상환경을 찾을 수 없습니다!
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

REM ============================================================================
REM Step 3: Check dependencies
REM ============================================================================

echo [Step 3/8] 의존성 확인...
echo.

pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [INFO] PyInstaller 설치 중...
    pip install pyinstaller
)

pip show psutil >nul 2>&1
if errorlevel 1 (
    echo [INFO] psutil 설치 중...
    pip install psutil
)

echo [OK] 의존성 확인 완료
echo.

REM ============================================================================
REM Step 4: Clean build artifacts
REM ============================================================================

echo [Step 4/8] 빌드 아티팩트 정리...
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

echo [OK] 정리 완료
echo.

REM ============================================================================
REM Step 5: Update version in VERSION.txt
REM ============================================================================

echo [Step 5/8] 버전 정보 업데이트...
echo.

echo 5.1.0 > VERSION.txt

echo [OK] 버전 정보 업데이트 완료
echo.

REM ============================================================================
REM Step 6: Build Portable version
REM ============================================================================

echo.
echo ============================================================================
echo  Portable 버전 빌드 (실행형)
echo ============================================================================
echo.

echo [Step 6/8] PyInstaller 실행 중...
echo.

pyinstaller --clean --noconfirm RoutingMLMonitor_v5_1_Portable.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Portable 빌드 실패!
    pause
    exit /b 1
)

echo.
echo [OK] Portable 빌드 완료
echo.

if exist "dist\RoutingML_AutoGen_v5.1.0_Portable.exe" (
    echo [OK] 실행 파일 생성: dist\RoutingML_AutoGen_v5.1.0_Portable.exe

    for %%F in ("dist\RoutingML_AutoGen_v5.1.0_Portable.exe") do set size=%%~zF
    set /a sizeMB=!size! / 1048576
    echo [INFO] 파일 크기: !sizeMB! MB
) else (
    echo [ERROR] 실행 파일을 찾을 수 없습니다!
    pause
    exit /b 1
)

REM ============================================================================
REM Step 7: Build Installer version
REM ============================================================================

echo.
echo ============================================================================
echo  Installer 버전 빌드 (설치형)
echo ============================================================================
echo.

echo [Step 7/8] PyInstaller 실행 중...
echo.

if exist "build\" (
    rmdir /s /q build
)

pyinstaller --clean --noconfirm RoutingMLMonitor_v5_1_Installer.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Installer 빌드 실패!
    pause
    exit /b 1
)

echo.
echo [OK] Installer 빌드 완료
echo.

if exist "dist\RoutingML_AutoGen_v5.1.0\" (
    echo [OK] 설치 디렉토리 생성: dist\RoutingML_AutoGen_v5.1.0\

    for /f %%A in ('dir /b /s "dist\RoutingML_AutoGen_v5.1.0\*" ^| find /c /v ""') do set filecount=%%A
    echo [INFO] 파일 수: !filecount!개
) else (
    echo [ERROR] 설치 디렉토리를 찾을 수 없습니다!
    pause
    exit /b 1
)

REM ============================================================================
REM Step 8: Summary
REM ============================================================================

echo.
echo [Step 8/8] 빌드 요약
echo.

echo ============================================================================
echo  빌드 완료!
echo ============================================================================
echo.

echo 생성된 파일:
echo.

if exist "dist\RoutingML_AutoGen_v5.1.0_Portable.exe" (
    echo 1. Portable 버전 (실행형):
    echo    dist\RoutingML_AutoGen_v5.1.0_Portable.exe
    echo    - 파일 크기: !sizeMB! MB
    echo    - 설치 불필요, 더블클릭으로 실행
    echo.
)

if exist "dist\RoutingML_AutoGen_v5.1.0\" (
    echo 2. Installer 버전 (설치형):
    echo    dist\RoutingML_AutoGen_v5.1.0\
    echo    - 파일 수: !filecount!개
    echo    - 디렉토리 단위 배포
    echo.
)

echo 기존 빌드:
echo    dist\old\ 폴더에 보관됨
echo.

echo ============================================================================
echo.

echo 빠른 시작:
echo   실행형: dist\RoutingML_AutoGen_v5.1.0_Portable.exe
echo   설치형: dist\RoutingML_AutoGen_v5.1.0\RoutingML_AutoGen.exe
echo.

echo ============================================================================

pause
