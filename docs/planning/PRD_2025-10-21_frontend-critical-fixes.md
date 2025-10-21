# PRD: Frontend Critical Fixes
**날짜**: 2025-10-21
**버전**: 1.0
**담당자**: Claude (Sonnet 4.5)

---

## 1. Executive Summary

3개의 Critical Frontend 오류를 수정합니다:
1. **ERP View 컬럼 드롭다운 작동 안 함** - hasRequestedData 로직 문제
2. **Training Frontend 무한 루프** - AlgorithmVisualizationWorkspace useEffect 의존성 문제
3. **Data Quality Monitoring 404 오류** - 백엔드 API 라우트 누락

**예상 소요 시간**: 2시간
**우선순위**: P0 (Critical)
**영향도**: 사용자가 핵심 기능 사용 불가

---

## 2. Problem Statement

### Issue #1: ERP View 컬럼 드롭다운 비활성화
**증상**:
- ERP View 선택 후 "컬럼" 드롭다운이 "선택하세요" 상태로 비활성화됨
- 사용자가 품목 검색을 위해 검색 버튼을 눌러야만 컬럼 로드됨

**근본 원인**:
```typescript
// ErpItemExplorer.tsx:69
enabled: Boolean(selectedView) && hasRequestedData
```
- `hasRequestedData`가 초기값 `false`로 설정됨 (Line 37)
- View 선택 시에도 `false`로 유지됨
- 검색 버튼 클릭 시에만 `setHasRequestedData(true)` 실행 (Line 159)

**영향**:
- UX 저하 (사용자가 View 선택 → 자동 컬럼 로드를 기대하지만 안 됨)
- 추가 클릭 필요 (검색 버튼)
- 서버 응답 지연 오류 메시지 발생 (API 호출 자체가 안 됨)

### Issue #2: Training Frontend Maximum Update Depth Exceeded
**증상**:
```
Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
at AlgorithmVisualizationWorkspace.tsx:502
```

**근본 원인** (Task agent 분석 결과):
```typescript
// Lines 582-603
useEffect(() => {
  if (!searchQuery) {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        style: { ...node.style, opacity: 1 },
      }))
    );
    return;
  }

  const query = searchQuery.toLowerCase();
  setNodes((nds) =>
    nds.map((node) => {
      const matches = node.data.label?.toLowerCase().includes(query);
      return {
        ...node,
        style: { ...node.style, opacity: matches ? 1 : 0.3 },
      };
    })
  );
}, [searchQuery]); // ❌ Missing 'nodes' dependency
```

**무한 루프 메커니즘**:
1. `setNodes()` 호출 → 새 node 객체 생성 (spread operator)
2. React Flow가 변경 감지 → `onNodesChange` 이벤트 발생
3. `handleNodesChange` 호출 → `setNodes(applyNodeChanges(...))` 재호출
4. React Flow가 다시 변경 감지 → **무한 루프**

**영향**:
- 애플리케이션 크래시
- 사용자가 알고리즘 시각화 기능 사용 불가
- 브라우저 성능 저하 (무한 리렌더링)

### Issue #3: Data Quality Monitoring 404 Error
**증상**:
```
Error: Request failed with status code 404
GET /api/data-quality/metrics
```

**근본 원인** (조사 완료):
```python
# backend/api/routes/data_quality.py:16
router = APIRouter(prefix="/data-quality", tags=["data-quality"])  # ❌ Missing /api prefix!
```

**분석**:
1. 프론트엔드: `api.get("/data-quality/metrics")` → baseURL `/api` + path → `/api/data-quality/metrics` 요청
2. 백엔드: 대부분 라우터는 `prefix="/api/xxx"` 패턴 사용 ✅
3. **data_quality router만** `prefix="/data-quality"` 사용 ❌
4. 실제 등록된 경로: `/data-quality/metrics` (NOT `/api/data-quality/metrics`)
5. 결과: Frontend 요청 URL과 Backend 라우트 불일치 → 404 Not Found

**증거**:
```bash
# 모든 라우터 prefix 확인
health.py:        prefix="/api"         ✅
anomaly.py:       prefix="/api/anomaly" ✅
dashboard.py:     prefix="/api/dashboard" ✅
data_quality.py:  prefix="/data-quality"  ❌ Missing /api!
training.py:      prefix="/api/training" ✅
```

**영향**:
- Data Quality Monitoring 페이지 전체 기능 불가
- 메트릭 대시보드 렌더링 실패
- 사용자가 데이터 품질 정보 확인 불가

---

## 3. Solution Design

### Solution #1: ERP View 컬럼 자동 로드

**변경 파일**: `frontend-prediction/src/components/routing/ErpItemExplorer.tsx`

**수정 전** (Lines 52-56):
```typescript
useEffect(() => {
  if (!selectedView && defaultViewName) {
    setSelectedView(defaultViewName);
  }
}, [defaultViewName, selectedView]);
```

**수정 후**:
```typescript
useEffect(() => {
  if (!selectedView && defaultViewName) {
    setSelectedView(defaultViewName);
  }
}, [defaultViewName, selectedView]);

// ✅ NEW: View 선택 시 자동으로 데이터 로드
useEffect(() => {
  if (selectedView) {
    setHasRequestedData(true);
  }
}, [selectedView]);
```

**대안 접근 (더 간단)**:
`hasRequestedData` state를 완전히 제거하고 `enabled: Boolean(selectedView)`만 사용:

```typescript
// Line 69: 기존
enabled: Boolean(selectedView) && hasRequestedData

// 수정 후
enabled: Boolean(selectedView)
```

**선택**: 대안 접근 (더 간단하고 명확함)

### Solution #2: React Infinite Loop 수정

**변경 파일**: `frontend-training/src/components/workspaces/AlgorithmVisualizationWorkspace.tsx`

**수정 전** (Lines 582-603):
```typescript
useEffect(() => {
  if (!searchQuery) {
    setNodes((nds) => nds.map((node) => ({
      ...node,
      style: { ...node.style, opacity: 1 },
    })));
    return;
  }

  const query = searchQuery.toLowerCase();
  setNodes((nds) =>
    nds.map((node) => {
      const matches = node.data.label?.toLowerCase().includes(query);
      return {
        ...node,
        style: { ...node.style, opacity: matches ? 1 : 0.3 },
      };
    })
  );
}, [searchQuery]);
```

**수정 후** (useMemo 사용):
```typescript
// ❌ Remove the problematic useEffect entirely

// ✅ Replace with useMemo
const displayNodes = useMemo(() => {
  if (!searchQuery || nodes.length === 0) {
    return nodes;
  }

  const query = searchQuery.toLowerCase();
  return nodes.map((node) => {
    const matches = node.data.label?.toLowerCase().includes(query);
    return {
      ...node,
      style: { ...node.style, opacity: matches ? 1 : 0.3 },
    };
  });
}, [nodes, searchQuery]);
```

**ReactFlow 컴포넌트 수정**:
```typescript
// Before
<ReactFlow
  nodes={viewMode === 'static' ? staticNodes : nodes}
  ...
/>

// After
<ReactFlow
  nodes={viewMode === 'static' ? staticNodes : displayNodes}
  ...
/>
```

### Solution #3: Data Quality Monitoring 404 수정

**변경 파일**: `backend/api/routes/data_quality.py`

**수정 전** (Line 16):
```python
router = APIRouter(prefix="/data-quality", tags=["data-quality"])
```

**수정 후**:
```python
router = APIRouter(prefix="/api/data-quality", tags=["data-quality"])
```

**변경 사항**:
- APIRouter prefix에 `/api` 추가
- 다른 모든 라우터와 일관성 유지
- 프론트엔드 요청 URL (`/api/data-quality/metrics`)과 일치

**영향 범위**:
- 백엔드 서버 재시작 필요
- 프론트엔드 코드 변경 불필요 (이미 올바른 URL 사용 중)
- 테스트 필요: Data Quality Monitoring 페이지 접속 확인

---

## 4. Implementation Plan

### Phase 1: Issue #1 수정 (30분)
- ErpItemExplorer.tsx 수정
- `hasRequestedData` 로직 제거 또는 수정
- 로컬 테스트

### Phase 2: Issue #2 수정 (45분)
- AlgorithmVisualizationWorkspace.tsx 수정
- useEffect → useMemo 리팩토링
- displayNodes 변수 추가
- ReactFlow props 수정
- 로컬 테스트

### Phase 3: Issue #3 조사 및 수정 (45분)
- 프론트엔드 API 호출 위치 확인
- 백엔드 라우터 확인
- 누락된 라우트 추가 또는 URL 수정
- 로컬 테스트

### Phase 4: Git Operations (WORKFLOW_DIRECTIVES Section 7.6)
- `git status` 확인
- `git add -A` (모든 변경사항)
- `git status` 재확인 (Changes not staged 없음 확인)
- Commit with detailed message
- Push to 251014
- Merge to main
- Return to 251014

---

## 5. Testing Plan

### Test Case #1: ERP View 컬럼 드롭다운
**Steps**:
1. 라우팅 생성 페이지 열기
2. ERP View Item 리스트 섹션 확인
3. ERP View 드롭다운에서 "dbo.BI_ITEM_INFO_VIEW" 선택
4. **Expected**: 컬럼 드롭다운이 자동으로 활성화되고 옵션 표시됨
5. 컬럼 선택 가능 확인

### Test Case #2: Training Frontend 무한 루프
**Steps**:
1. Training 페이지 열기
2. "데이터 품질 모니터링" 탭 클릭
3. **Expected**: 오류 없이 페이지 로드됨
4. 검색 기능 사용
5. **Expected**: 노드 opacity 변경되지만 무한 루프 없음

### Test Case #3: Data Quality Monitoring 404
**Steps**:
1. Data Quality Monitoring 페이지 열기
2. **Expected**: 404 오류 없이 데이터 로드됨
3. Metrics Dashboard 확인
4. **Expected**: 정상 데이터 표시

---

## 6. Rollback Plan

**If Issue #1 fix breaks**:
- Revert ErpItemExplorer.tsx to previous version
- Keep hasRequestedData logic

**If Issue #2 fix breaks**:
- Revert AlgorithmVisualizationWorkspace.tsx
- Add nodes to useEffect dependency array as temporary fix

**If Issue #3 fix breaks**:
- Disable Data Quality Monitoring feature
- Add "Under Maintenance" message

---

## 7. Success Criteria

- ✅ ERP View 컬럼 드롭다운이 View 선택 시 자동 활성화
- ✅ Training Frontend에서 무한 루프 오류 없음
- ✅ Data Quality Monitoring에서 404 오류 없음
- ✅ 모든 테스트 케이스 통과
- ✅ Git staging 규칙 (Section 7.6) 준수하여 커밋

---

## 8. Change Log

**2025-10-21 - Initial Version**
- 3개 Critical Frontend Issues 식별
- Solution Design 완료
- PRD 작성

---

**Last Updated**: 2025-10-21
**Next Review**: After implementation
