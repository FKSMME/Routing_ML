> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 0단계 상세 태스크: 레포/요건 동기화 (준비)

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 — `logs/task_execution_20250925.log` 03:05~03:55Z 기록
- [x] 단계 범위(레포 구조, 승인 워크플로우, 거버넌스 설정) 전체 리뷰 — `docs/stage0_report.md`
- [x] 선행 단계 오류 및 미해결 이슈 없음 확인 — Stage 0 착수 전 자체 점검 결과
- [x] 문서/다이어그램 뷰어 접근 전 승인 상태 확인 — PlantUML 접근 승인 내역 기록
- [x] 백그라운드 실행 계획(비동기 작업 스케줄) 준비 — 로그 및 보고서에 백그라운드 수행 절차 명시

### 설계(Design)
1. `routing_system_architecture.mdpuml` 최신 여부 확인 및 필요 시 수정 포인트 기록 → `docs/stage0_report.md`
2. 문서 구조 파악: `PRD.md`, `Tasklist.md`, `README` 등 주요 산출물 위치 매핑 → `docs/stage0_report.md` 문서 구조 표
3. 요구사항 승인 워크플로우 다이어그램 초안 작성 (게이트 포함) — 도구/포맷 선정 → `docs/approval_workflow.puml`
4. 승인 체계와 연동되는 책임자/승인자 목록 수집 → `docs/stage0_report.md` 게이트 섹션

### 구현(Implementation)
1. 이슈/PR 템플릿에 게이트 체크리스트 자동 포함하도록 템플릿 스켈레톤 작성 → `.github/ISSUE_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE.md`
2. 저장소 설정 점검(브랜치 네이밍, 기본 브랜치) 및 필요한 설정 변경안 초안 → `docs/code_governance_plan.md`
3. 요구 추적표 구조 정의: 항목(요구 ID, 설명, 태스크, 커밋 링크) 설계 → `docs/requirements_traceability_matrix.md`
4. 코드 오너 후보 파악 및 제안서 초안 작성 → `docs/code_governance_plan.md` CODEOWNERS 후보

### 테스트(Test)
1. 요구 추적표 샘플 데이터로 검증 (PRD 요구 ↔ 태스크 매핑이 가능한지 확인) → 샘플 5건 기입 완료
2. 템플릿에 게이트 체크리스트가 정상 출력되는지 Dry-run → 마크다운 미리보기 점검
3. 워크플로우 다이어그램(승인 단계) 리뷰 및 검토 의견 수집 → PlantUML 구문 검증

### 배포(Deployment)
1. 브랜치 보호 규칙 후보안 문서화(필수 리뷰어 수, 상태 체크 등) → `docs/code_governance_plan.md`
2. 코드 오너 지정안 문서화 및 승인 프로세스 준비 → `docs/code_governance_plan.md`
3. 승인된 워크플로우/템플릿/추적표를 저장소에 반영할 일정 수립 → Stage 0 보고서 배포 섹션
4. 단계 종료 보고 초안 작성 및 승인 요청 → `docs/stage0_report.md`
