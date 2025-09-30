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
- [ ] Dragging 100 nodes maintains < 16ms frame budget.
- [x] Rule violation badge shows for at least one invalid connection. Evidence: `tests/frontend/routingDragAndDrop.spec.tsx` (DSL-R001 badge assertion) + dev demo `/#rule-badge-demo`.
- [ ] Autosave persists and reloads after browser refresh.
- [ ] Responsive layout holds 20/60/20 ratio above 1280px; stacks gracefully below 1024px.
- [ ] Screen reader announces node selection and validation status.

## Delivery Artifacts
- Wireframes stored in `deliverables/2025-09-29/frontend_layout_wireframes.pdf`.
- ReactFlow node palette spec `deliverables/2025-09-29/reactflow_node_palette.json`.
- QA test script `deliverables/2025-09-29/frontend_reactflow_testcases.xlsx`.

## Follow-up
- Integrate ReactFlow plugin updates into `frontend/package.json` with offline `npm` cache.
- Coordinate with design team for accessibility review sign-off.
- Schedule usability session with power users post-beta.
