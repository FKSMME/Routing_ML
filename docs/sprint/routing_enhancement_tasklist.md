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
- [ ] Review `docs/Design/samples` and capture reusable UI tokens/components.
- [x] Finalize navigation labels/order and encoding fix in frontend. (2025-09-30 완료 - 라벨/설명 설계 명칭으로 정비)
- [ ] Update design specs for all menus (`routing_enhancement_plan.md`, `routing_state_store_plan.md`, new gap analysis).

## Phase 2 · Routing Generation Rebuild
- [ ] Implement 20/60/20 layout with Tabs/Candidate/Timeline panels.
- [ ] Integrate ReactFlow horizontal timeline with drag/resize.
- [x] Build Save panel (multi-format, local/clipboard/server, ERP toggle) and group management. (2025-09-28 23:29 완료)

## Phase 3 · Other Menus
- [x] Master data tree/matrix redesign + audit logging (2025-09-28 19:05 완료)
- [ ] Reference Data: Access DB connector + tree/matrix UI.
- [ ] Algorithm Visualization: Blueprint graph + settings modal.
- [ ] Data Output Settings: Column mapping/profile management.
- [ ] Learning Data Status: TensorBoard link, heatmap, feature toggles.
- [x] System Options: 옵션 충돌 규칙 + 컬럼 매핑 설정 (2025-09-29 20:45 완료 - workflow graph 연동 및 감사 로깅).

## Phase 4 · Persistence & Integration
- [x] Implement IndexedDB + server settings persistence. (2025-09-30 완료)
- [x] Extend audit logging (IP/time/action) for all UI operations. (2025-09-30 완료)
- [ ] Wire ERP interface trigger and Access file linkage.
- [ ] Document Docker/internal deployment plan.

## Phase 5 · QA & Release Prep
- [ ] Execute QA checklist (`docs/sprint/routing_enhancement_qa.md`).
- [ ] Perform `/api/routing/groups` integration test with backend.
- [ ] Update OpenAPI/Swagger with new endpoints.
- [ ] Prepare release notes and internal deployment SOP.
