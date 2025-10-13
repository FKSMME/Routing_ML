# Routing ML 서비스 모니터 EXE 빌드 가이드

## 개요
`scripts/server_monitor_dashboard.py`는 Tkinter 기반으로 동작하는 서비스 헬스 체크 도구입니다.  
Windows 환경에서 Python 없이도 실행할 수 있도록 `dist\RoutingMLMonitor.exe`를 생성하는 절차를 정리했습니다.

## 사전 준비
1. 프로젝트 루트에서 가상환경(.venv)을 만들어 두었다고 가정합니다.
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\pip install -r requirements.txt
   ```
2. PowerShell 또는 CMD에서 프로젝트 루트(`Routing_ML_4`)를 현재 경로로 맞춥니다.

## 빌드 방법
1. 빌드 스크립트를 실행합니다.
   ```powershell
   .\deploy\build_server_monitor_exe.bat
   ```
2. 스크립트는 다음을 수행합니다.
   - `.venv` 존재 여부 확인
   - PyInstaller 미설치 시 자동으로 설치
   - `scripts\server_monitor_dashboard.py`를 기반으로 GUI 단일 실행 파일 생성
3. 빌드가 완료되면 `dist\RoutingMLMonitor.exe`가 생성됩니다.

## 배포 / 사용
- `dist\RoutingMLMonitor.exe` 파일 하나만 다른 PC로 복사하면 실행 가능합니다.  
- 실행 전, 해당 PC에서 실제 서비스 포트(3000/5173/5174/8000)가 접근 가능한 네트워크인지 확인하세요.
- `START_ALL_WINDOWS.bat`로 서비스를 띄운 뒤 EXE를 실행하면, GUI에서 바로 상태를 모니터링하고 각 URL 버튼으로 접속할 수 있습니다.

## 문제 해결
- **PyInstaller 설치 실패**: 사내 미러를 사용해야 하는 경우 `pip install` 명령에 `--index-url` 옵션을 추가하거나, 네트워크 담당자에게 패키지 설치 허용을 요청하세요.
- **실행 시 SmartScreen 경고**: 내부 배포물이므로 “추가 정보” → “실행”을 선택하면 됩니다. 정기적으로 빌드하여 최신 버전을 배포하세요.
- **서비스가 OFFLINE으로 표시됨**: `START_ALL_WINDOWS.bat`가 실행된 상태인지, Windows 방화벽이 포트를 허용하는지 확인하세요.

## 참고
- 빌드 스크립트는 언제든 다시 실행해 최신 EXE를 갱신할 수 있습니다.
- 추가 아이콘이 필요하면 `pyinstaller` 호출부에 `--icon myicon.ico`를 추가한 뒤 `.ico` 파일을 `deploy` 폴더에 배치하면 됩니다.
