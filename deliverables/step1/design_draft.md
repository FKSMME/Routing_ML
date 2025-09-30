# Step 1 Design Draft Summary

> Source: `docs/Design/routing_enhancement_plan.md` (approved 2025-09-29)

## UX and Layout Principles
- Pastel gradient background with glassmorphism cards, consistent hover emphasis, and responsive breakpoints (≥1440px three columns, <1024px two columns, <768px stacked).【F:docs/Design/routing_enhancement_plan.md†L7-L19】
- Global header provides status summary and last saved timestamp with `lucide-react` icons; navigation orders menus from reference data through options with desktop tabs/breadcrumbs and mobile drawer support.【F:docs/Design/routing_enhancement_plan.md†L21-L36】

## Key Workspace Blueprints
- **Routing Generation (20/60/20 layout)**: left input matrix and CSV upload, central ReactFlow canvas with timeline tabs and audit summaries, right candidate cards plus save/interface controls; groups save to IndexedDB and `/api/routing/groups` with dirty/version indicators.【F:docs/Design/routing_enhancement_plan.md†L38-L55】
- **Reference Data** integrates Access connection management, Siemens-style tree, and history panel with mapping summary.【F:docs/Design/routing_enhancement_plan.md†L23-L33】
- **Algorithm Graph** uses blueprint-style nodes with double-click drawers to edit templates that update Python scaffolds and `models/blueprints/*.json`.【F:docs/Design/routing_enhancement_plan.md†L57-L63】
- **Data Output** defines column mapping matrix and preview with `/api/routing/output-profiles` persistence applied during save.【F:docs/Design/routing_enhancement_plan.md†L65-L73】
- **Learning Data Status** dashboards cards, TensorBoard iframe, and feature selection toggles that call `/api/trainer/features`.【F:docs/Design/routing_enhancement_plan.md†L75-L83】
- **Options Menu** centralizes statistical toggles, key mappings, ERP/Access paths, and Docker build controls.【F:docs/Design/routing_enhancement_plan.md†L85-L91】

## Persistence, Logging, and Deployment Guardrails
- Dual persistence via PostgreSQL and IndexedDB with `settings_version`, audit logging for UI actions, Docker deployment guidance, and separation of training console from REST project scope.【F:docs/Design/routing_enhancement_plan.md†L93-L101】

## Implementation Priorities and Review Notes
- Immediate priorities: finalize UI tokens/layout system, prototype routing screen, extend graph/visualization, define backend extensions, and run QA & Docker PoC.【F:docs/Design/routing_enhancement_plan.md†L103-L111】
- Codex review confirms alignment with samples, Access/ERP/log interfaces, and QA/deployment strategy cross-referenced with QA document and deploy scripts; no further remediation required.【F:docs/Design/routing_enhancement_plan.md†L113-L122】
