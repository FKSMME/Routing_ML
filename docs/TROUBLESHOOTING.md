# Routing ML 설치 문제 해결 가이드

## 1. 서비스 기동 실패
- **증상**: 설치 직후 서비스가 `Stopped` 상태.
- **조치**:
  1. `%APPDATA%\RoutingML\logs\install_service.log` 확인.
  2. `install_service.ps1 -RemoveOnly` 실행 후 `install_service.ps1 -ExecutablePath "C:\\Program Files\\FKSM\\RoutingML\\backend\\RoutingMLBackend.exe"` 재실행.
  3. Windows 이벤트 뷰어(Application)에서 오류 이벤트 확인.

## 2. 포트 충돌 (8000 사용 불가)
- **증상**: 헬스 체크 503, 로그에 `Address already in use`.
- **조치**:
  1. `netstat -ano | findstr :8000`로 포트 점유 프로세스 확인.
  2. `install_service.ps1 -Port 8050` 등 새 포트로 재설치.
  3. `post_install_test.ps1 -Port 8050` 실행해 검증.

## 3. Access ODBC 연결 실패
- **증상**: 예측 시 DB 연결 오류.
- **조치**:
  1. `verify_odbc.ps1` 실행으로 드라이버 존재 확인.
  2. ODBC 관리자(64bit)에서 `Microsoft Access Driver (*.mdb, *.accdb)` 설정 확인.
  3. 필요한 경우 재배포 패키지(AccessDatabaseEngine_X64.exe) 설치.

## 4. 모델 파일 누락
- **증상**: `/api/predict` 호출 시 모델 로드 실패 예외 발생.
- **조치**:
  1. 설치 디렉터리 `models/`에 `training_metadata.json`, `encoder.joblib`, `scaler.joblib` 등 최신 파일이 존재하는지 확인.
  2. 없다면 최신 학습 산출물을 복사하고 서비스 재시작.

## 5. TensorBoard Projector 미출력
- **증상**: `tb_projector` 디렉터리에 TSV 파일이 없음.
- **조치**:
  1. 트레이너 서비스를 실행하여 최신 임베딩을 재생성.
  2. `post_install_test.ps1` 로그에서 Projector 경고 여부 확인.

## 6. SQL 매핑 컬럼 불일치
- **증상**: 7.1 규격과 다른 컬럼명으로 INSERT 실패.
- **조치**:
  1. 워크플로우 그래프 UI에서 Power Query 매핑 프로파일을 선택 또는 편집.
  2. `%APPDATA%\RoutingML\config\workflow_settings.json`에 저장된 `sql.column_aliases` 값 확인.
  3. 필요 시 `config/sql_profiles/access_7_1.json` 템플릿을 복사하여 새로운 프로파일 생성.

## 7. 로그 수집 방법
- `%APPDATA%\RoutingML\logs` 폴더에 모든 PowerShell/서비스 로그가 저장.
- `collect_logs.ps1` 실행 시 날짜 기반 ZIP 파일을 바탕화면에 생성.

## 8. 롤백 실패
- **증상**: 제어판 제거 후에도 서비스가 남아 있음.
- **조치**:
  1. `install_service.ps1 -RemoveOnly -ServiceName RoutingMLPredictor` 실행.
  2. `%ProgramFiles%\FKSM\RoutingML` 폴더 수동 삭제.

## 9. 배포 관련 문의
- 설치/배포 담당자는 Stage9 패키징 오너(생산 IT팀)에 문의.
- 설치형 패키지 전략 세부 내용은 `docs/stage9_packaging_plan.md` 참고.
