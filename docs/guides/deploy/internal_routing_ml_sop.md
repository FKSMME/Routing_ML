# Routing ML Internal Deployment SOP (v2025-09-29)

## 0. Revision Summary — 2025-10-03 Stage 9 Alignment
- Stage 9 Alpha·Beta·GA 게이트별 승인 담당자, 증빙 산출물, 재검증 절차를 SOP 본문에 편입했다.
- 설치 가이드(`docs/install_guide_ko.md`)와 릴리즈 노트(`deliverables/release_notes_2025-09-29.md`)를 교차 참조하여 Task Execution 로그, 증빙 경로, 체크리스트 싱크 규칙을 명시했다.
- QA 체크리스트 결과 및 `logs/task_execution_*.log` 기록을 Stage 9 승인 선행 조건으로 정의했다.

## 1. Scope & Roles
- **Scope**: Routing ML Windows 패키지(백엔드 FastAPI + 프런트엔드 빌드 + ML 모델) 배포 및 업데이트.
- **Roles**:
  - *Release Owner*: QA 승인 및 릴리즈 노트 게시.
  - *Deployment Engineer*: 패키지 빌드, 무결성 검증, 사내 포털 업로드.
  - *Support Engineer*: 롤백/장애 대응.

## 2. Pre-deployment Checklist
1. `npm run build --prefix frontend` 성공 로그 확보 (TypeScript 오류 해결 필수). 【F:docs/sprint/routing_enhancement_qa.md†L1-L33】
2. `pytest tests/test_rsl_routing_groups.py` 통과 스크린샷 또는 로그 보관. 【66517b†L1-L33】
3. 최신 릴리즈 노트 작성 및 승인. 【F:deliverables/release_notes_2025-09-29.md†L1-L34】
4. Access DB 경로/환경 변수 확인 (`ROUTING_ML_RSL_DATABASE_URL`).

## 3. Deployment Flow
1. **Alpha**: 내부 QA 환경에 설치 → 릴리즈 노트 공유, QA 체크리스트 업데이트.
2. **Beta**: 제한된 사용자 그룹 대상 배포 → 피드백 수집, 이슈 레지스터 업데이트.
3. **GA**: 전체 대상 배포 → 설치 가이드/릴리즈 노트 최종 버전 배포.

## 4. Distribution & Integrity Controls
1. 빌드 산출물: `build/windows/RoutingMLInstaller_<버전>.exe` 및 프런트엔드 정적 번들 `build/frontend/RoutingMLFrontend_<버전>.zip`.
2. 무결성 검증: `Get-FileHash -Algorithm SHA256`로 해시값 산출 후 릴리즈 노트 및 포털에 게시.
3. 사내 포털 업로드: NAS 또는 SCCM에 설치 파일과 해시 파일(`.sha256`) 동시 업로드.
4. 정적 번들 동기화: `\\fileshare\routing_ml\frontend\latest`에 최신 번들을 배치하고, `Sync-FrontendBundle.ps1` 스크립트가 IIS 팜(노드1~노드4) 및 DMZ Nginx 캐시 노드에 `robocopy /MIR`로 동기화한다. VPN 미지원 거점은 `build/windows/RoutingMLFrontend_<버전>.zip` 오프라인 패키지를 받아 로컬 IIS에 수동 업로드한다.
5. 기록 보관: 업로드 로그/스크린샷을 JIRA 태스크에 첨부하고, Stage 4 재승인 근거로 `docs/stage4_frontend_report.md#배포-준비`에 동기화 결과를 링크한다.

## 5. Rollback & Backup
1. 기존 버전은 배포 전 `\share\routing_ml\backup\<버전>`에 복제.
2. 롤백 시 `install_service.ps1 -RemoveOnly` 실행 후 백업된 설치 파일 재설치.
3. `backup/` 폴더와 `update.bat` 스크립트를 동일 버전으로 맞춰 재배포.
4. 롤백 결과를 릴리즈 노트에 업데이트하고 이해관계자에게 공유.

## 6. Post-deployment Verification
1. `http://<host>:8000/api/health` 응답 확인.
2. `/api/rsl/groups` POST/GET 스팟 테스트 수행.
3. 감사 로그(`logs/audit/ui_actions.log`, `logs/audit/rsl.audit.log`)에 시간/IP 기록 확인.

## 7. Stage 9 Approval Workflow & Evidence
1. **Alpha(내부 QA)**
   - 선행 조건: `docs/sprint/routing_enhancement_qa.md` 체크리스트 통과, `pytest tests/test_rsl_routing_groups.py` 로그 확보.
   - 증빙: 설치 스모크 테스트 결과, `logs/qa/frontend_build_*.log`, `logs/task_execution_*.log` 승인 기록.
   - 승인자: QA 리드(예: QA-KIM) — Task Execution 로그에 `Next Stage Ready` 명시.
2. **Beta(선발 사용자)**
   - 선행 조건: Alpha 증빙 + 사용자 피드백 수집 계획 수립, 설치 가이드 최신화(`docs/install_guide_ko.md`).
   - 증빙: 베타 사용자 설치 스크린샷, `/api/health` 확인 기록, 피드백 요약.
   - 승인자: Deployment Engineer — NAS/SCCM 업로드 로그와 해시값 게시 완료.
3. **GA(전체 배포)**
   - 선행 조건: 베타 이슈 클로즈, 릴리즈 노트 승인(`deliverables/release_notes_2025-09-29.md`).
   - 증빙: Change Management 승인서, 전체 사용자 공지, 최종 설치/롤백 절차 검증.
   - 승인자: Release Owner — 릴리즈 노트 및 Tasklist Phase 5 체크박스 완료 상태 확인.
4. **증빙 보관 및 싱크 규칙**
   - 모든 단계의 승인 로그는 `logs/task_execution_*.log`에 ISO8601 타임스탬프로 남기고, 동일 내용을 Tasklist Phase 5 및 관련 문서 체크리스트에 반영한다.
   - 증빙 파일은 `deliverables/onboarding_evidence/` 하위에 `Stage9_<게이트>_YYYYMMDD/` 구조로 보관하고 릴리즈 노트 Highlights에 링크를 추가한다.
