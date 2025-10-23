# PRD: TypeScript Build Error Fixes

**Document ID**: PRD_2025-10-23_typescript-build-error-fixes
**Created**: 2025-10-23
**Priority**: 🔴 CRITICAL
**Status**: Active
**Related Documents**:
- CHECKLIST: [docs/planning/CHECKLIST_2025-10-23_typescript-build-error-fixes.md](CHECKLIST_2025-10-23_typescript-build-error-fixes.md)
- Workflow: [.claude/WORKFLOW_DIRECTIVES.md](../../.claude/WORKFLOW_DIRECTIVES.md)

---

## Executive Summary

### Problem Statement

**Build Failure**: TypeScript compilation failing with **30 errors**, blocking all development and deployment workflows.

**Severity**: 🔴 CRITICAL
**Impact**:
- ❌ Build process fails (`npm run build`)
- ❌ Cannot create production bundles
- ❌ Blocks all Git commit workflows per WORKFLOW_DIRECTIVES 7.6
- ❌ Development continues but with type safety compromised

**Root Cause**:
1. **RoutingCanvas.tsx** (24 errors): Missing props in `CanvasViewProps` interface - `connections`, `addConnection`, `removeConnection`, `updateConnection`, `setSelectedConnection` are used but not passed from parent component
2. **Type Safety Issues** (6 errors): Property name mismatches, incorrect imports, missing null checks

### Solution Overview

Fix all 30 TypeScript errors through 3 phases:
1. **Phase 1**: Fix RoutingCanvas.tsx props cascade (24 errors → 0)
2. **Phase 2**: Fix type safety issues (6 errors → 0)
3. **Phase 3**: Verify build success and clean git state

**Estimated Time**: 1.5-2 hours
**Success Criteria**: `npm run build` exits with 0 errors

---

## Goals and Objectives

### Primary Goals

1. **Restore Build Integrity**: Achieve 0 TypeScript compilation errors
2. **Maintain Functionality**: No regression in existing features
3. **Type Safety**: Improve type coverage and eliminate `any` types where possible

### Secondary Goals

1. **Documentation**: Document the prop cascade pattern in RoutingCanvas
2. **Prevention**: Identify patterns to avoid similar issues
3. **Testing**: Verify critical workflows still function after fixes

### Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| TypeScript Errors | 0 | 30 |
| Build Exit Code | 0 | 1 (failure) |
| Type Coverage | >95% | ~92% |
| Regression Tests | 100% pass | Not run |

---

## Problem Analysis

### Error Breakdown

#### Category 1: RoutingCanvas.tsx Props Missing (24 errors)

**File**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx`

**Pattern**: Parent-child component prop cascade broken

```typescript
// Line 817-850: Parent Component (RoutingCanvas)
export function RoutingCanvas(props: RoutingCanvasProps) {
  const connections = useRoutingStore((state) => state.connections);           // Line 819
  const addConnection = useRoutingStore((state) => state.addConnection);       // Line 824
  const removeConnection = useRoutingStore((state) => state.removeConnection); // Line 825
  const updateConnection = useRoutingStore((state) => state.updateConnection); // Line 826
  const setSelectedConnection = useRoutingStore((state) => state.setSelectedConnection); // Line 827

  // ❌ PROBLEM: These are NOT passed to RoutingCanvasView
  return <RoutingCanvasView ... />;
}

// Line 285-294: Child Component Props Definition
interface CanvasViewProps extends RoutingCanvasProps {
  timeline: TimelineStep[];
  moveStep: (stepId: string, toIndex: number) => void;
  // ❌ Missing: connections, addConnection, removeConnection, updateConnection, setSelectedConnection
}

// Line 296-815: Child Component (RoutingCanvasView)
function RoutingCanvasView({ timeline, moveStep, ... }: CanvasViewProps) {
  // Line 384: ❌ ERROR - 'connections' is not defined
  const flowEdges = useMemo(() => connections.map(...), [connections]);

  // Line 548, 550, 553, 565, 569, 600: ❌ ERROR - 'setSelectedConnection' is not defined
  setSelectedConnectionStore(edge.id);

  // Line 562, 575: ❌ ERROR - 'removeConnection' is not defined
  removeConnection(selectedEdgeId);

  // Line 583, 585: ❌ ERROR - 'addConnection' is not defined
  addConnection(connection.source, connection.target);

  // Line 595, 631: ❌ ERROR - 'updateConnection' is not defined
  updateConnection(oldEdge.id, { ... });
}
```

**Errors**:
```
Line 60:  TS18048 - 'step.timeCv' is possibly 'undefined'
Line 384: TS2304 - Cannot find name 'connections'
Line 384: TS7006 - Parameter 'connection' implicitly has an 'any' type
Line 408: TS2304 - Cannot find name 'connections'
Line 548: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 550: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 553: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 560: TS2304 - Cannot find name 'connections'
Line 560: TS7006 - Parameter 'item' implicitly has an 'any' type
Line 562: TS2304 - Cannot find name 'removeConnection'
Line 565: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 569: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 575: TS2304 - Cannot find name 'connections'
Line 575: TS2304 - Cannot find name 'removeConnection'
Line 575: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 583: TS2304 - Cannot find name 'addConnection'
Line 585: TS2304 - Cannot find name 'addConnection'
Line 593: TS2304 - Cannot find name 'connections'
Line 593: TS7006 - Parameter 'conn' implicitly has an 'any' type
Line 595: TS2304 - Cannot find name 'updateConnection'
Line 600: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 631: TS2304 - Cannot find name 'connections'
Line 631: TS2304 - Cannot find name 'setSelectedConnectionStore'
Line 631: TS2304 - Cannot find name 'updateConnection'
Line 793: TS2322 - Type '"bezier"' is not assignable to type 'ConnectionLineType | undefined'
```

#### Category 2: Type Safety Issues (6 errors)

**Error 1: DataOutputWorkspace.tsx**
```
Line 61: TS2551 - Property 'defaultValue' does not exist on type 'OutputProfileMapping'.
         Did you mean 'default_value'?
```

**Cause**: Property name mismatch (camelCase vs snake_case)

---

**Error 2: OptionsWorkspace.test.tsx**
```
Line 31: TS2322 - Type 'null' is not assignable to type 'Record<string, unknown> | undefined'
```

**Cause**: Incorrect type assertion in test mock

---

**Error 3: AlgorithmWorkspace.audit.test.tsx**
```
Line 10: TS2614 - Module '"@lib/apiClient"' has no exported member 'WorkflowConfigResponse'.
         Did you mean to use 'import WorkflowConfigResponse from "@lib/apiClient"' instead?
```

**Cause**: Incorrect named import (should be default import or different export)

---

**Error 4-5: AlgorithmWorkspace.tsx (frontend-shared)**
```
Line 34:  TS2307 - Cannot find module 'reactflow' or its corresponding type declarations
Line 127: TS7006 - Parameter 'ref' implicitly has an 'any' type
```

**Cause**: Missing reactflow module or incorrect import in frontend-shared

---

## Requirements

### Functional Requirements

#### FR-1: RoutingCanvas Props Cascade
- **FR-1.1**: Add `connections` array to `CanvasViewProps` interface
- **FR-1.2**: Add `addConnection` function to `CanvasViewProps` interface
- **FR-1.3**: Add `removeConnection` function to `CanvasViewProps` interface
- **FR-1.4**: Add `updateConnection` function to `CanvasViewProps` interface
- **FR-1.5**: Add `setSelectedConnection` function to `CanvasViewProps` interface
- **FR-1.6**: Pass all 5 props from `RoutingCanvas` to `RoutingCanvasView`
- **FR-1.7**: Verify all usage sites receive correct types

#### FR-2: Type Fixes
- **FR-2.1**: Change `defaultValue` to `default_value` in DataOutputWorkspace.tsx
- **FR-2.2**: Fix null type in OptionsWorkspace.test.tsx mock
- **FR-2.3**: Correct WorkflowConfigResponse import in AlgorithmWorkspace.audit.test.tsx
- **FR-2.4**: Fix reactflow import in frontend-shared AlgorithmWorkspace.tsx
- **FR-2.5**: Add type annotation for `ref` parameter in AlgorithmWorkspace.tsx
- **FR-2.6**: Add null check for `step.timeCv` in RoutingCanvas.tsx

### Non-Functional Requirements

#### NFR-1: Build Performance
- Build time should not increase by more than 5%
- Type checking should complete in <30 seconds

#### NFR-2: Code Quality
- No introduction of `any` types
- Maintain existing type safety levels
- Follow existing code patterns

#### NFR-3: Testing
- All existing tests must pass after changes
- No new test failures introduced
- Regression testing for routing canvas functionality

---

## Technical Design

### Phase 1: RoutingCanvas.tsx Props Fix

#### Step 1: Update CanvasViewProps Interface

**Location**: Line 285-294

```typescript
// BEFORE
interface CanvasViewProps extends RoutingCanvasProps {
  timeline: TimelineStep[];
  moveStep: (stepId: string, toIndex: number) => void;
  insertOperation: (payload: DraggableOperationPayload, index?: number) => void;
  removeStep: (stepId: string) => void;
  updateStepTimes: (stepId: string, times: { setupTime?: number; runTime?: number; waitTime?: number }) => void;
  productTabs: Array<...>;
  activeProductId: string | null;
  onCandidateSelect: (tabId: string) => void;
}

// AFTER
interface CanvasViewProps extends RoutingCanvasProps {
  timeline: TimelineStep[];
  moveStep: (stepId: string, toIndex: number) => void;
  insertOperation: (payload: DraggableOperationPayload, index?: number) => void;
  removeStep: (stepId: string) => void;
  updateStepTimes: (stepId: string, times: { setupTime?: number; runTime?: number; waitTime?: number }) => void;
  productTabs: Array<...>;
  activeProductId: string | null;
  onCandidateSelect: (tabId: string) => void;
  // NEW: Connection management props
  connections: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    metadata?: { createdBy?: string };
  }>;
  addConnection: (sourceId: string, targetId: string) => void;
  removeConnection: (connectionId: string) => void;
  updateConnection: (connectionId: string, updates: { sourceNodeId: string; targetNodeId: string }) => void;
  setSelectedConnection: (connectionId: string | null) => void;
}
```

#### Step 2: Update RoutingCanvasView Function Signature

**Location**: Line 296-309

```typescript
// BEFORE
function RoutingCanvasView({
  className,
  autoFit = true,
  fitPadding = 0.2,
  timeline,
  moveStep,
  insertOperation,
  removeStep,
  updateStepTimes,
  productTabs,
  activeProductId,
  onCandidateSelect,
  onProfileReady,
}: CanvasViewProps) {

// AFTER
function RoutingCanvasView({
  className,
  autoFit = true,
  fitPadding = 0.2,
  timeline,
  moveStep,
  insertOperation,
  removeStep,
  updateStepTimes,
  productTabs,
  activeProductId,
  onCandidateSelect,
  onProfileReady,
  // NEW: Connection props
  connections,
  addConnection,
  removeConnection,
  updateConnection,
  setSelectedConnection,
}: CanvasViewProps) {
```

#### Step 3: Update Variable References

**Location**: Throughout RoutingCanvasView function

```typescript
// BEFORE (Line 548, etc.)
setSelectedConnectionStore(edge.id);

// AFTER
setSelectedConnection(edge.id);
```

**Note**: Variable name changes from `setSelectedConnectionStore` to `setSelectedConnection` to match prop name

#### Step 4: Pass Props from RoutingCanvas

**Location**: Line 817-850

```typescript
// BEFORE
export function RoutingCanvas(props: RoutingCanvasProps) {
  const timeline = useRoutingStore((state) => state.timeline);
  const connections = useRoutingStore((state) => state.connections);
  const moveStep = useRoutingStore((state) => state.moveStep);
  // ... other hooks

  return (
    <ReactFlowProvider>
      <RoutingCanvasView
        {...props}
        timeline={timeline}
        moveStep={moveStep}
        insertOperation={insertOperation}
        removeStep={removeStep}
        updateStepTimes={updateStepTimes}
        productTabs={productTabs}
        activeProductId={activeProductId}
        onCandidateSelect={handleCandidateSelect}
      />
    </ReactFlowProvider>
  );
}

// AFTER
export function RoutingCanvas(props: RoutingCanvasProps) {
  const timeline = useRoutingStore((state) => state.timeline);
  const connections = useRoutingStore((state) => state.connections);
  const moveStep = useRoutingStore((state) => state.moveStep);
  const insertOperation = useRoutingStore((state) => state.insertOperation);
  const removeStep = useRoutingStore((state) => state.removeStep);
  const updateStepTimes = useRoutingStore((state) => state.updateStepTimes);
  const addConnection = useRoutingStore((state) => state.addConnection);
  const removeConnection = useRoutingStore((state) => state.removeConnection);
  const updateConnection = useRoutingStore((state) => state.updateConnection);
  const setSelectedConnection = useRoutingStore((state) => state.setSelectedConnection);
  // ... other hooks

  return (
    <ReactFlowProvider>
      <RoutingCanvasView
        {...props}
        timeline={timeline}
        moveStep={moveStep}
        insertOperation={insertOperation}
        removeStep={removeStep}
        updateStepTimes={updateStepTimes}
        productTabs={productTabs}
        activeProductId={activeProductId}
        onCandidateSelect={handleCandidateSelect}
        // NEW: Pass connection props
        connections={connections}
        addConnection={addConnection}
        removeConnection={removeConnection}
        updateConnection={updateConnection}
        setSelectedConnection={setSelectedConnection}
      />
    </ReactFlowProvider>
  );
}
```

#### Step 5: Fix timeCv Null Check

**Location**: Line 60

```typescript
// BEFORE
const timeCvPercent = step.timeCv !== null ? Math.round(step.timeCv * 100) : null;

// AFTER
const timeCvPercent = step.timeCv !== null && step.timeCv !== undefined
  ? Math.round(step.timeCv * 100)
  : null;
```

### Phase 2: Type Safety Fixes

#### Fix 1: DataOutputWorkspace.tsx

**Location**: Line 61

```typescript
// BEFORE
const defaultVal = mapping.defaultValue;

// AFTER
const defaultVal = mapping.default_value;
```

#### Fix 2: OptionsWorkspace.test.tsx

**Location**: Line 31

```typescript
// BEFORE
const mockContext = null;

// AFTER
const mockContext = undefined;
// OR
const mockContext: Record<string, unknown> | undefined = undefined;
```

#### Fix 3: AlgorithmWorkspace.audit.test.tsx

**Location**: Line 10

**Option A**: Change to default import
```typescript
// BEFORE
import { WorkflowConfigResponse } from "@lib/apiClient";

// AFTER
import WorkflowConfigResponse from "@lib/apiClient";
```

**Option B**: Check actual export in apiClient.ts and use correct import

#### Fix 4: AlgorithmWorkspace.tsx (frontend-shared)

**Location**: Line 34

```typescript
// BEFORE
import ... from 'reactflow';

// AFTER
import ... from '@xyflow/react';
// OR verify correct package name and version
```

**Location**: Line 127

```typescript
// BEFORE
const handleRef = (ref) => { ... }

// AFTER
const handleRef = (ref: HTMLElement | null) => { ... }
```

### Phase 3: Verification

#### Build Verification
```bash
cd frontend-prediction
npm run build
# Expected: Exit code 0, no TypeScript errors
```

#### Type Check
```bash
cd frontend-prediction
npx tsc --noEmit
# Expected: Exit code 0
```

#### Runtime Verification
- Start dev server: `npm run dev`
- Navigate to routing workspace
- Verify canvas renders
- Test connection creation/deletion
- Verify no console errors

---

## Phase Breakdown

### Phase 1: RoutingCanvas Props Fix (45-60 min)

**Tasks**:
1. Update `CanvasViewProps` interface with 5 new props
2. Update `RoutingCanvasView` function parameters
3. Replace all `setSelectedConnectionStore` with `setSelectedConnection`
4. Update `RoutingCanvas` to pass all props
5. Add timeCv null check
6. Verify TypeScript errors reduced to ~6

**Git Operations**:
- Commit Phase 1
- Push to 251014
- Merge to main
- Push main
- Return to 251014

### Phase 2: Type Safety Fixes (30-45 min)

**Tasks**:
1. Fix DataOutputWorkspace.tsx property name
2. Fix OptionsWorkspace.test.tsx null type
3. Fix AlgorithmWorkspace.audit.test.tsx import
4. Fix AlgorithmWorkspace.tsx reactflow import
5. Fix AlgorithmWorkspace.tsx ref type
6. Verify TypeScript errors = 0

**Git Operations**:
- Commit Phase 2
- Push to 251014
- Merge to main
- Push main
- Return to 251014

### Phase 3: Verification & Documentation (15-20 min)

**Tasks**:
1. Run `npm run build` - verify exit code 0
2. Run `npx tsc --noEmit` - verify 0 errors
3. Start dev server - verify no runtime errors
4. Test routing canvas functionality
5. Update work history document

**Git Operations**:
- Commit Phase 3 (if any changes)
- Final verification
- Work history document creation

---

## Success Criteria

### Phase 1 Complete

- [ ] CanvasViewProps interface updated with 5 new props
- [ ] RoutingCanvasView function signature updated
- [ ] All `setSelectedConnectionStore` references renamed
- [ ] RoutingCanvas passes all 5 props
- [ ] timeCv null check added
- [ ] TypeScript errors reduced to ≤6

### Phase 2 Complete

- [ ] DataOutputWorkspace.tsx property name fixed
- [ ] OptionsWorkspace.test.tsx type fixed
- [ ] AlgorithmWorkspace.audit.test.tsx import fixed
- [ ] AlgorithmWorkspace.tsx reactflow import fixed
- [ ] AlgorithmWorkspace.tsx ref type fixed
- [ ] TypeScript errors = 0

### Phase 3 Complete

- [ ] `npm run build` exits with code 0
- [ ] `npx tsc --noEmit` shows 0 errors
- [ ] Dev server starts without errors
- [ ] Routing canvas renders correctly
- [ ] Connection creation/deletion works
- [ ] Work history document created

---

## Final Acceptance Criteria

### Must Complete

- [ ] All 30 TypeScript errors resolved
- [ ] Build process successful (`npm run build`)
- [ ] No runtime errors in dev server
- [ ] All existing functionality intact
- [ ] Work history document created

### Quality Gates

- [ ] Type coverage maintained at >95%
- [ ] No introduction of `any` types
- [ ] All tests pass
- [ ] Git workflow clean (no unstaged changes)
- [ ] WORKFLOW_DIRECTIVES compliance verified

---

## Risk Mitigation

### Risk 1: Breaking Routing Canvas Functionality

**Mitigation**:
- Incremental changes with verification
- Test each connection operation after fix
- Maintain existing prop names where possible

### Risk 2: Introducing New Type Errors

**Mitigation**:
- Run `npx tsc --noEmit` after each file change
- Verify exact types from store
- Use IDE type hints for validation

### Risk 3: Frontend-Shared Module Issues

**Mitigation**:
- Check package.json for correct reactflow version
- Verify frontend-shared dependencies
- Isolate frontend-shared changes if needed

---

## Dependencies

### Required Before Start

- [ ] Node.js 18+ environment
- [ ] npm packages installed (`node_modules` up to date)
- [ ] Git branch 251014 checked out
- [ ] No uncommitted changes (clean working tree per WORKFLOW_DIRECTIVES)

### External Dependencies

- `@xyflow/react` or `reactflow` package (verify version)
- `@store/routingStore` types
- Test framework for regression testing

---

## Timeline

**Start Date**: 2025-10-23
**Target Completion**: 2025-10-23 (same day)
**Total Duration**: 1.5-2 hours

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1 | 45-60 min | RoutingCanvas props fix |
| Phase 2 | 30-45 min | Type safety fixes |
| Phase 3 | 15-20 min | Verification |

---

## Appendix

### Error Reference

**Full TypeScript Error Log**:
```
src/components/routing/RoutingCanvas.tsx(60,59): error TS18048: 'step.timeCv' is possibly 'undefined'.
src/components/routing/RoutingCanvas.tsx(384,7): error TS2304: Cannot find name 'connections'.
src/components/routing/RoutingCanvas.tsx(384,24): error TS7006: Parameter 'connection' implicitly has an 'any' type.
src/components/routing/RoutingCanvas.tsx(408,6): error TS2304: Cannot find name 'connections'.
src/components/routing/RoutingCanvas.tsx(548,9): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(550,9): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(553,6): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(560,28): error TS2304: Cannot find name 'connections'.
src/components/routing/RoutingCanvas.tsx(560,46): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/components/routing/RoutingCanvas.tsx(562,11): error TS2304: Cannot find name 'removeConnection'.
src/components/routing/RoutingCanvas.tsx(565,9): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(569,9): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(575,7): error TS2304: Cannot find name 'connections'.
src/components/routing/RoutingCanvas.tsx(575,20): error TS2304: Cannot find name 'removeConnection'.
src/components/routing/RoutingCanvas.tsx(575,54): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(583,7): error TS2304: Cannot find name 'addConnection'.
src/components/routing/RoutingCanvas.tsx(585,6): error TS2304: Cannot find name 'addConnection'.
src/components/routing/RoutingCanvas.tsx(593,24): error TS2304: Cannot find name 'connections'.
src/components/routing/RoutingCanvas.tsx(593,42): error TS7006: Parameter 'conn' implicitly has an 'any' type.
src/components/routing/RoutingCanvas.tsx(595,9): error TS2304: Cannot find name 'updateConnection'.
src/components/routing/RoutingCanvas.tsx(600,9): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(631,6): error TS2304: Cannot find name 'connections'.
src/components/routing/RoutingCanvas.tsx(631,29): error TS2304: Cannot find name 'setSelectedConnectionStore'.
src/components/routing/RoutingCanvas.tsx(631,67): error TS2304: Cannot find name 'updateConnection'.
src/components/routing/RoutingCanvas.tsx(793,13): error TS2322: Type '"bezier"' is not assignable to type 'ConnectionLineType | undefined'.
src/components/workspaces/__tests__/OptionsWorkspace.test.tsx(31,5): error TS2322: Type 'null' is not assignable to type 'Record<string, unknown> | undefined'.
src/components/workspaces/DataOutputWorkspace.tsx(61,50): error TS2551: Property 'defaultValue' does not exist on type 'OutputProfileMapping'. Did you mean 'default_value'?
tests/frontend-prediction/workspaces/AlgorithmWorkspace.audit.test.tsx(10,8): error TS2614: Module '"@lib/apiClient"' has no exported member 'WorkflowConfigResponse'. Did you mean to use 'import WorkflowConfigResponse from "@lib/apiClient"' instead?
../frontend-shared/src/components/workspaces/AlgorithmWorkspace.tsx(34,8): error TS2307: Cannot find module 'reactflow' or its corresponding type declarations.
../frontend-shared/src/components/workspaces/AlgorithmWorkspace.tsx(127,44): error TS7006: Parameter 'ref' implicitly has an 'any' type.
```

**Total**: 30 errors across 5 files

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
