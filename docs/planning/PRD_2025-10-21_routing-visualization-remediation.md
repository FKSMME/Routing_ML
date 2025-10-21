# PRD — Routing Visualization Remediation (2025-10-21)

## Executive Summary
- Implement end-to-end fixes ensuring the routing creation canvas correctly reflects backend recommendation data, maintains authentication stability, and restores dashboard metrics.
- Address critical QA findings: candidate metadata loss, 401 prediction errors, missing dashboard statistics.
- Deliver production-ready enhancements with updated tests and documentation.

## Problem Statement
Recent QA exposed severe misalignment between backend prediction payloads and the visualization layer. Candidate metadata (`CandidateRouting`) is discarded, similarity scoring is inferred from timeline state, and repeated authentication failures degrade reliability. Dashboard analytics also fail due to outdated SQL references. Without remediation, users cannot trust recommendations or monitoring outputs, blocking release sign-off.

## Goals and Objectives
1. Persist and surface candidate metadata in the frontend state/store so recommendations and canvas nodes reflect true API payloads.
2. Ensure prediction requests succeed reliably by handling authentication/token refresh prior to `/api/predict`.
3. Restore dashboard routing KPIs by fixing broken SQL (`INSRT_DT`) references.
4. Provide automated coverage and documentation updates per directives.

## Requirements
- Modify `routingStore.loadRecommendations` to persist both `items` and `candidates`.
- Update recommendation/canvas components to consume `CandidateRouting` data (similarity, matched features, process counts).
- Preserve metadata during drag/drop (`insertOperation`, `toTimelineStep`) and display on nodes/tooltips.
- Add prediction pre-flight check (token validation/refresh) in workspace store or API client.
- Update dashboard query/config to remove invalid column references.
- Add unit/integration tests covering candidate persistence and auth flow.
- Update documentation/checklists per directives; produce QA evidence.

## Phase Breakdown
### Phase 1 — Planning & Scaffolding
- Create checklist, confirm workflow steps, capture baseline snapshots.

### Phase 2 — Frontend State & UI Updates
- Persist candidates, update components, adjust drag/drop metadata handling.

### Phase 3 — Backend/API Integration & Monitoring Fixes
- Implement auth pre-check, fix dashboard SQL, adjust logging as needed.

### Phase 4 — Validation & Documentation
- Add tests, run QA scenarios, update docs/checklists, produce evidence.

## Success Criteria
- Canvas and recommendation panes display accurate similarity/matched-feature data for all candidates.
- `/api/predict` success rate improves (no 401s in QA scenario).
- Dashboard KPIs load without errors.
- Tests and documentation updated; checklist completed with evidence.

## Timeline Estimates
- Phase 1: 0.5 day
- Phase 2: 1.0 day
- Phase 3: 0.5 day
- Phase 4: 0.5 day
- Total: 2.5 days

