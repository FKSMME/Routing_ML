# PRD: Custom Process Nodes Management System

**Date**: 2025-10-24
**Status**: In Planning
**Priority**: High
**Related Issue**: Bug Report #3 from 2025-10-24

---

## Executive Summary

현재 "후보 공정 노드" 탭은 ML 추천 결과를 그대로 표시하고 있으나, 실제로는 **사용자가 수동으로 관리하는 커스텀 공정 노드** 시스템이어야 합니다.

사용자는 ML이 추천할 수 없는 공정들(용접, 도색, 검사 등)을 직접 추가하고 관리하며, 이를 드래그하여 라우팅 또는 블루프린트에 추가할 수 있어야 합니다.

**Expected Outcome**:
- 사용자 정의 공정 노드 CRUD 시스템
- 1줄 수평 레이아웃으로 노드 표시
- 드래그 앤 드롭으로 라우팅/블루프린트에 추가
- 개인별 커스텀 노드 저장/관리

---

## Problem Statement

### Current Behavior (잘못된 구현)

**"후보 공정 노드" 탭**:
- ML 추천 후보를 그대로 표시
- 추천 결과와 중복된 정보
- 사용자가 직접 추가/관리 불가능

**근본 문제**:
> "추천이 불가능한 용접이나, 도색등 도면을 직접 보고 사용자가 스스로 추가할 노드들을 관리하고, 그 노드를 시각화의 라우팅이나, 블루프린트 노드에 추가하고 순서를 정할 수 있는 기능인거야."

### Expected Behavior (올바른 구현)

**"사용자 정의 공정 노드"**:
1. **노드 관리**:
   - 사용자가 공정 코드, 공정명을 입력하여 노드 추가
   - 수정, 삭제 가능
   - 개인별 저장 (user-specific)

2. **UI 레이아웃**:
   - 1줄 수평 스크롤 레이아웃
   - 각 노드는 카드 형태로 표시
   - "+" 버튼으로 새 노드 추가

3. **사용 방법**:
   - 노드를 드래그하여 라우팅 시각화에 추가
   - 블루프린트에도 추가 가능
   - 순서 조정 가능

4. **사용 사례**:
   - 용접 (WELD) - ML이 학습하지 못한 공정
   - 도색 (PAINT) - 도면 확인 후 수동 추가
   - 검사 (INSPECT) - 특정 품목에만 필요
   - 조립 (ASSEMBLY) - 커스텀 공정

---

## Goals and Objectives

### Primary Goals

1. **커스텀 노드 관리 시스템 구축**
   - 사용자별 커스텀 공정 노드 CRUD API
   - Frontend UI로 노드 추가/수정/삭제
   - 노드 정보: 공정코드, 공정명, 예상시간 (선택)

2. **UI/UX 재설계**
   - 추천 리스트 → 커스텀 노드 관리로 변경
   - 1줄 수평 레이아웃
   - 드래그 앤 드롭 지원

3. **라우팅 통합**
   - 커스텀 노드를 라우팅에 추가
   - 블루프린트 타임라인에 삽입
   - 순서 조정 가능

### Secondary Goals

- 자주 사용하는 노드 템플릿 제공
- 팀 단위 노드 공유 (향후 확장)

---

## Requirements

### Functional Requirements

#### FR-1: Backend - Custom Node Storage

**데이터 모델**:
```python
class UserCustomNode(BaseModel):
    id: str  # UUID
    user_id: str  # 소유자
    process_code: str  # 공정 코드 (예: WELD, PAINT)
    process_name: str  # 공정명 (예: 용접, 도색)
    estimated_time: Optional[float]  # 예상 소요시간 (분)
    color: Optional[str]  # UI 색상 코드
    created_at: datetime
    updated_at: datetime
```

**API Endpoints**:
- `GET /api/custom-nodes` - 현재 사용자의 커스텀 노드 목록
- `POST /api/custom-nodes` - 새 노드 생성
- `PUT /api/custom-nodes/{id}` - 노드 수정
- `DELETE /api/custom-nodes/{id}` - 노드 삭제

#### FR-2: Frontend - Node Management UI

**레이아웃**:
```
┌──────────────────────────────────────────────────────────┐
│ 사용자 정의 공정 노드                          [+ 추가] │
├──────────────────────────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐            │
│  │ 용접  │  │ 도색  │  │ 검사  │  │ 조립  │  →         │
│  │ WELD  │  │ PAINT │  │INSPECT│  │ASSEMB │            │
│  │ 15분  │  │ 30분  │  │ 10분  │  │ 20분  │            │
│  └───────┘  └───────┘  └───────┘  └───────┘            │
└──────────────────────────────────────────────────────────┘
```

**기능**:
- 수평 스크롤 가능한 노드 리스트
- 각 노드 hover 시 편집/삭제 버튼
- 드래그 가능 (draggable)
- "+" 버튼 클릭 시 노드 추가 모달

#### FR-3: Drag and Drop Integration

**드래그 소스**:
- 커스텀 노드를 드래그 시작

**드롭 타겟**:
- 라우팅 타임라인 (TimelinePanel)
- 블루프린트 타임라인
- 공정 순서 사이에 삽입

**드롭 동작**:
- 드롭 위치에 커스텀 공정 추가
- 자동으로 seq 번호 재정렬
- 시각화 즉시 업데이트

#### FR-4: Node Add/Edit Modal

**필드**:
- 공정 코드 (필수, 영문 대문자)
- 공정명 (필수, 한글/영문)
- 예상 시간 (선택, 숫자)
- 색상 (선택, color picker)

**Validation**:
- 공정 코드 중복 체크
- 공정 코드 형식 검증 (영문 대문자, 언더스코어)

### Non-Functional Requirements

#### NFR-1: Performance
- 노드 목록 로딩 시간 < 500ms
- 드래그 앤 드롭 응답 < 100ms

#### NFR-2: User Experience
- 직관적인 UI (사용자 설명 없이 사용 가능)
- 실수로 삭제 방지 (확인 대화상자)

#### NFR-3: Data Persistence
- 사용자별 노드 저장
- 브라우저 새로고침 후에도 유지

---

## Phase Breakdown

### Phase 1: Backend API Implementation (3-4 hours)

**Tasks**:
1. 데이터베이스 스키마 설계 (SQLite table 또는 JSON 파일)
2. Pydantic 모델 정의 (CustomNodeCreate, CustomNodeUpdate, CustomNodeResponse)
3. CRUD API 구현 (routes/custom_nodes.py)
4. 사용자 인증 통합 (current_user 기반 필터링)
5. API 테스트

**Deliverables**:
- `backend/models/custom_node.py` (if using DB)
- `backend/api/routes/custom_nodes.py`
- `backend/api/schemas.py` (CustomNode schemas)

### Phase 2: Frontend State Management (2-3 hours)

**Tasks**:
1. Custom nodes API client functions
2. React Query hook (useCustomNodes)
3. Zustand store slice (if needed) or local state
4. CRUD mutations (add, update, delete)

**Deliverables**:
- `frontend-prediction/src/lib/apiClient.ts` (custom node functions)
- `frontend-prediction/src/hooks/useCustomNodes.ts`

### Phase 3: UI Component Implementation (3-4 hours)

**Tasks**:
1. CustomNodeCard component (노드 카드)
2. CustomNodeList component (1줄 레이아웃)
3. CustomNodeModal component (추가/수정 폼)
4. CandidateNodeTabs 교체 또는 리팩토링
5. 드래그 핸들러 추가

**Deliverables**:
- `frontend-prediction/src/components/routing/CustomNodeCard.tsx`
- `frontend-prediction/src/components/routing/CustomNodeList.tsx`
- `frontend-prediction/src/components/routing/CustomNodeModal.tsx`

### Phase 4: Drag & Drop Integration (2-3 hours)

**Tasks**:
1. CustomNodeCard에 draggable 속성 추가
2. TimelinePanel에 drop handler 추가
3. 드롭 시 노드 삽입 로직
4. Seq 재정렬
5. 시각화 업데이트

**Deliverables**:
- Updated TimelinePanel with drop zones
- Drag data format definition
- Insert logic in routingStore

### Phase 5: Testing & Polish (1-2 hours)

**Tasks**:
1. 노드 CRUD 테스트
2. 드래그 앤 드롭 테스트
3. 다중 사용자 시나리오 테스트
4. UI/UX 개선
5. 문서 업데이트

**Deliverables**:
- Test results
- Bug fixes
- User guide (optional)

---

## Success Criteria

### Must Have
- ✅ 사용자가 커스텀 노드 추가/수정/삭제 가능
- ✅ 노드가 1줄 수평 레이아웃으로 표시
- ✅ 드래그하여 라우팅에 추가 가능
- ✅ 개인별 노드 저장 (user-specific)
- ✅ ML 추천 리스트와 혼동 없음

### Should Have
- 색상 커스터마이징
- 자주 사용하는 노드 템플릿

### Nice to Have
- 팀 단위 노드 공유
- 노드 카테고리 분류

---

## Timeline Estimates

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Backend API | 3-4 hours | None |
| Phase 2: State Management | 2-3 hours | Phase 1 |
| Phase 3: UI Components | 3-4 hours | Phase 2 |
| Phase 4: Drag & Drop | 2-3 hours | Phase 3 |
| Phase 5: Testing | 1-2 hours | Phase 4 |
| **Total** | **11-16 hours** | |

---

## Technical Considerations

### Data Storage Options

**Option A: Database Table**
- Pros: Structured, scalable, relational
- Cons: Requires migration

**Option B: JSON File per User**
- Pros: Simple, no migration
- Cons: Less queryable

**Recommendation**: Option A (Database table) for production quality

### Drag & Drop Library

현재 프로젝트가 이미 사용하는 드래그 앤 드롭 라이브러리 확인 필요:
- `@lib/dragAndDrop.ts` 존재 확인됨
- 기존 시스템 활용

### Color Coding

각 노드 타입별 색상:
- 용접 (WELD): Orange
- 도색 (PAINT): Blue
- 검사 (INSPECT): Green
- 조립 (ASSEMBLY): Purple
- 기타: Gray

---

## Risks and Mitigation

### Risk 1: 드래그 앤 드롭 충돌
**Impact**: Medium
**Probability**: Medium
**Mitigation**: 기존 드래그 시스템과 data format 통일

### Risk 2: 사용자 혼란 (용도 불명확)
**Impact**: High
**Probability**: Low
**Mitigation**: 명확한 레이블 및 툴팁 제공

### Risk 3: 노드 데이터 손실
**Impact**: High
**Probability**: Low
**Mitigation**: 정기 백업, soft delete

---

## Open Questions

1. 노드 삭제 시 이미 라우팅에 추가된 노드는 어떻게 처리? (유지 vs 삭제)
2. 노드 최대 개수 제한? (예: 사용자당 50개)
3. 색상 선택 필수 vs 선택?

---

## Approval & Sign-off

**Prepared By**: Claude (AI Assistant)
**Date**: 2025-10-24
**Status**: Ready for Implementation

---

**Next Steps**:
1. Create CHECKLIST_2025-10-24_custom-process-nodes.md
2. Begin Phase 1 implementation (Backend API)
3. Update checklist as tasks complete
