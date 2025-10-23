# PRD: Move Training Menus to Training Frontend

**Date**: 2025-10-23
**Priority**: P1 (High)
**Status**: Planning
**Related Task**: Menu reorganization for better separation of concerns

---

## Executive Summary

Move all training-related menu items from **frontend-prediction** to **frontend-training** to improve application architecture and user experience. This separation ensures that prediction-focused users and training-focused users have dedicated interfaces.

### Quick Facts
- **Affected Apps**: frontend-prediction, frontend-training
- **Menus to Move**: 4 items (quality-monitor, training-monitor, training-settings, log-viewer)
- **Estimated Time**: 2-3 hours
- **Breaking Changes**: None (menu items will be available in training frontend)

---

## Problem Statement

### Current State
Currently, **frontend-prediction** (https://localhost:5173) includes both prediction AND training-related menus:
- Prediction menus: routing, master-data, routing-config, data-relationship, profile-management, data-quality
- **Training menus**: quality-monitor, training-monitor, training-settings, log-viewer

### Issues
1. **Confusion**: Prediction users see training menus they don't need
2. **Cluttered UI**: Too many menu items in one app
3. **Wrong separation**: Training functionality is in prediction app
4. **Maintenance burden**: Two different concerns mixed in one codebase

### Desired State
- **frontend-prediction** (5173): Only prediction-related menus
- **frontend-training** (5174): All training-related menus + existing tensorboard features

---

## Goals and Objectives

### Primary Goals
1. ✅ Remove 4 training menus from frontend-prediction
2. ✅ Add 4 training menus to frontend-training
3. ✅ Preserve all functionality (no features lost)
4. ✅ Maintain consistent UI/UX across both apps

### Success Criteria
- [ ] frontend-prediction shows only 6 prediction menus
- [ ] frontend-training shows 4 new training menus + existing features
- [ ] All menu navigation works correctly
- [ ] No console errors or broken links
- [ ] Backend API remains unchanged

---

## Requirements

### Functional Requirements

#### FR-1: Remove Training Menus from frontend-prediction
**Location**: `frontend-prediction/src/App.tsx`

Remove these 4 items from NAVIGATION_CONFIG:
1. `quality-monitor` (Line 82-87)
2. `training-monitor` (Line 88-94)
3. `training-settings` (Line 96-101)
4. `log-viewer` (Line 103-108)

**Components to Remove**:
- `QualityDashboard` lazy import (Line 17)
- `TrainingMonitor` lazy import (Line 18)
- `IterTrainingSettings` lazy import (Line 19)
- `LogViewer` lazy import (Line 20)

**Switch cases to Remove** (Lines 369-380):
```typescript
case "quality-monitor":
  workspace = <Suspense fallback={loadingFallback}><QualityDashboard /></Suspense>;
  break;
case "training-monitor":
  workspace = <Suspense fallback={loadingFallback}><TrainingMonitor /></Suspense>;
  break;
case "training-settings":
  workspace = <Suspense fallback={loadingFallback}><IterTrainingSettings /></Suspense>;
  break;
case "log-viewer":
  workspace = <Suspense fallback={loadingFallback}><LogViewer /></Suspense>;
  break;
```

#### FR-2: Add Training Menus to frontend-training
**Location**: `frontend-training/src/App.tsx`

Add these 4 items to NAVIGATION_CONFIG:
1. quality-monitor
2. training-monitor
3. training-settings
4. log-viewer

Import required components from frontend-prediction (copy or shared):
- QualityDashboard
- TrainingMonitor
- IterTrainingSettings
- LogViewer

#### FR-3: Shared Components Strategy
**Decision**: Copy components to frontend-training (not shared library)
**Reason**: Each frontend app should be independent

**Components to Copy**:
```
frontend-prediction/src/components/
├── quality/QualityDashboard.tsx
├── training/TrainingMonitor.tsx
├── settings/IterTrainingSettings.tsx
└── quality/LogViewer.tsx
```

Copy to:
```
frontend-training/src/components/
├── quality/QualityDashboard.tsx
├── training/TrainingMonitor.tsx
├── settings/IterTrainingSettings.tsx
└── quality/LogViewer.tsx
```

#### FR-4: Store and State Management
**Check if these components use any stores**:
- useWorkspaceStore
- useAuthStore
- Any training-specific stores

**Action**: Ensure frontend-training has all required stores

---

## Phase Breakdown

### Phase 1: Preparation & Analysis (30 min)
**Goal**: Understand component dependencies

Tasks:
1. Read all 4 component files
2. Identify store dependencies
3. Identify shared component dependencies
4. Check API endpoint usage
5. Document copy requirements

**Deliverables**:
- List of all dependencies per component
- List of stores to verify in frontend-training
- List of shared components to copy

### Phase 2: Copy Components to frontend-training (45 min)
**Goal**: Copy all 4 training components with dependencies

Tasks:
1. Create directories in frontend-training
2. Copy QualityDashboard.tsx + dependencies
3. Copy TrainingMonitor.tsx + dependencies
4. Copy IterTrainingSettings.tsx + dependencies
5. Copy LogViewer.tsx + dependencies
6. Update import paths
7. Verify no TypeScript errors

**Deliverables**:
- 4 components copied and compiling
- All import paths fixed
- No TS errors in frontend-training

### Phase 3: Update frontend-training App.tsx (30 min)
**Goal**: Add training menus to frontend-training navigation

Tasks:
1. Read frontend-training/src/App.tsx
2. Add 4 new navigation items to NAVIGATION_CONFIG
3. Add lazy imports for 4 components
4. Add switch cases for 4 workspaces
5. Verify navigation rendering

**Deliverables**:
- 4 new menus visible in frontend-training
- Navigation works (no errors)

### Phase 4: Remove from frontend-prediction (15 min)
**Goal**: Remove training menus from frontend-prediction

Tasks:
1. Remove 4 navigation items from NAVIGATION_CONFIG
2. Remove 4 lazy imports
3. Remove 4 switch cases
4. Remove unused component files (optional, can keep for reference)

**Deliverables**:
- Only 6 prediction menus visible
- No TypeScript errors
- App compiles successfully

### Phase 5: Testing & Validation (30 min)
**Goal**: Verify both apps work correctly

Tasks:
1. Test frontend-prediction (5173)
   - All 6 menus navigate correctly
   - No console errors
   - No broken imports
2. Test frontend-training (5174)
   - All 4 new menus navigate correctly
   - Components render without errors
   - API calls work
3. Cross-browser test (Chrome, Edge)

**Deliverables**:
- Both apps run without errors
- All menus functional
- Test results documented

### Phase 6: Git Workflow (15 min)
**Goal**: Commit and merge changes

Tasks:
1. git add -A
2. git status (verify all changes staged)
3. git commit (detailed message)
4. git push origin 251014
5. git checkout main && git merge 251014
6. git push origin main
7. git checkout 251014

**Deliverables**:
- Clean git status
- Changes merged to main

---

## Timeline Estimates

| Phase | Estimated Time | Buffer | Total |
|-------|---------------|--------|-------|
| Phase 1 | 30 min | 10 min | 40 min |
| Phase 2 | 45 min | 15 min | 60 min |
| Phase 3 | 30 min | 10 min | 40 min |
| Phase 4 | 15 min | 5 min | 20 min |
| Phase 5 | 30 min | 10 min | 40 min |
| Phase 6 | 15 min | 5 min | 20 min |
| **Total** | **2h 45m** | **55m** | **3h 40m** |

---

## Technical Specifications

### Menu Items to Move

```typescript
// FROM frontend-prediction/src/App.tsx
const TRAINING_MENUS = [
  {
    key: "quality-monitor",
    id: "quality-monitor",
    label: "품질 모니터링",
    description: "Iterative Training 품질 추세와 알림을 확인합니다.",
    icon: <Activity size={18} />,
  },
  {
    key: "training-monitor",
    id: "training-monitor",
    label: "훈련 모니터",
    description: "Iterative Training 진행 상태를 추적합니다.",
    icon: <Activity size={18} />,
  },
  {
    key: "training-settings",
    id: "training-settings",
    label: "훈련 설정",
    description: "Iterative Training 파이프라인 파라미터를 조정합니다.",
    icon: <Settings2 size={18} />,
  },
  {
    key: "log-viewer",
    id: "log-viewer",
    label: "로그 뷰어",
    description: "훈련 및 예측 관련 로그를 조회합니다.",
    icon: <Activity size={18} />,
  },
];
```

### Components to Copy

```typescript
// Lazy imports to copy to frontend-training
const QualityDashboard = lazy(() => import("@components/quality/QualityDashboard").then(m => ({ default: m.QualityDashboard })));
const TrainingMonitor = lazy(() => import("@components/training/TrainingMonitor").then(m => ({ default: m.TrainingMonitor })));
const IterTrainingSettings = lazy(() => import("@components/settings/IterTrainingSettings").then(m => ({ default: m.IterTrainingSettings })));
const LogViewer = lazy(() => import("@components/quality/LogViewer").then(m => ({ default: m.LogViewer })));
```

---

## Risks and Mitigations

### Risk 1: Missing Dependencies
**Probability**: Medium
**Impact**: High
**Mitigation**: Phase 1 dependency analysis will catch all required imports

### Risk 2: Store Incompatibility
**Probability**: Low
**Impact**: Medium
**Mitigation**: Verify all stores exist in frontend-training, copy if needed

### Risk 3: API Endpoint Differences
**Probability**: Low
**Impact**: Low
**Mitigation**: Both apps use same backend (port 8000), no changes needed

### Risk 4: Broken Navigation After Removal
**Probability**: Low
**Impact**: Medium
**Mitigation**: Phase 5 testing will catch navigation issues

---

## Acceptance Criteria

### Must Have
- [ ] frontend-prediction shows only 6 menus (no training menus)
- [ ] frontend-training shows 4 new training menus
- [ ] All 4 components work in frontend-training
- [ ] No TypeScript compilation errors
- [ ] No console runtime errors
- [ ] All menus navigate correctly
- [ ] Git workflow completed successfully

### Should Have
- [ ] Component code is identical (copied correctly)
- [ ] Import paths are correct
- [ ] Loading states work correctly
- [ ] Error boundaries work

### Nice to Have
- [ ] Shared components refactored to frontend-shared (future optimization)
- [ ] Documentation updated
- [ ] Screenshots of new UI

---

## Post-Implementation

### Validation Checklist
1. ✅ Frontend-prediction shows 6 menus only
2. ✅ Frontend-training shows 4 new training menus
3. ✅ All navigation works without errors
4. ✅ No console errors in either app
5. ✅ Git history is clean and documented

### Follow-up Tasks
- Consider creating frontend-shared library for truly shared components
- Update user documentation
- Update deployment scripts if needed

---

## References

- **WORKFLOW_DIRECTIVES**: `.claude/WORKFLOW_DIRECTIVES.md`
- **Current Prediction App**: `frontend-prediction/src/App.tsx`
- **Current Training App**: `frontend-training/src/App.tsx`
- **Components**: `frontend-prediction/src/components/`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Author**: Claude Code
**Approved By**: [Pending User Review]
