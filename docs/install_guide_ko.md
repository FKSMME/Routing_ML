# Routing ML Windows 설치 가이드 (사내용)

## 1. 개요
- 목적: 파이썬 미설치 Windows 10/11 64bit 환경에서 Routing ML 예측 서비스를 설치한다.
- 구성 요소: PyInstaller로 패키징된 FastAPI 백엔드, Vite 빌드된 프런트엔드, ML 모델/설정 템플릿, PowerShell 운영 스크립트.
- 설치 대상: 생산/품질 엔지니어의 로컬 PC, 또는 생산 IT팀이 관리하는 작업용 서버.

## 2. 사전 준비 체크리스트
1. **관리자 권한**: 설치 프로그램 및 서비스 등록은 관리자 권한이 필요하다.
2. **Access ODBC 드라이버**: "Microsoft Access Driver (*.mdb, *.accdb)" 64bit 버전 설치 확인. `verify_odbc.ps1`로 검증 가능.
3. **방화벽 허용**: 기본 포트 8000을 Windows Defender 방화벽에 예외로 등록.
4. **사내망 접근**: SQL Server/Access 데이터베이스 접근을 위한 VPN 또는 전용망 연결.
5. **코드 서명 인증서**: 정식 배포 시 `RoutingMLInstaller_<버전>.exe`에 사내 코드서명 적용.

## 3. 빌드 절차 (Windows 빌드 에이전트에서 수행)
1. `pip install -r requirements.txt pyinstaller` 실행.
2. `npm install --prefix frontend` (최초 1회) 후 `npm run build --prefix frontend`.
3. `python deploy/installer/build_windows_installer.py --clean` 실행.
   - 결과물: `build/windows/installer` 폴더와 `build/windows/RoutingMLInstaller.iss` 생성.
4. Inno Setup Compiler(6.x 이상)에서 `RoutingMLInstaller.iss`를 열고 빌드.
   - 출력: `build/windows/RoutingMLInstaller_<버전>.exe`.
5. 빌드 로그는 `logs/installer_build.log`에 기록됨.

## 4. 설치 절차 (사용자 PC)
1. `RoutingMLInstaller_<버전>.exe`를 관리자 권한으로 실행.
2. 설치 마법사 안내에 따라 경로, 바로가기 옵션을 선택.
3. 설치 완료 후 자동으로 PowerShell 스크립트가 실행되어 Windows 서비스(`RoutingMLPredictor`)가 등록되고 기동.
4. 설치 완료 메시지에서 로그 위치(%APPDATA%\RoutingML\logs)와 검증 결과를 확인.
5. 필요 시 `collect_logs.ps1`로 로그를 압축하여 IT팀에 전달.

## 5. 설치 후 검증
1. 브라우저에서 `http://localhost:8000/api/health` 접속 → JSON 응답 200 확인.
2. `http://localhost:8000/api/workflow/graph` GET → 설정 템플릿 응답 확인.
3. 워크플로우 UI에서 SAVE → `config/workflow_settings.json` 타임스탬프 업데이트 확인.
4. `/api/predict`에 샘플 품목 요청 → 3~4개의 라우팅 후보와 Trimmed-STD 적용 값이 반환되는지 확인.
5. `models/tb_projector/` 경로에 TensorBoard 파일 존재 확인.

## 6. 문제 해결 요약
- 서비스 시작 실패: `install_service.ps1 -RemoveOnly`로 삭제 후 다시 설치, 또는 `eventvwr.msc` 응용 프로그램 로그 확인.
- 포트 충돌: `install_service.ps1 -Port <새포트>`로 재등록 후 `post_install_test.ps1 -Port <새포트>` 실행.
- DB 연결 오류: ODBC DSN/방화벽 재확인, `verify_odbc.ps1` 실행.
- 모델 누락: `models/` 폴더에 최신 학습 산출물을 복사 후 서비스 재시작.

## 7. 롤백 절차
1. 제어판 > 프로그램 추가/제거에서 Routing ML 제거 실행.
2. 제거 마법사가 Windows 서비스 제거 및 파일 삭제 수행.
3. 필요 시 `%APPDATA%\RoutingML` 폴더 백업 후 삭제.

## 8. 배포 정책 요약
- 알파 → 베타 → GA 3단계 릴리스. 각 단계별 QA 시트와 설치 로그를 JIRA 태스크에 첨부.
- 설치 파일은 사내 배포 포털(NAS/SCCM)에 업로드하고 해시값(SHA256)을 등록.
- 업데이트 시 기존 버전을 `backup/` 폴더로 복제 후 덮어쓰기. `update.bat` 스크립트 제공 예정.

부록: 세부 장애 대응 및 로그 분석 가이드는 `docs/TROUBLESHOOTING.md` 참조.
