# PRD: Routing Visualization Enhancements

**Date**: 2025-10-20
**Author**: Claude (AI Assistant)
**Status**: Planning
**Priority**: High

---

## 1. Overview

### Background
현재 라우팅 시각화 시스템에서 다음과 같은 문제점들이 발견되었습니다:
1. "제어판" 탭 이름이 실제 기능과 맞지 않음 (예측 대상 품목 선택 기능)
2. 여러 개의 Item Code 입력 시 라우팅 생성이 작동하지 않음
3. 생성된 여러 품목의 라우팅 리스트를 선택하여 시각화할 수 있는 UI가 없음
4. 후보목록 박스의 디자인이 비효율적 (가로 스크롤, 레이아웃 문제)
5. Timeline과 Recommendation 간 노드 추가/연결 기능 불일치

### Goals
- 사용자 경험 개선: 직관적인 탭 이름 및 레이아웃
- 다중 품목 라우팅 생성 기능 복구
- 품목별 라우팅 선택 UI 추가
- 후보목록 박스 디자인 개선
- 드래그 앤 드롭으로 노드 연결/해제 기능 구현

---

## 2. Requirements

### 2.1 탭 이름 변경 (Phase 1)
**현재**: "제어판"
**변경**: "예측 대상 품목"

**이유**:
- 해당 탭의 주요 기능은 ERP View에서 품목을 선택하고 예측 파라미터를 설정하는 것
- "제어판"은 너무 일반적이고 기능을 명확히 표현하지 못함

**파일**:
- `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx` (line 75)

---

### 2.2 다중 품목 라우팅 생성 수정 (Phase 2)
**문제**:
- 여러 개의 Item Code를 입력하고 "라우팅 생성" 버튼 클릭 시 작동하지 않음
- 각 품목별 학습된 모델 내용대로 라우팅 리스트를 생성해야 함

**요구사항**:
- `onSubmit` 핸들러가 여러 개의 itemCodes를 처리하도록 수정
- 각 itemCode별로 `/api/prediction/routing` API 호출
- 응답 데이터 구조를 품목별로 관리 (Map 또는 Array)

**예상 데이터 구조**:
```typescript
{
  routings: [
    {
      itemCode: "ITEM001",
      candidates: [...],
      metrics: {...}
    },
    {
      itemCode: "ITEM002",
      candidates: [...],
      metrics: {...}
    }
  ],
  selectedItemCode: "ITEM001" // 현재 선택된 품목
}
```

**파일**:
- API 호출 로직이 있는 컴포넌트 (PredictionControls 또는 상위)
- 상태 관리 로직 수정 필요

---

### 2.3 품목 리스트 선택 UI 추가 (Phase 3)
**요구사항**:
- 시각화 탭 좌측에 생성된 품목 리스트 패널 추가
- 리스트에서 품목을 클릭하면 해당 품목의 라우팅 시각화
- 현재 선택된 품목 하이라이트 표시

**UI 레이아웃**:
```
┌─────────────────────────────────────────────────────┐
│  시각화 탭                                           │
├──────────┬──────────────────────────┬────────────────┤
│ 품목     │  타임라인/시각화          │  후보목록       │
│ 리스트   │                          │                │
│ (15%)    │  (55%)                   │  (30%)         │
│          │                          │                │
│ ITEM001 ●│  [Timeline Visualization]│  [Candidates]  │
│ ITEM002  │                          │                │
│ ITEM003  │                          │                │
└──────────┴──────────────────────────┴────────────────┘
```

**새 컴포넌트**:
- `ItemListPanel.tsx` - 품목 리스트 표시 및 선택

**파일**:
- `frontend-prediction/src/components/routing/ItemListPanel.tsx` (신규)
- `RoutingTabbedWorkspace.tsx` - 레이아웃 수정

---

### 2.4 후보목록 박스 디자인 개선 (Phase 4)
**현재 문제**:
- 가로 스크롤 발생
- "후보공정 노드" 설명 불필요
- "후보 공정 노드 - 검색" 레이아웃 비효율적

**개선 사항**:
1. **설명 제거**: "후보공정 노드" 하단의 설명 텍스트 제거
2. **레이아웃 변경**:
   - "후보 공정 노드" 라벨
   - "검색" 입력창
   - 위 두 개를 별도 행으로 배치 (같은 열 아님)
3. **박스 크기 조정**:
   - 가로 크기 확대하여 가로 스크롤 제거
   - 컨텐츠가 박스 내에서 자동 배열되도록 flex-wrap 적용

**변경 전**:
```
┌─────────────────────────────┐
│ 후보 공정 노드 | 검색         │ ← 한 줄
│ 설명 텍스트...               │
│ [노드1] [노드2] [노드3]...→  │ ← 스크롤
└─────────────────────────────┘
```

**변경 후**:
```
┌──────────────────────────────────────┐
│ 후보 공정 노드                        │
│ ┌────────────────────┐               │
│ │ 🔍 검색            │               │
│ └────────────────────┘               │
│                                      │
│ [노드1] [노드2] [노드3]              │
│ [노드4] [노드5] [노드6]              │ ← 자동 줄바꿈
└──────────────────────────────────────┘
```

**파일**:
- `frontend-prediction/src/components/CandidatePanel.tsx`

---

### 2.5 노드 연결 드래그 앤 드롭 구현 (Phase 5)
**현재 문제**:
- Timeline에 후보공정 노드 추가는 되지만 Recommendation에 표시 안됨
- Timeline의 노드 순서가 라우팅 순서와 일치하지 않음
- 와이어(연결선) 시작/끝점을 드래그하여 수정할 수 없음

**요구사항**:

1. **Recommendation 동기화**:
   - Timeline에 추가된 노드가 Recommendation에도 표시되어야 함
   - 양방향 동기화 (Timeline ↔ Recommendation)

2. **라우팅 순서 시각화**:
   - Timeline의 노드가 라우팅 순서대로 연결되어야 함
   - 노드 간 선(edge) 표시

3. **드래그 앤 드롭 와이어 편집**:
   - 와이어 시작점을 드래그하여 다른 노드에 연결
   - 와이어 끝점을 드래그하여 다른 노드에 연결
   - 노드 클릭으로 와이어 연결/해제 토글
   - 와이어 선택 후 Delete 키로 삭제

**기술 스택**:
- React DnD 또는 네이티브 Drag Events
- SVG/Canvas for wire rendering
- State management for connections

**새 유틸리티**:
- `frontend-prediction/src/lib/dragAndDrop.ts` - 드래그 앤 드롭 유틸리티
- Wire connection state management

**파일**:
- `frontend-prediction/src/components/TimelinePanel.tsx`
- `frontend-prediction/src/components/routing/RecommendationPanel.tsx` (있다면)
- `frontend-prediction/src/store/routingStore.ts` (상태 관리)

---

## 3. Technical Design

### 3.1 Data Flow
```
User selects multiple items (ITEM001, ITEM002, ITEM003)
  ↓
onClick "라우팅 생성"
  ↓
For each itemCode:
  POST /api/prediction/routing { itemCode }
  ↓
Store results in state: { itemCode, candidates, metrics }[]
  ↓
Display ItemListPanel with all items
  ↓
User clicks item → Update selectedItemCode → Render Timeline/Candidates for that item
```

### 3.2 State Management
```typescript
interface RoutingState {
  routings: Array<{
    itemCode: string;
    candidates: Candidate[];
    metrics: Metrics;
    timeline: TimelineNode[];
  }>;
  selectedItemCode: string | null;
  connections: Array<{
    id: string;
    from: string; // nodeId
    to: string;   // nodeId
  }>;
}
```

### 3.3 Wire Connection Algorithm
```typescript
interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceAnchor: 'top' | 'right' | 'bottom' | 'left';
  targetAnchor: 'top' | 'right' | 'bottom' | 'left';
}

// Drag start on anchor point
onDragStart(nodeId, anchor) {
  tempConnection = { sourceNodeId: nodeId, sourceAnchor: anchor };
}

// Drag over valid drop target
onDragOver(nodeId, anchor) {
  highlight anchor as valid drop target;
}

// Drop on target anchor
onDrop(nodeId, anchor) {
  createConnection({
    id: uuid(),
    sourceNodeId: tempConnection.sourceNodeId,
    targetNodeId: nodeId,
    sourceAnchor: tempConnection.sourceAnchor,
    targetAnchor: anchor
  });
}
```

---

## 4. Implementation Phases

### Phase 1: 탭 이름 변경
- **Task**: "제어판" → "예측 대상 품목"
- **Files**: RoutingTabbedWorkspace.tsx
- **Time**: 5분

### Phase 2: 다중 품목 라우팅 생성 수정
- **Tasks**:
  - API 호출 로직 수정 (병렬 또는 순차)
  - 상태 관리 구조 변경 (단일 → 배열)
  - 에러 핸들링 개선
- **Files**: PredictionControls.tsx, API client, State management
- **Time**: 1시간

### Phase 3: 품목 리스트 UI 추가
- **Tasks**:
  - ItemListPanel 컴포넌트 생성
  - 레이아웃 재구성 (15% / 55% / 30%)
  - 품목 선택 핸들러 구현
  - 선택된 품목 하이라이트
- **Files**: ItemListPanel.tsx, RoutingTabbedWorkspace.tsx
- **Time**: 1.5시간

### Phase 4: 후보목록 디자인 개선
- **Tasks**:
  - 설명 텍스트 제거
  - 라벨과 검색창 레이아웃 변경
  - Flex-wrap으로 자동 줄바꿈
  - 박스 가로 크기 확대
- **Files**: CandidatePanel.tsx, CSS
- **Time**: 30분

### Phase 5: 노드 연결 드래그 앤 드롭
- **Tasks**:
  - Connection state management
  - Wire rendering (SVG)
  - Drag handlers (start, over, drop)
  - Recommendation 동기화
  - 라우팅 순서 시각화
  - Wire 편집 기능 (연결/해제/삭제)
- **Files**: TimelinePanel.tsx, dragAndDrop.ts, routingStore.ts
- **Time**: 3시간

---

## 5. Acceptance Criteria

- [x] "제어판" 탭이 "예측 대상 품목"으로 변경됨
- [ ] 여러 개의 Item Code 입력 후 "라우팅 생성" 클릭 시 모든 품목의 라우팅이 생성됨
- [ ] 시각화 탭에 품목 리스트 패널이 표시됨
- [ ] 품목 리스트에서 품목 클릭 시 해당 품목의 라우팅이 시각화됨
- [ ] 후보목록 박스에서 가로 스크롤이 제거됨
- [ ] 후보목록의 라벨과 검색창이 별도 행으로 배치됨
- [ ] Timeline에 추가된 노드가 Recommendation에도 표시됨
- [ ] Timeline의 노드가 라우팅 순서대로 와이어로 연결됨
- [ ] 와이어 시작/끝점을 드래그하여 다른 노드에 연결 가능
- [ ] 노드 간 연결을 해제할 수 있음

---

## 6. Risks & Mitigations

### Risk 1: 다중 품목 API 호출 성능
- **Mitigation**: Promise.all로 병렬 호출, 로딩 인디케이터 표시

### Risk 2: 드래그 앤 드롭 복잡도
- **Mitigation**: 단계별 구현 (먼저 기본 연결, 이후 편집 기능)

### Risk 3: 상태 관리 복잡도 증가
- **Mitigation**: Zustand 또는 Context API로 명확한 상태 구조 유지

---

## 7. Success Metrics

- 사용자가 여러 품목의 라우팅을 한 번에 생성하고 비교 가능
- 후보목록 박스의 가독성 50% 향상 (가로 스크롤 제거)
- 드래그 앤 드롭으로 라우팅 편집 시간 70% 단축
