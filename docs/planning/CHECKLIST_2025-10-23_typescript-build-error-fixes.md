# Checklist: TypeScript Build Error Fixes

**Date**: 2025-10-23
**Related PRD**: docs/planning/PRD_2025-10-23_typescript-build-error-fixes.md
**Status**: In Progress
**Priority**: 🔴 CRITICAL
**Branch**: 251014

---

## Phase 1: RoutingCanvas.tsx Props Fix

### Tasks

#### 1.1 Update CanvasViewProps Interface

- [ ] Add `connections` array prop to CanvasViewProps interface
- [ ] Add `addConnection` function prop to CanvasViewProps interface
- [ ] Add `removeConnection` function prop to CanvasViewProps interface
- [ ] Add `updateConnection` function prop to CanvasViewProps interface
- [ ] Add `setSelectedConnection` function prop to CanvasViewProps interface
- [ ] Verify prop types match routingStore return types

**Location**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:285-294`

#### 1.2 Update RoutingCanvasView Function Signature

- [ ] Add `connections` parameter to RoutingCanvasView destructuring
- [ ] Add `addConnection` parameter to RoutingCanvasView destructuring
- [ ] Add `removeConnection` parameter to RoutingCanvasView destructuring
- [ ] Add `updateConnection` parameter to RoutingCanvasView destructuring
- [ ] Add `setSelectedConnection` parameter to RoutingCanvasView destructuring

**Location**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:296-309`

#### 1.3 Rename Variable References

- [ ] Replace `setSelectedConnectionStore` with `setSelectedConnection` (Line 548)
- [ ] Replace `setSelectedConnectionStore` with `setSelectedConnection` (Line 550)
- [ ] Replace `setSelectedConnectionStore` with `setSelectedConnection` (Line 553)
- [ ] Replace `setSelectedConnectionStore` with `setSelectedConnection` (Line 565)
- [ ] Replace `setSelectedConnectionStore` with `setSelectedConnection` (Line 569)
- [ ] Replace `setSelectedConnectionStore` with `setSelectedConnection` (Line 600)
- [ ] Update dependency arrays to use `setSelectedConnection` (Line 553, 575, 631)

**Note**: Variable name standardization from `setSelectedConnectionStore` → `setSelectedConnection`

#### 1.4 Update RoutingCanvas to Pass Props

- [ ] Verify `connections` is extracted from useRoutingStore (Line 819)
- [ ] Verify `addConnection` is extracted from useRoutingStore (Line 824)
- [ ] Verify `removeConnection` is extracted from useRoutingStore (Line 825)
- [ ] Verify `updateConnection` is extracted from useRoutingStore (Line 826)
- [ ] Verify `setSelectedConnection` is extracted from useRoutingStore (Line 827)
- [ ] Pass `connections` prop to RoutingCanvasView
- [ ] Pass `addConnection` prop to RoutingCanvasView
- [ ] Pass `removeConnection` prop to RoutingCanvasView
- [ ] Pass `updateConnection` prop to RoutingCanvasView
- [ ] Pass `setSelectedConnection` prop to RoutingCanvasView

**Location**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:817-850`

#### 1.5 Fix timeCv Null Check

- [ ] Add undefined check to `step.timeCv` conditional (Line 60)
- [ ] Verify timeCvPercent calculation handles null and undefined

**Location**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:60`

#### 1.6 Fix ConnectionLineType

- [ ] Investigate ConnectionLineType enum values from reactflow
- [ ] Update "bezier" to correct ConnectionLineType value (Line 793)

**Location**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx:793`

#### 1.7 Verification

- [ ] Run `npx tsc --noEmit` to check TypeScript errors
- [ ] Verify RoutingCanvas.tsx errors reduced from 24 to 0
- [ ] Verify no new TypeScript errors introduced

**Estimated Time**: 45-60 minutes
**Status**: Not Started

### Git Operations

- [ ] Git staging completeness check (git status → git add -A → git status)
- [ ] Commit Phase 1: "fix: Resolve RoutingCanvas TypeScript errors (24 → 0)"
- [ ] Push to 251014
- [ ] Merge verification (git diff main..251014)
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: Type Safety Fixes

### Tasks

#### 2.1 Fix DataOutputWorkspace.tsx

- [ ] Change `mapping.defaultValue` to `mapping.default_value` (Line 61)
- [ ] Verify property exists in OutputProfileMapping type
- [ ] Test DataOutputWorkspace component renders without errors

**Location**: `frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx:61`
**Error**: `TS2551: Property 'defaultValue' does not exist`

#### 2.2 Fix OptionsWorkspace.test.tsx

- [ ] Change `mockContext = null` to `mockContext = undefined` (Line 31)
- [ ] Or add explicit type: `Record<string, unknown> | undefined`
- [ ] Verify test file compiles without errors

**Location**: `frontend-prediction/src/components/workspaces/__tests__/OptionsWorkspace.test.tsx:31`
**Error**: `TS2322: Type 'null' is not assignable`

#### 2.3 Fix AlgorithmWorkspace.audit.test.tsx

- [ ] Read `@lib/apiClient` to check WorkflowConfigResponse export
- [ ] Change to default import if needed: `import WorkflowConfigResponse from ...`
- [ ] Or fix named export in apiClient.ts if missing
- [ ] Verify import resolves correctly

**Location**: `tests/frontend-prediction/workspaces/AlgorithmWorkspace.audit.test.tsx:10`
**Error**: `TS2614: Module has no exported member 'WorkflowConfigResponse'`

#### 2.4 Fix AlgorithmWorkspace.tsx (frontend-shared) - reactflow

- [ ] Check package.json for reactflow package name and version
- [ ] Update import statement to correct package name
- [ ] Options: `reactflow`, `@xyflow/react`, or other
- [ ] Verify module resolves in frontend-shared context

**Location**: `frontend-shared/src/components/workspaces/AlgorithmWorkspace.tsx:34`
**Error**: `TS2307: Cannot find module 'reactflow'`

#### 2.5 Fix AlgorithmWorkspace.tsx (frontend-shared) - ref type

- [ ] Add type annotation to `ref` parameter: `ref: HTMLElement | null`
- [ ] Or use appropriate React ref type if different
- [ ] Verify type matches actual usage

**Location**: `frontend-shared/src/components/workspaces/AlgorithmWorkspace.tsx:127`
**Error**: `TS7006: Parameter 'ref' implicitly has an 'any' type`

#### 2.6 Verification

- [ ] Run `npx tsc --noEmit` to check all TypeScript errors
- [ ] Verify total errors reduced to 0
- [ ] Check no new errors introduced

**Estimated Time**: 30-45 minutes
**Status**: Not Started

### Git Operations

- [ ] Git staging completeness check (git status → git add -A → git status)
- [ ] Commit Phase 2: "fix: Resolve type safety issues (6 errors)"
- [ ] Push to 251014
- [ ] Merge verification (git diff main..251014)
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Verification & Documentation

### Tasks

#### 3.1 Build Verification

- [ ] Run `npm run build` in frontend-prediction directory
- [ ] Verify exit code is 0
- [ ] Verify no TypeScript compilation errors in output
- [ ] Check build output size is reasonable

**Expected Output**: `✓ built in XXXms`

#### 3.2 Type Check Verification

- [ ] Run `npx tsc --noEmit` in frontend-prediction directory
- [ ] Verify 0 errors
- [ ] Capture clean output for documentation

**Expected Output**: No errors, exit code 0

#### 3.3 Runtime Verification

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to routing workspace in browser
- [ ] Verify RoutingCanvas component renders
- [ ] Test connection creation (drag from node to node)
- [ ] Test connection deletion (select edge, press Delete key)
- [ ] Test connection reconnection (drag edge endpoint)
- [ ] Verify no console errors during interaction
- [ ] Verify DataOutputWorkspace renders (test default_value fix)

#### 3.4 Metrics Collection

- [ ] Record final TypeScript error count: 0
- [ ] Record build time (compare to baseline if available)
- [ ] Record number of files changed
- [ ] Record lines of code changed

#### 3.5 Documentation

- [ ] Create work history document: `docs/work-history/2025-10-23_typescript-build-error-fixes.md`
- [ ] Document error analysis and root causes
- [ ] Document solutions applied per file
- [ ] Include before/after TypeScript error count
- [ ] Include Git commit history
- [ ] Add "Lessons Learned" section

**Estimated Time**: 15-20 minutes
**Status**: Not Started

### Git Operations

- [ ] Git staging completeness check (if any changes)
- [ ] Commit Phase 3: "docs: Add work history for TypeScript error fixes" (if applicable)
- [ ] Push to 251014 (if applicable)
- [ ] Merge to main (if applicable)
- [ ] Push main (if applicable)
- [ ] Return to 251014
- [ ] Final verification: `git status` shows clean working tree

---

## Progress Tracking

```
Phase 1 (RoutingCanvas): [░░░░░░░░░░] 0% (0/33 tasks)
Phase 2 (Type Safety):   [░░░░░░░░░░] 0% (0/18 tasks)
Phase 3 (Verification):  [░░░░░░░░░░] 0% (0/14 tasks)

Total:                   [░░░░░░░░░░] 0% (0/65 tasks)

Git Operations:          [░░░░░░░░░░] 0% (0/18 checkpoints)
```

---

## Acceptance Criteria

### Phase 1 Complete

- [ ] CanvasViewProps interface has 5 new connection props
- [ ] RoutingCanvasView function signature updated
- [ ] All `setSelectedConnectionStore` renamed to `setSelectedConnection`
- [ ] RoutingCanvas passes all 5 connection props
- [ ] timeCv null check includes undefined
- [ ] ConnectionLineType error resolved
- [ ] RoutingCanvas.tsx TypeScript errors = 0

### Phase 2 Complete

- [ ] DataOutputWorkspace uses `default_value` property
- [ ] OptionsWorkspace.test.tsx type assertion fixed
- [ ] AlgorithmWorkspace.audit.test.tsx import corrected
- [ ] AlgorithmWorkspace.tsx reactflow import fixed
- [ ] AlgorithmWorkspace.tsx ref type annotated
- [ ] Total TypeScript errors = 0

### Phase 3 Complete

- [ ] `npm run build` succeeds with exit code 0
- [ ] `npx tsc --noEmit` shows 0 errors
- [ ] Dev server starts without compilation errors
- [ ] RoutingCanvas renders and functions correctly
- [ ] Connection operations work (create, delete, reconnect)
- [ ] DataOutputWorkspace renders without errors
- [ ] Work history document created and committed

---

## Final Acceptance Criteria

### Must Complete

- [ ] All 65 tasks marked as [x]
- [ ] All 18 Git checkpoints completed
- [ ] TypeScript errors reduced from 30 → 0
- [ ] Build process successful
- [ ] No runtime regressions
- [ ] Work history documented

### Quality Gates

- [ ] TypeScript strict mode passes
- [ ] No `any` types introduced
- [ ] All existing tests pass
- [ ] Code follows existing patterns
- [ ] Git working tree clean
- [ ] WORKFLOW_DIRECTIVES compliance verified

---

## Dependencies

### Required Before Start

- [ ] Node.js 18+ installed
- [ ] npm packages up to date (`npm install`)
- [ ] Git branch 251014 checked out
- [ ] Working tree clean (no uncommitted changes)
- [ ] Dev server not running (or can be restarted)

### External Dependencies

- `reactflow` or `@xyflow/react` package
- `@store/routingStore` types available
- Test framework operational

---

## Risk Mitigation

### If RoutingCanvas Changes Break Functionality

**Action**:
1. Revert commit
2. Re-analyze prop types from store
3. Add console.log debugging
4. Apply fix incrementally

### If Type Errors Persist After Fixes

**Action**:
1. Run `npx tsc --noEmit --listFiles` to check compilation context
2. Verify tsconfig.json settings
3. Clear TypeScript cache: `rm -rf node_modules/.cache`
4. Restart TypeScript server in IDE

### If Frontend-Shared Module Issues

**Action**:
1. Check if frontend-shared needs separate fix
2. Verify monorepo linking if applicable
3. Consider skipping frontend-shared fix if isolated
4. Document as known issue if non-blocking

---

## Success Metrics

### Quantitative

- TypeScript errors: 30 → 0 (100% reduction)
- Build success rate: 0% → 100%
- Files modified: ~5
- Lines changed: ~30-40
- Time to fix: <2 hours

### Qualitative

- Build confidence restored
- Type safety maintained
- Development workflow unblocked
- Git workflow can proceed per WORKFLOW_DIRECTIVES

---

## Timeline

**Start Date**: 2025-10-23
**Target Completion**: 2025-10-23 (same day)
**Total Duration**: 1.5-2 hours

| Phase | Start | End | Duration |
|-------|-------|-----|----------|
| Phase 1 | - | - | 45-60 min |
| Phase 2 | - | - | 30-45 min |
| Phase 3 | - | - | 15-20 min |

---

## Notes

### Important Reminders

1. Update checkboxes `[ ]` → `[x]` immediately after each task
2. Commit after EACH phase completion
3. Always push to 251014 branch first
4. Merge to main only after phase completion
5. Return to 251014 branch after merging
6. Update Progress Tracking after each task
7. Run `npx tsc --noEmit` frequently during Phase 1 and 2

### Debugging Tips

**If errors persist after prop addition**:
```typescript
// Add console.log in RoutingCanvasView to verify props received
console.log('Connections prop:', connections);
console.log('Add connection:', typeof addConnection);
```

**Check prop types match store**:
```typescript
// In RoutingCanvas, verify store types
console.log('Store connections type:', typeof connections);
```

**TypeScript cache issues**:
```bash
# Clear cache and rebuild
rm -rf node_modules/.cache
npm run build
```

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
**Checklist Version**: 1.0
