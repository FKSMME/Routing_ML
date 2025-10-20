# CHECKLIST: Routing Visualization Enhancements

**Project**: Routing Visualization Improvements
**Date**: 2025-10-20
**PRD**: [PRD_2025-10-20_routing-visualization-enhancements.md](./PRD_2025-10-20_routing-visualization-enhancements.md)

---

## Phase 1: 탭 이름 변경

### 1.1 RoutingTabbedWorkspace 수정
- [x] "제어판" label을 "예측 대상 품목"으로 변경
- [x] 관련 주석 및 설명 업데이트
- [x] 변경 사항 확인

**Estimated Time**: 5분
**Actual Time**: 3분
**Status**: ✅ Completed

**Git Operations**:
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: 다중 품목 라우팅 생성 수정

### 2.1 API 호출 로직 조사
- [ ] 현재 라우팅 생성 API 엔드포인트 확인
- [ ] 단일 품목 vs 다중 품목 처리 방식 파악
- [ ] API 응답 구조 분석

### 2.2 상태 관리 구조 변경
- [ ] 기존 상태 구조 파악 (단일 routing data)
- [ ] 다중 품목 지원 상태 구조 설계
- [ ] 상태 타입 정의 업데이트

### 2.3 API 호출 로직 수정
- [ ] 여러 itemCodes에 대해 병렬 API 호출 구현
- [ ] Promise.all 또는 순차 호출 구현
- [ ] 에러 핸들링 추가 (일부 실패 시 처리)
- [ ] 로딩 상태 관리

### 2.4 데이터 저장 및 관리
- [ ] 각 품목별 라우팅 데이터 저장
- [ ] selectedItemCode 상태 추가
- [ ] 품목 선택 핸들러 구현

### 2.5 테스트
- [ ] 단일 품목 입력 테스트
- [ ] 다중 품목 입력 테스트 (2-5개)
- [ ] 에러 케이스 테스트
- [ ] 로딩 인디케이터 확인

**Estimated Time**: 1시간
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: 품목 리스트 UI 추가

### 3.1 ItemListPanel 컴포넌트 생성
- [ ] 컴포넌트 파일 생성 (ItemListPanel.tsx)
- [ ] Props 인터페이스 정의
- [ ] 품목 리스트 렌더링 로직 구현
- [ ] 선택된 품목 하이라이트 스타일링

### 3.2 레이아웃 재구성
- [ ] RoutingTabbedWorkspace의 시각화 탭 레이아웃 수정
- [ ] 품목 리스트 패널 영역 추가 (15%)
- [ ] 타임라인 영역 축소 (70% → 55%)
- [ ] 후보목록 영역 유지 (30%)

### 3.3 품목 선택 기능 구현
- [ ] 품목 클릭 핸들러 구현
- [ ] selectedItemCode 상태 업데이트
- [ ] Timeline/Candidates 패널에 선택된 품목 데이터 전달
- [ ] 선택 상태 시각적 피드백 (활성 표시)

### 3.4 스타일링
- [ ] 품목 리스트 스타일 (리스트 아이템, 호버, 선택)
- [ ] 레이아웃 반응형 조정
- [ ] 스크롤 처리

### 3.5 테스트
- [ ] 품목 리스트 렌더링 확인
- [ ] 품목 선택 시 시각화 변경 확인
- [ ] 여러 품목 간 전환 테스트

**Estimated Time**: 1.5시간
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: 후보목록 디자인 개선

### 4.1 CandidatePanel 구조 분석
- [ ] 현재 레이아웃 구조 파악
- [ ] "후보공정 노드" 설명 위치 확인
- [ ] 검색창 위치 확인

### 4.2 설명 텍스트 제거
- [ ] "후보공정 노드" 하단 설명 제거
- [ ] 관련 마크업 정리

### 4.3 레이아웃 변경
- [ ] "후보 공정 노드" 라벨을 별도 행으로 배치
- [ ] 검색 입력창을 별도 행으로 배치
- [ ] Flex 방향 변경 (row → column)

### 4.4 박스 크기 및 자동 줄바꿈
- [ ] 후보목록 섹션 가로 크기 확대 검토
- [ ] 노드 목록 컨테이너에 flex-wrap 적용
- [ ] 가로 스크롤 제거 확인
- [ ] 반응형 조정

### 4.5 테스트
- [ ] 가로 스크롤 제거 확인
- [ ] 노드 목록 자동 줄바꿈 확인
- [ ] 다양한 해상도에서 테스트

**Estimated Time**: 30분
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 4
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 5: 노드 연결 드래그 앤 드롭

### 5.1 Connection State 관리
- [ ] Connection 타입 정의
- [ ] Connections 상태 추가 (routingStore 또는 local state)
- [ ] Add/Remove/Update connection 함수 구현

### 5.2 Timeline 노드 순서 시각화
- [ ] 노드를 라우팅 순서대로 배치
- [ ] 노드 간 연결선(edge) 렌더링
- [ ] SVG 또는 Canvas로 선 그리기

### 5.3 Recommendation 동기화
- [ ] Timeline에 추가된 노드를 Recommendation에 반영
- [ ] 양방향 동기화 로직 구현
- [ ] 상태 변경 감지 및 UI 업데이트

### 5.4 드래그 앤 드롭 기본 구현
- [ ] 노드에 드래그 핸들러 추가 (anchor points)
- [ ] onDragStart, onDragOver, onDrop 구현
- [ ] 임시 연결선 표시 (드래그 중)
- [ ] 유효한 드롭 타겟 하이라이트

### 5.5 와이어 편집 기능
- [ ] 와이어 시작점 드래그하여 재연결
- [ ] 와이어 끝점 드래그하여 재연결
- [ ] 와이어 클릭으로 선택
- [ ] 선택된 와이어 Delete 키로 삭제
- [ ] 노드 클릭으로 연결/해제 토글

### 5.6 UI/UX 개선
- [ ] 드래그 커서 변경
- [ ] 연결 가능 여부 시각적 피드백
- [ ] 와이어 호버 효과
- [ ] 선택된 와이어 스타일

### 5.7 테스트
- [ ] 노드 추가 시 Recommendation 동기화 확인
- [ ] 라우팅 순서대로 와이어 연결 확인
- [ ] 드래그 앤 드롭으로 와이어 재연결 테스트
- [ ] 와이어 삭제 테스트
- [ ] 복잡한 연결 시나리오 테스트

**Estimated Time**: 3시간
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 5
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [░░░░░] 0% (0/3 tasks)
Phase 2: [░░░░░] 0% (0/14 tasks)
Phase 3: [░░░░░] 0% (0/13 tasks)
Phase 4: [░░░░░] 0% (0/11 tasks)
Phase 5: [░░░░░] 0% (0/20 tasks)

Total: [░░░░░░░░░░] 0% (0/61 tasks)
```

---

## Acceptance Criteria

- [ ] "제어판" 탭이 "예측 대상 품목"으로 변경됨
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

## Notes

- Phase 5는 가장 복잡한 기능이므로 단계별로 구현
- 먼저 기본 드래그 앤 드롭 연결 구현 후, 편집 기능 추가
- 성능 최적화는 기본 기능 완성 후 고려
