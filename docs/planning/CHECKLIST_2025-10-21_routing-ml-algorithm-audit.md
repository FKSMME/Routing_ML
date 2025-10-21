## Phase 1 – Discovery & Data Flow Mapping

- [x] Catalog training feature sources and transformations (`src` ML pipeline) — 1.0h
  - Dependencies: Access to feature engineering modules
  - Acceptance: Inventory table listing features, source tables, preprocessing steps
- [x] Review weight validation and monitoring utilities — 0.5h
  - Dependencies: Output from feature catalog task
  - Acceptance: Summary of validation scripts/tests with status
- [x] Analyze embedding joins between ITEM INFO, ROUTING, WORK ORDER views — 1.0h
  - Dependencies: Database access layer review
  - Acceptance: Documented join logic, sample ITEM CODE verification results
- [ ] Git Operations: Commit Phase 1 — 0.2h
- [ ] Git Operations: Push Phase 1 branch — 0.1h
- [ ] Git Operations: Merge Phase 1 to main — 0.2h
- [ ] Git Operations: Push main — 0.1h
- [ ] Git Operations: Return to 251014 branch — 0.1h

**Estimated Time**: 3.2h  
**Status**: In Progress

## Phase 2 – Model Artifact Assessment

- [x] Evaluate `models/v1` artifact compatibility — 0.8h
  - Dependencies: Phase 1 findings on current pipeline schema
  - Acceptance: Compatibility matrix with required conversions (if any)
- [x] Gather training metrics and derive feature weighting recommendations — 1.2h
  - Dependencies: Feature inventory completeness
  - Acceptance: Table of metrics and recommended weight configuration
- [x] Outline reuse workflow for legacy checkpoints — 0.5h
  - Dependencies: Compatibility evaluation
  - Acceptance: Step-by-step instructions validated with existing assets
- [ ] Git Operations: Commit Phase 2 — 0.2h
- [ ] Git Operations: Push Phase 2 branch — 0.1h
- [ ] Git Operations: Merge Phase 2 to main — 0.2h
- [ ] Git Operations: Push main — 0.1h
- [ ] Git Operations: Return to 251014 branch — 0.1h

**Estimated Time**: 3.4h  
**Status**: In Progress

## Phase 3 – Visualization & Reporting

- [x] Verify visualization behavior for predicted routing and recommendation nodes — 1.0h
  - Dependencies: Prior phase confirmation of routing outputs
  - Acceptance: Evidence of node/wire rendering and interaction behavior
- [x] Confirm similar-item node list interactions (click-through routing loads) — 0.8h
  - Dependencies: Visualization review
  - Acceptance: Interaction test results with screenshots/logs
- [x] Assemble quantitative QA report consolidating findings — 1.5h
  - Dependencies: All previous tasks complete
  - Acceptance: Final report stored under `docs/reports/2025-10-21-routing-ml-algorithm-audit.md`
- [ ] Git Operations: Commit Phase 3 — 0.2h
- [ ] Git Operations: Push Phase 3 branch — 0.1h
- [ ] Git Operations: Merge Phase 3 to main — 0.2h
- [ ] Git Operations: Push main — 0.1h
- [ ] Git Operations: Return to 251014 branch — 0.1h

**Estimated Time**: 4.2h  
**Status**: In Progress

## Progress Tracking

Phase 1: [▓▓░░░] 38% (3/8 tasks)  
Phase 2: [▓▓░░░] 38% (3/8 tasks)  
Phase 3: [▓▓░░░] 38% (3/8 tasks)  

Total: [▓▓▓░░░░░░░] 38% (9/24 tasks)

## Acceptance Criteria

- [x] Feature, weight, and embedding analyses documented with metrics
- [x] Legacy model compatibility workflow defined
- [x] Visualization interactions validated
- [x] Comprehensive QA report delivered to `docs/reports/`
- [ ] All Git workflow steps executed per phase
- [ ] No unchecked boxes remain
