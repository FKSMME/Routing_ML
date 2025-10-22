# Checklist: ERP Drawing Viewer Integration

**Date**: 2025-10-22
**Related PRD**: docs/planning/PRD_2025-10-22_erp-drawing-viewer-integration.md
**Status**: Not Started
**Priority**: HIGH
**Branch**: 251014

---

## Phase 1: Backend API Implementation

### Tasks

- [ ] Create `/api/items/{item_cd}/drawing-info` endpoint in backend
- [ ] Implement MSSQL query to fetch DRAW_NO from item_info table
- [ ] Implement MSSQL query to fetch REV from item_info table
- [ ] Add response model with drawingNumber, revision, available fields
- [ ] Add error handling for database connection failures
- [ ] Add error handling for missing item_code
- [ ] Add error handling for null/empty DRAW_NO
- [ ] Test endpoint with valid item codes
- [ ] Test endpoint with invalid item codes
- [ ] Test endpoint with missing drawing data
- [ ] Add API endpoint documentation
- [ ] Add unit tests for endpoint

**Estimated Time**: 2-3 hours
**Status**: Not Started

### Git Operations

- [ ] Commit Phase 1 changes with descriptive message
- [ ] Push to 251014 branch
- [ ] Verify build succeeds
- [ ] Test endpoint manually

---

## Phase 2: Frontend Components

### Tasks

#### DrawingViewerButton Component

- [ ] Create `frontend-prediction/src/components/routing/` directory (if not exists)
- [ ] Create `DrawingViewerButton.tsx` component file
- [ ] Implement button component with itemCode prop
- [ ] Add loading state management
- [ ] Add disabled state when no itemCode
- [ ] Implement handleClick function
- [ ] Add fetchDrawingInfo API call
- [ ] Implement URL building logic
- [ ] Add window.open with ERP viewer URL
- [ ] Add error handling with Korean error messages
- [ ] Add loading spinner/text during API call
- [ ] Style button with Tailwind CSS

#### DrawingViewerSettings Dialog

- [ ] Create `DrawingViewerSettings.tsx` component file
- [ ] Implement dialog with open/close state
- [ ] Add ERP ID input field
- [ ] Add default sheet number input field
- [ ] Add window width input field
- [ ] Add window height input field
- [ ] Implement settings load from localStorage
- [ ] Implement settings save to localStorage
- [ ] Add form validation
- [ ] Style dialog with existing UI components

#### URL Builder Utility

- [ ] Create `frontend-prediction/src/utils/erpViewerUrl.ts` file
- [ ] Implement buildErpViewerUrl function
- [ ] Add ErpViewerParams interface
- [ ] Implement URL parameter encoding
- [ ] Add URL validation
- [ ] Add unit tests for URL builder

#### API Client Function

- [ ] Add fetchDrawingInfo function to `apiClient.ts`
- [ ] Define DrawingInfo interface
- [ ] Implement error handling for API call
- [ ] Add TypeScript type safety

#### Settings Hook

- [ ] Create `useDrawingViewerSettings.ts` hook
- [ ] Implement settings state management
- [ ] Add default values for settings
- [ ] Implement localStorage sync

**Estimated Time**: 3-4 hours
**Status**: Not Started

### Git Operations

- [ ] Commit Phase 2 changes with descriptive message
- [ ] Push to 251014 branch
- [ ] Verify TypeScript compilation succeeds
- [ ] Verify build succeeds

---

## Phase 3: Integration and Testing

### Tasks

#### Integration

- [ ] Find routing visualization page component
- [ ] Identify visualization tab structure
- [ ] Add DrawingViewerButton to left side of visualization tab
- [ ] Add settings icon next to button
- [ ] Connect button to selected item state
- [ ] Wire up settings dialog open/close
- [ ] Test button appears in correct location
- [ ] Test button visibility with/without item selection

#### API Integration

- [ ] Test API endpoint returns correct data for sample items
- [ ] Test button fetches drawing info on click
- [ ] Test URL generation with real data
- [ ] Test ERP viewer opens in new window
- [ ] Verify URL parameters are correct

#### Edge Cases

- [ ] Test with item having no drawing data (DRAW_NO is null)
- [ ] Test with item having no revision (REV is null)
- [ ] Test with invalid item code
- [ ] Test with network error during API call
- [ ] Test with missing ERP ID in settings
- [ ] Test button disabled state
- [ ] Test loading state during API call

#### Error Handling

- [ ] Add user-friendly error message for missing drawing data
- [ ] Add error message for network failures
- [ ] Add error message for missing ERP ID
- [ ] Test all error scenarios display correct messages
- [ ] Ensure errors don't crash the page

**Estimated Time**: 2-3 hours
**Status**: Not Started

### Git Operations

- [ ] Commit Phase 3 changes with descriptive message
- [ ] Push to 251014 branch
- [ ] Verify all tests pass
- [ ] Manual testing completed

---

## Phase 4: Polish and Documentation

### Tasks

#### UI Polish

- [ ] Add Korean tooltip to button ("도면 조회: 선택한 품목의 기술 도면 보기")
- [ ] Improve button styling (colors, hover effects, focus states)
- [ ] Add settings icon with hover effect
- [ ] Ensure button matches overall UI design
- [ ] Add loading spinner animation
- [ ] Test responsive behavior

#### User Experience

- [ ] Add success feedback when viewer opens
- [ ] Improve error message clarity
- [ ] Add help text in settings dialog
- [ ] Test keyboard navigation
- [ ] Test accessibility (screen readers)

#### Documentation

- [ ] Create implementation document `docs/implementation/2025-10-22_erp-drawing-viewer.md`
- [ ] Document API endpoint usage
- [ ] Document component usage
- [ ] Document settings configuration
- [ ] Add screenshots of button and settings dialog
- [ ] Update user guide with new feature

#### Final Testing

- [ ] Test full workflow with multiple items
- [ ] Test settings persistence across sessions
- [ ] Test with different window sizes
- [ ] Test with different ERP IDs
- [ ] Verify no console errors
- [ ] Verify no TypeScript errors
- [ ] Performance test (button response < 500ms)

#### Bug Fixes

- [ ] Fix any discovered bugs
- [ ] Re-test after bug fixes
- [ ] Verify all acceptance criteria met

**Estimated Time**: 1-2 hours
**Status**: Not Started

### Git Operations

- [ ] Commit Phase 4 changes with descriptive message
- [ ] Push to 251014 branch
- [ ] Merge 251014 to main branch
- [ ] Push main to remote
- [ ] Return to 251014 branch
- [ ] Create work history document

---

## Progress Tracking

```
Phase 1 (Backend):    [░░░░░░░░░░] 0% (0/12 tasks)
Phase 2 (Frontend):   [░░░░░░░░░░] 0% (0/30 tasks)
Phase 3 (Integration):[░░░░░░░░░░] 0% (0/18 tasks)
Phase 4 (Polish):     [░░░░░░░░░░] 0% (0/20 tasks)

Total:                [░░░░░░░░░░] 0% (0/80 tasks)

Git Operations:       [░░░░░░░░░░] 0% (0/13 checkpoints)
```

---

## Acceptance Criteria

### Phase 1 Complete

- [ ] API endpoint exists and is accessible
- [ ] Endpoint returns correct drawing data from MSSQL
- [ ] Error handling works for all edge cases
- [ ] Unit tests pass
- [ ] API documentation complete

### Phase 2 Complete

- [ ] DrawingViewerButton component renders
- [ ] Settings dialog opens and closes
- [ ] URL builder generates correct URLs
- [ ] Settings persist in localStorage
- [ ] All TypeScript types defined
- [ ] No compilation errors

### Phase 3 Complete

- [ ] Button appears on visualization tab
- [ ] Button fetches drawing data on click
- [ ] ERP viewer opens with correct URL
- [ ] All edge cases handled gracefully
- [ ] Error messages display correctly
- [ ] Loading states work properly

### Phase 4 Complete

- [ ] UI is polished and professional
- [ ] All documentation complete
- [ ] No bugs remaining
- [ ] All acceptance tests pass
- [ ] Performance criteria met
- [ ] Feature ready for production

---

## Final Acceptance Criteria

### Must Complete

- [ ] All 80 tasks marked as [x]
- [ ] All 13 Git checkpoints completed
- [ ] [도면 조회] button functional on visualization tab
- [ ] Settings dialog working and persistent
- [ ] ERP viewer integration complete
- [ ] All error cases handled

### Quality Gates

- [ ] Code builds without errors
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] API endpoint tested and working
- [ ] Button response time < 500ms
- [ ] UI matches design standards
- [ ] Korean text correct and clear
- [ ] All tests pass

---

## Dependencies

### Required Before Start

- [ ] Access to MSSQL database with item_info table
- [ ] Confirmation that DRAW_NO and REV columns exist
- [ ] ERP Image Viewer URL accessible from development environment
- [ ] Sample item codes with drawing data for testing

### Required During Implementation

- [ ] Database connection configured in backend
- [ ] Test ERP ID for development/testing
- [ ] Sample drawing numbers for testing
- [ ] Access to routing visualization page code

---

## Notes

### Important Reminders

1. Update checkboxes [ ] → [x] immediately after each task
2. Commit after EACH phase completion
3. Always push to 251014 branch first
4. Merge to main only after phase completion and testing
5. Return to 251014 branch after merging
6. Update Progress Tracking after each task
7. Test thoroughly before marking phase complete

### Database Schema Reference

```sql
-- item_info table
ITEM_CD   VARCHAR   -- Primary key / Item code
DRAW_NO   VARCHAR   -- Drawing number
REV       VARCHAR   -- Revision number
...
```

### ERP Viewer URL Reference

```
Base URL: https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx

Parameters:
  erpid  = User's ERP ID (from settings)
  pid    = 1 (fixed for English menu)
  dno    = Drawing number (from item_info.DRAW_NO)
  sheet  = Sheet number (from settings, default "1")
  rev    = Revision (from item_info.REV)

Example:
https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx?erpid=USER123&pid=1&dno=DWG-2024-001&sheet=1&rev=A
```

### File Structure

```
backend/
└── api/
    └── routes/
        └── items.py (or new drawing.py)
            └── GET /items/{item_cd}/drawing-info

frontend-prediction/
├── src/
│   ├── components/
│   │   └── routing/
│   │       ├── DrawingViewerButton.tsx (NEW)
│   │       └── DrawingViewerSettings.tsx (NEW)
│   ├── utils/
│   │   └── erpViewerUrl.ts (NEW)
│   ├── hooks/
│   │   └── useDrawingViewerSettings.ts (NEW)
│   └── lib/
│       └── apiClient.ts (ADD fetchDrawingInfo)
│
└── docs/
    ├── planning/
    │   ├── PRD_2025-10-22_erp-drawing-viewer-integration.md
    │   └── CHECKLIST_2025-10-22_erp-drawing-viewer-integration.md (this file)
    └── implementation/
        └── 2025-10-22_erp-drawing-viewer.md (to be created in Phase 4)
```

---

## Risk Mitigation

### If DRAW_NO column is empty

- Disable button
- Show tooltip: "도면 정보가 없습니다"
- Log missing drawing info for analysis

### If database query fails

- Show error message: "도면 정보 조회 실패"
- Provide retry button
- Log error for debugging

### If ERP viewer URL is inaccessible

- Show error message: "ERP 시스템에 접근할 수 없습니다"
- Verify URL configuration
- Check network connectivity

### If user doesn't know ERP ID

- Add help text in settings dialog
- Provide example ERP ID format
- Link to documentation (if available)

---

## Success Metrics

### Quantitative

- Button click → Viewer open time: < 2 seconds
- API response time: < 1 second
- Settings save/load time: < 100ms
- Zero errors in production logs

### Qualitative

- Users can access drawings without context switching
- Workflow efficiency improved
- Positive user feedback
- No support tickets related to feature

---

## Timeline

**Start Date**: 2025-10-22
**Estimated Duration**: 8-12 hours (1-1.5 days)
**Target Completion**: 2025-10-23

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1 | 2-3h | - | - |
| Phase 2 | 3-4h | - | - |
| Phase 3 | 2-3h | - | - |
| Phase 4 | 1-2h | - | - |

---

**Last Updated**: 2025-10-22
**Next Review**: After Phase 1 completion
**Checklist Version**: 1.0
