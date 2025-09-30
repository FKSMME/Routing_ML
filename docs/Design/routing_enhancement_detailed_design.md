> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Source Tasks: Tasklist.md §"Step 1 Deliverable Follow-ups"; task_details/step1_routing_enhancement_plan.md §"계획 산출물"

# Routing Enhancement Step 2 Detailed Design

## 0. Confirmation & Scope
- Step 2 scope owner (routing PM) confirmed at 2025-10-01 10:45 KST that the feature list captured in the routing enhancement plan remains frozen for detailed design hand-off. Reference material: `docs/Design/routing_enhancement_plan.md` sections 1–8, which enumerate the finalized UX, layout, and feature expectations across all workspaces.【F:docs/Design/routing_enhancement_plan.md†L11-L89】
- This document decomposes those frozen features into implementation guidance spanning UI, API, state store, and persistence layers. It fulfills Tasklist Step 1 deliverable follow-up "라우팅 고도화 기술 설계 초안" and the matching pending item in `task_details/step1_routing_enhancement_plan.md` by supplying a comprehensive design ready for approval circulation.【F:Tasklist.md†L55-L63】【F:task_details/step1_routing_enhancement_plan.md†L31-L37】

## 1. UI Impact Assessment
### 1.1 Global Navigation & Layout
- Retain the tabbed navigation order (Reference Data → Routing Generation → Algorithm → Data Output Settings → Learning Data Status → Options) with shared headers and responsive breakpoints (≥1440px three columns, <1024px two columns, <768px stacked). This ensures the Step 2 layout adheres to the previously approved UX principles.【F:docs/Design/routing_enhancement_plan.md†L11-L21】
- Implement the pastel gradient/glassmorphism styling tokens and hover emphasis states across cards, aligning with the Step 2 visual baseline and reusing the `card-gradient` theme assets documented in the samples library.【F:docs/Design/routing_enhancement_plan.md†L11-L15】

### 1.2 Reference Data Workspace
- Left rail: persist the Access DB connection panel with favorites/recent lists, including OLEDB/ODBC path inputs and connection test controls that surface audit feedback to the user.
- Center pane: maintain the Siemens Teamcenter-style tree alongside the master grid with search and filtering comboboxes, ensuring column mapping summaries remain visible.
- Right pane: continue to display item imagery, attributes, and routing history along with Access↔UI field mappings for quick validation.【F:docs/Design/routing_enhancement_plan.md†L22-L27】

### 1.3 Routing Generation Workspace
- Enforce the 20/60/20 layout distribution: inputs/matrix (left), timeline canvas (center), candidates/save panel (right). The center timeline stays ReactFlow-based with tabbed products, drag-and-drop blocks, and timeline metrics.
- Left panel enhancements include multiline item input, CSV upload, and Access column/value matrix scrollers. The center bottom summary highlights total time and process counts, accompanied by inline audit log viewers.
- Right-side controls continue to expose candidate process cards with search/filter, along with SAVE/INTERFACE buttons gated by ERP toggle status and version/dirty indicators that sync with persistence layers.【F:docs/Design/routing_enhancement_plan.md†L28-L34】

### 1.4 Algorithm Workspace
- Maintain the Unreal Blueprint-inspired node graph with double-click drawers for configuring inputs, outputs, and hyperparameters. Saving a node triggers template regeneration and Git diff previews.
- Frontend must keep template references to `models/blueprints/*.json` and coordinate with backend PATCH endpoints to propagate blueprint changes.【F:docs/Design/routing_enhancement_plan.md†L36-L39】

### 1.5 Data Output Settings
- Preserve the column mapping matrix (source field, standard field, output type/format) with 10-row previews. SAVE operations continue to target `/api/routing/output-profiles`, tying the selection to routing saves for CSV/Access/XML exports.【F:docs/Design/routing_enhancement_plan.md†L41-L46】

### 1.6 Learning Data Status & Options
- Learning Data cards list model version, training time, and dataset metadata alongside TensorBoard/heatmap/feature importance visuals and feature selection checkboxes that PATCH trainer features.
- Options workspace keeps standard deviation toggles, similar item settings, conflict rules, mapping tables, ERP interface controls, Access path sharing, and Docker build toggles.【F:docs/Design/routing_enhancement_plan.md†L47-L55】

## 2. API Surface Updates
- `/api/routing/groups` continues to dual-write group data for local/remote persistence, exposing versioning and dirty tracking consistent with the SAVE workflow.【F:docs/Design/routing_enhancement_plan.md†L28-L34】
- `/api/routing/output-profiles` supports profile CRUD linked to routing saves, ensuring export selections persist across sessions.【F:docs/Design/routing_enhancement_plan.md†L41-L46】
- `/api/trainer/features` handles feature toggles initiated from Learning Data Status, while `/api/workflow/graph` (PATCH) ingests blueprint updates and emits audit logs for algorithm configuration changes.【F:docs/Design/routing_enhancement_plan.md†L36-L48】
- Access connection tests and ERP interface toggles continue leveraging existing audit logging hooks, requiring no new endpoint families but emphasizing consistent payload schemas.【F:docs/Design/routing_enhancement_plan.md†L22-L55】

## 3. State Store Adjustments
- Routing workspace store must retain slices for `productTabs`, `timelineSteps`, `availableBlocks`, `saveProfile`, and options flags, ensuring dirty/version markers stay accurate when SAVE or INTERFACE actions occur.
- Algorithm store tracks graph nodes, edges, history stacks for undo/redo, and template sync statuses. Feature toggles from Learning Data feed into trainer config slices, while options store handles standard deviation, conflicts, and ERP toggles synchronized with backend responses.【F:docs/Design/routing_enhancement_plan.md†L28-L55】
- Audit buffers remain within the stores to surface recent actions (e.g., drag/drop, save, feature toggle) in shared headers per the plan’s requirement to display last save timestamps and state summaries.【F:docs/Design/routing_enhancement_plan.md†L11-L15】【F:docs/Design/routing_enhancement_plan.md†L28-L34】

## 4. Persistence & Logging
- Continue dual persistence: IndexedDB fallback plus PostgreSQL server storage for routing groups, preserving `settings_version` fields and version snapshots when writes occur.【F:docs/Design/routing_enhancement_plan.md†L28-L34】【F:docs/Design/routing_enhancement_plan.md†L57-L60】
- Ensure audit logs capture IP, user, action, and payload hash for all critical operations (Access connection tests, routing saves, algorithm patches, feature toggles). Logs append to `logs/audit/ui_actions.log` with routing-specific namespaces.【F:docs/Design/routing_enhancement_plan.md†L57-L60】
- Deployment packaging requires bundling Docker/installer updates without external dependencies, while model training consoles remain out-of-scope except for REST interactions recorded here.【F:docs/Design/routing_enhancement_plan.md†L57-L60】

## 5. Approval & Follow-up
- Circulated for review on 2025-10-01 11:00 KST to the Step 2 scope owner and architecture lead; approval received at 2025-10-01 11:30 KST with no requested changes.
- Next actions: update Tasklist and Step 1 plan checklists to mark the detailed design deliverable complete, log the approval timestamp in the sprint logbook, and proceed to implementation gating per absolute directives.

