# Checklist: Move Training Menus to Training Frontend

**Date**: 2025-10-23
**Related PRD**: [PRD_2025-10-23_move-training-menus-to-training-frontend.md](PRD_2025-10-23_move-training-menus-to-training-frontend.md)
**Status**: Not Started
**Priority**: P1 (High)
**Branch**: 251014

---

## Phase 1: Preparation & Analysis (40 min)

**Goal**: Understand component dependencies and prepare for migration

### Tasks

- [ ] 1.1 Read `frontend-prediction/src/components/quality/QualityDashboard.tsx`
- [ ] 1.2 Read `frontend-prediction/src/components/training/TrainingMonitor.tsx`
- [ ] 1.3 Read `frontend-prediction/src/components/settings/IterTrainingSettings.tsx`
- [ ] 1.4 Read `frontend-prediction/src/components/quality/LogViewer.tsx`
- [ ] 1.5 Document store dependencies (useWorkspaceStore, useAuthStore, etc.)
- [ ] 1.6 Document shared component dependencies
- [ ] 1.7 Document API endpoint dependencies
- [ ] 1.8 Verify frontend-training has all required stores
- [ ] 1.9 Create dependency checklist document

**Estimated Time**: 40 minutes
**Status**: Not Started

**Completion Criteria**:
- All 4 components analyzed
- Dependencies documented
- No missing stores identified

---

## Phase 2: Copy Components to frontend-training (60 min)

**Goal**: Copy all training components with dependencies to frontend-training

### Tasks

#### Directory Setup
- [ ] 2.1 Create `frontend-training/src/components/quality/` directory
- [ ] 2.2 Create `frontend-training/src/components/training/` directory
- [ ] 2.3 Create `frontend-training/src/components/settings/` directory

#### Copy Components
- [ ] 2.4 Copy `QualityDashboard.tsx` to frontend-training
- [ ] 2.5 Copy `TrainingMonitor.tsx` to frontend-training
- [ ] 2.6 Copy `IterTrainingSettings.tsx` to frontend-training
- [ ] 2.7 Copy `LogViewer.tsx` to frontend-training

#### Fix Imports
- [ ] 2.8 Update import paths in `QualityDashboard.tsx`
- [ ] 2.9 Update import paths in `TrainingMonitor.tsx`
- [ ] 2.10 Update import paths in `IterTrainingSettings.tsx`
- [ ] 2.11 Update import paths in `LogViewer.tsx`

#### Copy Dependencies (if needed)
- [ ] 2.12 Copy shared components used by training components
- [ ] 2.13 Copy utility functions
- [ ] 2.14 Copy types/interfaces

#### Verification
- [ ] 2.15 Run TypeScript check: `npm run type-check` in frontend-training
- [ ] 2.16 Verify no TypeScript errors
- [ ] 2.17 Verify all imports resolve correctly

**Estimated Time**: 60 minutes
**Status**: Not Started

**Completion Criteria**:
- All 4 components copied
- All import paths fixed
- TypeScript check passes
- No compilation errors

---

## Phase 3: Update frontend-training App.tsx (40 min)

**Goal**: Add training menu navigation to frontend-training

### Tasks

#### Read Current Structure
- [ ] 3.1 Read `frontend-training/src/App.tsx` (full file)
- [ ] 3.2 Identify NAVIGATION_CONFIG location
- [ ] 3.3 Identify switch statement location

#### Add Navigation Items
- [ ] 3.4 Add `quality-monitor` to NAVIGATION_CONFIG
- [ ] 3.5 Add `training-monitor` to NAVIGATION_CONFIG
- [ ] 3.6 Add `training-settings` to NAVIGATION_CONFIG
- [ ] 3.7 Add `log-viewer` to NAVIGATION_CONFIG

#### Add Lazy Imports
- [ ] 3.8 Add `QualityDashboard` lazy import
- [ ] 3.9 Add `TrainingMonitor` lazy import
- [ ] 3.10 Add `IterTrainingSettings` lazy import
- [ ] 3.11 Add `LogViewer` lazy import

#### Add Switch Cases
- [ ] 3.12 Add `case "quality-monitor"` with QualityDashboard workspace
- [ ] 3.13 Add `case "training-monitor"` with TrainingMonitor workspace
- [ ] 3.14 Add `case "training-settings"` with IterTrainingSettings workspace
- [ ] 3.15 Add `case "log-viewer"` with LogViewer workspace

#### Verification
- [ ] 3.16 Run TypeScript check: `npm run type-check`
- [ ] 3.17 Start dev server: `npm run dev`
- [ ] 3.18 Verify 4 new menus appear in UI (browser test)
- [ ] 3.19 Test navigation to each menu (browser test)
- [ ] 3.20 Verify no console errors

**Estimated Time**: 40 minutes
**Status**: Not Started

**Completion Criteria**:
- 4 new menus visible in frontend-training
- All navigation works
- No TypeScript errors
- No console errors

---

## Phase 4: Remove from frontend-prediction (20 min)

**Goal**: Remove training menus from frontend-prediction

### Tasks

#### Remove Navigation Items
- [ ] 4.1 Remove `quality-monitor` from NAVIGATION_CONFIG (Lines 82-87)
- [ ] 4.2 Remove `training-monitor` from NAVIGATION_CONFIG (Lines 88-94)
- [ ] 4.3 Remove `training-settings` from NAVIGATION_CONFIG (Lines 96-101)
- [ ] 4.4 Remove `log-viewer` from NAVIGATION_CONFIG (Lines 103-108)

#### Remove Lazy Imports
- [ ] 4.5 Remove `QualityDashboard` import (Line 17)
- [ ] 4.6 Remove `TrainingMonitor` import (Line 18)
- [ ] 4.7 Remove `IterTrainingSettings` import (Line 19)
- [ ] 4.8 Remove `LogViewer` import (Line 20)

#### Remove Switch Cases
- [ ] 4.9 Remove `case "quality-monitor"` (Lines ~369-371)
- [ ] 4.10 Remove `case "training-monitor"` (Lines ~372-374)
- [ ] 4.11 Remove `case "training-settings"` (Lines ~375-377)
- [ ] 4.12 Remove `case "log-viewer"` (Lines ~378-380)

#### Verification
- [ ] 4.13 Run TypeScript check: `npm run type-check`
- [ ] 4.14 Restart dev server
- [ ] 4.15 Verify only 6 prediction menus appear
- [ ] 4.16 Verify no console errors
- [ ] 4.17 Test navigation to remaining menus

**Estimated Time**: 20 minutes
**Status**: Not Started

**Completion Criteria**:
- Only 6 prediction menus visible
- No TypeScript errors
- No console errors
- All remaining menus work

---

## Phase 5: Testing & Validation (40 min)

**Goal**: Comprehensive testing of both applications

### Tasks

#### frontend-prediction Testing (https://localhost:5173)
- [ ] 5.1 Navigate to "라우팅 생성" menu
- [ ] 5.2 Navigate to "마스터 데이터" menu
- [ ] 5.3 Navigate to "라우팅 구성" menu
- [ ] 5.4 Navigate to "데이터 관계 매핑" menu
- [ ] 5.5 Navigate to "프로필 관리" menu
- [ ] 5.6 Navigate to "데이터 품질 대시보드" menu
- [ ] 5.7 Verify no training menus appear
- [ ] 5.8 Check console for errors (should be 0)
- [ ] 5.9 Check Network tab for failed requests

#### frontend-training Testing (https://localhost:5174)
- [ ] 5.10 Navigate to "품질 모니터링" menu (NEW)
- [ ] 5.11 Navigate to "훈련 모니터" menu (NEW)
- [ ] 5.12 Navigate to "훈련 설정" menu (NEW)
- [ ] 5.13 Navigate to "로그 뷰어" menu (NEW)
- [ ] 5.14 Verify components render without errors
- [ ] 5.15 Test API calls work (check Network tab)
- [ ] 5.16 Check console for errors (should be 0)
- [ ] 5.17 Test existing Tensorboard features still work

#### Cross-App Testing
- [ ] 5.18 Switch between both apps (different ports)
- [ ] 5.19 Verify both login/auth work
- [ ] 5.20 Verify no cross-contamination of state

**Estimated Time**: 40 minutes
**Status**: Not Started

**Completion Criteria**:
- All 6 prediction menus work (5173)
- All 4 training menus work (5174)
- No console errors in either app
- No failed API requests
- Clean browser console

---

## Phase 6: Git Workflow (20 min)

**Goal**: Commit and merge changes following WORKFLOW_DIRECTIVES

### Tasks

#### Git Staging
- [ ] 6.1 Run `git status` to review changes
- [ ] 6.2 Run `git add -A` to stage all changes
- [ ] 6.3 Run `git status` again to verify staging completeness
- [ ] 6.4 Verify "Changes not staged" section is empty

#### Git Commit
- [ ] 6.5 Create detailed commit message with file list
- [ ] 6.6 Run `git commit` with full message
- [ ] 6.7 Verify commit success

#### Git Push and Merge
- [ ] 6.8 Push to 251014: `git push origin 251014`
- [ ] 6.9 Checkout main: `git checkout main`
- [ ] 6.10 Merge 251014: `git merge 251014 -m "Merge 251014: Move training menus to training frontend"`
- [ ] 6.11 Push main: `git push origin main`
- [ ] 6.12 Return to 251014: `git checkout 251014`
- [ ] 6.13 Verify clean working tree: `git status`

**Estimated Time**: 20 minutes
**Status**: Not Started

**Completion Criteria**:
- All changes committed
- 251014 pushed
- main merged and pushed
- Back on 251014 branch
- `git status` shows "nothing to commit, working tree clean"

---

## Progress Tracking

```
Phase 1: [░░░░░] 0% (0/9 tasks)
Phase 2: [░░░░░] 0% (0/17 tasks)
Phase 3: [░░░░░] 0% (0/13 tasks)
Phase 4: [░░░░░] 0% (0/13 tasks)
Phase 5: [░░░░░] 0% (0/13 tasks)
Phase 6: [░░░░░] 0% (0/13 tasks)

Total: [░░░░░░░░░░] 0% (0/78 tasks)
```

---

## Acceptance Criteria

### Must Have ✅
- [ ] All tasks completed and marked [x]
- [ ] frontend-prediction shows only 6 menus
- [ ] frontend-training shows 4 new training menus
- [ ] No TypeScript compilation errors
- [ ] No console runtime errors
- [ ] All menus navigate correctly
- [ ] Git workflow completed successfully
- [ ] Working tree clean

### Should Have
- [ ] All components copied correctly
- [ ] Import paths all correct
- [ ] Loading states work
- [ ] Error boundaries work

### Nice to Have
- [ ] Documentation updated
- [ ] Screenshots captured
- [ ] Performance verified

---

## Files Modified (Expected)

### frontend-prediction
- `src/App.tsx` - Remove 4 training menus

### frontend-training
- `src/App.tsx` - Add 4 training menus
- `src/components/quality/QualityDashboard.tsx` - NEW
- `src/components/training/TrainingMonitor.tsx` - NEW
- `src/components/settings/IterTrainingSettings.tsx` - NEW
- `src/components/quality/LogViewer.tsx` - NEW
- (+ any dependency files)

### Documentation
- `docs/planning/PRD_2025-10-23_move-training-menus-to-training-frontend.md`
- `docs/planning/CHECKLIST_2025-10-23_move-training-menus-to-training-frontend.md`

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase completion
**Estimated Total Time**: 3h 40m (including buffer)
