# PRD: QA 100% Pass - Codebase Optimization & Cleanup

**Date**: 2025-10-22
**Status**: Active
**Related Checklist**: [docs/planning/CHECKLIST_2025-10-22_qa-100-percent-pass.md](docs/planning/CHECKLIST_2025-10-22_qa-100-percent-pass.md)

---

## Executive Summary

Following comprehensive QA inspection of 1,446 files (excluding dependency directories), this PRD addresses critical issues preventing 100% QA pass. The codebase contains ~188k LOC (32k backend, 88k frontend, 9.2k tests), 128k LOC documentation, and 1.3M LOC training data. Major findings include:

- 15+ duplicate files across models, deliverables, and frontend projects
- 1.06GB redundant model artifacts across versions
- Backend security risks (default JWT secret, unimplemented iterative training)
- Incomplete frontend features (Timeline save TODO)
- Accumulated logs/deliverables (429 files, 3.8MB)
- Documentation sprawl (513 files, 127k LOC)

**Objective**: Achieve 100% QA pass through systematic deduplication, security hardening, feature completion, and asset optimization.

---

## Problem Statement

### Quantitative Issues

1. **File Duplication** (15+ instances):
   - 3D background model: 4x copies (frontend-home, frontend-prediction, frontend-training)
   - Model metadata: 3x copies (deliverables/v1.0/models/*, models/*)
   - Joblib artifacts: 2x copies (models/default, models/test_phase2)
   - Frontend modules: schema.ts, hyperspeedPresets.ts, components, stores replicated
   - Test code: routing-groups.spec.ts duplicated across 3 projects

2. **Storage Waste**:
   - models/ directory: 1.06GB (89 files) with version overlap
   - node_modules: 867MB combined (474MB + 393MB)
   - Logs: 288 files, 3.1MB
   - Deliverables: 141 files, 0.7MB

3. **Incomplete Implementation**:
   - `backend/iter_training/trainer.py:63` - NotImplementedError
   - `frontend-prediction/src/components/TimelinePanel.tsx:28` - TODO

4. **Security Risks**:
   - Default JWT secret in production config
   - Unvalidated model deployment pipeline

### Qualitative Issues

1. **Maintainability**: Duplicated components increase bug surface and update cost
2. **Developer Experience**: Confusion over "which file is canonical"
3. **CI/CD Performance**: Redundant logs/assets slow down pipelines
4. **Documentation Clarity**: 513 files without clear taxonomy

---

## Goals and Objectives

### Primary Goals

1. **Eliminate Duplication**: Remove all 15+ duplicate files, establish single source of truth
2. **Optimize Storage**: Reduce model artifacts from 1.06GB to <500MB via deduplication
3. **Complete Backend**: Implement iterative training data preparation, harden JWT security
4. **Complete Frontend**: Finish Timeline save functionality
5. **Clean Assets**: Archive/remove accumulated logs, streamline deliverables
6. **Organize Documentation**: Categorize docs into active/archived/deprecated

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Duplicate files | 15+ | 0 |
| Model storage | 1.06GB | <500MB |
| Incomplete features | 2 (iter training, timeline) | 0 |
| Security risks | 1 (JWT) | 0 |
| Accumulated logs | 288 files | <10 (active only) |
| Test coverage | 10.5% | 15% (improve) |
| Documentation files | 513 | <300 (active) |

---

## Requirements

### Functional Requirements

**FR1: Deduplication System**
- Remove all 4 copies of background.glb, retain 1 in frontend-shared
- Consolidate model metadata to models/ directory only
- Remove duplicate joblib artifacts (test_phase2 → default)
- Centralize frontend components to frontend-shared
- Unify test suites

**FR2: Backend Completion**
- Implement `backend/iter_training/trainer.py:prepare_training_data()`
- Replace default JWT_SECRET with environment variable
- Add deployment validation in `backend/iter_training/deployer.py`

**FR3: Frontend Completion**
- Implement Timeline save functionality in TimelinePanel.tsx
- Refactor routingStore.ts (60-76KB → modular stores)

**FR4: Asset Cleanup**
- Archive logs older than 30 days to `logs/archive/`
- Consolidate deliverables by version to `deliverables/archive/`
- Remove unused SQLite dump (?memory?)

**FR5: Documentation Taxonomy**
- Categorize docs into: `/active`, `/archive`, `/deprecated`
- Create index: `docs/INDEX.md`

### Non-Functional Requirements

**NFR1: Backward Compatibility**
- Maintain all public API contracts
- Preserve model loading paths with symlinks/config

**NFR2: Git History Preservation**
- Use `git mv` for renames
- Document migrations in commit messages

**NFR3: Testing**
- All changes must pass existing test suites
- Add tests for new iter_training implementation

---

## Phase Breakdown

### Phase 1: Planning & Documentation (1 hour)

**Tasks**:
1. Create this PRD
2. Create detailed Checklist
3. Review and approve plan

**Deliverables**:
- `docs/planning/PRD_2025-10-22_qa-100-percent-pass.md`
- `docs/planning/CHECKLIST_2025-10-22_qa-100-percent-pass.md`

---

### Phase 2: Duplicate File Removal - 3D Assets (0.5 hours)

**Tasks**:
1. Move background.glb to `frontend-shared/public/models/`
2. Update references in all 3 frontend projects
3. Remove 3 duplicate copies
4. Test 3D rendering in all apps

**Validation**:
- Only 1 background.glb exists in codebase
- All frontends render 3D scene correctly

---

### Phase 3: Duplicate File Removal - Model Metadata (1 hour)

**Tasks**:
1. Audit all metadata JSON files (training_metadata.json, feature_*.json)
2. Identify canonical versions (models/ vs deliverables/)
3. Remove duplicates from deliverables/v1.0/models/
4. Update backend references if needed

**Validation**:
- 0 duplicate metadata files
- Backend loads metadata correctly

---

### Phase 4: Model Artifacts Optimization (1.5 hours)

**Tasks**:
1. Compare models/default vs models/test_phase2
2. Archive test_phase2 to `models/archive/`
3. Remove version_* duplicate joblibs
4. Update manifest.py to reference single source
5. Verify model loading in prediction service

**Expected Savings**: ~530MB (50% reduction)

**Validation**:
- Model inference works with consolidated artifacts
- Storage reduced to <500MB

---

### Phase 5: Frontend Deduplication - Shared Modules (2 hours)

**Tasks**:
1. Move schema.ts to frontend-shared/src/lib/api/
2. Move hyperspeedPresets.ts to frontend-shared/src/components/
3. Consolidate stores (routingStore.ts) via shared base
4. Update imports in prediction/training projects
5. Remove duplicate files
6. Run frontend tests

**Validation**:
- All frontend apps build successfully
- Shared modules imported correctly
- Tests pass

---

### Phase 6: Frontend Deduplication - Tests (1 hour)

**Tasks**:
1. Consolidate routing-groups.spec.ts to `tests/frontend/e2e/`
2. Remove duplicates from frontend-prediction/tests, frontend-training/tests
3. Update test runner configs
4. Run unified test suite

**Validation**:
- E2E tests pass from central location
- No duplicate test code

---

### Phase 7: Backend Security - JWT Hardening (0.5 hours)

**Tasks**:
1. Update backend/api/config.py: JWT_SECRET from environment
2. Add .env.example with placeholder
3. Update deployment docs
4. Verify auth flow with new secret

**Validation**:
- JWT_SECRET not hardcoded
- Auth tests pass

---

### Phase 8: Backend Implementation - Iterative Training (2 hours)

**Tasks**:
1. Implement `prepare_training_data()` in backend/iter_training/trainer.py
2. Add data validation logic
3. Implement evaluation metrics
4. Add unit tests
5. Update deployer.py with validation checks

**Validation**:
- No NotImplementedError raised
- Iterative training pipeline functional
- Tests cover new code

---

### Phase 9: Frontend Completion - Timeline Save (1 hour)

**Tasks**:
1. Implement save logic in TimelinePanel.tsx:28
2. Add IndexedDB persistence
3. Add save/load UI controls
4. Test timeline state recovery

**Validation**:
- TODO removed
- Timeline saves and restores correctly

---

### Phase 10: Log Cleanup (0.5 hours)

**Tasks**:
1. Create `logs/archive/` directory
2. Move logs older than 30 days to archive
3. Update .gitignore to exclude logs/archive
4. Keep only recent 10 logs in logs/

**Validation**:
- logs/ contains <10 active files
- Archive not tracked by git

---

### Phase 11: Deliverables Cleanup (1 hour)

**Tasks**:
1. Create `deliverables/archive/` structure by version
2. Move redundant deliverables to archive
3. Keep only latest v1.0 artifacts
4. Remove unused SQLite dump
5. Update README referencing deliverables

**Validation**:
- deliverables/ streamlined
- Active artifacts clearly identified

---

### Phase 12: Documentation Taxonomy (2 hours)

**Tasks**:
1. Audit all 513 docs files
2. Create directory structure: docs/active, docs/archive, docs/deprecated
3. Categorize and move files
4. Create docs/INDEX.md with hierarchy
5. Update root README to reference INDEX.md

**Expected Result**: <300 active docs

**Validation**:
- Clear documentation hierarchy
- INDEX.md navigable

---

### Phase 13: Frontend Store Refactoring (2 hours)

**Tasks**:
1. Split routingStore.ts into modular stores:
   - routingDataStore.ts
   - routingUIStore.ts
   - routingSelectionStore.ts
2. Update components to use new stores
3. Test state management

**Validation**:
- Each store <20KB
- All features work correctly

---

### Phase 14: .gitkeep Consolidation (0.25 hours)

**Tasks**:
1. Audit all 5+ .gitkeep files
2. Remove from directories with content
3. Keep only for essential empty dirs

**Validation**:
- Minimal .gitkeep files

---

### Phase 15: Final Validation & QA Report (1 hour)

**Tasks**:
1. Re-run full QA inspection script
2. Generate updated metrics
3. Verify all success criteria met
4. Create QA_REPORT_2025-10-22_100-percent-pass.md
5. Update work history

**Deliverables**:
- `deliverables/QA_REPORT_2025-10-22_100-percent-pass.md`
- `docs/work-history/2025-10-22_qa-100-percent-pass.md`

---

### Phase 16: Git Finalization & Monitor Rebuild (1 hour)

**Tasks**:
1. Determine RoutingMLMonitor version bump (likely v5.3.0 → v5.4.0 for minor cleanup)
2. Run monitor build validation sequence
3. Update spec file
4. Rebuild executable
5. Final commit and merge to main

**Validation**:
- All phases committed
- Monitor rebuilt and tested
- Work history complete

---

## Success Criteria

### Acceptance Criteria

**Must Have**:
- ✅ Zero duplicate files (measured by content hash)
- ✅ Model storage <500MB
- ✅ No NotImplementedError in codebase
- ✅ No TODO comments for Timeline save
- ✅ JWT secret from environment
- ✅ Logs/ <10 active files
- ✅ Docs/ <300 active files
- ✅ All existing tests pass
- ✅ New tests for iter_training

**Should Have**:
- Frontend store files <25KB each
- Test coverage >12%
- Build time reduced by 10%

**Won't Have** (Out of Scope):
- Complete test coverage (defer to future)
- PostgreSQL migration (separate project)
- Node_modules optimization (handled by package managers)

---

## Timeline Estimates

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| 1: Planning | 1h | None |
| 2: 3D Assets | 0.5h | Phase 1 |
| 3: Model Metadata | 1h | Phase 1 |
| 4: Model Artifacts | 1.5h | Phase 3 |
| 5: Frontend Shared | 2h | Phase 1 |
| 6: Frontend Tests | 1h | Phase 5 |
| 7: JWT Security | 0.5h | Phase 1 |
| 8: Iter Training | 2h | Phase 1 |
| 9: Timeline Save | 1h | Phase 5 |
| 10: Logs | 0.5h | Phase 1 |
| 11: Deliverables | 1h | Phase 1 |
| 12: Docs Taxonomy | 2h | Phase 1 |
| 13: Store Refactor | 2h | Phase 5 |
| 14: .gitkeep | 0.25h | Phase 1 |
| 15: Final QA | 1h | Phases 2-14 |
| 16: Git & Monitor | 1h | Phase 15 |

**Total Estimated Time**: ~18 hours
**Expected Completion**: 3 working days (6h/day)

---

## Risk Assessment

### High Risk

1. **Breaking Changes in Model Loading**
   - Mitigation: Test all prediction endpoints before/after
   - Rollback: Keep archived versions accessible

2. **Frontend Import Errors**
   - Mitigation: Incremental refactoring with build verification
   - Rollback: Git revert per phase

### Medium Risk

1. **Test Suite Failures**
   - Mitigation: Run tests after each phase
   - Fix immediately before next phase

2. **Storage Reduction Insufficient**
   - Mitigation: Analyze artifact sizes before deletion
   - Adjust archive strategy

### Low Risk

1. **Documentation Categorization Disputes**
   - Mitigation: User review of INDEX.md
   - Easy to reorganize

---

## Dependencies

**External**:
- None (all work internal to codebase)

**Internal**:
- All phases depend on Phase 1 (Planning) completion
- Phase 6 depends on Phase 5 (frontend structure)
- Phase 13 depends on Phase 5 (shared modules)
- Phase 15 depends on Phases 2-14 (all implementations)
- Phase 16 depends on Phase 15 (validation)

---

## Appendix

### QA Inspection Summary Reference

**Source**: User-provided QA report (2025-10-22)

**Key Metrics**:
- Total Lines: ~1,644,318 (data: 1,299,949)
- Code Lines: ~188,000
- Languages: Python 51,947 / TypeScript 95,478 / Markdown 116,964
- Test Lines: 9,236 (10.5% coverage)
- Model Assets: 1.06GB (89 files)
- Logs: 288 files, 3.1MB
- Deliverables: 141 files, 0.7MB
- Documentation: 513 files, 127,611 lines

**Critical Findings**:
1. Duplicate files: 15+ instances
2. Model redundancy: test_phase2 ≈ default
3. Frontend module replication: 3 projects, shared logic duplicated
4. Backend NotImplementedError: iter_training/trainer.py:63
5. Frontend TODO: TimelinePanel.tsx:28
6. Security: Default JWT secret
7. Asset accumulation: logs, deliverables not pruned

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Next Review**: After Phase 15 completion
