# PRD: Routing Prediction UI Fixes

**Date**: 2025-10-24
**Status**: In Progress
**Related Checklist**: [CHECKLIST_2025-10-24_routing-prediction-ui-fixes.md](./CHECKLIST_2025-10-24_routing-prediction-ui-fixes.md)

---

## Executive Summary

This document outlines 5 critical UI fixes for the Routing Prediction workspace to improve user experience and fix functional issues:

1. Enable double-click time editing in recommended flow nodes (like blueprint)
2. Implement proper manual candidate process nodes with scrollbar
3. Fix invisible ERP IT setting button icon (change to white)
4. Resolve hardcoded item issue after routing generation
5. Show 10 similar items and provide runtime in recommended routing

**Estimated Total Time**: 8-10 hours
**Priority**: High
**Impact**: Improves UX, fixes critical data display bugs

---

## Problem Statement

### Issue #1: Recommended Flow Nodes - Missing Time Edit Feature
**Current State**: Recommended flow nodes display timing information but cannot be edited via double-click
**Problem**: Users cannot modify setup/run/wait times like they can in blueprint nodes
**Impact**: Inconsistent UX, requires manual workarounds

### Issue #2: Candidate Process Nodes - Wrong Implementation
**Current State**:
- Candidate nodes show recommended processes from API
- No manual input capability
- Display is verbose with full details
- No vertical scrollbar causes page stretching

**Problem**:
- Users cannot manually add custom processes
- Names are not simplified
- Information should only appear on double-click
- Page layout breaks with many candidates

**Impact**: Poor UX, limited functionality, layout issues

### Issue #3: Drawing Lookup ERP IT Setting Button - Invisible Icon
**Current State**: Settings gear icon has same color as background
**Problem**: Icon is not visible to users
**Impact**: Users cannot find settings, accessibility issue

### Issue #4: Routing Generation - Item Hardcoding Issue
**Current State**: After running routing recommendation once, that item code is hardcoded
**Problem**: Changing items doesn't refresh the view unless Ctrl+R is pressed
**Impact**: Users see stale data, confusing UX

### Issue #5: Similar Items Display - Incomplete Data
**Current State**:
- Not showing 10 similar items consistently
- Runtime not displayed in recommended routing

**Problem**: Critical data missing from UI
**Impact**: Users cannot see full similarity analysis and timing information

---

## Goals and Objectives

### Primary Goals
1. Make recommended flow nodes editable via double-click
2. Implement proper manual candidate process node system
3. Make ERP settings icon visible
4. Fix item selection state management
5. Display complete similar items (10) and runtime data

### Success Metrics
- Issue #1: Double-click on recommended node opens time edit dialog
- Issue #2: Manual candidate nodes with scrollbar, simplified display
- Issue #3: White gear icon visible against all backgrounds
- Issue #4: Item selection updates correctly without forced refresh
- Issue #5: All 10 similar items visible, runtime shown in recommendations

---

## Requirements

### Functional Requirements

#### FR-1: Editable Recommended Flow Nodes
- **FR-1.1**: Double-clicking recommended flow node opens time edit modal
- **FR-1.2**: Modal shows current setup/run/wait times
- **FR-1.3**: User can modify times and save
- **FR-1.4**: Updated times reflect in node display
- **FR-1.5**: Behavior matches blueprint node editing

#### FR-2: Manual Candidate Process Nodes
- **FR-2.1**: User can manually input custom process codes
- **FR-2.2**: Node displays simplified name only (process code)
- **FR-2.3**: Double-click shows full process information in modal
- **FR-2.4**: Double-click allows editing of process details
- **FR-2.5**: Container has vertical scrollbar when content overflows
- **FR-2.6**: Page height remains fixed (no stretching)

#### FR-3: Visible ERP Settings Icon
- **FR-3.1**: Settings gear icon rendered in white color
- **FR-3.2**: Icon visible against light and dark backgrounds
- **FR-3.3**: Maintains accessibility standards (contrast ratio)

#### FR-4: Dynamic Item Selection
- **FR-4.1**: Selecting new item clears previous routing data
- **FR-4.2**: Running recommendation fetches fresh data for selected item
- **FR-4.3**: No hardcoded item codes in state
- **FR-4.4**: State updates trigger proper re-renders

#### FR-5: Complete Similar Items & Runtime Display
- **FR-5.1**: Display exactly 10 similar items (or max available)
- **FR-5.2**: Each similar item shows similarity percentage
- **FR-5.3**: Recommended routing displays runtime for each operation
- **FR-5.4**: Runtime format: "{minutes}분" or "-" if null

### Non-Functional Requirements

#### NFR-1: Performance
- Time edit modal opens within 100ms
- Item selection state updates within 200ms
- Scrollbar performs smoothly with 50+ nodes

#### NFR-2: Compatibility
- Works in Chrome, Edge, Firefox (latest versions)
- Responsive layout maintained
- No breaking changes to existing features

#### NFR-3: Accessibility
- Keyboard navigation supported
- ARIA labels for screen readers
- Sufficient color contrast (WCAG 2.1 AA)

---

## Phase Breakdown

### Phase 1: Investigation & Setup (2 hours)
**Objective**: Understand current implementation and prepare for fixes

**Tasks**:
1. Analyze RecommendationsTab.tsx current double-click handling
2. Review CandidateNodeTabs.tsx and CandidatePanel.tsx structure
3. Locate DrawingViewerButton.tsx icon rendering
4. Trace routingStore.ts state management for item selection
5. Audit similar items fetching logic and runtime display

**Deliverables**:
- Code analysis notes
- File paths for all modifications
- State flow diagrams

### Phase 2: Issue #1 & #2 Implementation (3 hours)
**Objective**: Fix recommended node editing and candidate node display

**Tasks**:
1. Implement time edit modal component
2. Add double-click handler to recommended flow nodes
3. Create manual candidate input form
4. Simplify candidate node display (name only)
5. Add double-click info/edit modal for candidate nodes
6. Implement vertical scrollbar in candidate container

**Deliverables**:
- TimeEditModal.tsx component
- Updated RecommendationsTab.tsx
- ManualCandidateInput.tsx component
- Updated CandidateNodeTabs.tsx with scrollbar

### Phase 3: Issue #3, #4, #5 Implementation (3 hours)
**Objective**: Fix icon visibility, state management, and data display

**Tasks**:
1. Change gear icon color to white in DrawingViewerButton.tsx
2. Refactor routingStore item selection logic
3. Add state reset on item change
4. Update similar items fetch to request 10 items
5. Add runtime display to RecommendationsTab.tsx
6. Verify runtime data flow from API to UI

**Deliverables**:
- Updated DrawingViewerButton.tsx (white icon)
- Refactored routingStore.ts (dynamic item selection)
- Updated apiClient.ts (10 similar items)
- Updated RecommendationsTab.tsx (runtime display)

### Phase 4: Testing & Polish (2 hours)
**Objective**: Verify all fixes work correctly

**Tasks**:
1. Test recommended node time editing
2. Test manual candidate input and scrollbar
3. Verify icon visibility in different themes
4. Test item selection state changes
5. Verify 10 similar items and runtime display
6. Cross-browser testing
7. Accessibility audit

**Deliverables**:
- Test report
- Bug fixes (if any)
- Screenshots of all fixes

---

## Technical Specifications

### Issue #1: Time Edit Modal Structure
```typescript
interface TimeEditModalProps {
  operation: OperationStep;
  onSave: (times: { setupTime?: number; runTime?: number; waitTime?: number }) => void;
  onClose: () => void;
}

// Modal should include:
// - Input fields for setup/run/wait times
// - Validation (non-negative numbers)
// - Save/Cancel buttons
// - Escape key to close
```

### Issue #2: Manual Candidate Node Structure
```typescript
interface ManualCandidateNode {
  id: string;
  processCode: string;
  processName?: string;
  description?: string;
  setupTime?: number;
  runTime?: number;
  waitTime?: number;
  isManual: true;  // Flag to distinguish from API candidates
}

// Container CSS:
.candidate-nodes-container {
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
}
```

### Issue #3: Icon Color Change
```typescript
// DrawingViewerButton.tsx
<svg className="w-4 h-4 text-white">  // Change from text-gray-500 to text-white
  <path d="gear-icon-path" fill="currentColor" />
</svg>
```

### Issue #4: State Management Fix
```typescript
// routingStore.ts
interface RoutingStore {
  activeItemCode: string | null;  // Current selected item
  setActiveItemCode: (code: string | null) => void;

  // Action to clear data when item changes
  resetRoutingData: () => void;
}

// In App.tsx or component:
useEffect(() => {
  if (itemCode !== previousItemCode) {
    resetRoutingData();
  }
}, [itemCode]);
```

### Issue #5: Similar Items & Runtime Display
```typescript
// apiClient.ts
export async function fetchSimilarItems(itemCode: string, limit: number = 10) {
  return api.get(`/api/v1/routing/similar/${itemCode}?limit=${limit}`);
}

// RecommendationsTab.tsx
<div className="runtime-display">
  <span>Run: {operation.RUN_TIME ?? "-"}분</span>
</div>
```

---

## Success Criteria

### Acceptance Criteria

#### AC-1: Recommended Flow Nodes
- [ ] Double-click opens time edit modal
- [ ] Modal displays current times
- [ ] User can edit and save times
- [ ] Changes persist in node display

#### AC-2: Manual Candidate Nodes
- [ ] User can add custom process codes
- [ ] Node shows simplified name only
- [ ] Double-click shows full details
- [ ] Scrollbar appears when needed
- [ ] Page height stays fixed

#### AC-3: ERP Settings Icon
- [ ] Icon is white color
- [ ] Visible against all backgrounds
- [ ] Contrast ratio ≥ 4.5:1

#### AC-4: Item Selection
- [ ] Changing item clears old data
- [ ] No forced refresh needed
- [ ] State updates correctly

#### AC-5: Similar Items & Runtime
- [ ] Displays 10 similar items (or max available)
- [ ] Runtime shown in recommendations
- [ ] Format: "{number}분" or "-"

---

## Timeline Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Investigation | 2 hours | None |
| Phase 2: Issues #1 & #2 | 3 hours | Phase 1 |
| Phase 3: Issues #3, #4, #5 | 3 hours | Phase 2 |
| Phase 4: Testing & Polish | 2 hours | Phase 3 |
| **Total** | **10 hours** | |

---

## Dependencies

### Internal Dependencies
- frontend-prediction React application
- routingStore.ts Zustand store
- apiClient.ts backend communication
- Existing component structure

### External Dependencies
- Backend API endpoints (must support 10 similar items)
- Runtime data availability in API responses

---

## Risks and Mitigation

### Risk 1: Backend API Limitations
**Risk**: Backend may not return 10 similar items or runtime data
**Likelihood**: Medium
**Impact**: High
**Mitigation**: Verify API response structure first, update backend if needed

### Risk 2: State Management Complexity
**Risk**: Item selection state change may affect other features
**Likelihood**: Low
**Impact**: Medium
**Mitigation**: Thorough testing of all routing features after changes

### Risk 3: Scrollbar Browser Compatibility
**Risk**: Custom scrollbar may not work in all browsers
**Likelihood**: Low
**Impact**: Low
**Mitigation**: Use standard CSS overflow-y: auto (universally supported)

---

## Stakeholders

- **Product Owner**: User requesting fixes
- **Developer**: Claude (implementation)
- **QA**: Manual testing by user
- **End Users**: Factory routing planners

---

## References

### Related Documents
- `.claude/WORKFLOW_DIRECTIVES.md` - Development workflow
- `frontend-prediction/src/store/routingStore.ts` - State management
- `frontend-prediction/src/components/routing/` - UI components

### Related Issues
- None (new PRD)

---

**Document Status**: Ready for Implementation
**Next Steps**: Create CHECKLIST and begin Phase 1
