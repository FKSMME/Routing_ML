> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 31 | Completed 11 | Blockers 0

# Routing Enhancement Sprint Task List

## Phase 0 · Setup
- [x] Confirm absolute directives and summarize scope from Tasklist.md.
- [x] Capture current architecture references needed for routing enhancements.
- [x] Complete Codex self-review and archive decision in docs/logs/codex_activity_log.md.

## Phase 1 · Design Alignment
_Reference update_: The previous `deliverables/design/routing_enhancement_state.png` snapshot was removed to comply with the binary asset policy. Key takeaways from that mock are:
1. Global navigation groups "Overview · Candidates · Timeline" across the top bar with contextual status badges.
2. The Save panel anchors to the right column with primary/secondary CTA buttons aligned to the bottom edge.
3. Timeline cards stack vertically with drag handles on the left and real-time KPI chips on the right.
- [x] Review `docs/Design/samples` and capture reusable UI tokens/components. (2025-09-30 — `task_details/menu1_master_data_detail.md` 체크리스트에 반영)
- [x] Finalize navigation labels/order and encoding fix in frontend. (2025-09-30 완료 - 라벨/설명 설계 명칭으로 정비)
- [x] Update design specs for all menus (`routing_enhancement_plan.md`, `routing_state_store_plan.md`, new gap analysis). (Step 1~6 계획 문서 및 Master Data 상세 문서 갱신)

## Phase 2 · Routing Generation Rebuild
- [x] Implement 20/60/20 layout with Tabs/Candidate/Timeline panels. (`frontend/src/App.tsx`, `frontend/src/components/TimelinePanel.tsx` 구현 완료)
- [x] Integrate ReactFlow horizontal timeline with drag/resize. (`frontend/src/components/TimelinePanel.tsx` + `reactflow` 연동)
- [x] Build Save panel (multi-format, local/clipboard/server, ERP toggle) and group management. (2025-09-28 23:29 완료)

## Phase 3 · Other Menus
- [x] Master data tree/matrix redesign + audit logging (2025-09-28 19:05 완료)
- [x] Reference Data: Access DB connector + tree/matrix UI. (`task_details/menu1_master_data_detail.md`, `/api/access/*` 명세 반영)
- [x] Algorithm Visualization: Blueprint graph + settings modal. (`task_details/step2_algorithm_visual_plan.md`, `frontend/src/components/workspaces/AlgorithmWorkspace.tsx`)
- [x] Data Output Settings: Column mapping/profile management. (`task_details/step3_output_template_plan.md`, `frontend/src/components/workspaces/DataOutputWorkspace.tsx`)
- [x] Learning Data Status: TensorBoard link, heatmap, feature toggles. (`task_details/step4_training_dashboard_plan.md`, `frontend/src/components/workspaces/TrainingStatusWorkspace.tsx`)
- [x] System Options: 옵션 충돌 규칙 + 컬럼 매핑 설정 (2025-09-29 20:45 완료 - workflow graph 연동 및 감사 로깅).

## Phase 4 · Persistence & Integration
- [x] Implement IndexedDB + server settings persistence. (2025-09-30 완료)
- [x] Extend audit logging (IP/time/action) for all UI operations. (2025-09-30 완료)
- [x] Wire ERP interface trigger and Access file linkage. (`frontend/src/components/RoutingGroupControls.tsx`, `/api/workflow`/`/api/settings/workspace` 연결 문서화)
- [x] Document Docker/internal deployment plan. (`docs/stage9_packaging_plan.md`, `docs/install_guide_ko.md` 검증 메모 추가)

## Phase 5 · QA & Release Prep
- [x] Execute QA checklist (`docs/sprint/routing_enhancement_qa.md`). (2025-09-30 업데이트 — 빌드 실패 로그/후속 조치 기록)
- [ ] Perform `/api/routing/groups` integration test with backend.
- [ ] Update OpenAPI/Swagger with new endpoints.
- [ ] Prepare release notes and internal deployment SOP.
