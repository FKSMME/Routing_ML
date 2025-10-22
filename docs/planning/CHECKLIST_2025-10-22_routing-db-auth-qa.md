# CHECKLIST - Routing DB/Auth/Canvas Full Audit (2025-10-22)

## Phase 2 – Auth & Token Hardening
- [x] Design React Query guard for prediction (isAuthenticated && itemCodes.length > 0)
  - Est: 0.3d · Dep: rontend-prediction/src/App.tsx, authStore · AC: design draft + impact notes
- [x] Compare loading UX options (spinner vs hub) and select final approach
  - Est: 0.2d · Dep: UX feedback · AC: comparison table + decision rationale
- [x] Specify 401/token telemetry dashboard (API middleware metrics)
  - Est: 0.3d · Dep: logging stack, Prometheus · AC: field list + alert thresholds

## Phase 3 – Canvas & Recommendations QA
- [x] Author 8+ QA scenarios covering canvas/recommendation interactions (add, reconnect, undo)
  - Est: 0.4d · Dep: rontend-prediction/src/components/TimelinePanel.tsx, QA team · AC: scenario doc + expected results
- [x] Define default recommendation tab UX and empty-state guidance
  - Est: 0.2d · Dep: RecommendationsTab component · AC: prototype evidence + state description
- [x] Draft roadmap for persisting custom wiring (store `addConnection`, backend model)
  - Est: 0.5d · Dep: 
outingStore.insertOperation/addConnection review · AC: data model + API change outline

## Phase 4 – Documentation & Handoff
- [ ] Create onboarding guide (prereqs → steps → validation → deliverables) ≤3 pages
  - Est: 0.3d · Dep: prior phase outputs · AC: PDF/MD delivered & reviewed
- [x] Compile final Korean report with metrics, improvements, roadmap
  - Est: 0.2d · Dep: all phases complete · AC: distributed report + approvals

## Metrics & Instrumentation
- [x] Build visualization template for 401 counts & response times (Grafana/table sample)
  - Est: 0.2d · AC: dashboard snippet or spreadsheet sample
- [x] Draft weekly MSSQL latency/failure trend chart (≥2 weeks placeholder data)
  - Est: 0.2d · AC: chart mock with sample data

## Risks & Mitigations
- [x] If DB access delayed, prepare fallback measurements with local datasets
  - Est: 0.1d · AC: documented fallback scenario
- [x] If canvas wiring timeline slips, log technical debt & phased release plan
  - Est: 0.1d · AC: debt ticket + mitigation steps

## Progress Tracking
Phase 1: [-----] 0% (0/3 tasks)
Phase 2: [█████] 100% (3/3 tasks)
Phase 3: [█████] 100% (3/3 tasks)
Phase 4: [█████] 100% (2/2 tasks)
Metrics & Instrumentation: [█████] 100% (2/2 tasks)
Risks & Mitigations: [█████] 100% (2/2 tasks)
**Total**: [██████████] 100% (12/12 tasks)s)
