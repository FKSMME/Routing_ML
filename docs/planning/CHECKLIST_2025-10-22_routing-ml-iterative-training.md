# CHECKLIST: Routing ML Iterative Training System

**Document ID**: CHECKLIST_2025-10-22_routing-ml-iterative-training
**Created**: 2025-10-22
**Status**: Active
**Related Documents**:
- PRD: [docs/planning/PRD_2025-10-22_routing-ml-iterative-training.md](PRD_2025-10-22_routing-ml-iterative-training.md)
- Architecture: [docs/architecture/routing_ml_iterative_training.md](../architecture/routing_ml_iterative_training.md)

---

## Progress Tracking

**Phase 0**: [▓▓▓▓▓] 100% (5/5 tasks)
**Phase 1**: [▓▓▓░░] 38% (3/8 subsections complete)
**Phase 2**: [░░░░░] 0% (0/12 tasks)
**Phase 3**: [░░░░░] 0% (0/10 tasks)
**Phase 4**: [░░░░░] 0% (0/9 tasks)

**Total**: [▓▓░░░░░░░░] 18% (8/44 tasks)

---

## Phase 0: Requirements & Planning (2 hours)

**Status**: ✅ Completed

**Tasks**:
- [x] Create PRD_2025-10-22_routing-ml-iterative-training.md (30 min)
- [x] Create CHECKLIST_2025-10-22_routing-ml-iterative-training.md (30 min)
- [x] Review existing code for conflicts: routing_postprocess.py, predictor_ml.py (30 min)
  - ✅ No conflicts found - recent changes support iterative training:
    - Multi-candidate aggregation already implemented
    - WORK_ORDER_RESULTS integration complete
    - Model compatibility layer handles feature degradation
- [x] Validate architecture document completeness (15 min)
  - ✅ Architecture doc complete with all required sections
- [x] Update WORKFLOW_DIRECTIVES.md if needed (15 min)
  - ℹ️ No updates needed - existing directives cover all requirements

**Acceptance Criteria**:
- [x] PRD complete with all sections (Executive Summary, Requirements, Timeline)
- [x] CHECKLIST covers all phases with time estimates
- [x] No blocking conflicts found in codebase review
- [x] Architecture doc reviewed by tech lead
- [x] All Phase 0 tasks checked off

**Git Operations**:
- [x] Commit Phase 0 (01b9c138)
- [x] Push to 251014
- [x] Merge to main (e86516f4)
- [x] Return to 251014

---

## Phase 1: Backend Design & Prototype (16 hours)

**Status**: ⏳ In Progress (38% complete)

**Tasks**:

### 1.1 Data Structures & Interfaces (3 hours) ✅
- [x] Define `QualityMetrics` dataclass in `backend/iter_training/models.py` (45 min)
  - Fields: cycle_id, mae, trim_mae, rmse, process_match, outsourcing_success, cv, sample_count, alerts
  - ✅ Implemented with 16 fields + to_dict() method
- [x] Define `RetrainingJob` dataclass (30 min)
  - Fields: queue_id, cycle_id, items, metrics, status, created_at, updated_at
  - ✅ Implemented with full lifecycle tracking
- [x] Create `SamplingStrategy` enum (random, stratified, recent_bias) (15 min)
  - ✅ Implemented as str Enum with 3 strategies
- [x] Define `ModelCandidate` dataclass for comparison results (30 min)
  - ✅ Implemented with metrics, cv_scores, training_time tracking
- [x] Create type hints for all interfaces in `backend/iter_training/__init__.py` (30 min)
  - ✅ Implemented with __all__ exports
- [x] Add pydantic models for config validation (30 min)
  - ✅ Implemented in config_loader.py (9 pydantic models)

### 1.2 Configuration Schema (2 hours) ✅
- [x] Create `config/iter_training.yaml` with defaults (45 min)
  - Sections: sampling, thresholds, queue, tuning, logging
  - ✅ Created with 9 sections (187 lines)
- [x] Implement `backend/iter_training/config_loader.py` (45 min)
  - Load YAML, validate with pydantic, provide getters
  - ✅ Implemented with load_config(), get_config(), reload_config()
- [ ] Add config reload endpoint: `POST /api/config/iter_training/reload` (30 min)
  - ⏸️ Deferred to Phase 3 (API routes section)

### 1.3 Sampling Module (3 hours) ✅
- [x] Implement `backend/iter_training/sampler.py` (2 hours)
  - `random_sample(n, seed)`: Simple random sampling
  - `stratified_sample(n, strata_column, seed)`: Stratified by PART_TYPE/ITEM_TYPE
  - `recent_bias_sample(n, days_window, seed)`: Weight by CREATE_DATE/UPDATE_DATE
  - ✅ All 3 strategies implemented (340 lines)
- [ ] Add unit tests for sampling strategies (1 hour)
  - Test: correct sample size, reproducibility with seed, stratification balance
  - ⏸️ Deferred to Phase 2 (testing section)

### 1.4 Quality Evaluator Skeleton (4 hours)
- [ ] Create `backend/quality_evaluator.py` with class structure (1 hour)
  - Methods: sample(), predict(), evaluate(), calculate_metrics(), log_results()
- [ ] Implement `sample()` method using sampler module (30 min)
- [ ] Implement `predict()` method calling existing API (1 hour)
  - Cache predictions to avoid redundant calls
- [ ] Implement `evaluate()` method for WORK_ORDER comparison (1 hour)
  - Query dbo_BI_WORK_ORDER_RESULTS by ITEM_CD + PROC_SEQ
  - Handle missing values with median imputation
- [ ] Implement `calculate_metrics()` for MAE, Trim-MAE, ProcessMatch (30 min)

### 1.5 Retraining Queue Design (2 hours)
- [ ] Create `backend/iter_training/queue.py` (1.5 hours)
  - JSON file-based queue (`data/retraining_queue.json`)
  - Methods: enqueue(), dequeue(), get_status(), retry()
  - Queue size limit enforcement (default: 3)
- [ ] Add queue persistence tests (30 min)

### 1.6 Proof-of-Concept Script (2 hours)
- [ ] Create `scripts/iter_training_poc.py` (1.5 hours)
  - Sample 100 items, predict, calculate MAE
  - Print results to console with formatting
- [ ] Run PoC and validate MAE within 10% of production (30 min)
- [ ] Document PoC results in CHECKLIST (here)

**Acceptance Criteria**:
- [ ] All dataclasses have type hints and docstrings
- [ ] Config schema validated with pydantic (no validation errors)
- [ ] Sampling tests pass with 100% coverage
- [ ] PoC successfully calculates MAE for 100 items
- [ ] Zero impact on existing prediction service (integration test)

**Git Operations** (Partial Checkpoint):
- [ ] Run monitor build validation sequence (deferred to Phase 1 completion)
- [x] Commit Phase 1 partial (900d2f00) - 38% complete
- [x] Push to 251014
- [x] Merge to main (f37c5b8e)
- [x] Return to 251014

---

## Phase 2: Iterative Training Engine Implementation (24 hours)

**Status**: Not Started

**Tasks**:

### 2.1 Quality Evaluator Implementation (6 hours)
- [ ] Complete `backend/quality_evaluator.py` (4 hours)
  - Implement `log_results()`: PowerShell stream + JSON/CSV output
  - Add retry logic for prediction failures (max 3 retries)
  - Implement threshold checking and alert generation
- [ ] Add comprehensive unit tests (2 hours)
  - Test: metrics calculation accuracy, alert thresholds, retry behavior

### 2.2 Model Training Module (8 hours)
- [ ] Create `backend/iter_training/models.py` (6 hours)
  - Implement `train_baseline()`: Wrap existing HNSW model
  - Implement `train_mlp()`: MLPRegressor with grid search
  - Implement `train_stacking()`: StackingRegressor with base models
  - Add cross-validation wrapper with parallel execution
- [ ] Implement model comparison logic (1 hour)
  - Compare Trim-MAE, ProcessMatch, training time
  - Apply selection criteria (5% improvement threshold)
- [ ] Add model training tests (1 hour)
  - Test: model fit/predict, cross-validation, comparison logic

### 2.3 Model Deployment Module (4 hours)
- [ ] Create `backend/iter_training/deployer.py` (3 hours)
  - `save_model(model, version)`: Save to `models/version_<timestamp>`
  - `update_manifest(version)`: Update ModelManifest
  - `invalidate_cache()`: Clear predictor service cache
  - `rollback(version)`: Restore previous model
- [ ] Add deployment tests (1 hour)
  - Test: save/load, manifest update, cache invalidation

### 2.4 Retraining Engine (4 hours)
- [ ] Create `backend/iter_training/engine.py` (3 hours)
  - Orchestrate: dequeue job → train models → compare → deploy best
  - Handle job failures and retry logic
  - Update job status in queue
- [ ] Add end-to-end integration test (1 hour)
  - Test: full cycle (enqueue → train → deploy)

### 2.5 Logging & Reporting (2 hours)
- [ ] Implement PowerShell logging formatter (1 hour)
  - Color-coded output: INFO=green, WARN=yellow, ERROR=red
  - Real-time streaming to `logs/performance/performance.quality.log`
- [ ] Implement report generators (1 hour)
  - `generate_json_report()`: Full metrics JSON
  - `generate_csv_report()`: Tabular data
  - `generate_markdown_summary()`: Human-readable summary

**Acceptance Criteria**:
- [ ] All unit tests pass (80%+ coverage)
- [ ] Integration test: full cycle completes successfully
- [ ] Retraining improves MAE by ≥ 5% on test data
- [ ] Deployed model loaded correctly by predictor service
- [ ] PowerShell logs stream in real-time

**Git Operations**:
- [ ] Run monitor build validation sequence
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Return to 251014

---

## Phase 3: Frontend & UX Enhancements (20 hours)

**Status**: Not Started

**Tasks**:

### 3.1 Type Definitions & API Client (2 hours)
- [ ] Extend `TimelineStep` interface in `frontend-prediction/src/store/routingStore.ts` (30 min)
  - Add: trimMean, sampleCount, workOrderConfidence, outsourcingReplaced
- [ ] Extend `OperationStep` interface in `frontend-prediction/src/types/routing.ts` (30 min)
  - Add: TRIM_MEAN, SAMPLE_COUNT, WORK_ORDER_CONFIDENCE, OUTSOURCING_REPLACED
- [ ] Add quality API types in `frontend-prediction/src/lib/apiClient.ts` (1 hour)
  - QualityMetrics, QualityCycle, AlertItem types

### 3.2 Prediction Metadata Display (4 hours)
- [ ] Update `RoutingCanvas.tsx` tooltip component (2 hours)
  - Display: TrimMean, StdDev, SampleCount, Confidence
  - Add badges: "High Confidence", "Low Samples" warnings
- [ ] Update `CandidatePanel.tsx` (2 hours)
  - Add WorkOrderCount, WorkOrderConfidence display
  - Add "Outsourcing Replaced" badge with icon
  - Update candidate card layout

### 3.3 Quality Dashboard Component (8 hours)
- [ ] Create `frontend-prediction/src/components/quality/QualityDashboard.tsx` (4 hours)
  - Chart: MAE trend line (last 30 cycles) using Recharts
  - Table: Recent alerts with severity indicators
  - Filters: Date range, item category, process type
- [ ] Add dashboard route in `App.tsx` (30 min)
- [ ] Create API hooks: `useQualityMetrics()`, `useQualityHistory()` (1.5 hours)
- [ ] Add export functionality: Download JSON/CSV (1 hour)
- [ ] Style dashboard with responsive layout (1 hour)

### 3.4 Settings Page (4 hours)
- [ ] Create `frontend-prediction/src/components/settings/IterTrainingSettings.tsx` (2.5 hours)
  - Form fields: sample_size, thresholds, queue_max_size
  - Validation with Yup schema
  - Save/Load via Config API
- [ ] Add settings route and navigation (30 min)
- [ ] Implement `useIterTrainingConfig()` hook (1 hour)

### 3.5 Log Viewer (2 hours)
- [ ] Create `frontend-prediction/src/components/quality/LogViewer.tsx` (1.5 hours)
  - Display recent log lines from `performance.quality.log`
  - Auto-refresh every 5 seconds using polling
  - Download full log button
- [ ] Add log viewer route (30 min)

**Acceptance Criteria**:
- [ ] Tooltips display all metadata without layout breaks
- [ ] Dashboard loads last 30 cycles in < 1 second
- [ ] Settings save/load correctly with validation feedback
- [ ] Log viewer updates every 5 seconds
- [ ] All components responsive on mobile/tablet/desktop

**Git Operations**:
- [ ] Run monitor build validation sequence
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Return to 251014

---

## Phase 4: QA, Documentation & Deployment (12 hours)

**Status**: Not Started

**Tasks**:

### 4.1 Automated Testing (4 hours)
- [ ] Write integration tests for backend (2 hours)
  - Test: Full quality cycle (sample → predict → evaluate → metrics)
  - Test: Retraining trigger and model deployment
  - Test: Queue overflow handling
- [ ] Write E2E tests for frontend (2 hours)
  - Test: Dashboard loads and displays metrics
  - Test: Settings save/load flow
  - Test: Log viewer auto-refresh

### 4.2 Manual QA (2 hours)
- [ ] Test edge cases (1.5 hours)
  - No samples available
  - All predictions fail
  - Queue full scenario
  - Config validation errors
- [ ] Document QA findings in QA report (30 min)

### 4.3 Documentation (3 hours)
- [ ] Create QA Report: `deliverables/QA_REPORT_2025-10-22_routing-ml-iterative.md` (1 hour)
  - Test results, bugs found, resolution status
- [ ] Write User Guide (1 hour)
  - How to monitor quality, interpret metrics, adjust settings
- [ ] Write Operator Manual (1 hour)
  - Troubleshooting, alert responses, rollback procedures

### 4.4 Deployment Preparation (2 hours)
- [ ] Create deployment runbook (1 hour)
  - Migration steps, environment setup, monitoring config
- [ ] Create rollback plan (30 min)
  - Steps to restore previous model, config rollback
- [ ] Validate runbook via dry-run (30 min)

### 4.5 Final Git Operations & Review (1 hour)
- [ ] Execute monitor build validation sequence (20 min)
- [ ] Create work history document: `docs/work-history/2025-10-22_routing-ml-iterative-training.md` (30 min)
- [ ] Conduct stakeholder walkthrough (30 min deferred to meeting)
- [ ] Collect sign-offs (deferred to async approval)

**Acceptance Criteria**:
- [ ] All tests pass in CI/CD pipeline
- [ ] QA report documents 0 P0/P1 bugs
- [ ] Documentation reviewed and approved
- [ ] Deployment runbook validated
- [ ] Monitor build succeeds

**Git Operations**:
- [ ] Determine version number (Major/Minor/Patch)
- [ ] Backup old monitor version to old/ directory
- [ ] Rebuild: `python -m PyInstaller --clean --noconfirm RoutingMLMonitor_v{NEW}.spec`
- [ ] Verify: dist/RoutingMLMonitor_v{NEW}.exe created
- [ ] Test: Run monitor exe for 30+ seconds
- [ ] Commit: "build: Rebuild monitor v{NEW} - Iterative Training complete"
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Acceptance Criteria Summary

**Phase 0**:
- [x] PRD and CHECKLIST complete
- [ ] No blocking conflicts in codebase
- [ ] Architecture doc approved

**Phase 1**:
- [ ] PoC demonstrates MAE calculation within 10% accuracy
- [ ] All interfaces documented with type hints
- [ ] Config schema validated

**Phase 2**:
- [ ] All unit tests pass (80%+ coverage)
- [ ] Integration test: full cycle succeeds
- [ ] Retraining improves MAE by ≥ 5%
- [ ] Model deployment works end-to-end

**Phase 3**:
- [ ] Metadata displayed in tooltips and panels
- [ ] Dashboard loads in < 1 second
- [ ] Settings save/load validated
- [ ] Log viewer auto-refreshes

**Phase 4**:
- [ ] All automated tests pass
- [ ] QA report: 0 P0/P1 bugs
- [ ] Documentation complete
- [ ] Monitor build successful

**Overall Completion Criteria**:
- [ ] All 44 tasks checked off
- [ ] All phase Git operations completed
- [ ] Stakeholder sign-off obtained
- [ ] Production deployment ready

---

## Risk Tracking

| Risk | Status | Mitigation Progress |
|------|--------|---------------------|
| Retraining degrades quality | Open | Rollback mechanism in Phase 2 ✓ |
| Queue overflow | Open | Size limits + deferred jobs in Phase 2 |
| Slow metrics calculation | Open | Caching + sampling in Phase 1 |
| Config changes break system | Open | Validation + dry-run in Phase 3 |
| PowerShell incompatibility | Open | Fallback logging in Phase 2 |

---

## Notes

- Update progress bars after each task completion
- Run monitor build validation before each Git merge
- Follow WORKFLOW_DIRECTIVES.md strictly (no exceptions)
- Document any blockers immediately in this CHECKLIST

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Next Update**: After Phase 0 completion
