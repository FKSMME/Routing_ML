# Checklist: Routing Prediction UI Fixes

**Date**: 2025-10-24
**Related PRD**: [PRD_2025-10-24_routing-prediction-ui-fixes.md](./PRD_2025-10-24_routing-prediction-ui-fixes.md)
**Status**: In Progress

---

## Phase 1: Investigation & Setup

**Objective**: Understand current implementation and prepare for fixes

- [x] Analyze RecommendationsTab.tsx double-click handling (Est. 0.3h)
- [x] Review CandidateNodeTabs.tsx and CandidatePanel.tsx structure (Est. 0.4h)
- [x] Locate DrawingViewerButton.tsx icon rendering code (Est. 0.2h)
- [x] Trace routingStore.ts state management for item selection (Est. 0.5h)
- [x] Audit similar items fetching logic and runtime display (Est. 0.6h)

**Estimated Time**: 2 hours
**Status**: Completed

**Dependencies**: None

**Investigation Findings**:
- Issue #1: RecommendationsTab.tsx lines 200-211 display timing but no edit handler
- Issue #2: CandidatePanel.tsx shows API recommendations, need separate manual input
- Issue #3: Need to find settings gear icon (not in DrawingViewerButton.tsx main button)
- Issue #4: State managed via routingStore, need to add reset on item change
- Issue #5: topK=10 already set in workspaceStore.ts:262, need to verify display

**Git Operations**:
- [ ] Git staging completeness check
  - `git status` executed
  - `git add -A` executed
  - `git status` re-confirmed → "Changes not staged" section empty
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge validation pre-check
  - `git diff main..251014` confirmed
  - No unexpected changes verified
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: Fix Issues #1 & #2 (Recommended Nodes & Candidate Nodes)

**Objective**: Implement time editing for recommended nodes and proper manual candidate node system

### Issue #1: Recommended Flow Nodes - Time Editing

- [ ] Create TimeEditModal.tsx component (Est. 0.5h)
  - Input fields for setup/run/wait times
  - Validation for non-negative numbers
  - Save/Cancel buttons
  - Escape key handler
- [ ] Add double-click handler to recommended nodes in RecommendationsTab.tsx (Est. 0.3h)
- [ ] Implement time update logic in routingStore.ts (Est. 0.2h)
- [ ] Test time editing functionality (Est. 0.2h)

### Issue #2: Candidate Process Nodes - Manual Input & Scrollbar

- [ ] Create ManualCandidateInput.tsx component (Est. 0.5h)
  - Form for manual process code entry
  - Process name and description fields
  - Add button
- [ ] Simplify CandidateNodeTabs.tsx display (Est. 0.3h)
  - Show only process code
  - Remove verbose details from card view
- [ ] Create CandidateInfoModal.tsx for double-click details (Est. 0.4h)
  - Display full process information
  - Enable editing of details
- [ ] Add vertical scrollbar to candidate container (Est. 0.2h)
  - CSS: max-height + overflow-y: auto
  - Test with 20+ candidates
- [ ] Update routingStore.ts to support manual candidates (Est. 0.3h)
  - Add isManual flag
  - Separate manual vs API candidates

**Estimated Time**: 3 hours
**Status**: Not Started

**Dependencies**: Phase 1 complete

**Git Operations**:
- [ ] Git staging completeness check
  - `git status` executed
  - `git add -A` executed
  - `git status` re-confirmed → "Changes not staged" section empty
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge validation pre-check
  - `git diff main..251014` confirmed
  - No unexpected changes verified
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Fix Issues #3, #4, #5 (Icon, State, Data Display)

**Objective**: Fix icon visibility, state management, and data completeness

### Issue #3: ERP Settings Icon - Visibility

- [ ] Locate gear icon in DrawingViewerButton.tsx (Est. 0.1h)
- [ ] Change icon color from gray to white (Est. 0.1h)
  - Update className: text-gray-500 → text-white
- [ ] Test icon visibility on light/dark backgrounds (Est. 0.1h)
- [ ] Verify accessibility contrast ratio (Est. 0.1h)

### Issue #4: Item Selection - State Management Fix

- [ ] Identify hardcoded item references in routingStore.ts (Est. 0.3h)
- [ ] Add resetRoutingData() action to routingStore (Est. 0.2h)
- [ ] Implement useEffect to detect item changes in App.tsx (Est. 0.2h)
- [ ] Add state cleanup on item change (Est. 0.2h)
  - Clear candidates
  - Clear recommendations
  - Clear timeline
  - Clear selected candidate
- [ ] Test item switching without Ctrl+R (Est. 0.3h)

### Issue #5: Similar Items & Runtime Display

- [ ] Update fetchSimilarItems() in apiClient.ts to request 10 items (Est. 0.2h)
  - Add limit parameter: ?limit=10
- [ ] Verify backend returns 10 similar items (Est. 0.3h)
- [ ] Update CandidateNodeTabs.tsx to display all 10 candidates (Est. 0.2h)
- [ ] Add runtime display to RecommendationsTab.tsx (Est. 0.3h)
  - Format: "Run: {RUN_TIME}분" or "-"
- [ ] Verify runtime data flow from API to UI (Est. 0.2h)
- [ ] Test with multiple items (Est. 0.2h)

**Estimated Time**: 3 hours
**Status**: Not Started

**Dependencies**: Phase 2 complete

**Git Operations**:
- [ ] Git staging completeness check
  - `git status` executed
  - `git add -A` executed
  - `git status` re-confirmed → "Changes not staged" section empty
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge validation pre-check
  - `git diff main..251014` confirmed
  - No unexpected changes verified
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: Testing & Polish

**Objective**: Comprehensive testing and final polish

### Functional Testing

- [ ] Test Issue #1: Recommended node time editing (Est. 0.3h)
  - Double-click opens modal
  - Times display correctly
  - Edit and save works
  - Changes persist
- [ ] Test Issue #2: Manual candidate nodes (Est. 0.3h)
  - Can add manual candidates
  - Display simplified correctly
  - Double-click shows details
  - Scrollbar works smoothly
- [ ] Test Issue #3: Icon visibility (Est. 0.2h)
  - White icon visible
  - Works in all themes
- [ ] Test Issue #4: Item selection (Est. 0.3h)
  - Switching items clears data
  - No forced refresh needed
  - State updates correctly
- [ ] Test Issue #5: Data display (Est. 0.3h)
  - 10 similar items shown
  - Runtime visible in recommendations

### Cross-Browser Testing

- [ ] Test in Chrome (Est. 0.1h)
- [ ] Test in Edge (Est. 0.1h)
- [ ] Test in Firefox (Est. 0.1h)

### Accessibility Audit

- [ ] Keyboard navigation works (Est. 0.1h)
- [ ] ARIA labels present (Est. 0.1h)
- [ ] Color contrast sufficient (Est. 0.1h)

### Bug Fixes (if needed)

- [ ] Fix any discovered bugs (Est. 0.5h buffer)

**Estimated Time**: 2 hours
**Status**: Not Started

**Dependencies**: Phase 3 complete

**Final Git Operations** (CHECKLIST 100% complete):
- [ ] Determine version number (Major/Minor/Patch)
  - Decision: ____________ (e.g., v6.2.1)
  - Reasoning: ____________
- [ ] Backup old version to old/ directory
  - `mkdir -p old` (if needed)
  - `move RoutingMLMonitor_v6.2.0.spec old/`
  - `move RoutingMLMonitor_v6.2.0.exe old/` (if exists)
- [ ] Create new spec file
  - `copy RoutingMLMonitor_v6.2.0.spec RoutingMLMonitor_v{NEW}.spec`
- [ ] Update spec file version information
- [ ] Pre-build validation (CRITICAL)
  - `.\.venv\Scripts\python.exe scripts\server_monitor_dashboard_v5_1.py --help`
  - Run for minimum 10 seconds
  - Verify no errors
  - **IF ERRORS: Fix code, re-test, DO NOT proceed to build**
- [ ] Rebuild monitor
  - `.\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v{NEW}.spec`
- [ ] Verify build output
  - `ls -lh dist/RoutingMLMonitor_v{NEW}.exe` (~12MB)
- [ ] Move exe to project root
  - `move dist/RoutingMLMonitor_v{NEW}.exe .`
- [ ] Clean dist and build folders (CRITICAL - prevent user confusion)
  - `rm -f dist/RoutingMLMonitor_v*.exe`
  - `rm -rf dist/* build/*`
- [ ] Final verification: Only latest version in root
  - `ls -lh RoutingMLMonitor_v*.exe`
  - **Must show only v{NEW}.exe**
- [ ] Post-build validation (CRITICAL)
  - `.\RoutingMLMonitor_v{NEW}.exe --version` (background)
  - Run for minimum 30 seconds
  - Visual check: UI loads correctly
  - No Tkinter exceptions or error popups
  - No console errors after exit
  - **IF ERRORS: Fix code, restart from pre-build validation**
- [ ] Git staging completeness check
  - `git status` executed
  - `git add -A` executed (include new exe, spec, old/)
  - `git status` re-confirmed → "Changes not staged" section empty
- [ ] Commit: "build: Rebuild monitor v{NEW} - CHECKLIST 100% complete"
- [ ] Push to 251014
- [ ] Merge validation pre-check
  - `git diff main..251014` confirmed
  - No unexpected changes verified
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014
- [ ] Create work history document

---

## Progress Tracking

```
Phase 1: [▓▓▓▓▓] 100% (5/5 tasks) ✓
Phase 2: [░░░░░░░░░░] 0% (0/10 tasks)
Phase 3: [░░░░░░░░░░░░░] 0% (0/13 tasks)
Phase 4: [░░░░░░░░░░░░] 0% (0/12 tasks)

Total: [▓▓░░░░░░░░░░░░░░░░░░] 12.5% (5/40 tasks)
```

---

## Acceptance Criteria

### Issue #1: Recommended Flow Nodes
- [ ] Double-click on recommended node opens time edit modal
- [ ] Modal displays current setup/run/wait times
- [ ] User can edit times and save changes
- [ ] Updated times reflect in node display immediately
- [ ] Behavior matches blueprint node editing

### Issue #2: Manual Candidate Process Nodes
- [ ] User can manually input custom process codes
- [ ] Node displays simplified name only (process code)
- [ ] Double-click shows full process information in modal
- [ ] Double-click modal allows editing of process details
- [ ] Container has vertical scrollbar when content overflows
- [ ] Page height remains fixed (no vertical stretching)

### Issue #3: ERP Settings Icon
- [ ] Settings gear icon rendered in white color
- [ ] Icon visible against light and dark backgrounds
- [ ] Contrast ratio meets WCAG 2.1 AA standards (≥ 4.5:1)

### Issue #4: Dynamic Item Selection
- [ ] Selecting new item clears previous routing data
- [ ] Running recommendation fetches fresh data for selected item
- [ ] No hardcoded item codes remain in state
- [ ] State updates trigger proper component re-renders
- [ ] No Ctrl+R forced refresh needed

### Issue #5: Complete Similar Items & Runtime Display
- [ ] Display exactly 10 similar items (or max available from API)
- [ ] Each similar item shows similarity percentage
- [ ] Recommended routing displays runtime for each operation
- [ ] Runtime format: "{number}분" or "-" if data unavailable

### General Quality
- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged to main
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining
- [ ] Type-check passes (npm run type-check)
- [ ] No console errors in browser
- [ ] No TypeScript errors
- [ ] All files properly committed (git status clean)

---

## Risk Mitigation Checklist

- [ ] Backend API verified to support 10 similar items
- [ ] Runtime data available in API response confirmed
- [ ] State management changes tested with existing features
- [ ] No breaking changes to other workspaces

---

**Last Updated**: 2025-10-24
**Next Review**: After each Phase completion

---

## Notes

### Version Decision Guidelines
- **Patch (Z)**: Bug fixes, UI improvements without new features → v6.2.1
- **Minor (Y)**: New features (manual candidates, time editing) → v6.3.0
- **Major (X)**: Breaking changes, architecture changes → v7.0.0

**Recommended for this work**: **Minor (v6.3.0)** - New features added (time editing, manual candidate input)
