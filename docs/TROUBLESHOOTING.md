
# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# Routing ML 설치 문제 해결 가이드 (주니어도 쉽게)

## 0. 사용 방법
- 문제 상황을 찾고, 체크리스트 순서대로 따라가면 됩니다.
- 각 항목은 **원인 파악 → 간단한 해결법 → 추가 조치** 순서로 적혀 있습니다.

## 1. 서비스가 바로 멈출 때
- [ ] `%APPDATA%\RoutingML\logs\install_service.log` 파일을 열어 마지막 오류 메시지를 확인한다.
- [ ] 명령 프롬프트(관리자)에서 아래 명령을 실행해 서비스를 지우고 다시 등록한다.
  ```powershell
  install_service.ps1 -RemoveOnly
  install_service.ps1 -ExecutablePath "C:\Program Files\FKSM\RoutingML\backend\RoutingMLBackend.exe"
  ```
- [ ] 그래도 안 되면 Windows 이벤트 뷰어(Application)에서 오류 이벤트 번호를 확인해 IT팀에 전달한다.

## 2. 8000 포트를 사용할 수 없을 때
- [ ] `netstat -ano | findstr :8000`으로 누가 포트를 쓰는지 확인한다.
- [ ] 해당 프로그램을 종료하거나, 아래 명령으로 다른 포트(예: 8050)를 지정해 다시 설치한다.
  ```powershell
  install_service.ps1 -Port 8050
  post_install_test.ps1 -Port 8050
  ```
- [ ] 브라우저에서 `http://localhost:8050/api/health`를 열어 동작을 확인한다.

## 3. Access ODBC 연결이 되지 않을 때
- [ ] `verify_odbc.ps1`를 실행해 "Microsoft Access Driver (*.mdb, *.accdb)" (64비트)가 보이는지 확인한다.
- [ ] 보이지 않으면 `AccessDatabaseEngine_X64.exe`를 설치한다.
- [ ] 그래도 연결이 안 되면 VPN/내부망 연결 상태와 방화벽 정책을 확인한다.

## 4. 예측 모델을 찾지 못할 때
- [ ] 설치 폴더의 `models` 안에 `training_metadata.json`, `encoder.joblib`, `scaler.joblib` 파일이 있는지 확인한다.
- [ ] 없다면 최신 모델 파일을 복사하고 서비스를 다시 시작한다.
- [ ] 모델 버전이 맞는지 `logs/service.log`에서 로딩 메시지를 확인한다.

## 5. TensorBoard 파일이 없을 때
- [ ] 트레이너 서비스를 한 번 실행해 최신 임베딩을 만든다.
- [ ] `models/tb_projector/` 폴더에 `projector_config.json`, `metadata.tsv`, `vectors.tsv`가 생겼는지 확인한다.
- [ ] 없다면 `post_install_test.ps1` 로그에서 경고 메시지를 확인한다.

## 6. SQL 컬럼 이름이 달라서 저장이 실패할 때
- [ ] 워크플로우 UI → Power Query 매핑 탭에서 원하는 프로파일을 선택하거나 새 매핑을 만든다.
- [ ] `%APPDATA%\RoutingML\config\workflow_settings.json` 파일의 `sql.column_aliases` 값을 확인해 잘못된 컬럼이 있는지 살핀다.
- [ ] 필요하면 `config/sql_profiles/access_7_1.json` 템플릿을 복사해 새 프로파일을 만들고 적용한다.

## 7. 로그를 모아야 할 때
- [ ] `%APPDATA%\RoutingML\logs` 폴더에 서비스와 스크립트 로그가 모두 저장된다.
- [ ] `collect_logs.ps1`를 실행하면 날짜 이름으로 된 ZIP 파일을 바탕화면에 자동으로 만든다.

## 8. 삭제가 제대로 되지 않을 때
- [ ] 제어판에서 Routing ML을 제거했는지 다시 확인한다.
- [ ] 남아 있는 서비스가 있으면 아래 명령으로 제거한다.
  ```powershell
  install_service.ps1 -RemoveOnly -ServiceName RoutingMLPredictor
  ```
- [ ] 마지막으로 `%ProgramFiles%\FKSM\RoutingML` 폴더를 수동으로 지운다.

## 9. 누구에게 도움을 요청해야 하나요?
- 설치/배포 담당자: Stage9 패키징 책임자(생산 IT팀)
- 문서: `docs/stage9_packaging_plan.md`에서 설치 전략과 배포 정책을 다시 확인할 수 있습니다.

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

