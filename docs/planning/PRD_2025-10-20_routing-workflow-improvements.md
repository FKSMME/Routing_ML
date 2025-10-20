# PRD: Routing Workflow Improvements

**Date**: 2025-10-20
**Author**: Claude Code
**Status**: Draft
**Priority**: High

---

## 1. Overview

### Problem Statement
The routing prediction and visualization workflow has several critical issues affecting usability and functionality:
1. Only ITEM-001 is being predicted when multiple items are submitted
2. Dark mode text visibility issues
3. Missing routing combination and process group dropdown menu
4. No CSV export functionality per item code
5. Wire connections between nodes not visible
6. Minimap clutters the canvas
7. Node settings popup is hidden and has no close button
8. No comprehensive API call logging system

### Goals
- Fix multi-item prediction to process all submitted item codes
- Ensure text is readable in dark mode
- Add routing combination/process group dropdown UI
- Implement CSV export with data mapping and profile integration
- Make wire connections visible in canvas
- Remove minimap from canvas
- Fix node settings popup visibility and usability
- Implement comprehensive API logging system

### Success Metrics
- All submitted item codes generate routing predictions
- 100% text readability in dark mode
- CSV files successfully exported per item code to user-specified folder
- Wire connections visible and functional
- No minimap visible in canvas
- Popup fully visible with close button
- All API calls logged with complete metadata

---

## 2. User Stories

### Story 1: Multi-Item Prediction
**As a** user
**I want to** submit multiple item codes and see routing predictions for all of them
**So that** I can compare and manage routings for multiple products

**Acceptance Criteria:**
- [ ] User enters "ITEM-001, ITEM-002, ITEM-003" in prediction controls
- [ ] User clicks "추천 실행" button
- [ ] System generates predictions for all 3 items
- [ ] ItemListPanel shows all 3 items
- [ ] User can switch between items to see their individual routings

### Story 2: Dark Mode Text Visibility
**As a** user
**I want to** see all text clearly in dark mode
**So that** I can work comfortably in low-light environments

**Acceptance Criteria:**
- [ ] All text has sufficient contrast ratio (WCAG AA: 4.5:1 minimum)
- [ ] Labels, input fields, buttons are readable
- [ ] No white-on-white or black-on-black text

### Story 3: Routing Combination Dropdown
**As a** user
**I want to** select routing combinations and process groups via dropdown
**So that** I can configure routing settings before export

**Acceptance Criteria:**
- [ ] Dropdown menu visible in routing workspace
- [ ] Shows available routing combinations
- [ ] Shows available process groups
- [ ] Selection persists during session

### Story 4: CSV Export per Item
**As a** user
**I want to** export routing data as CSV files per item code
**So that** I can import them into other systems

**Acceptance Criteria:**
- [ ] "전체 출력" button triggers export
- [ ] Combines data mapping settings and profile settings
- [ ] Generates one CSV file per item code
- [ ] Files saved to user-specified local folder
- [ ] CSV format follows data mapping schema

### Story 5: Wire Connection Visibility
**As a** user
**I want to** see wire connections between timeline nodes
**So that** I can understand the routing sequence

**Acceptance Criteria:**
- [ ] Edges/wires visible between all connected nodes
- [ ] Wire style consistent (color, thickness)
- [ ] Wires update when nodes are reordered

### Story 6: Remove Minimap
**As a** user
**I want** the minimap removed from canvas
**So that** I have more space for the main visualization

**Acceptance Criteria:**
- [ ] Minimap component not rendered
- [ ] No visual artifacts left behind
- [ ] Canvas layout adjusts to use full space

### Story 7: Fix Node Settings Popup
**As a** user
**I want** the node settings popup to be fully visible with a close button
**So that** I can configure nodes without frustration

**Acceptance Criteria:**
- [ ] Popup appears in center of viewport or near trigger button
- [ ] Popup has visible close button (X icon)
- [ ] Popup has proper z-index to appear above all content
- [ ] Clicking outside popup or close button dismisses it

### Story 8: API Call Logging
**As a** system administrator
**I want** all API calls logged comprehensively
**So that** I can audit user actions and debug issues

**Acceptance Criteria:**
- [ ] All API endpoints log: timestamp, user, endpoint, method, payload, response code
- [ ] Logs written to dedicated file (e.g., `logs/api_access.log`)
- [ ] Log rotation configured (daily or by size)
- [ ] Sensitive data (passwords) redacted from logs

---

## 3. Technical Requirements

### 3.1 Multi-Item Prediction Fix

**Current Issue:**
- Analysis needed: Check if frontend sends all item codes or only first one
- Check if backend processes all items or stops after first

**Solution:**
- Verify `PredictionControls` passes all `itemCodes` to API
- Verify `predictRoutings()` sends array correctly
- Verify backend `predict()` processes all items in array

**Files to Modify:**
- `frontend-prediction/src/hooks/usePredictRoutings.ts`
- `frontend-prediction/src/lib/apiClient.ts`
- `backend/api/routes/prediction.py`
- `backend/api/services/prediction_service.py`

### 3.2 Dark Mode Text Visibility

**Solution:**
- Audit all CSS classes for color values
- Add dark mode specific color overrides
- Use CSS custom properties for consistent theming

**Files to Modify:**
- `frontend-prediction/src/index.css`
- Component-specific CSS files

### 3.3 Routing Combination Dropdown

**Solution:**
- Add dropdown component in RoutingTabbedWorkspace
- Fetch available routing combinations from backend
- Store selection in routingStore

**New Components:**
- `RoutingCombinationSelector.tsx`

**Files to Modify:**
- `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx`
- `frontend-prediction/src/store/routingStore.ts`

### 3.4 CSV Export per Item

**Solution:**
- Read data mapping settings from workspaceStore
- Read profile settings from routingStore
- Combine timeline data with mapping rules
- Generate CSV per item using Papaparse
- Trigger download or save to file system

**Implementation:**
- Use Electron File System API if available
- Fallback to browser download API
- One CSV per item code in `productTabs`

**Files to Modify:**
- `frontend-prediction/src/lib/csvExporter.ts` (new)
- `frontend-prediction/src/components/TimelinePanel.tsx`

### 3.5 Wire Connection Visibility

**Current State:**
- ReactFlow already renders edges
- May be hidden by CSS or configuration

**Solution:**
- Check `RoutingCanvas.tsx` for edge styling
- Ensure edges have visible stroke color and width
- Verify `edgeTypes` configuration

**Files to Modify:**
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx`

### 3.6 Remove Minimap

**Solution:**
- Remove `<MiniMap />` component from ReactFlow
- Verify no imports remain

**Files to Modify:**
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx`

### 3.7 Fix Node Settings Popup

**Solution:**
- Use modal/dialog with proper z-index (e.g., `z-index: 9999`)
- Add close button in top-right corner
- Center using CSS flexbox or fixed positioning
- Add backdrop click handler

**Files to Modify:**
- `frontend-prediction/src/components/CandidatePanel.tsx`
- Related modal components

### 3.8 API Call Logging

**Solution:**
- Add FastAPI middleware to log all requests
- Include: timestamp, username, method, path, query params, status code
- Write to rotating log file using Python `logging.handlers.RotatingFileHandler`
- Redact sensitive fields (password, token)

**Files to Modify:**
- `backend/api/app.py` (add middleware)
- `common/logger.py` (configure API logger)

---

## 4. Implementation Phases

### Phase 1: Multi-Item Prediction Fix (High Priority)
**Estimated Time**: 2 hours
**Tasks:**
1. Debug current prediction flow
2. Verify itemCodes array handling
3. Fix backend or frontend as needed
4. Test with 3+ items

### Phase 2: Dark Mode Text Visibility (High Priority)
**Estimated Time**: 1 hour
**Tasks:**
1. Audit all text colors in dark mode
2. Update CSS custom properties
3. Test all pages in dark mode

### Phase 3: Routing Combination Dropdown (Medium Priority)
**Estimated Time**: 3 hours
**Tasks:**
1. Design dropdown UI component
2. Fetch routing combinations data
3. Integrate with routingStore
4. Add to RoutingTabbedWorkspace

### Phase 4: CSV Export per Item (High Priority)
**Estimated Time**: 4 hours
**Tasks:**
1. Create CSV exporter utility
2. Integrate data mapping and profile settings
3. Generate CSV per item
4. Add file save/download logic
5. Test with multiple items

### Phase 5: Wire Connection Visibility (Medium Priority)
**Estimated Time**: 1 hour
**Tasks:**
1. Check edge rendering in RoutingCanvas
2. Update edge styles if needed
3. Test visibility

### Phase 6: Remove Minimap (Low Priority)
**Estimated Time**: 15 minutes
**Tasks:**
1. Remove MiniMap component
2. Clean up imports
3. Test canvas layout

### Phase 7: Fix Node Settings Popup (High Priority)
**Estimated Time**: 2 hours
**Tasks:**
1. Update popup z-index and positioning
2. Add close button
3. Add backdrop click handler
4. Test visibility and usability

### Phase 8: API Call Logging (Medium Priority)
**Estimated Time**: 2 hours
**Tasks:**
1. Add FastAPI middleware
2. Configure rotating log file
3. Test logging for all endpoints
4. Verify sensitive data redaction

---

## 5. Dependencies

- **Frontend:**
  - React Query (already installed)
  - Papaparse for CSV generation
  - ReactFlow (already installed)

- **Backend:**
  - FastAPI middleware
  - Python logging module (built-in)

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Multi-item prediction breaks other features | High | Thorough testing with 1, 3, 10 items |
| CSV export fails on large datasets | Medium | Add progress indicator, chunked processing |
| API logging impacts performance | Medium | Use async logging, configure buffer size |
| Dark mode changes break light mode | Low | Test both modes after changes |

---

## 7. Open Questions

1. **CSV Export Location**: Should user select folder via dialog? Or use default downloads folder?
2. **Routing Combinations**: What data structure defines a "routing combination"? Existing in backend?
3. **API Logging**: What retention policy? Daily rotation? Max file size?

---

## 8. Future Enhancements

- CSV export format customization
- Batch export for all items
- API log viewer in admin UI
- Real-time wire animation during prediction

---

**Approval Required:** Yes
**Reviewed By:** Pending
**Approved Date:** Pending
