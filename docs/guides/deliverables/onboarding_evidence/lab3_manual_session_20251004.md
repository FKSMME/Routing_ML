# Lab-3 Manual QA Session — 2025-10-04

- **Location / Device**: Lab-3 workstation (Chrome 127.0.6533.88, 27" @ 2560×1440)
- **Session Window**: 2025-10-04 09:05:12 KST → 10:26:47 KST
- **Observer**: QA Ops 김서윤 (remote notes by Dev Support 이규민)
- **Test Build**: frontend `main` 6d1f3fa, backend `main` 7a92c67, database snapshot `qa-routing-20251003`

## Completed Scenarios

1. **Layout ratio verification (1440px & 1280px)**
   - Captured computed styles via DevTools -> Layout pane at 2560×1440 and responsive mode 1280×900.
   - Measurements recorded in [`layout_ratio_manual_20251004.log`](./layout_ratio_manual_20251004.log).
   - Screenshots stored in secure share (`QA/Lab3/20251004/layout_ratio_{1440,1280}.png`).

2. **PredictionControls regression**
   - Adjusted similarity threshold 0.35 → 0.55 → 0.40; backend responded with updated KPI delta within 480 ms.
   - Confirmed dirty flag transitions in UI, noted in [`prediction_controls_manual_20251004.log`](./prediction_controls_manual_20251004.log).

3. **Metrics / Visualization panel parity**
   - Compared KPI chart overlays against baseline capture dated 2025-09-27; no deviations detected.
   - Logged overlay checksum + screenshot references in [`metrics_visualization_manual_20251004.log`](./metrics_visualization_manual_20251004.log).

4. **WorkflowGraphPanel navigation regression**
   - Navigated Recommendation Board → Workflow Graph → back to Recommendation Board three times; no state leakage.
   - Confirmed React Query cache resets and history stack clearing, recorded in [`workflow_graph_manual_20251004.log`](./workflow_graph_manual_20251004.log).

5. **Routing group dirty reset scenario**
   - Dragged operation `MILL_02` to slot 3, triggered dirty flag, executed Undo → Redo, then Cancel Save.
   - Verified audit log payload and UI state rollback, summarized in [`dirty_reset_manual_20251004.log`](./dirty_reset_manual_20251004.log).

6. **ERP toggle manual payload capture**
   - Toggled ERP requirement ON, saved routing group `QA-LAB3-20251004-A`.
   - Captured UI snapshot + network payload stored in [`erp_toggle_manual_20251004.ui.json`](./erp_toggle_manual_20251004.ui.json) and [`erp_toggle_manual_20251004.network.json`](./erp_toggle_manual_20251004.network.json).

7. **POST 409 rollback capture**
   - Attempted duplicate routing save (`QA-LAB3-20251004-A`), observed 409 conflict, UI rollback, and audit entry with `rollback_reason="DUPLICATE_GROUP"`.
   - Evidence logged in [`routing_save_409_manual_20251004.log`](./routing_save_409_manual_20251004.log).

8. **GET routing group dirty release capture**
   - Loaded group `QA-LAB3-BASELINE`, confirmed timeline refresh, dirty flag cleared, and store snapshot recorded.
   - Supplemented existing screenshot with live run notes in [`get_group_dirty_release_manual_20251004.log`](./get_group_dirty_release_manual_20251004.log).

## Session Outcome

- All outstanding ⚠️ items from `docs/sprint/routing_enhancement_qa.md` converted to ✅.
- Network HAR archives uploaded to secure share (`QA/Lab3/20251004/network/*.har`); masked extracts included above.
- Blocker issue [`docs/issues/qa_manual_browser_blocker_20251002.md`] marked resolved with cross-reference to this session log.

