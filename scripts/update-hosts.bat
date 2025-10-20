@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 관리자 권한으로 다시 실행해 주세요.
    pause
    exit /b 1
)

set "HOSTS=C:\Windows\System32\drivers\etc\hosts"
set "BACKUP=%HOSTS%.bak_%DATE:/=-%_%TIME::=-%"
echo 백업 파일 생성: %BACKUP%
copy "%HOSTS%" "%BACKUP%" >nul

set "HAS_KSM_LS="
set "HAS_MCS="
set "HAS_RTML="

for /f "tokens=* delims=" %%L in ('findstr /b /c:"172.16.2.131 KSM-LS" "%HOSTS%"') do set "HAS_KSM_LS=1"
for /f "tokens=* delims=" %%L in ('findstr /b /c:"10.204.2.28 mcs.ksm.co.kr" "%HOSTS%"') do set "HAS_MCS=1"
for /f "tokens=* delims=" %%L in ('findstr /b /c:"10.204.2.28 rtml.ksm.co.kr" "%HOSTS%"') do set "HAS_RTML=1"

if not defined HAS_KSM_LS (
    echo 172.16.2.131 KSM-LS>>"%HOSTS%"
    echo 추가: 172.16.2.131 KSM-LS
) else (
    echo 이미 존재: 172.16.2.131 KSM-LS
)

if not defined HAS_MCS (
    echo 10.204.2.28 mcs.ksm.co.kr>>"%HOSTS%"
    echo 추가: 10.204.2.28 mcs.ksm.co.kr
) else (
    echo 이미 존재: 10.204.2.28 mcs.ksm.co.kr
)

if not defined HAS_RTML (
    echo 10.204.2.28 rtml.ksm.co.kr>>"%HOSTS%"
    echo 추가: 10.204.2.28 rtml.ksm.co.kr
) else (
    echo 이미 존재: 10.204.2.28 rtml.ksm.co.kr
)

echo 완료되었습니다.
pause
