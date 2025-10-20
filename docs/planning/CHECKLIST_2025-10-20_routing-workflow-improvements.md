# Checklist: Routing Workflow Improvements

**Date**: 2025-10-20
**PRD**: [PRD_2025-10-20_routing-workflow-improvements.md](./PRD_2025-10-20_routing-workflow-improvements.md)

---

## Progress Overview

- **Total Tasks**: 65
- **Completed**: 0
- **In Progress**: 0
- **Pending**: 65

---

## Phase 0: Critical Bug Fix - Algorithm Workspace Infinite Loop (Priority: CRITICAL) ⚠️✅

### Analysis
- [x] Read AlgorithmVisualizationWorkspace.tsx line 582-603
- [x] Identify setState call inside useEffect causing infinite loop
- [x] Determine root cause: `nodes.length` in dependency array triggers re-render

### Fix Implementation
- [x] Remove `nodes.length` from useEffect dependency array
- [x] Keep only `searchQuery` as dependency
- [x] Prevents infinite loop while maintaining search functionality
- [x] Test algorithm visualization workspace

**Root Cause**: Line 109 had `useEffect` with dependency `[searchQuery, nodes.length]`. When `searchQuery` changed, it called `setNodes()`, which changed `nodes.length`, triggering another `useEffect` execution, creating infinite loop.

**Solution**: Removed `nodes.length` from dependency array. The effect now only runs when `searchQuery` changes. The `setNodes((nds) => ...)` functional update always operates on current state, so explicit `nodes.length` dependency is unnecessary.

**Commit**: To be added

---

## Phase 1: Multi-Item Prediction Fix (8 tasks)

### Investigation
- [ ] Read PredictionControls component to verify itemCodes handling
- [ ] Read usePredictRoutings hook to check API call
- [ ] Read apiClient.ts predictRoutings function
- [ ] Check backend prediction.py endpoint
- [ ] Identify where filtering to ITEM-001 occurs

### Fix Implementation
- [ ] Fix itemCodes array handling in frontend
- [ ] Fix backend processing to handle all items
- [ ] Update loadRecommendations to create tabs for all items

### Testing
- [ ] Test with single item (ITEM-001)
- [ ] Test with 3 items (ITEM-001, ITEM-002, ITEM-003)
- [ ] Test with 10 items
- [ ] Verify ItemListPanel shows all items
- [ ] Verify switching between items works

**Commit**: To be added

---

## Phase 2: Dark Mode Text Visibility (6 tasks)

### Audit
- [ ] Check PredictionControls text colors
- [ ] Check TimelinePanel text colors
- [ ] Check CandidatePanel text colors
- [ ] Check all input fields and labels
- [ ] Check button text colors

### Fix Implementation
- [ ] Update CSS custom properties for dark mode
- [ ] Add text color overrides in index.css
- [ ] Ensure minimum contrast ratio 4.5:1

### Testing
- [ ] Test light mode (no regressions)
- [ ] Test dark mode (all text readable)
- [ ] Test on different screens/browsers

**Commit**: To be added

---

## Phase 3: Routing Combination Dropdown (10 tasks)

### Design
- [ ] Create RoutingCombinationSelector component interface
- [ ] Design dropdown UI (position, styling)
- [ ] Define data structure for routing combinations
- [ ] Define data structure for process groups

### Implementation
- [ ] Create RoutingCombinationSelector.tsx component
- [ ] Add dropdown to RoutingTabbedWorkspace
- [ ] Fetch routing combinations from routingStore
- [ ] Add selection state to routingStore
- [ ] Style dropdown component

### Testing
- [ ] Test dropdown opens/closes
- [ ] Test selection persists
- [ ] Test integration with routing workspace

**Commit**: To be added

---

## Phase 4: CSV Export per Item (12 tasks)

### Analysis
- [ ] Read workspaceStore data mapping settings
- [ ] Read routingStore profile settings
- [ ] Understand current timeline data structure
- [ ] Define CSV column schema

### Implementation
- [ ] Create csvExporter.ts utility
- [ ] Implement data mapping transformation
- [ ] Implement profile settings integration
- [ ] Generate CSV per item using Papaparse
- [ ] Add file save dialog (Electron API or download)
- [ ] Add "전체 출력" button to TimelinePanel
- [ ] Connect button to export function

### Testing
- [ ] Test CSV generation for single item
- [ ] Test CSV generation for multiple items
- [ ] Verify CSV format matches schema
- [ ] Test file save to user folder
- [ ] Test with empty timeline

**Commit**: To be added

---

## Phase 5: Wire Connection Visibility (5 tasks)

### Investigation
- [ ] Read RoutingCanvas.tsx edge configuration
- [ ] Check if edges are being rendered
- [ ] Check edge styling (stroke, strokeWidth)
- [ ] Verify flowEdges array has data

### Fix Implementation
- [ ] Update edge style if needed (color, width)
- [ ] Ensure edges visible against background
- [ ] Test with multiple connected nodes

**Commit**: To be added

---

## Phase 6: Remove Minimap (3 tasks)

### Implementation
- [ ] Remove MiniMap component from RoutingCanvas.tsx
- [ ] Remove MiniMap import
- [ ] Clean up related CSS if any

### Testing
- [ ] Verify canvas renders without minimap
- [ ] Verify no console errors
- [ ] Test canvas layout uses full space

**Commit**: To be added

---

## Phase 7: Fix Node Settings Popup (8 tasks)

### Investigation
- [ ] Read CandidatePanel node settings modal
- [ ] Identify popup component (Dialog, Modal, etc.)
- [ ] Check current z-index and positioning

### Fix Implementation
- [ ] Update popup z-index to 9999
- [ ] Center popup using CSS (fixed + transform)
- [ ] Add close button (X icon in top-right)
- [ ] Add backdrop click handler to close
- [ ] Add Escape key handler to close

### Testing
- [ ] Test popup appears in center
- [ ] Test close button works
- [ ] Test backdrop click closes popup
- [ ] Test Escape key closes popup

**Commit**: To be added

---

## Phase 8: API Call Logging (13 tasks)

### Design
- [ ] Define log format (JSON or structured text)
- [ ] Define log fields (timestamp, user, endpoint, method, payload, status)
- [ ] Design log rotation policy (daily or size-based)
- [ ] Identify sensitive fields to redact

### Implementation
- [ ] Create API logging middleware in backend/api/app.py
- [ ] Configure RotatingFileHandler in common/logger.py
- [ ] Add request logging (before processing)
- [ ] Add response logging (after processing)
- [ ] Implement sensitive data redaction
- [ ] Set log file path (logs/api_access.log)
- [ ] Configure log rotation (10MB per file, keep 10 files)

### Testing
- [ ] Test logging for GET requests
- [ ] Test logging for POST requests with payload
- [ ] Test logging for authenticated requests (includes username)
- [ ] Verify sensitive data (password) is redacted
- [ ] Verify log rotation works
- [ ] Test log file permissions

**Commit**: To be added

---

## Testing & Integration (0 tasks - continuous)

- Test all phases together
- Regression testing
- Performance testing
- User acceptance testing

---

## Documentation

- [ ] Update README with new features
- [ ] Document CSV export format
- [ ] Document API logging format
- [ ] Update user guide

**Commit**: To be added

---

**Total Estimated Time**: 20-25 hours
**Priority Order**: Phase 0 (Critical) → Phase 1 → Phase 2 → Phase 7 → Phase 4 → Phase 8 → Phase 5 → Phase 6 → Phase 3
