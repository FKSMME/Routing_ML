> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 릴리스 거버넌스 체크 (섹션 8) — 2025-09-27

`docs/install_guide_ko.md` 섹션 8에서 요구하는 알파→GA 거버넌스 항목을 점검하였다.

## 1. 알파→GA QA 문서화
- `docs/install_verification_20250927.md`에 설치 검증 시나리오, API 점검 결과, 실패 항목과 후속 조치를 기록하여 QA 근거를 확보했다.【F:docs/install_verification_20250927.md†L1-L33】
- 향후 GA 승인 시 위 보고서를 JIRA 태스크에 첨부하도록 릴리스 노트에 참조 링크를 추가할 예정.

## 2. NAS/SCCM 업로드 및 해시 검증
- 현재 레포지토리에는 `RoutingMLInstaller_*.exe` 산출물이 없어 해시 계산과 포털 업로드를 수행할 수 없다.【2da467†L1-L2】
- `sha256sum build/windows/RoutingMLInstaller_0.1.0.exe` 명령을 실행한 결과 파일이 존재하지 않아 실패했음을 확인했다.【e765c1†L1-L2】
- 조치: Inno Setup 빌드 산출물(`build/windows/RoutingMLInstaller_<버전>.exe`)이 생성되면 즉시 SHA256 값을 산출하여 NAS/SCCM 등록 페이지에 함께 업로드하도록 DevOps 태스크를 예약한다.

## 3. 기존 버전 백업
- 현재 리포지토리에 `backup/` 폴더가 없어 이전 버전 백업이 준비되지 않았다.【35516d†L1-L2】
- 조치: 새 설치 파일을 배포하기 전에 `backup/` 디렉터리를 생성하고 이전 버전 실행 파일 및 관련 해시 파일을 이동 저장한 뒤 `update.bat` 시나리오를 문서화한다.

## 결론
- QA 기록은 완료되었으나 설치 실행 파일 부재로 인해 해시 검증과 백업 작업은 보류 상태다. 빌드 산출물 확보 후 섹션 8 체크리스트를 재점검하고 완료 여부를 갱신해야 한다.
- 2025-10-04 기준 Stage 4/5 QA 게이트(실기기 수동 검증 포함)가 완료되어 `docs/sprint/routing_enhancement_qa.md` 상의 ⚠️ 항목을 모두 ✅로 전환했다. 다음 배포 윈도우는 2025-10-06 02:00-04:00 UTC(내부망)로 예약되어 있으며, ERP 토글/dirty reset 증빙은 [`deliverables/onboarding_evidence/lab3_manual_session_20251004.md`](../deliverables/onboarding_evidence/lab3_manual_session_20251004.md)에 정리했다.
- 내부망 배포 절차: 2025-10-05 23:30 UTC에 staging DB 스냅샷( `qa-routing-20251003` )을 운영과 비교하고, 2025-10-06 01:15 UTC에 `deploy/internal_network_rollout_20251006.md` 초안에 따라 read-only 점검 → 01:45 UTC ERP 토글 기능 플래그 활성 → 02:00 UTC 정식 배포. QA 인계자는 Stage 5 SQL 보고서에 첨부한 수동 증빙을 참조하여 SQL 마이그레이션 승인 서명을 완료한다. 【F:docs/stage4_frontend_report.md†L66-L74】【F:docs/stage5_sql_report.md†L79-L88】
