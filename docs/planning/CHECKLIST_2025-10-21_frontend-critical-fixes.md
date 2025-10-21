# CHECKLIST: Frontend Critical Fixes
**PRD**: [PRD_2025-10-21_frontend-critical-fixes.md](PRD_2025-10-21_frontend-critical-fixes.md)
**날짜**: 2025-10-21
**버전**: 1.0

---

## Progress Overview

```
Phase 1 (Issue #1): [████████████] 100% (5/5 tasks) ✅
Phase 2 (Issue #2): [████████████] 100% (6/6 tasks) ✅
Phase 3 (Issue #3): [████████░░░░] 57% (4/7 tasks) 🔄

Total: [████████████░░] 83% (15/18 tasks)
```

---

## Phase 1: Issue #1 - ERP View 컬럼 드롭다운 수정

**Estimated Time**: 30분
**Status**: Not Started

### 1.1 코드 분석
- [ ] ErpItemExplorer.tsx Line 69 `enabled` 로직 확인
- [ ] hasRequestedData state 사용처 전체 검색
- [ ] 현재 동작 흐름 이해

### 1.2 수정 구현
- [ ] hasRequestedData 로직 제거
  - Line 37: state 선언 제거
  - Line 69: `enabled: Boolean(selectedView)` 수정
  - Line 111: `setHasRequestedData(false)` 제거
  - Line 159: `setHasRequestedData(true)` 제거
  - Line 160: hasRequestedData 의존성 제거

### 1.3 로컬 테스트
- [ ] 브라우저 개발자 도구 열기
- [ ] 라우팅 생성 페이지 접속
- [ ] ERP View 선택 시 컬럼 자동 로드 확인
- [ ] 컬럼 드롭다운 활성화 확인

### 1.4 문서 업데이트
- [ ] PRD에 실제 수정 내용 반영
- [ ] CHECKLIST 진행률 업데이트

**Git Operations**:
- [ ] **Git staging 완전성 확인** (Section 7.6.1)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 1
- [ ] Push to 251014

---

## Phase 2: Issue #2 - Training Frontend 무한 루프 수정

**Estimated Time**: 45분
**Status**: Not Started

### 2.1 코드 분석
- [ ] AlgorithmVisualizationWorkspace.tsx Line 582-603 확인
- [ ] useEffect 의존성 배열 분석
- [ ] Task agent 보고서 재검토

### 2.2 useEffect 제거
- [ ] Lines 582-603 useEffect 전체 삭제
- [ ] 주석으로 삭제 이유 명시

### 2.3 useMemo 추가
- [ ] displayNodes useMemo 추가 (Line 582 위치)
```typescript
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

### 2.4 ReactFlow 컴포넌트 수정
- [ ] Line 946 ReactFlow nodes prop 수정
  - Before: `nodes={viewMode === 'static' ? staticNodes : nodes}`
  - After: `nodes={viewMode === 'static' ? staticNodes : displayNodes}`

### 2.5 로컬 테스트
- [ ] Training 페이지 접속
- [ ] 데이터 품질 모니터링 탭 클릭
- [ ] 오류 없이 로드 확인
- [ ] 브라우저 콘솔 오류 없음 확인

### 2.6 문서 업데이트
- [ ] CHECKLIST 진행률 업데이트

**Git Operations**:
- [ ] **Git staging 완전성 확인** (Section 7.6.1)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 2
- [ ] Push to 251014

---

## Phase 3: Issue #3 - Data Quality Monitoring 404 수정

**Estimated Time**: 45분
**Status**: Not Started

### 3.1 프론트엔드 API 호출 조사
- [x] Data Quality Monitoring 컴포넌트 파일 찾기
  - MetricsPanel.tsx → apiClient.ts 사용
- [x] API 호출 URL 확인 (axios.get 등)
  - `/data-quality/metrics` (baseURL `/api` 적용 시 `/api/data-quality/metrics`)
- [x] 요청하는 엔드포인트 목록 작성
  - GET /api/data-quality/metrics

### 3.2 백엔드 라우터 확인
- [x] `backend/api/routes/data_quality.py` 파일 읽기
- [x] 등록된 라우트 목록 확인
  - @router.get("/metrics") - Line 24
  - router prefix: "/data-quality" - Line 16 ❌
- [x] `backend/api/app.py`에서 라우터 등록 확인
  - Line 120: app.include_router(data_quality_router) ✅

### 3.3 불일치 분석
- [x] 프론트엔드 요청 URL vs 백엔드 라우트 비교
  - Frontend: `/api/data-quality/metrics`
  - Backend: `/data-quality/metrics` (missing /api!)
- [x] 누락된 라우트 식별
  - Router prefix에 `/api` 누락
- [x] URL path 오타 확인
  - 오타 없음, prefix 불일치 문제

### 3.4 수정 구현
- [x] 백엔드 라우트 수정
  - Line 16: `prefix="/api/data-quality"` ✅
- [x] 프론트엔드 URL 수정 (필요 시)
  - 수정 불필요 (이미 올바름)
- [x] FastAPI app.py 라우터 등록 (필요 시)
  - 이미 등록되어 있음 (Line 120)

### 3.5 로컬 테스트
- [ ] 백엔드 서버 실행 확인
- [ ] Data Quality Monitoring 페이지 접속
- [ ] 404 오류 없음 확인
- [ ] Metrics Dashboard 데이터 표시 확인

### 3.6 문서 업데이트
- [ ] PRD에 실제 원인 및 수정 내용 추가
- [ ] CHECKLIST 진행률 업데이트

### 3.7 통합 테스트
- [ ] 모든 3개 이슈 수정 후 전체 애플리케이션 테스트
- [ ] 회귀 테스트 (기존 기능 정상 작동 확인)

**Git Operations**:
- [ ] **Git staging 완전성 확인** (Section 7.6.1)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] **Merge 전 검증** (Section 7.6.4)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Final Checklist

### Acceptance Criteria
- [ ] Issue #1: ERP View 컬럼 드롭다운 자동 활성화 ✅
- [ ] Issue #2: Training Frontend 무한 루프 오류 없음 ✅
- [ ] Issue #3: Data Quality Monitoring 404 오류 없음 ✅
- [ ] 모든 테스트 케이스 통과
- [ ] Git staging 규칙 (Section 7.6) 100% 준수
- [ ] PRD 및 CHECKLIST 업데이트 완료

### Documentation
- [ ] PRD 최종 업데이트
- [ ] CHECKLIST 100% 완료 표시
- [ ] Work history document (선택 사항)

---

**Last Updated**: 2025-10-21
**Next Review**: After Phase completion
