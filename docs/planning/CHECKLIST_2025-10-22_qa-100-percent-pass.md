# Checklist: QA 100% Pass - Codebase Optimization & Cleanup

**Date**: 2025-10-22
**Related PRD**: [docs/planning/PRD_2025-10-22_qa-100-percent-pass.md](docs/planning/PRD_2025-10-22_qa-100-percent-pass.md)
**Status**: In Progress
**Current Phase**: Phase 1
**Current Branch**: 251014

---

## Phase 1: Planning & Documentation

**Estimated Time**: 1 hour
**Status**: In Progress

### Tasks

- [x] Create PRD document
- [x] Create Checklist document
- [x] Review and approve plan with user (보안 Phase 7 skip 승인)

**Git Operations**:
- [ ] **Git staging completeness check** (required!)
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify → "Changes not staged" empty ✅
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] **Merge validation** (required!)
  - `git diff main..251014` verify ✅
  - No unexpected changes ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: Duplicate File Removal - 3D Assets

**Estimated Time**: 0.5 hours
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Verify all 4 background.glb locations:
  - frontend-home/background.glb
  - frontend-home/models/background.glb
  - frontend-prediction/public/models/background.glb
  - frontend-training/public/models/background.glb
- [ ] Create frontend-shared/public/models/ directory if not exists
- [ ] Move canonical background.glb to frontend-shared/public/models/
- [ ] Update frontend-home to import from frontend-shared
- [ ] Update frontend-prediction to import from frontend-shared
- [ ] Update frontend-training to import from frontend-shared
- [ ] Delete 3 duplicate background.glb files
- [ ] Test 3D rendering in frontend-home
- [ ] Test 3D rendering in frontend-prediction
- [ ] Test 3D rendering in frontend-training
- [ ] Verify only 1 background.glb in codebase (Glob search)

**Validation**:
```bash
# Should return only 1 file
find . -name "background.glb" -type f | wc -l
# Expected: 1
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify → "Changes not staged" empty ✅
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Duplicate File Removal - Model Metadata

**Estimated Time**: 1 hour
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Audit all training_metadata.json files:
  - deliverables/v1.0/models/default/training_metadata.json
  - deliverables/v1.0/models/training_metadata.json
  - models/training_metadata.json
- [ ] Audit all feature JSON files (feature_importance.json, feature_weights.json, etc.)
- [ ] Compare content hashes to identify exact duplicates
- [ ] Identify canonical version (models/ directory)
- [ ] Remove duplicates from deliverables/v1.0/models/default/
- [ ] Remove duplicates from deliverables/v1.0/models/
- [ ] Update backend references if needed (search codebase)
- [ ] Test backend model loading
- [ ] Verify metadata files load correctly in prediction service

**Validation**:
```bash
# Check for duplicate metadata files
find . -name "training_metadata.json" -type f
# Expected: Only in models/
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: Model Artifacts Optimization

**Estimated Time**: 1.5 hours
**Status**: Not Started
**Dependencies**: Phase 3

### Tasks

- [ ] Compare models/default/ vs models/test_phase2/:
  - similarity_engine.joblib
  - encoder.joblib
  - All other .joblib files
- [ ] Calculate file size differences
- [ ] Create models/archive/ directory
- [ ] Move entire models/test_phase2/ to models/archive/
- [ ] Remove models/version_* directories if duplicates
- [ ] Update models/manifest.py to reference models/default only
- [ ] Update backend config if test_phase2 referenced
- [ ] Test model loading in prediction service
- [ ] Test similarity engine functionality
- [ ] Verify storage reduction (should be ~530MB savings)

**Validation**:
```bash
# Check models directory size
du -sh models/
# Expected: <500MB (down from 1.06GB)

# Verify only default and archive exist
ls models/
# Expected: default/ archive/ manifest.py
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 4
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 5: Frontend Deduplication - Shared Modules

**Estimated Time**: 2 hours
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Verify frontend-shared directory structure
- [ ] Create frontend-shared/src/lib/api/ if not exists
- [ ] Move schema.ts to frontend-shared/src/lib/api/schema.ts (canonical from frontend-prediction)
- [ ] Create frontend-shared/src/components/hyperspeed/ if not exists
- [ ] Move hyperspeedPresets.ts to frontend-shared/src/components/hyperspeed/
- [ ] Update package.json in frontend-shared with exports
- [ ] Update frontend-prediction imports for schema.ts
- [ ] Update frontend-training imports for schema.ts
- [ ] Update frontend-prediction imports for hyperspeedPresets.ts
- [ ] Update frontend-training imports for hyperspeedPresets.ts
- [ ] Delete duplicate schema.ts from frontend-training
- [ ] Delete duplicate hyperspeedPresets.ts from frontend-prediction/training
- [ ] Build frontend-shared
- [ ] Build frontend-prediction (verify success)
- [ ] Build frontend-training (verify success)
- [ ] Run frontend-prediction tests
- [ ] Run frontend-training tests

**Validation**:
```bash
# Check for duplicate schema.ts
find frontend-* -name "schema.ts" -type f
# Expected: Only in frontend-shared

# Check builds
cd frontend-prediction && npm run build
cd frontend-training && npm run build
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 5
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 6: Frontend Deduplication - Tests

**Estimated Time**: 1 hour
**Status**: Not Started
**Dependencies**: Phase 5

### Tasks

- [ ] Verify tests/frontend/e2e/ directory exists
- [ ] Create if not exists
- [ ] Move routing-groups.spec.ts to tests/frontend/e2e/ (canonical version)
- [ ] Compare all 3 versions for differences:
  - frontend-prediction/tests/e2e/routing-groups.spec.ts
  - frontend-training/tests/e2e/routing-groups.spec.ts
  - tests/frontend/routingTimeline.spec.ts
- [ ] Merge any unique test cases into canonical version
- [ ] Delete duplicate from frontend-prediction/tests/e2e/
- [ ] Delete duplicate from frontend-training/tests/e2e/
- [ ] Update test runner configs to point to tests/frontend/e2e/
- [ ] Run consolidated test suite
- [ ] Verify all test cases pass

**Validation**:
```bash
# Check for duplicate test files
find . -name "routing-groups.spec.ts" -type f
# Expected: Only in tests/frontend/e2e/

# Run tests
npm run test:e2e
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 6
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 7: Backend Security - JWT Hardening

**Estimated Time**: 0.5 hours
**Status**: SKIPPED (사내망 전용, 보안 요구사항 면제)
**Dependencies**: Phase 1

### Tasks

- [ ] Locate JWT_SECRET in backend/api/config.py
- [ ] Replace hardcoded value with `os.getenv("JWT_SECRET", raise_error=True)`
- [ ] Create .env.example with JWT_SECRET=your-secret-here-change-in-production
- [ ] Update deployment documentation (README or docs/)
- [ ] Add JWT secret generation instructions
- [ ] Verify .env in .gitignore
- [ ] Test auth flow with environment variable
- [ ] Run backend auth tests
- [ ] Verify JWT token generation/validation works

**Validation**:
```bash
# Ensure JWT_SECRET not in code
grep -r "JWT_SECRET.*=" backend/api/config.py
# Should show only os.getenv call

# Test backend
cd backend && pytest tests/test_auth.py
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 7
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 8: Backend Implementation - Iterative Training

**Estimated Time**: 2 hours
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Read backend/iter_training/trainer.py current implementation
- [ ] Design prepare_training_data() logic:
  - Load historical routing data
  - Validate data quality
  - Feature extraction
  - Data splitting
- [ ] Implement prepare_training_data() replacing NotImplementedError
- [ ] Implement data validation checks
- [ ] Implement evaluation metrics calculation
- [ ] Add logging for data preparation steps
- [ ] Read backend/iter_training/deployer.py
- [ ] Add model validation checks in deployer.py
- [ ] Create tests/backend/test_iter_training.py
- [ ] Write unit tests for prepare_training_data
- [ ] Write unit tests for validation logic
- [ ] Run all backend tests
- [ ] Test end-to-end iterative training flow

**Validation**:
```bash
# Check for NotImplementedError
grep -r "NotImplementedError" backend/iter_training/
# Expected: None

# Run tests
pytest backend/iter_training/ -v
pytest tests/backend/test_iter_training.py -v
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 8
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 9: Frontend Completion - Timeline Save

**Estimated Time**: 1 hour
**Status**: Not Started
**Dependencies**: Phase 5

### Tasks

- [ ] Read frontend-prediction/src/components/TimelinePanel.tsx
- [ ] Locate TODO at line 28
- [ ] Design Timeline save architecture:
  - IndexedDB schema
  - Save trigger (auto-save vs manual)
  - Load on mount
- [ ] Implement IndexedDB persistence module
- [ ] Implement save functionality
- [ ] Implement load functionality
- [ ] Add UI controls (Save/Load buttons or auto-save indicator)
- [ ] Add error handling for storage failures
- [ ] Test timeline state save
- [ ] Test timeline state recovery after page reload
- [ ] Remove TODO comment
- [ ] Update tests to cover persistence

**Validation**:
```bash
# Check for TODO
grep -n "TODO" frontend-prediction/src/components/TimelinePanel.tsx
# Expected: None at line 28

# Manual test:
# 1. Open app, modify timeline
# 2. Save
# 3. Reload page
# 4. Verify timeline restored
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 9
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 10: Log Cleanup

**Estimated Time**: 0.5 hours
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Create logs/archive/ directory
- [ ] List all files in logs/ with timestamps
- [ ] Identify logs older than 30 days
- [ ] Move old logs to logs/archive/
- [ ] Keep only recent 10 logs in logs/
- [ ] Update .gitignore to exclude logs/archive/
- [ ] Verify logs/ contains <10 files
- [ ] Document log retention policy in README or docs/

**Validation**:
```bash
# Check log count
ls logs/*.log | wc -l
# Expected: <10

# Check archive
ls logs/archive/ | wc -l
# Expected: >0 (old logs moved)
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` (Note: logs/archive excluded by .gitignore) ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 10 (.gitignore update)
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 11: Deliverables Cleanup

**Estimated Time**: 1 hour
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Create deliverables/archive/ directory structure
- [ ] Audit all 141 files in deliverables/
- [ ] Identify redundant deliverables (older versions)
- [ ] Move older versions to deliverables/archive/vX.X/
- [ ] Keep only latest v1.0 artifacts in deliverables/
- [ ] Locate and review ?memory? SQLite dump
- [ ] Remove unused SQLite dump if confirmed unnecessary
- [ ] Update README to reference deliverables/ structure
- [ ] Document deliverable versioning strategy

**Validation**:
```bash
# Check deliverables count
find deliverables/ -type f | wc -l
# Expected: <50 (down from 141)

# Check archive
ls deliverables/archive/
# Expected: version directories
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 11
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 12: Documentation Taxonomy

**Estimated Time**: 2 hours
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Audit all 513 docs files
- [ ] Create taxonomy structure:
  - docs/active/ (current, maintained)
  - docs/archive/ (historical, reference)
  - docs/deprecated/ (obsolete, to be removed)
- [ ] Categorize each document by review date and relevance
- [ ] Move active docs to docs/active/
- [ ] Move archived docs to docs/archive/
- [ ] Move deprecated docs to docs/deprecated/
- [ ] Create docs/INDEX.md with hierarchical structure
- [ ] Add descriptions and last-update dates to INDEX.md
- [ ] Update root README.md to reference docs/INDEX.md
- [ ] Review with user for categorization approval

**Target**: <300 active docs

**Validation**:
```bash
# Check active docs count
find docs/active/ -type f | wc -l
# Expected: <300

# Verify INDEX exists
cat docs/INDEX.md
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 12
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 13: Frontend Store Refactoring

**Estimated Time**: 2 hours
**Status**: Not Started
**Dependencies**: Phase 5

### Tasks

- [ ] Read frontend-prediction/src/store/routingStore.ts (60-76KB)
- [ ] Analyze store sections:
  - Data management (routings, items)
  - UI state (selected nodes, filters)
  - Selection state (multi-select, active)
- [ ] Create routingDataStore.ts for data management
- [ ] Create routingUIStore.ts for UI state
- [ ] Create routingSelectionStore.ts for selection state
- [ ] Migrate logic from monolithic store to modular stores
- [ ] Update components to import from new stores
- [ ] Test all routing features in frontend-prediction
- [ ] Repeat for frontend-training/src/store/routingStore.ts if similar
- [ ] Run all frontend tests
- [ ] Verify each store <25KB

**Validation**:
```bash
# Check store sizes
ls -lh frontend-prediction/src/store/*.ts
# Expected: Each <25KB

# Build and test
cd frontend-prediction && npm run build && npm run test
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 13
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 14: .gitkeep Consolidation

**Estimated Time**: 0.25 hours
**Status**: Not Started
**Dependencies**: Phase 1

### Tasks

- [ ] Find all .gitkeep files in repository
- [ ] Review each directory containing .gitkeep
- [ ] Remove .gitkeep from directories with other content
- [ ] Keep .gitkeep only for essential empty directories (e.g., logs/, cache/)
- [ ] Verify git tracking of necessary empty directories

**Validation**:
```bash
# Find all .gitkeep
find . -name ".gitkeep" -type f
# Expected: <3 files (minimal)
```

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 14
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 15: Final Validation & QA Report

**Estimated Time**: 1 hour
**Status**: Not Started
**Dependencies**: Phases 2-14

### Tasks

- [ ] Re-run comprehensive file audit
- [ ] Count duplicate files (should be 0)
- [ ] Measure models/ directory size (should be <500MB)
- [ ] Count logs/ files (should be <10)
- [ ] Count deliverables/ files (should be <50)
- [ ] Count docs/active/ files (should be <300)
- [ ] Verify NotImplementedError count (should be 0)
- [ ] Verify TODO count for Timeline (should be 0)
- [ ] Run all backend tests
- [ ] Run all frontend tests
- [ ] Generate metrics report
- [ ] Create deliverables/QA_REPORT_2025-10-22_100-percent-pass.md
- [ ] Compare before/after metrics
- [ ] Verify all success criteria met

**Success Criteria Checklist**:
- [ ] Zero duplicate files (measured by content hash)
- [ ] Model storage <500MB
- [ ] No NotImplementedError in codebase
- [ ] No TODO comments for Timeline save
- [ ] JWT secret from environment
- [ ] Logs/ <10 active files
- [ ] Docs/ <300 active files
- [ ] All existing tests pass
- [ ] New tests for iter_training present

**Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 15 (QA Report)
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 16: Git Finalization & Monitor Rebuild

**Estimated Time**: 1 hour
**Status**: Not Started
**Dependencies**: Phase 15

### Tasks

- [ ] Review all changes since project start
- [ ] Determine RoutingMLMonitor version bump:
  - Current: v5.3.0
  - Recommended: v5.4.0 (Minor - cleanup features)
  - Reason: Documentation, cleanup, feature completion
- [ ] Update all Checklist progress to 100%
- [ ] Create work history document: docs/work-history/2025-10-22_qa-100-percent-pass.md
- [ ] Test monitor build: `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py` (10s minimum)
- [ ] Create old/ directory if not exists
- [ ] Backup old spec: `move RoutingMLMonitor_v5.3.0.spec old/`
- [ ] Copy new spec: `copy old\RoutingMLMonitor_v5.3.0.spec RoutingMLMonitor_v5.4.0.spec`
- [ ] Update spec file version references
- [ ] Rebuild monitor: `.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.4.0.spec`
- [ ] Verify dist/RoutingMLMonitor_v5.4.0.exe created (~12MB)
- [ ] Move exe to root: `move dist\RoutingMLMonitor_v5.4.0.exe .`
- [ ] Clean build artifacts: `rm -rf dist/* build/*`
- [ ] Test exe: `.\RoutingMLMonitor_v5.4.0.exe` (30s minimum, UI check)
- [ ] Final commit: "build: Rebuild monitor v5.4.0 - QA 100% pass complete"

**Final Git Operations**:
- [ ] **Git staging completeness check**
  - `git status` ✅
  - `git add -A` ✅
  - `git status` re-verify ✅
- [ ] Commit Phase 16 (Final)
- [ ] Push to 251014
- [ ] **Merge validation**
  - `git diff main..251014` verify ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1:  [▓▓▓▓▓] 100% (3/3 tasks) ✓
Phase 2:  [░░░░░] 0% (0/11 tasks)
Phase 3:  [░░░░░] 0% (0/9 tasks)
Phase 4:  [░░░░░] 0% (0/10 tasks)
Phase 5:  [░░░░░] 0% (0/17 tasks)
Phase 6:  [░░░░░] 0% (0/11 tasks)
Phase 7:  [SKIPPED] 사내망 전용
Phase 8:  [░░░░░] 0% (0/13 tasks)
Phase 9:  [░░░░░] 0% (0/12 tasks)
Phase 10: [░░░░░] 0% (0/8 tasks)
Phase 11: [░░░░░] 0% (0/9 tasks)
Phase 12: [░░░░░] 0% (0/11 tasks)
Phase 13: [░░░░░] 0% (0/11 tasks)
Phase 14: [░░░░░] 0% (0/5 tasks)
Phase 15: [░░░░░] 0% (0/14 tasks)
Phase 16: [░░░░░] 0% (0/16 tasks)

Total: [▓░░░░░░░░░] ~2% (3/160 tasks, excluding Phase 7)
```

---

## Acceptance Criteria

**Must Complete**:
- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged to main
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining
- [ ] RoutingMLMonitor rebuilt to v5.4.0
- [ ] QA Report shows 100% pass
- [ ] All success metrics achieved

**Quality Gates**:
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] No NotImplementedError in codebase
- [ ] No critical TODOs remaining
- [ ] Git history clean and complete

---

## Notes

- **Current branch**: 251014 (working branch)
- **Target branch**: main (merge after each phase)
- **Monitor version**: v5.3.0 → v5.4.0 (on completion)
- **Estimated total time**: 18 hours (~3 days @ 6h/day)

---

**Last Updated**: 2025-10-22
**Next Update**: After each phase completion
**Status**: Phase 1 in progress
