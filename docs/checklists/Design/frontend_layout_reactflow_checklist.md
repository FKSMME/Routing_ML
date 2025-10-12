# Frontend Layout & ReactFlow Execution Checklist

## Layout Principles (20/60/20)
- **Left 20% – Navigation & Filters**: Collapsible panel with manifest version selector, rule filters, and history log.
- **Center 60% – Canvas**: ReactFlow viewport with grid snapping, zoom controls, and minimap overlay.
- **Right 20% – Detail Drawer**: Contextual inspector showing node properties, rule violations, and preview outputs.

## ReactFlow Enhancements
| Feature | Requirement | Notes |
| --- | --- | --- |
| Drag-and-drop nodes | Support palette -> canvas drop with validation hooks. | Use `onDragOver` gating to enforce manifest constraints. |
| Edge validation | Prevent cycles and invalid transitions using DSL rules. | ✅ ReactFlow timeline badge renders DSL rule id + message (`RoutingCanvas` + Vitest coverage). |
| Snapshot preview | Button to render latest inference preview for selected node. | Calls inference API with staging flag. |
| Undo/Redo | Maintain action stack integrated with state store. | Limit depth to 50; expose keyboard shortcuts. |
| Autosave | Every 60s or on focus loss, persist to local draft. | Indicate autosave timestamp in footer. |

## Accessibility & UX
- Keyboard navigation for node selection (arrow keys) and property editing (Enter/Tab).
- High contrast theme compliance with WCAG AA.
- Tooltip on rule badges describing violation and remediation hints.

## Testing Checklist
- [ ] Dragging 100 nodes maintains < 16ms frame budget. _2025-09-30 profiling run captured in `deliverables/2025-09-29/routing_canvas_profile.json` logged max 572.258 ms with 3 frames over budget; follow-up required._
- [x] Rule violation badge shows for at least one invalid connection.
  - Procedure: run `npx vitest run ../tests/frontend/routingDragAndDrop.spec.tsx --reporter verbose` from `frontend/` to simulate palette drop and enforce DSL rules.
  - Evidence: `logs/qa/frontend_rule_badge_20251005.log`.
- [x] Autosave persists and reloads after browser refresh.
  - Procedure: edit timeline nodes, trigger autosave, reload browser session, and confirm IndexedDB snapshot replay via routing store inspector.
  - Evidence: `logs/qa/indexeddb_autosave_restore_20250930.md`.
- [ ] Responsive layout holds 20/60/20 ratio above 1280px; stacks gracefully below 1024px.
  - Procedure: Execute Playwright viewport sweep (1280 px and 1024 px) capturing column widths via bounding boxes; verify side panels ≈20% and responsive stacking thresholds.
  - Evidence: `deliverables/onboarding_evidence/layout_ratio_1280.log` (center column overflow; requires adjustment).
- [ ] Screen reader announces node selection and validation status.
  - Procedure: With NVDA (Windows) or VoiceOver (macOS), tab through `RoutingCanvas`, confirm node focus announcements and ARIA live updates for rule badges; capture transcript or `.sr` log.
  - Evidence: _Pending dedicated assistive technology pass; capture log once completed._

## Delivery Artifacts
- Wireframes stored in `deliverables/2025-09-29/frontend_layout_wireframes.pdf`.
- ReactFlow node palette spec `deliverables/2025-09-29/reactflow_node_palette.json`.
- QA test script `deliverables/2025-09-29/frontend_reactflow_testcases.csv`.

## Follow-up
- Integrate ReactFlow plugin updates into `frontend/package.json` with offline `npm` cache.
- Coordinate with design team for accessibility review sign-off.
- Schedule usability session with power users post-beta.
