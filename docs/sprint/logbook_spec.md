> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# Sprint Logbook Specification

## Purpose
- Provide an English logbook template that satisfies the absolute directive and Tasklist reporting cadence.
- Ensure every entry captures measurable outcomes, evidence, and approval checkpoints for on-prem PoC execution.

## Entry Template
| Field | Description | Example |
| --- | --- | --- |
| Date (YYYY-MM-DD) | Local calendar date | 2025-09-28 |
| Stage / Menu | Stage number or menu name referencing Tasklist | Menu 2 - Routing Builder |
| Task ID | Path + checklist item anchor | task_details/menu2_routing_builder_detail.md#implementation |
| Description | Short action summary in English | Implemented DnD reorder for routing blocks |
| Metrics | Quantitative outcome (time, count, fps, etc.) | 60fps maintained on 1920x1080 |
| Evidence | File path, screenshot, or log reference | logs/audit/routing_builder.log |
| Approval | Approver / status / timestamp | Dev Lead - pending |
| Follow-up | Next steps or blockers | Await ERP interface toggle spec |

### 절대 지령 게이트 템플릿 연동
- 모든 문서/로그북 작업은 [`docs/absolute_directive_gate_template.md`](../absolute_directive_gate_template.md)의 Gate 0~7 체크리스트를 복사하여 섹션 상단에 배치한다.
- 각 Gate 행을 업데이트할 때 동일한 내용(담당자, 승인 시각, 증빙, 이전 단계 오류 재확인 결과)을 `logs/task_execution_*.log`에도 같은 타임스탬프와 함께 기록한다.
- 다음 단계에 착수하기 전, Gate 6·Gate 7의 “이전 단계 오류 재확인 결과” 칼럼을 `재확인 완료` 또는 `추가 조치 필요`로 명시하고, 동일한 판정을 로그에 남긴 뒤에만 단계 전환을 요청한다.

## Logging Rules
- Record one row per discrete action or test; group related rows with suffixes (e.g., 2.2.a, 2.2.b).
- Attach at least one quantitative metric per entry (execution time, success count, error rate, frame rate).
- Reference artefacts stored under logs/, deliverables/, or screenshots/ using workspace-relative paths.
- Flag blockers explicitly in the Follow-up column and keep Tasklist entries in sync.
- Submit daily updates before 18:00 local time; overdue items stay as Approval = pending until reviewed.

## Quality Checks
1. Verify every entry references a valid Tasklist item or detail document section.
2. Confirm metrics are reproducible and documented in the linked evidence (logs, screenshots, datasets).
3. Note environment details for PoC actions (machine specs, dataset snapshot, model build).
4. Run weekly audits comparing logbook entries with logs/audit/* to catch omissions.

## Automation Plan
- Script: scripts/update_logbook.py (to be implemented) parses Tasklist checkboxes, requests metrics, and appends rows following the template.
- Schedule: Windows Task Scheduler nightly at 17:45 on the PoC workstation; manual trigger via poetry run python scripts/update_logbook.py --manual remains available.
- Inputs: reads staged YAML files under logs/pending_updates/ produced by UI/API modules; falls back to interactive prompts when no batch data exists.
- Outputs: appends to docs/sprint/logbook.md, writes CSV to deliverables/reports/logbook_latest.csv, and updates summary counts in Tasklist headers.
- Safeguards: validates against this schema, enforces presence of IP/user/action, and aborts writes while unresolved blockers persist.

## Storage
- Primary logbook: docs/sprint/logbook.md.
- Archive: docs/sprint/archive/ with naming convention YYYYMMDD_sprint_log.md.
- Retention: rolling 180-day history aligned with the logging policy.

