# PRD: Routing ML Iterative Training System

**Document ID**: PRD_2025-10-22_routing-ml-iterative-training
**Created**: 2025-10-22
**Status**: Active
**Owner**: ML Engineering Team
**Related Documents**:
- Architecture: [docs/architecture/routing_ml_iterative_training.md](../architecture/routing_ml_iterative_training.md)
- Checklist: [docs/planning/CHECKLIST_2025-10-22_routing-ml-iterative-training.md](CHECKLIST_2025-10-22_routing-ml-iterative-training.md)
- Workflow Directives: [.claude/WORKFLOW_DIRECTIVES.md](../../.claude/WORKFLOW_DIRECTIVES.md)

---

## Executive Summary

Implement an automated iterative training system for Routing ML that continuously monitors prediction quality, detects degradation, and triggers retraining when needed. The system will:

1. **Quality Evaluation Worker**: Periodically sample items, compare predictions with actual work order data, and calculate quality metrics
2. **Retraining Engine**: Train alternative models (MLP, Stacking) and deploy improvements automatically
3. **Frontend Extensions**: Display prediction metadata (sample counts, confidence, outsourcing replacement) and quality dashboards
4. **Operational Monitoring**: Provide PowerShell-based real-time logging and structured reports (JSON/CSV/Markdown)

**Expected Impact**:
- 30% reduction in prediction MAE through continuous optimization
- Early detection of model degradation (within 1 day vs. current manual weeks)
- Reduced manual intervention time from 8 hours/week to 1 hour/week

---

## Problem Statement

### Current State

- **Manual Training**: Model retraining requires manual data preparation, parameter selection, and deployment (8+ hours)
- **No Quality Monitoring**: No systematic tracking of prediction quality vs. actual work orders
- **Reactive Approach**: Model degradation discovered only when users report poor recommendations
- **Limited Feedback Loop**: No automated mechanism to learn from actual production outcomes

### Pain Points

1. **Delayed Detection**: Model quality drops silently until user complaints accumulate
2. **Resource Waste**: Over-training on unchanged data or under-training when data evolves rapidly
3. **Unclear Metadata**: Users cannot see prediction confidence, sample counts, or data freshness
4. **Manual Overhead**: Every model update requires manual configuration, testing, and deployment

---

## Goals and Objectives

### Primary Goals

1. **Automate Quality Monitoring** (P0)
   - Evaluate prediction quality every 24 hours
   - Compare predictions with actual work order outcomes
   - Alert when metrics fall below thresholds

2. **Implement Continuous Retraining** (P0)
   - Train alternative models (MLP, Stacking) when quality degrades
   - Compare candidate models against baseline using cross-validation
   - Deploy improved models automatically with rollback capability

3. **Enhance User Transparency** (P0)
   - Display prediction metadata: sample counts, confidence scores, data quality indicators
   - Show model version and last evaluation date on prediction pages

4. **Provide Operational Visibility** (P1)
   - Real-time PowerShell logging for monitoring
   - Structured reports (JSON/CSV/Markdown) for analysis

### Success Criteria

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| MAE (Mean Absolute Error) | 4.8 min | ≤ 3.5 min | Trim-MAE on validation set |
| Process Match Rate | 78% | ≥ 85% | % of predicted processes matching actual |
| Detection Latency | ~2 weeks | ≤ 1 day | Time from degradation to alert |
| Manual Effort | 8 hrs/week | ≤ 1 hr/week | Operator time spent on model management |
| Model Freshness | Varies | ≤ 7 days | Max age of training data |

---

## Requirements

### Functional Requirements

#### FR1: Quality Evaluation Worker

**FR1.1 - Sampling Strategy**
- Support 3 sampling modes: random, stratified (by part type/category), recent_bias (weighted by creation date)
- Configurable sample size (default: 500 items)
- Reproducible sampling with seed parameter

**FR1.2 - Prediction Execution**
- Use existing `predict_items_with_ml_optimized` API
- Cache predictions to avoid redundant computation
- Handle prediction failures gracefully (retry up to 3 times)

**FR1.3 - Actual Data Comparison**
- Query `dbo_BI_WORK_ORDER_RESULTS` for actual SETUP_TIME, RUN_TIME, WAIT_TIME
- Match by ITEM_CD + PROC_SEQ + JOB_CD
- Handle missing/null values with configurable imputation

**FR1.4 - Metrics Calculation**
- Calculate per-cycle: MAE, Trim-MAE (10% trim), RMSE, ProcessMatch, OutsourcingSuccess, CV, SampleCount
- Per-item metrics: deviation, confidence, data quality score
- Aggregate metrics by category (part type, process type, etc.)

**FR1.5 - Threshold-Based Alerts**
- Trigger warnings when:
  - MAE > 5.0 minutes
  - ProcessMatch < 0.8
  - CV > 0.5 (high variability)
  - SampleCount < 3 (insufficient data)

**FR1.6 - Retraining Queue Management**
- Enqueue retraining jobs when quality thresholds violated
- Queue size limit: 3 concurrent jobs (configurable)
- Job states: pending, running, failed, succeeded, deferred
- Retry policy: max 2 retries with exponential backoff

#### FR2: Retraining Engine

**FR2.1 - Model Candidates**
- Baseline: Current HNSW + embedding model
- MLPRegressor: Hidden layers [128, 64], activation='relu', solver='adam'
- StackingRegressor: Base=[KNN, RandomForest, MLP], Final=RidgeCV

**FR2.2 - Cross-Validation**
- K-Fold (K=5) with stratified splits
- Metrics: Trim-MAE, ProcessMatch, training time, inference latency
- Parallel execution using joblib (n_jobs=-1)

**FR2.3 - Model Selection Criteria**
- Accept if: (new_trim_mae < baseline_trim_mae * 0.95) AND (new_process_match > baseline_process_match)
- Reject if: metrics worse or training unstable (CV > 0.6 across folds)

**FR2.4 - Model Deployment**
- Save to `models/version_<timestamp>` with metadata.json
- Update ModelManifest and FeatureWeightManager
- Invalidate predictor cache to force reload
- Keep last 3 versions for rollback

**FR2.5 - Hyperparameter Tuning** (Phase 2+)
- Grid/Random search over configured parameter space
- Max 5 trials per retraining cycle
- Time budget: 2 hours max per tuning job

#### FR3: Frontend Enhancements

**FR3.1 - Prediction Metadata Display**
- Node tooltips: SETUP/RUN/WAIT times + TrimMean, StdDev, SampleCount, Confidence
- Candidate tabs: WorkOrderCount, WorkOrderConfidence, OutsourcingReplaced badge
- Prediction header: Model version, last evaluation date, current MAE

**FR3.2 - Quality Dashboard**
- Chart: Last 30 quality cycles (MAE trend line)
- Table: Recent alerts with severity (warning/error)
- Filters: Date range, item category, process type
- Export: Download JSON/CSV reports

**FR3.3 - Settings UI**
- Edit `iter_training.yaml` parameters: sample_size, thresholds, tuning config
- Save/Load via backend Config API (`PUT /api/config/iter_training`)
- Audit log: Track all config changes with user/timestamp

**FR3.4 - Log Viewer** (Phase 3+)
- Display recent log lines from `performance.quality.log`
- Auto-refresh every 5 seconds
- Download full log file button

### Non-Functional Requirements

**NFR1: Performance**
- Quality evaluation cycle: ≤ 10 minutes for 500 items
- Retraining: ≤ 2 hours for full model comparison
- API latency: Metrics query ≤ 200ms

**NFR2: Reliability**
- Evaluation worker uptime: 99.5%
- Graceful degradation: Failures don't block primary prediction service
- Data integrity: All metrics auditable via logs

**NFR3: Observability**
- Real-time PowerShell logging with color-coded levels
- Structured JSON logs for programmatic analysis
- Cycle reports: JSON (complete), CSV (tabular), Markdown (summary)

**NFR4: Security**
- Config changes require authentication (admin role)
- Sensitive parameters (DB credentials) never logged
- Model files integrity checked via SHA256 hashes

**NFR5: Maintainability**
- Modular design: Worker, Engine, Deployer as separate services
- Configuration-driven: All thresholds/parameters in YAML
- Comprehensive unit tests (80%+ coverage)

---

## Phase Breakdown

### Phase 0: Requirements & Planning (2 hours)

**Deliverables**:
- [ ] PRD (this document) - 완료
- [ ] CHECKLIST with detailed tasks
- [ ] Review existing code for conflicts (routing_postprocess, predictor_ml)
- [ ] Update WORKFLOW_DIRECTIVES.md if needed

**Acceptance Criteria**:
- All stakeholders reviewed and approved PRD
- CHECKLIST covers all FRs with time estimates
- No blockers identified in codebase review

---

### Phase 1: Backend Design & Prototype (16 hours)

**Deliverables**:
- [ ] `backend/quality_evaluator.py` module design (interfaces, data schemas)
- [ ] `backend/iter_training/` package structure
- [ ] `config/iter_training.yaml` schema and defaults
- [ ] Proof-of-concept script: Sample → Predict → Evaluate → Metrics
- [ ] Design doc: Retraining queue, model comparison, deployment flow

**Acceptance Criteria**:
- PoC successfully samples 100 items, calculates MAE
- Config schema validated with pydantic
- All interfaces documented with type hints + docstrings
- Zero impact on existing prediction service

**Key Tasks**:
1. Define `QualityMetrics` dataclass (MAE, Trim-MAE, ProcessMatch, etc.)
2. Implement sampling strategies (random, stratified, recent_bias)
3. Create retraining queue data structure (JSON file-based)
4. Design model comparison framework (cross-validation, metric aggregation)
5. Prototype logging: PowerShell stream + JSON output

---

### Phase 2: Iterative Training Engine Implementation (24 hours)

**Deliverables**:
- [ ] `backend/quality_evaluator.py` - full implementation
- [ ] `backend/iter_training/engine.py` - retraining logic
- [ ] `backend/iter_training/models.py` - MLP/Stacking wrappers
- [ ] `backend/iter_training/deployer.py` - model save/load/activate
- [ ] Unit tests: sampling, metrics, queue, model comparison
- [ ] Integration test: End-to-end cycle (sample → train → deploy)

**Acceptance Criteria**:
- All unit tests pass (80%+ coverage)
- Integration test completes successfully
- Retraining improves MAE by ≥ 5% on test data
- Deployed model correctly loaded by predictor service

**Key Tasks**:
1. Implement SamplingStage, PredictionStage, EvaluationStage
2. Build retraining queue manager (enqueue, dequeue, retry logic)
3. Implement MLPRegressor and StackingRegressor training pipelines
4. Add cross-validation with parallel execution
5. Create model deployment module (save, update manifest, invalidate cache)
6. Set up PowerShell logging with color-coded output
7. Generate cycle reports (JSON/CSV/Markdown)

---

### Phase 3: Frontend & UX Enhancements (20 hours)

**Deliverables**:
- [ ] Prediction metadata display in RoutingCanvas tooltips
- [ ] CandidatePanel enhanced with sample count/confidence/outsourcing badges
- [ ] QualityDashboard component (chart + table + filters)
- [ ] SettingsPage for `iter_training.yaml` editing
- [ ] LogViewer component with auto-refresh
- [ ] API endpoints: `GET /api/quality/metrics`, `PUT /api/config/iter_training`

**Acceptance Criteria**:
- Tooltips display all required fields without layout breaks
- Dashboard loads last 30 cycles in < 1 second
- Settings save/load correctly with validation feedback
- Log viewer updates every 5 seconds without flickering

**Key Tasks**:
1. Extend `TimelineStep` and `OperationStep` interfaces with new fields
2. Update `routingStore.ts` to fetch and map quality metadata
3. Create QualityDashboard component (React + Recharts)
4. Build SettingsForm with Yup validation
5. Implement LogViewer with WebSocket or polling
6. Add backend routes: quality metrics, config CRUD
7. Update API client types

---

### Phase 4: QA, Documentation & Deployment (12 hours)

**Deliverables**:
- [ ] Automated tests: Unit (backend/frontend), Integration, E2E
- [ ] QA Report: `deliverables/QA_REPORT_2025-10-22_routing-ml-iterative.md`
- [ ] User Guide: How to monitor quality, interpret metrics, adjust settings
- [ ] Operator Manual: Troubleshooting, alert responses, rollback procedures
- [ ] Deployment runbook: Migration steps, rollback plan, monitoring setup
- [ ] Stakeholder review meeting + sign-off

**Acceptance Criteria**:
- All tests pass in CI/CD pipeline
- QA report documents 0 P0/P1 bugs
- Documentation reviewed and approved by 2 stakeholders
- Deployment runbook validated via dry-run

**Key Tasks**:
1. Write integration tests: Full quality cycle, retraining trigger, model deployment
2. Write E2E tests: Dashboard loads, settings save, log viewer updates
3. Perform manual QA: Edge cases (no samples, all predictions fail, queue full)
4. Document alert scenarios and response procedures
5. Create deployment checklist (DB migrations, config updates, model backups)
6. Conduct stakeholder walkthrough and collect feedback
7. Execute Monitor build validation sequence per WORKFLOW_DIRECTIVES.md
8. Create work history document: `docs/work-history/2025-10-22_routing-ml-iterative-training.md`

---

## Timeline Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 2 hours | None |
| Phase 1 | 16 hours | Phase 0 complete |
| Phase 2 | 24 hours | Phase 1 complete |
| Phase 3 | 20 hours | Phase 2 complete |
| Phase 4 | 12 hours | Phase 3 complete |
| **Total** | **74 hours** | **~9 working days** |

**Critical Path**:
Phase 0 → Phase 1 (PoC) → Phase 2 (Engine) → Phase 3 (Frontend) → Phase 4 (QA)

**Milestones**:
- Day 1: PRD + CHECKLIST approved
- Day 3: PoC demonstrates MAE calculation
- Day 6: Retraining engine deploys first improved model
- Day 8: Dashboard displays live quality metrics
- Day 9: QA complete, ready for production

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Retraining degrades quality | High | Medium | Rollback mechanism, A/B testing, gradual rollout |
| Queue overflow during peak load | Medium | Medium | Queue size limits, deferred jobs, priority system |
| Metrics calculation too slow | High | Low | Caching, incremental updates, sampling optimization |
| Config changes break system | High | Low | Schema validation, dry-run mode, version control |
| PowerShell logging incompatible | Low | Low | Fallback to file-only logging, cross-platform testing |

---

## Success Metrics

**Phase-by-Phase Metrics**:

| Phase | Metric | Target | Measurement Method |
|-------|--------|--------|-------------------|
| Phase 1 | PoC MAE accuracy | Within 10% of production | Manual validation on 100 samples |
| Phase 2 | Retraining improvement | ≥ 5% MAE reduction | Cross-validation on test set |
| Phase 3 | Dashboard load time | < 1 second | Chrome DevTools Network tab |
| Phase 4 | Zero regression bugs | 0 P0/P1 bugs | QA test suite results |

**Production Metrics (30 days post-launch)**:

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Average MAE | 4.8 min | ≤ 3.5 min | Quality dashboard |
| Process Match Rate | 78% | ≥ 85% | Quality dashboard |
| User Complaints | ~5/week | ≤ 1/week | Support ticket system |
| Manual Model Updates | 4/month | ≤ 1/month | Audit logs |
| System Uptime | 99.0% | ≥ 99.5% | Monitoring alerts |

---

## Dependencies

**Internal**:
- Existing prediction API: `predict_items_with_ml_optimized`
- Database views: `dbo_BI_ITEM_INFO_VIEW`, `dbo_BI_ROUTING_VIEW`, `dbo_BI_WORK_ORDER_RESULTS`
- Frontend stores: `routingStore.ts`, `predictionStore.ts`
- Backend services: `training_service.py`, `feature_weights.py`

**External**:
- Python libraries: scikit-learn (1.3+), pandas, joblib, pydantic
- Frontend libraries: React 18+, Recharts, Yup
- Infrastructure: PostgreSQL 14+, PowerShell 7+ (for logging)

**Blockers**:
- None identified at PRD approval stage

---

## Out of Scope (Future Phases)

1. **Active Learning**: Prioritize uncertain predictions for human review
2. **Multi-Objective Optimization**: Balance MAE, latency, resource cost
3. **AutoML**: Automated hyperparameter tuning beyond grid search
4. **Real-Time Retraining**: Trigger retraining on individual prediction failures
5. **Explainability**: SHAP values, feature importance visualization per prediction

---

## Appendix

### A. Glossary

- **Trim-MAE**: Mean Absolute Error after removing top/bottom 10% outliers
- **ProcessMatch**: Percentage of predicted process sequences matching actual work orders
- **OutsourcingSuccess**: Percentage of successful outsource → in-house conversions
- **CV (Coefficient of Variation)**: StdDev / Mean, measures relative variability
- **Cycle**: One complete iteration of quality evaluation (sample → predict → evaluate → metrics)

### B. Reference Documents

- Architecture Design: [docs/architecture/routing_ml_iterative_training.md](../architecture/routing_ml_iterative_training.md)
- Workflow Directives: [.claude/WORKFLOW_DIRECTIVES.md](../../.claude/WORKFLOW_DIRECTIVES.md)
- Existing QA Report: [deliverables/QA_REPORT_2025-10-22_routing-ml-qa-comprehensive-review.md](../../deliverables/QA_REPORT_2025-10-22_routing-ml-qa-comprehensive-review.md)

### C. Approval Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| QA Lead | | | |
| DevOps | | | |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Next Review**: Upon Phase 0 completion
