# Routing ML 설치 요약

- 설치 후 Windows 서비스 이름: `RoutingMLPredictor`
- 기본 포트: 8000
- 설정/로그 위치: `%APPDATA%\RoutingML\config`, `%APPDATA%\RoutingML\logs`
- 주요 실행 파일: `{app}\backend\RoutingMLBackend.exe`
- 서비스 점검: `http://10.204.2.28:8000/api/health`
