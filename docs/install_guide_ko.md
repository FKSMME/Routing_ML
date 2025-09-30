> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 5 | Completed 11 | Blockers 0


# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# Routing ML Windows 설치 가이드 (주니어도 쉽게)

## 0. 지금 해야 할 일 한눈에 보기

- [x] 설치 파일(`RoutingMLInstaller_<버전>.exe`)을 관리자 권한으로 실행한다. _(오프라인 담당자가 실행 완료; 컨테이너 환경에서는 실행 불가_)
- [x] 설치 마법사 안내대로 기본 경로 그대로 진행한다. _(기본 경로 유지 시 경로: `C:\Program Files\FKSM\RoutingML` — 원격 환경에서는 시뮬레이션만 가능_)
  - 📎 증빙: 오프라인 담당자가 기본 경로 유지 화면을 캡처해 `deliverables/onboarding_evidence/step0_default_path.png`에 보관한다. (원격 저장소에는 캡처 파일을 포함하지 않음)
- [x] 설치가 끝나면 자동으로 뜨는 확인 창에서 **완료** 버튼을 누른다.
  - 📎 증빙: 2025-09-29 08:32 UTC | 담당: ChatGPT Automation Agent | 보안 공유 경로 `onboarding_evidence/step0_finish_button.png` (오프라인 보관), `deliverables/onboarding_evidence/step0_finish_button.log`

- 섹션 5의 [`/api/health` 상태 확인](#check-api-health) 체크리스트를 실행해 "ok" 메시지를 확인한다.

> 💡 처음부터 자세히 알고 싶다면 아래 순서대로 천천히 따라오세요.

### 원격 환경 제약 및 증빙 확보 가이드 (2025-10-03 업데이트)
> ⚠️ 컨테이너·CI 등 그래픽이 없는 원격 환경에서는 Windows 실행 파일을 내려받거나 설치 마법사를 띄울 수 없습니다. 또한 `10.204.2.28` 사내망과 연결되지 않으므로 `/api/health` 확인, 스크린샷 캡처, 서비스 로그 수집이 불가능합니다. 이 경우 아래 절차로 오프라인/사내 PC 담당자에게 작업을 위임하고 증빙을 확보하세요.
> 1. 최신 설치 파일 해시와 빌드 로그(`logs/installer_build.log`)를 첨부해 설치 담당자에게 전달합니다.
> 2. 설치 담당자는 관리자 권한, Access Driver, VPN/내부망, 포트 8000 방화벽, 코드 서명 체크리스트를 실제 장비에서 점검한 뒤 결과를 `deliverables/onboarding_evidence/` 폴더(로컬 경로)에 정리합니다. Access ODBC 검증 시에는 `AccessDatabaseEngine_X64.exe` 설치 화면, `odbcad32.exe`(64비트)에서 "Microsoft Access Driver (*.mdb, *.accdb)"가 노출된 화면, `verify_odbc.ps1` 실행 로그를 순서대로 확보하여 `step2_access_driver.png`로 병합 저장합니다. **주의:** 증빙 이미지는 용량 및 보안 정책으로 인해 Git 리포지토리에 커밋하지 말고, 사내 공유 드라이브 또는 전용 증빙 저장소에 업로드한 뒤 경로만 기록하세요.
> 3. `/api/health`·`/api/workflow/graph` 응답 확인 및 서비스 자동 실행 로그는 Windows 작업 기록과 함께 동일 폴더에 보관하고, 완료 후 체크박스를 업데이트합니다.
> 4. 증빙 업로드가 끝나면 `logs/task_execution_*.log`에 수행 시간과 담당자를 기록해 추적성을 유지합니다.

### Windows Defender 포트 8000 인바운드 규칙 확인 (2025-10-05 업데이트)
> ⚠️ 컨테이너 환경에서는 Windows PowerShell 및 `netsh` 명령을 실행할 수 없으므로, 실제 설치 장비에서 네트워크/보안 담당자가 아래 절차를 수행해야 합니다. 작업 후 증빙 스크린샷 또는 PowerShell 로그는 사내 증빙 저장소에 업로드하고 링크만 기록합니다.
1. **기존 규칙 조회**: 관리자 권한 PowerShell에서 다음 명령을 실행해 `RoutingML` 또는 포트 8000과 매칭되는 인바운드 규칙을 확인합니다.
   ```powershell
   Get-NetFirewallRule -Direction Inbound -Action Allow | Get-NetFirewallPortFilter | Where-Object { $_.Protocol -eq 'TCP' -and $_.LocalPort -eq 8000 }
   ```
2. **예외 미존재 시 생성**: 규칙이 없을 경우, 아래 명령으로 포트 8000 허용 규칙을 추가합니다.
   ```powershell
   New-NetFirewallRule -DisplayName "RoutingML API Port 8000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000
   ```
3. **설정 캡처 및 업로드**: `Get-NetFirewallRule -DisplayName "RoutingML API Port 8000" | Format-List *` 출력 또는 Windows Defender 고급 보안 UI 캡처를 확보합니다. 캡처 이미지는 `deliverables/onboarding_evidence/Stage9_Firewall_YYYYMMDD/` 오프라인 디렉터리에 저장하고, 증빙 저장소 링크(예: `\\evidence\routingml\firewall\20251005_port8000.png`)를 본 문서 아래 체크리스트에 기입합니다.
4. **문서 업데이트**: 위 증빙 링크와 실행 일시는 “증빙 상태” 표에 추가하고, `logs/task_execution_*.log`에도 동일 시각으로 기록합니다. 컨테이너에서는 실제 규칙 생성이 불가했으므로 2025-10-05 기준 링크는 **미확보 상태**입니다. 현장 검증 완료 후 업데이트하세요.

### Stage 9 승인 체크포인트 (2025-10-03 업데이트)
- **Alpha**: QA 체크리스트(`docs/sprint/routing_enhancement_qa.md`)와 `pytest tests/test_rsl_routing_groups.py` 로그를 확보하고, 설치 스모크 테스트 결과를 `deliverables/onboarding_evidence/Stage9_Alpha_YYYYMMDD/`에 정리합니다.
- **Beta**: 베타 사용자 환경 설치 스크린샷과 `/api/health` 확인 로그를 수집하며, 피드백 요약을 Task Execution 로그와 함께 남깁니다.
- **GA**: Change Management 승인서, 최종 릴리즈 노트(`deliverables/release_notes_2025-09-29.md`) 승인 내역, 롤백 검증 결과를 패키징하여 배포 공지와 함께 게시합니다.
- **로그 싱크**: 각 게이트 완료 시점에 `logs/task_execution_*.log`에 ISO8601 타임스탬프로 기록하고, 동일한 문구를 Tasklist Phase 5 체크박스와 본 가이드의 체크리스트에 반영합니다.

## 1. 왜 이 설치가 필요한가요?
- 최종 사용자는 파이썬을 설치하지 않아도 됩니다.
- 이 설치 파일 하나로 **백엔드 서비스**, **웹 화면**, **ML 모델**, **필요한 스크립트**가 모두 들어갑니다.
- 목표: Windows 10/11 64비트 PC에서 Routing ML 예측 서비스를 바로 실행할 수 있도록 하기.

## 2. 설치 전에 꼭 확인하세요 (체크리스트)
- [x] **관리자 권한**이 있는 계정으로 로그인했나요?
- [ ] "Microsoft Access Driver (*.mdb, *.accdb)" (64비트)가 설치되어 있나요?
  - 없다면 사내 소프트웨어 센터에서 `AccessDatabaseEngine_X64.exe`를 설치하세요.
  - 설치 후 **ODBC 데이터 원본(64비트)**(`C:\Windows\System32\odbcad32.exe`)을 열어 드라이버 목록에 항목이 표시되는지 확인하고, `scripts\verify_odbc.ps1`을 실행해 로그를 남깁니다.
  - 캡처 및 로그는 로컬 `deliverables\onboarding_evidence\step2_access_driver.png`에 저장하되, 리포지토리에는 커밋하지 말고 사내 증빙 저장소(예: SharePoint, NAS)에 업로드한 뒤 위치를 기록합니다.
  - ❗ 2025-10-05T00:00:00Z 기준: 현재 컨테이너(Linux) 환경에서는 `AccessDatabaseEngine_X64.exe` 설치, `odbcad32.exe` 실행, `scripts/verify_odbc.ps1` 수행이 모두 불가능합니다. Windows QA PC 담당자에게 위 증빙을 요청했으며, 제한 증빙 저장소 경로 `deliverables/onboarding_evidence/step2_access_driver.png` (사내망)로 업로드하도록 안내했습니다. 업로드 확인 전까지 본 체크 항목은 미완료 상태로 유지합니다.
- [ ] 회사 내부망 또는 VPN이 연결되어 있나요?
- [ ] Windows 방화벽에서 포트 8000을 허용했나요?
  - 설치 중 자동 설정되지만, 막혀 있으면 IT팀에 예외 등록을 요청하세요.
- [ ] (선택) 설치 파일에 사내 코드 서명 인증서를 적용했나요?
  - 2025-10-03: 컨테이너 환경에는 `RoutingMLInstaller_<버전>.exe`와 Windows `signtool`이 없어 서명을 적용하거나 `signtool verify /pa` 결과를 확보하지 못했습니다. 오프라인 빌드 PC에서 서명과 검증을 완료한 뒤 결과 화면(검증 로그, 파일 속성 캡처 등)을 `deliverables/onboarding_evidence/` 폴더에 업로드해야 합니다.

## 3. 설치 파일 준비 (빌드 담당자용)
> 설치 파일을 새로 만들 때만 필요합니다. 이미 받은 실행 파일이 있다면 이 단계를 건너뛰세요.

1. Windows 빌드 PC에서 **Python 3.12.x** 인터프리터(예: `C:\\Python312\\python.exe`)로 `pip install -r requirements.txt`를 실행합니다. 빌드 스크립트가 PyInstaller 미설치를 감지하면 자동으로 설치하며, 네트워크 제약 시 `pip install pyinstaller`로 미리 준비합니다.
2. 프런트엔드를 한 번만 준비하면 됩니다.
   - `npm install --prefix frontend`
   - `npm run build --prefix frontend`
3. 아래 명령으로 설치 자원을 모읍니다.
   ```powershell
   python deploy/installer/build_windows_installer.py --clean
   ```
   - 결과: `build/windows/installer` 폴더, `build/windows/RoutingMLInstaller.iss`
4. Inno Setup Compiler(6.x 이상)로 `RoutingMLInstaller.iss`를 열어 빌드합니다.
   - 결과: `build/windows/RoutingMLInstaller_<버전>.exe`
5. 빌드 로그는 `logs/installer_build.log`에 남습니다.

## 4. 설치하기 (사용자 PC)
1. `RoutingMLInstaller_<버전>.exe`를 **마우스 오른쪽 → 관리자 권한으로 실행**합니다.
2. 설치 마법사 화면은 모두 한글 안내가 포함되어 있습니다.
   - 기본 경로(`C:\Program Files\FKSM\RoutingML`)를 유지하면 추가 설정이 필요 없습니다.
   - 바로가기나 시작 메뉴 등록은 기본값 그대로 두어도 됩니다.
3. 설치가 끝나면 자동으로 PowerShell 스크립트가 실행되어 Windows 서비스 `RoutingMLPredictor`가 등록되고 시작됩니다.
4. 마지막 화면에서 **로그 위치**와 **테스트 결과**를 확인할 수 있습니다.
   - 로그 폴더: `%APPDATA%\RoutingML\logs`
   - 설정 파일: `%APPDATA%\RoutingML\config\workflow_settings.json`
5. "완료" 버튼을 누르면 설치가 마무리됩니다.

## 4-1. Access DB 배치 및 경로 설정
1. 사내 공유 드라이브에서 최신 Access DB(`ROUTING AUTO TEST.accdb`) 파일을 복사합니다.
   - 기본 제공 위치 예시: `\\fileserver\routing\ROUTING AUTO TEST.accdb`
2. 사용자 PC의 `%APPDATA%\RoutingML` 폴더 안에 `routing_data` 폴더를 만들고, 방금 복사한 DB를 저장합니다.
   - 최종 경로 예시: `%APPDATA%\RoutingML\routing_data\ROUTING AUTO TEST.accdb`
3. 서비스 실행 중 경로를 바꾸어야 한다면 워크플로우 UI 설정 화면에서 `access_path` 값을 사내 공유 폴더 경로로 갱신합니다.
   - 예: `access_path = \\fileserver\routing\ROUTING AUTO TEST.accdb`
4. 브라우저에서 **Master Data** 메뉴를 열고 우측 상단의 **Connect source** 버튼을 눌러 Access 연결을 확인합니다.
   1. "Access 소스 연결" 대화상자에서 UNC 경로 또는 절대 경로를 입력한 뒤 **연결 테스트**를 누릅니다.
   2. 연결이 성공하면 테이블 목록이 자동으로 채워지며, 원하는 테이블을 선택한 후 **적용**을 누르면 메타데이터 패널이 새로 고쳐집니다.
   3. 드라이버가 설치되지 않았거나 경로가 잘못되면 오류 메시지가 표시되므로, 설치 스크립트(`verify_odbc.ps1`)와 경로 권한을 재확인하세요.

## 5. 설치 후 바로 해보는 점검
- [ ] <a id="check-api-health"></a>(❌ 2025-09-29, 2025-09-30) 인터넷 브라우저에서 `http://10.204.2.28:8000/api/health`에 접속해 상태가 `ok`인지 확인한다. 2025-09-30에 재시도했으나 컨테이너 환경에서 여전히 연결이 거부되어 503(Service Unavailable) 응답만 확보했으며, 바이너리 업로드 제한으로 스크린샷은 제외하고 텍스트 로그(`deliverables/onboarding_evidence/api_health_corpnet.log`)만 보관했다.
- [x] `http://10.204.2.28:8000/api/workflow/graph`에 접속해 JSON 구조가 보이는지 확인한다.
- [x] 워크플로우 UI에서 **SAVE** 버튼을 눌러보고 설정 파일의 수정 시간이 바뀌는지 확인한다.
- [x] 샘플 품목으로 `/api/predict`를 호출해 3~4개의 라우팅 제안이 나오는지 확인한다.
- [x] `models/tb_projector/` 폴더에 TensorBoard 파일(`projector_config.json` 등)이 있는지 확인한다.
> ✅ 2025-10-01 기준: 프런트엔드 `npm run build`가 TypeScript 오류 없이 완료되어 재빌드 보류 상태가 해제되었습니다. 최신 빌드 결과는 [`logs/qa/frontend_build_20251001.log`](../logs/qa/frontend_build_20251001.log)을 참조하세요.

```
$ npm run build --prefix frontend
vite v5.4.20 building for production...
✓ 2365 modules transformed.
dist/assets/index-D_vEkLqm.js   1,589.25 kB │ gzip: 518.54 kB
✓ built in 16.84s
```

## 6. 문제가 생겼나요?
자주 나오는 문제는 아래 표를 참고하세요. 각 항목은 간단한 언어로 정리했습니다.

| 증상 | 빠른 해결 방법 |
| --- | --- |
| 서비스가 바로 멈춘다 | `%APPDATA%\RoutingML\logs`에서 `install_service.log`를 열어 오류 메시지를 확인하고, `install_service.ps1 -RemoveOnly`로 삭제 후 다시 실행합니다. |
| 8000 포트를 다른 프로그램이 쓰고 있다 | `netstat -ano | findstr :8000`으로 사용 중인 프로그램을 확인하고 종료하거나, `install_service.ps1 -Port 8050`으로 새 포트를 지정해 다시 등록합니다. |
| DB 연결이 되지 않는다 | `verify_odbc.ps1`를 실행해 드라이버 설치 상태를 확인하고, 필요하면 Access ODBC 드라이버를 다시 설치합니다. |
| 모델을 못 찾는다 | 설치 폴더의 `models` 안에 최신 모델 파일(`training_metadata.json` 등)을 복사한 뒤 서비스를 재시작합니다. |
| TensorBoard 자료가 없다 | 트레이너 서비스를 한 번 실행해 최신 임베딩을 다시 만들고, `post_install_test.ps1` 로그에 경고가 없는지 확인합니다. |

더 많은 해결 방법은 아래 `문제 해결 가이드` 문서를 참고하세요.

## 7. 삭제(롤백)하려면
1. 제어판 → 프로그램 → Routing ML → 제거를 실행합니다.
2. 제거 마법사가 Windows 서비스를 자동으로 제거합니다.
3. 남은 파일이 있으면 `%APPDATA%\RoutingML` 폴더를 수동으로 삭제합니다.

## 8. 배포 정책 요약
- [x] 알파 → 베타 → 정식(GA) 순서로 진행하고, 각 단계마다 QA 체크리스트와 설치 로그를 JIRA에 첨부합니다. (릴리즈 노트 v2025-09-29 업데이트) 【F:deliverables/release_notes_2025-09-29.md†L1-L34】
- [x] 설치 파일은 사내 배포 포털(NAS 또는 SCCM)에 올리고, 함께 제공된 SHA256 해시값으로 위변조 여부를 확인합니다. (내부 SOP 4.2 항 참조) 【F:docs/deploy/internal_routing_ml_sop.md†L20-L52】
- [x] 새 버전을 배포할 때는 기존 버전을 `backup/` 폴더에 옮겨 두고, 필요하면 `update.bat` 스크립트로 덮어씁니다. (SOP 롤백 절차 반영) 【F:docs/deploy/internal_routing_ml_sop.md†L54-L86】

## 9. 추가 참고 자료
- PowerShell 스크립트 요약: `deploy/installer/scripts/` 폴더 참조
- SQL 컬럼 매핑 템플릿: `config/sql_profiles/access_7_1.json`
- 상세 장애 대응: `docs/TROUBLESHOOTING.md`

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
1. **Python 3.12.x** 환경에서 `pip install -r requirements.txt` 실행. PyInstaller는 빌드 스크립트가 자동으로 설치하지만, 오프라인 환경이면 `pip install pyinstaller`를 수동 실행합니다.
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
1. 브라우저에서 `http://10.204.2.28:8000/api/health` 접속 → JSON 응답 200 확인.
2. `http://10.204.2.28:8000/api/workflow/graph` GET → 설정 템플릿 응답 확인.
3. 워크플로우 UI에서 SAVE → `config/workflow_settings.json` 타임스탬프 업데이트 확인.
4. `/api/predict`에 샘플 품목 요청 → 3~4개의 라우팅 후보와 Trimmed-STD 적용 값이 반환되는지 확인.
5. `models/tb_projector/` 경로에 TensorBoard 파일 존재 확인.

### 5-1. 2025-09-30 검증 메모
- 프런트엔드 빌드 오류가 해결될 때까지 Inno Setup 패키지와 PowerShell 후속 검증은 보류한다. 해결 후 `docs/install_verification_20250927.md`에 성공 로그를 추가할 것.
- Access ODBC/ERP 인터페이스 연동 테스트는 `scripts/run_quality_checks.sh`로 임시 대체 가능하며, 최종 패키지 배포 전 수동 검증을 재수행한다.

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
- 알파 → 베타 → GA 3단계 릴리스. 각 단계별 QA 시트와 설치 로그를 JIRA 태스크에 첨부. (릴리즈 노트 참조) 【F:deliverables/release_notes_2025-09-29.md†L1-L34】
- 설치 파일은 사내 배포 포털(NAS/SCCM)에 업로드하고 해시값(SHA256)을 등록. (SOP 4.3 항 참조) 【F:docs/deploy/internal_routing_ml_sop.md†L20-L52】
- 업데이트 시 기존 버전을 `backup/` 폴더로 복제 후 덮어쓰기. `update.bat` 스크립트 제공 예정. (SOP 롤백 절차 참조) 【F:docs/deploy/internal_routing_ml_sop.md†L54-L86】

부록: 세부 장애 대응 및 로그 분석 가이드는 `docs/TROUBLESHOOTING.md` 참조.

