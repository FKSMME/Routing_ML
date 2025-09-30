> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 1 | Completed 0 | Blockers 0

# Routing ML 설치 검증 보고서 (2025-09-27)

본 문서는 `docs/install_guide_ko.md`의 섹션 0~2 및 5에서 요구하는 항목을 실제 리포지토리 환경에서 점검한 결과를 정리한다.

## 0. 설치 파일 실행 확인
- 현재 리포지토리에는 `RoutingMLInstaller_*.exe` 파일이 존재하지 않는다. `find` 명령으로 확인한 결과 설치 실행 파일이 배포되지 않았음.【2da467†L1-L2】
- Windows 환경이 아닌 Linux 컨테이너이므로 관리자 권한 실행 및 설치 마법사 실행은 수행 불가.

### 0.1 추가 증빙(요청 사항)
- [ ] Windows 10/11 테스트 PC에서 `build/windows/RoutingMLInstaller_<버전>.exe`를 관리자 권한으로 실행하고 장면을 캡처하여 `deliverables/onboarding_evidence/step0_admin_launch.png`에 업로드.
  - 현 개발 환경에서는 Windows GUI를 사용할 수 없으므로 실제 설치 파일 실행과 화면 캡처를 수행하지 못함.
  - 캡처와 실행 로그가 확보될 경우, 해당 파일 경로와 상세 절차를 본 섹션에 추가 기록해야 함.

## 1~2. 사전 요구사항 체크
- **Access ODBC 드라이버**: `pyodbc.drivers()` 호출 결과 빈 배열이 반환되어 Microsoft Access ODBC 드라이버가 설치되어 있지 않음을 확인함.【e6bdbb†L1-L5】

- **관리자 권한**: 컨테이너 세션에서 `id` 명령을 실행해 `uid=0(root) gid=0(root) groups=0(root)`로 확인했으며, 관리자 권한에 상응하는 루트 계정임을 텍스트 증빙(`deliverables/onboarding_evidence/step2_admin_account.txt`)으로 보관함.

- **Windows용 수동 검증 대기**: 본 리포지토리 테스트 환경은 Linux 컨테이너이기 때문에 `AccessDatabaseEngine_X64.exe` 실행, `odbcad32.exe`(64bit) 확인, `verify_odbc.ps1` 로그 수집을 직접 수행할 수 없다. 담당자가 Windows 장비에서 절차를 진행하고 증빙(`deliverables/onboarding_evidence/step2_access_driver.png`)을 로컬에 생성한 뒤, Git 리포지토리에 커밋하지 않고 사내 증빙 저장소에 업로드하도록 요청하였다. 현재 저장소에는 정책상 바이너리 증빙 파일이 포함되어 있지 않다.

- **기타 항목**(VPN, 방화벽 등): 컨테이너 환경 특성상 확인 불가하므로 Windows 장비에서 후속 검증이 필요하다.

## 5. 설치 직후 점검 항목
| 점검 항목 | 결과 | 근거 |
| --- | --- | --- |
| [`/api/health` 응답 확인](install_guide_ko.md#check-api-health) | ❌ 503(Service Unavailable). 사내망 미연결로 헬스체크 실패 | `curl http://10.204.2.28:8000/api/health` 출력(2025-09-29, 2025-09-30 재시도 모두 동일). (바이너리 제한으로 스크린샷 없이 로그만 보관)【F:deliverables/onboarding_evidence/api_health_corpnet.log†L1-L18】 |
| 워크플로우 GET (`/api/workflow/graph`) | ✅ `last_saved` 값 확인 가능 | GET 호출에서 `last_saved` 타임스탬프 반환.【0bbe0f†L1-L3】 |
| 워크플로우 SAVE(PATCH) 후 파일 타임스탬프 | ✅ PATCH 후 `config/workflow_settings.json`에 ISO 타임스탬프 반영 | PATCH 응답과 파일 조회에서 `2025-09-27T01:08:10.442335` 확인.【3cae27†L1-L3】【7080ae†L1-L2】 |
| `/api/predict` 샘플 호출 | ❌ 503(Service Unavailable). 모델 디렉터리에 `similarity_engine.joblib`가 없어 로드 실패 | HTTP 상태 코드 503 및 오류 메시지에서 파일 부재 확인.【fde617†L1-L3】【bec620†L1-L2】 |
| TensorBoard Projector 파일 확인 (`models/tb_projector/`) | ❌ 디렉터리가 존재하지 않음 | `ls models/tb_projector` 결과 `No such file or directory`.【65c3b2†L1-L2】 |

### 인증 & SAVE 검증 세부 기록
- 폴백 계정(`tester`)으로 로그인하여 토큰 발급: `/api/auth/login` 호출 성공 후 토큰 획득.【518d0a†L1-L5】
- 워크플로우 PATCH 시 `predictor.max_routing_variants=5`로 갱신되고 `graph.last_saved`에 ISO 타임스탬프 기록됨.【a1dace†L1-L3】【3cae27†L1-L3】

## 결론 및 후속 조치
- API 헬스체크 및 워크플로우 저장 기능은 컨테이너 환경에서 정상 동작을 확인.
- 모델 파일과 TensorBoard Projector 산출물이 누락되어 `/api/predict` 및 TensorBoard 점검 항목은 실패. Windows 배포 전에 `models/latest/` 또는 `models/default/`에 `similarity_engine.joblib` 등 학습 산출물을 포함하고, `models/tb_projector/` 경로에 `projector_config.json` 등을 배치해야 함.
- Access ODBC 드라이버 미설치 상태이므로 실제 운영 환경에서는 64비트 Access 드라이버 설치 여부를 재확인해야 함.
