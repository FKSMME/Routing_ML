# PRD: ERP Drawing Viewer Integration

**Date**: 2025-10-22
**Status**: Planning
**Priority**: HIGH
**Branch**: 251014

---

## Executive Summary

Add [도면 조회] (Drawing Viewer) button to the routing creation page visualization tab, enabling users to view ERP drawing documents directly from the routing interface. The button will open KSM's ERP Image Viewer with drawing information fetched from MSSQL item_info table.

**Impact**: HIGH - Provides immediate access to technical drawings during routing creation, improving workflow efficiency and reducing context switching.

---

## Problem Statement

### Current State

- Users creating routing plans need to reference technical drawings
- Drawing information exists in MSSQL (item_info.DRAW_NO, item_info.REV)
- ERP Image Viewer URL is available but not integrated
- Users must manually open ERP system in separate window and search for drawings

### Pain Points

1. **Context Switching**: Users must leave routing creation page to view drawings
2. **Manual Search**: Users must manually enter drawing numbers in ERP system
3. **Time Consuming**: Reduces efficiency in routing creation workflow
4. **Error Prone**: Manual entry increases risk of viewing wrong drawings

---

## Goals and Objectives

### Primary Goals

1. Add [도면 조회] button to routing visualization tab (left side)
2. Integrate with KSM ERP Image Viewer
3. Auto-populate drawing parameters from MSSQL item_info table
4. Provide settings dialog for configuration

### Success Metrics

- [도면 조회] button visible on routing visualization page
- Button opens ERP Image Viewer with correct parameters
- Drawing number (DRAW_NO) and revision (REV) fetched from database
- Settings dialog allows user configuration
- No errors when opening viewer

### Non-Goals

- Modifying ERP Image Viewer system
- Implementing drawing upload functionality
- Creating new drawing management system
- Integrating with non-KSM ERP systems

---

## Requirements

### Functional Requirements

#### FR-1: Drawing Viewer Button

**Location**: Routing creation page → Visualization tab → Left side

**Button Properties**:
- Label: [도면 조회]
- Position: Left side of visualization tab
- Visibility: Always visible when product/item is selected
- Enabled: Only when drawing information available

#### FR-2: ERP Image Viewer Integration

**URL Format**:
```
https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx?erpid={erpid}&pid={pid}&dno={dno}&sheet={sheet}&rev={rev}
```

**Parameters**:
- `erpid`: User's ERP ID (from user session/settings)
- `pid`: 1 (fixed - English menu)
- `dno`: Drawing number (from MSSQL item_info.DRAW_NO)
- `sheet`: Sheet number (from settings or default)
- `rev`: Revision (from MSSQL item_info.REV)

#### FR-3: Database Integration

**Table**: MSSQL item_info
**Columns**:
- `DRAW_NO`: Drawing number string
- `REV`: Revision string

**Query Logic**:
```sql
SELECT DRAW_NO, REV
FROM item_info
WHERE ITEM_CD = {selected_item_code}
```

#### FR-4: Settings Dialog

**Configuration Options**:
- ERP ID (user's ERP identifier)
- Default sheet number
- Auto-open behavior (new window/tab)
- Window dimensions (width/height)

**Settings Storage**: localStorage or user preferences table

### Non-Functional Requirements

#### NFR-1: Performance
- Button click response < 500ms
- Database query < 1 second
- No UI blocking during query

#### NFR-2: Usability
- Clear button label in Korean
- Disabled state when no drawing available
- Error messages in Korean
- Tooltip with drawing info on hover

#### NFR-3: Reliability
- Graceful handling of missing drawing data
- Error notification if database query fails
- URL validation before opening viewer

---

## Technical Design

### Architecture

```
[Routing Visualization Tab]
├── Left Panel
│   ├── [도면 조회] Button (NEW)
│   │   ├── onClick → fetchDrawingInfo()
│   │   ├── Fetch DRAW_NO, REV from MSSQL
│   │   ├── Build ERP Viewer URL
│   │   └── window.open(url)
│   └── Settings Icon (NEW)
│       └── Opens DrawingViewerSettings dialog
│
└── Settings Dialog (NEW)
    ├── ERP ID input
    ├── Default sheet number
    ├── Window options
    └── Save/Cancel buttons
```

### Database Query

**Backend API Endpoint** (New or existing):
```typescript
GET /api/items/{item_cd}/drawing-info
Response: {
  drawingNumber: string;  // DRAW_NO
  revision: string;       // REV
  available: boolean;
}
```

### Frontend Components

#### 1. DrawingViewerButton Component

**File**: `frontend-prediction/src/components/routing/DrawingViewerButton.tsx`

```typescript
interface DrawingViewerButtonProps {
  itemCode: string;
  disabled?: boolean;
}

export function DrawingViewerButton({ itemCode, disabled }: DrawingViewerButtonProps) {
  const [loading, setLoading] = useState(false);
  const settings = useDrawingViewerSettings();

  const handleClick = async () => {
    setLoading(true);
    try {
      // Fetch drawing info from API
      const drawingInfo = await fetchDrawingInfo(itemCode);

      if (!drawingInfo.available) {
        alert("도면 정보를 찾을 수 없습니다.");
        return;
      }

      // Build ERP viewer URL
      const url = buildErpViewerUrl({
        erpid: settings.erpId,
        pid: "1",
        dno: drawingInfo.drawingNumber,
        sheet: settings.defaultSheet || "1",
        rev: drawingInfo.revision,
      });

      // Open in new window
      window.open(url, "_blank", `width=${settings.width},height=${settings.height}`);
    } catch (error) {
      alert("도면 조회 중 오류가 발생했습니다.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading || !itemCode}
      className="..."
    >
      {loading ? "조회 중..." : "도면 조회"}
    </button>
  );
}
```

#### 2. DrawingViewerSettings Dialog

**File**: `frontend-prediction/src/components/routing/DrawingViewerSettings.tsx`

```typescript
interface DrawingViewerSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function DrawingViewerSettings({ open, onClose }: DrawingViewerSettingsProps) {
  const [erpId, setErpId] = useState("");
  const [defaultSheet, setDefaultSheet] = useState("1");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem("drawingViewerSettings", JSON.stringify({
      erpId,
      defaultSheet,
      width,
      height,
    }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>도면 조회 설정</DialogTitle>
      <DialogContent>
        <TextField label="ERP ID" value={erpId} onChange={(e) => setErpId(e.target.value)} />
        <TextField label="기본 시트 번호" value={defaultSheet} onChange={(e) => setDefaultSheet(e.target.value)} />
        <TextField label="창 너비" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        <TextField label="창 높이" type="number" type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSave}>저장</Button>
      </DialogActions>
    </Dialog>
  );
}
```

#### 3. Backend API Function

**File**: `backend/api/routes/items.py` (or new routes file)

```python
@router.get("/items/{item_cd}/drawing-info")
async def get_drawing_info(item_cd: str):
    """
    Fetch drawing information from item_info table.

    Returns:
        {
            "drawingNumber": str,
            "revision": str,
            "available": bool
        }
    """
    query = """
        SELECT DRAW_NO, REV
        FROM item_info
        WHERE ITEM_CD = :item_cd
    """

    result = await database.fetch_one(query, {"item_cd": item_cd})

    if result and result["DRAW_NO"]:
        return {
            "drawingNumber": result["DRAW_NO"],
            "revision": result["REV"] or "",
            "available": True
        }
    else:
        return {
            "drawingNumber": "",
            "revision": "",
            "available": False
        }
```

### URL Builder Utility

**File**: `frontend-prediction/src/utils/erpViewerUrl.ts`

```typescript
interface ErpViewerParams {
  erpid: string;
  pid: string;
  dno: string;
  sheet: string;
  rev: string;
}

export function buildErpViewerUrl(params: ErpViewerParams): string {
  const baseUrl = "https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx";
  const urlParams = new URLSearchParams({
    erpid: params.erpid,
    pid: params.pid,
    dno: params.dno,
    sheet: params.sheet,
    rev: params.rev,
  });
  return `${baseUrl}?${urlParams.toString()}`;
}
```

---

## Implementation Phases

### Phase 1: Backend API Implementation (2-3 hours)

**Tasks**:
1. Create `/api/items/{item_cd}/drawing-info` endpoint
2. Implement MSSQL query to fetch DRAW_NO and REV
3. Add error handling for missing data
4. Test endpoint with sample item codes
5. Document API endpoint

**Deliverables**:
- Working API endpoint
- API documentation
- Unit tests for endpoint

**Git Checkpoint**: Commit Phase 1

---

### Phase 2: Frontend Components (3-4 hours)

**Tasks**:
1. Create `DrawingViewerButton.tsx` component
2. Create `DrawingViewerSettings.tsx` dialog component
3. Create `erpViewerUrl.ts` utility
4. Add API client function `fetchDrawingInfo()`
5. Implement settings storage (localStorage)
6. Add button to routing visualization tab

**Deliverables**:
- DrawingViewerButton component
- Settings dialog component
- URL builder utility
- Components integrated in visualization tab

**Git Checkpoint**: Commit Phase 2

---

### Phase 3: Integration and Testing (2-3 hours)

**Tasks**:
1. Integrate button with routing visualization page
2. Connect to item selection state
3. Test with real item codes and drawing data
4. Test settings persistence
5. Test URL generation and window opening
6. Handle edge cases (missing data, network errors)
7. Add loading and error states

**Deliverables**:
- Fully integrated feature
- Error handling complete
- All edge cases handled

**Git Checkpoint**: Commit Phase 3

---

### Phase 4: Polish and Documentation (1-2 hours)

**Tasks**:
1. Add Korean tooltips
2. Improve button styling
3. Add keyboard shortcuts (optional)
4. Create user documentation
5. Create implementation document
6. Final testing and bug fixes

**Deliverables**:
- Polished UI
- User documentation
- Implementation document
- All bugs fixed

**Git Checkpoint**: Commit Phase 4, Final Merge

---

## Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 | 2-3h | 2-3h |
| Phase 2 | 3-4h | 5-7h |
| Phase 3 | 2-3h | 7-10h |
| Phase 4 | 1-2h | 8-12h |

**Total Estimate**: 8-12 hours (1-1.5 days)

---

## Success Criteria

### Must Have

- [ ] [도면 조회] button visible on routing visualization tab
- [ ] Button fetches DRAW_NO and REV from MSSQL item_info table
- [ ] Button opens ERP Image Viewer in new window with correct URL
- [ ] Settings dialog allows ERP ID and sheet configuration
- [ ] Settings persist across sessions
- [ ] Error handling for missing drawing data
- [ ] Loading state during API call

### Should Have

- [ ] Tooltip showing drawing info on hover
- [ ] Disabled state when no item selected
- [ ] Success feedback when opening viewer
- [ ] Settings icon next to button
- [ ] Window size configuration

### Nice to Have

- [ ] Keyboard shortcut for opening viewer
- [ ] Recent drawings history
- [ ] Drawing preview thumbnail
- [ ] Batch open multiple drawings

---

## Dependencies

### Required

- MSSQL database access to item_info table
- ERP Image Viewer URL accessibility (https://img.ksm.co.kr/...)
- User ERP ID available in session or settings
- Routing visualization page with item selection state

### Optional

- Dialog component library (if not already available)
- Icon library for settings icon

---

## Risks and Mitigation

### Risk 1: DRAW_NO or REV column empty/null

**Likelihood**: High
**Impact**: Medium
**Mitigation**:
- Check for null/empty values before opening viewer
- Display clear error message to user
- Disable button when drawing info unavailable

### Risk 2: ERP Image Viewer URL changes

**Likelihood**: Low
**Impact**: High
**Mitigation**:
- Store base URL in configuration file
- Make URL configurable in settings
- Document URL structure for future updates

### Risk 3: CORS or network issues accessing ERP viewer

**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Open in new window (not iframe) to avoid CORS
- Provide clear error messages for network failures
- Test with various network conditions

### Risk 4: User doesn't know their ERP ID

**Likelihood**: Medium
**Impact**: Low
**Mitigation**:
- Provide help text in settings dialog
- Show where to find ERP ID
- Consider auto-detection if possible

---

## Acceptance Criteria

### User Stories

**As a routing planner, I want to:**
- Click [도면 조회] button to view technical drawings
- See drawings without leaving routing creation page
- Have drawing number auto-populated from database
- Configure my ERP ID once and reuse it

### Acceptance Tests

1. **Button Visibility**
   - Given I am on routing visualization tab
   - When an item is selected
   - Then [도면 조회] button is visible on the left side

2. **Open Drawing Viewer**
   - Given [도면 조회] button is clicked
   - When drawing info exists in database
   - Then ERP Image Viewer opens in new window
   - And URL contains correct drawing number and revision

3. **Handle Missing Drawing**
   - Given [도면 조회] button is clicked
   - When no drawing info exists for item
   - Then error message displays
   - And viewer does not open

4. **Settings Persistence**
   - Given I configure ERP ID in settings
   - When I save settings and refresh page
   - Then settings are still available
   - And button uses saved ERP ID

5. **Loading State**
   - Given [도면 조회] button is clicked
   - When API request is in progress
   - Then button shows loading state
   - And button is disabled during loading

---

## Future Enhancements

### v2 Features

- Drawing preview thumbnail on hover
- Recent drawings history list
- Batch open multiple related drawings
- Drawing version comparison
- Download drawing as PDF

### v3 Features

- Drawing annotations and markup
- Embedded drawing viewer (no external window)
- Drawing change notifications
- Integration with revision control system

---

## References

### Related Documents

- Routing Visualization Page: `frontend-prediction/src/pages/RoutingCreation.tsx`
- API Client: `frontend-prediction/src/lib/apiClient.ts`
- Database Schema: MSSQL item_info table

### External Systems

- KSM ERP Image Viewer: https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx
- MSSQL Database: item_info table (DRAW_NO, REV columns)

### URL Structure

```
https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx
  ?erpid={사용자 ERP ID}
  &pid=1              (1=Eng, 2=Doc 등)
  &dno={도면번호}      (item_info.DRAW_NO)
  &sheet={시트번호}
  &rev={Revision}     (item_info.REV)
```

---

## Approvals

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | - | - | Pending |
| Tech Lead | - | - | Pending |
| QA Lead | - | - | Pending |

---

**Last Updated**: 2025-10-22
**Next Review**: After Phase 1 completion
**Document Version**: 1.0
