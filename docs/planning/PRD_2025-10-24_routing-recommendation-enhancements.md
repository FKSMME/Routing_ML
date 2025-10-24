# PRD: 라우팅 추천 시스템 개선 (Routing Recommendation System Enhancements)

**Date**: 2025-10-24
**Author**: Claude Code
**Status**: Draft
**Priority**: High

---

## Executive Summary

라우팅 추천 시스템의 사용자 경험을 개선하기 위해 7가지 핵심 기능을 구현합니다:
1. **유사품 검색 개선**: Similar Items 리스트에 여러 품목 표시 및 유사도 정확성 향상
2. **자동 저장/새로고침**: 도면 조회 및 라우팅 추천 실행 시 저장 즉시 UI 자동 업데이트
3. **UI 레이블 개선**: 시각화 탭 이름 변경 (Timeline → 블루프린트, Recommendation → 라우팅)
4. **Run Time 표시 수정**: 노드에서 Run Time이 제대로 표시되지 않는 버그 수정
5. **노드 편집 개선**: Recommendation 노드 더블클릭 편집 기능 강화
6. **자원(Res) 관리**: 노드에 자원 정보 추가 및 공정그룹 선택 기능 구현
7. **모델 선택 기능**: 사용자가 예측 모델을 선택하고 상세 정보를 볼 수 있는 UI 추가

---

## Problem Statement

### 현재 문제점

1. **유사품 검색 불충분**
   - Similar Items 리스트에 1개 품목만 표시됨
   - 동일 이력만 검색되고 유사품이 검색되지 않음
   - 유사도 threshold 설정 문제 가능성

2. **저장 후 수동 새로고침 필요**
   - 도면 조회 및 라우팅 추천 실행 시 변경사항 저장 후 Ctrl+R로 새로고침해야 적용됨
   - 사용자 작업 흐름 단절
   - 데이터 동기화 지연

3. **시각화 탭 이름 혼란**
   - "Timeline"과 "Recommendation" 이름이 기능을 명확히 설명하지 못함
   - 한글 용어와 영문 용어 혼재

4. **Run Time 미표시**
   - 노드에 Setup Time은 표시되나 Run Time이 제대로 표시되지 않음
   - 데이터 바인딩 또는 데이터 소스 문제 가능성

5. **노드 편집 기능 제한**
   - Recommendation 노드를 더블클릭하여 값을 수정할 수 없음
   - 또는 편집 기능이 제한적임

6. **자원 정보 부재**
   - 노드에 Setup/Run/Wait 시간만 있고 자원(Res) 정보 없음
   - 공정그룹을 선택할 수 있는 UI 필요

---

## Goals and Objectives

### Primary Goals

1. **유사품 검색 품질 향상**
   - 유사품을 3개 이상 표시
   - 유사도 알고리즘 검증 및 threshold 조정
   - Similar Items 리스트 UI 개선

2. **실시간 UI 업데이트**
   - 저장 시 자동으로 UI 업데이트
   - Ctrl+R 수동 새로고침 불필요
   - 상태 관리 최적화

3. **명확한 UI 레이블**
   - Timeline → "블루프린트"
   - Recommendation → "라우팅"
   - 일관된 한글 용어 사용

4. **정확한 시간 정보 표시**
   - Run Time 제대로 표시
   - Setup Time, Wait Time과 동일한 형식

5. **강화된 노드 편집**
   - 더블클릭으로 모든 노드 값 편집 가능
   - Setup/Run/Wait/Res 모두 편집 가능

6. **자원 관리 통합**
   - 노드에 Res(자원) 필드 추가
   - 공정그룹 선택 드롭다운 UI
   - ProcessGroupsWorkspace와 통합

### Success Metrics

- [ ] Similar Items에 평균 3개 이상 품목 표시
- [ ] 유사도 검색 정확도 80% 이상
- [ ] 저장 후 자동 업데이트 100% (수동 새로고침 불필요)
- [ ] Run Time 표시율 100%
- [ ] 노드 편집 성공률 100%
- [ ] 자원 정보 입력 가능률 100%

---

## Requirements

### 1. Similar Items 개선

#### Functional Requirements
- FR1.1: Similar Items 리스트에 최소 3개 품목 표시
- FR1.2: 유사도 점수(%)와 함께 품목명 표시
- FR1.3: 유사도 threshold 조정 가능 (UI 또는 config)
- FR1.4: 유사품이 없을 경우 "유사품 없음" 메시지 표시

#### Technical Requirements
- TR1.1: `prediction_service.py`의 유사도 알고리즘 검증
- TR1.2: `similarity_engine.joblib` 모델 파라미터 확인
- TR1.3: `top_k` 파라미터를 3 이상으로 설정
- TR1.4: `similarity_threshold` 조정 (현재값 검증)

#### Files to Modify
- `frontend-prediction/src/components/routing/CandidateNodeTabs.tsx`
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (Lines 688-768)
- `backend/api/services/prediction_service.py`
- `backend/api/routes/prediction.py`

---

### 2. 자동 저장/새로고침

#### Functional Requirements
- FR2.1: 도면 조회 후 저장 시 UI 자동 업데이트
- FR2.2: 라우팅 추천 실행 후 저장 시 UI 자동 업데이트
- FR2.3: 저장 완료 시 시각적 피드백 (토스트 메시지)
- FR2.4: Ctrl+R 수동 새로고침 불필요

#### Technical Requirements
- TR2.1: Zustand store의 `routingStore.ts` 상태 동기화
- TR2.2: 저장 API 호출 후 store 자동 업데이트
- TR2.3: React Query 또는 SWR을 사용한 캐시 무효화
- TR2.4: `localStorage` 동기화 확인

#### Files to Modify
- `frontend-prediction/src/components/routing/DrawingViewerButton.tsx`
- `frontend-prediction/src/components/routing/RecommendationsTab.tsx`
- `frontend-prediction/src/store/routingStore.ts`
- `frontend-prediction/src/components/TimelinePanel.tsx`

---

### 3. 시각화 탭 이름 변경

#### Functional Requirements
- FR3.1: "Timeline" → "블루프린트"
- FR3.2: "Recommendation" → "라우팅"
- FR3.3: 탭 전환 시 기능 동일하게 유지

#### Technical Requirements
- TR3.1: UI 레이블 텍스트만 변경
- TR3.2: 기존 로직 변경 없음
- TR3.3: 접근성(aria-label) 업데이트

#### Files to Modify
- `frontend-prediction/src/components/routing/RecommendationsTab.tsx` (Lines 134-234)

---

### 4. Run Time 표시 수정

#### Functional Requirements
- FR4.1: 노드에 Run Time 정확히 표시
- FR4.2: Setup Time과 동일한 형식 (XX.X분)
- FR4.3: Run Time이 0 또는 null일 경우 "0.0분" 표시

#### Technical Requirements
- TR4.1: `TimelineNodeComponent`의 데이터 바인딩 확인
- TR4.2: `TimelineStep` 인터페이스의 `runTime` 필드 확인
- TR4.3: API 응답에서 `runTime` 데이터 포함 확인
- TR4.4: `runTime` vs `standardTime` 필드 매핑 검증

#### Files to Modify
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (Lines 274-282)
- `frontend-prediction/src/store/routingStore.ts` (TimelineStep 인터페이스)
- `backend/api/routes/prediction.py` (응답 스키마)

---

### 5. 노드 편집 개선

#### Functional Requirements
- FR5.1: Recommendation 노드 더블클릭 시 편집 모달 오픈
- FR5.2: Setup Time, Run Time, Wait Time 모두 편집 가능
- FR5.3: 편집 후 저장 시 즉시 UI 반영
- FR5.4: 유효성 검사 (음수 불가, 최대값 제한)

#### Technical Requirements
- TR5.1: 더블클릭 이벤트 핸들러 확인/추가
- TR5.2: `TimeEditModal.tsx` 통합 확인
- TR5.3: `updateStepTimes()` 액션 호출 확인
- TR5.4: 입력 검증 로직 강화

#### Files to Modify
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (Line 81 - 더블클릭 핸들러)
- `frontend-prediction/src/components/routing/TimeEditModal.tsx`
- `frontend-prediction/src/store/routingStore.ts` (updateStepTimes 액션)

---

### 6. 자원(Res) 관리

#### Functional Requirements
- FR6.1: 노드에 "자원(Res)" 필드 추가
- FR6.2: 자원 필드는 공정그룹 선택 드롭다운으로 구현
- FR6.3: ProcessGroupsWorkspace에서 정의한 공정그룹 목록 사용
- FR6.4: 자원 선택 시 해당 공정그룹의 default_columns 적용

#### Technical Requirements
- TR6.1: `TimelineStep` 인터페이스에 `resourceGroupId` 필드 추가
- TR6.2: `TimeEditModal.tsx`에 공정그룹 선택 드롭다운 추가
- TR6.3: Process Groups API (`/api/process-groups`) 연동
- TR6.4: 노드 표시 시 자원 정보 표시 (Lines 274-282)
- TR6.5: 백엔드 스키마 업데이트 (PredictionResponse)

#### Files to Modify
- `frontend-prediction/src/components/routing/TimeEditModal.tsx`
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (노드 표시)
- `frontend-prediction/src/store/routingStore.ts` (TimelineStep 인터페이스)
- `backend/api/schemas.py` (PredictionResponse, TimelineStep)
- `backend/api/routes/prediction.py` (응답에 resourceGroupId 포함)

---

## Phase Breakdown

### Phase 1: 유사품 검색 개선 (3 hours)
**Goal**: Similar Items에 3개 이상 품목 표시 및 유사도 정확성 향상

**Tasks**:
1. 백엔드 유사도 검색 로직 분석 (`prediction_service.py`)
2. `top_k` 및 `similarity_threshold` 파라미터 조정
3. 프론트엔드 CandidateNodeTabs UI 개선
4. 테스트 및 검증 (3개 이상 품목 표시 확인)

**Deliverables**:
- Similar Items 리스트에 평균 3개 이상 품목
- 유사도 점수 정확성 검증 문서

---

### Phase 2: 자동 저장/새로고침 (2 hours)
**Goal**: 저장 시 Ctrl+R 없이 UI 자동 업데이트

**Tasks**:
1. Zustand store 동기화 로직 검토
2. 저장 API 호출 후 store 자동 업데이트 구현
3. 토스트 메시지 추가 (저장 완료 피드백)
4. 테스트 (도면 조회, 라우팅 추천 시나리오)

**Deliverables**:
- 저장 후 자동 UI 업데이트 100%
- 사용자 피드백 메시지

---

### Phase 3: 시각화 탭 이름 변경 (0.5 hour)
**Goal**: Timeline → 블루프린트, Recommendation → 라우팅

**Tasks**:
1. RecommendationsTab.tsx 레이블 변경
2. 접근성 레이블 업데이트
3. 빠른 테스트 (UI 확인)

**Deliverables**:
- 변경된 탭 이름 (블루프린트, 라우팅)

---

### Phase 4: Run Time 표시 수정 (1.5 hours)
**Goal**: 노드에 Run Time 정확히 표시

**Tasks**:
1. TimelineNodeComponent 데이터 바인딩 분석
2. `runTime` vs `standardTime` 필드 매핑 확인
3. API 응답 스키마 확인 (runTime 포함 여부)
4. 프론트엔드 표시 로직 수정
5. 테스트 (Run Time 표시 확인)

**Deliverables**:
- 노드에 Run Time 정확히 표시 (XX.X분 형식)

---

### Phase 5: 노드 편집 개선 (2 hours)
**Goal**: Recommendation 노드 더블클릭 편집 기능 강화

**Tasks**:
1. 더블클릭 이벤트 핸들러 확인/추가
2. TimeEditModal 통합 확인
3. Setup/Run/Wait Time 편집 기능 검증
4. 유효성 검사 강화
5. 테스트 (편집 및 저장)

**Deliverables**:
- 더블클릭으로 노드 편집 가능
- 편집 후 즉시 UI 반영

---

### Phase 6: 자원(Res) 관리 (3 hours)
**Goal**: 노드에 자원 필드 추가 및 공정그룹 선택 기능 구현

**Tasks**:
1. TimelineStep 인터페이스에 `resourceGroupId` 추가
2. TimeEditModal에 공정그룹 드롭다운 추가
3. Process Groups API 연동 (GET /api/process-groups)
4. 노드 표시 시 자원 정보 표시
5. 백엔드 스키마 업데이트
6. 테스트 (자원 선택 및 표시)

**Deliverables**:
- 노드에 자원(Res) 필드 표시
- 공정그룹 선택 드롭다운
- ProcessGroupsWorkspace 통합

---

### Phase 7: 모델 선택 및 정보 표시 (2.5 hours)
**Goal**: 사용자가 예측 모델을 선택하고 상세 정보를 볼 수 있도록 구현

**Tasks**:
1. Model Registry API 구현 (사용 가능한 모델 목록 조회)
2. PredictionControls에 모델 선택 드롭다운 추가
3. 모델 정보 박스 UI 구현 (버전, 생성일, 성능 지표 등)
4. 선택한 모델로 로딩/전환 기능 구현
5. 모델 상태 실시간 업데이트
6. 테스트 (모델 전환 및 정보 표시)

**Deliverables**:
- 모델 선택 드롭다운 UI
- 모델 정보 박스 (버전, 생성일, 특징 가중치 프로필 등)
- 모델 전환 기능
- 기본 모델 "default" 자동 선택

---

## Success Criteria

### Acceptance Criteria

1. **유사품 검색**
   - [ ] Similar Items 리스트에 3개 이상 품목 표시
   - [ ] 유사도 점수 정확히 표시
   - [ ] 유사품이 없을 경우 적절한 메시지 표시

2. **자동 저장/새로고침**
   - [ ] 도면 조회 후 저장 시 UI 자동 업데이트
   - [ ] 라우팅 추천 후 저장 시 UI 자동 업데이트
   - [ ] Ctrl+R 수동 새로고침 불필요

3. **시각화 탭**
   - [ ] Timeline → "블루프린트" 변경
   - [ ] Recommendation → "라우팅" 변경

4. **Run Time 표시**
   - [ ] 노드에 Run Time 정확히 표시
   - [ ] Setup Time과 동일한 형식

5. **노드 편집**
   - [ ] 더블클릭으로 노드 편집 가능
   - [ ] Setup/Run/Wait Time 모두 편집 가능
   - [ ] 편집 후 즉시 UI 반영

6. **자원(Res) 관리**
   - [ ] 노드에 자원(Res) 필드 표시
   - [ ] 공정그룹 선택 드롭다운 동작
   - [ ] ProcessGroupsWorkspace와 통합

7. **모델 선택 기능**
   - [ ] 모델 선택 드롭다운 동작
   - [ ] 모델 정보 박스 표시
   - [ ] 선택한 모델로 전환 가능
   - [ ] 기본 모델 자동 선택

---

## Timeline Estimates

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| Phase 1 | 유사품 검색 개선 | 3 hours |
| Phase 2 | 자동 저장/새로고침 | 2 hours |
| Phase 3 | 시각화 탭 이름 변경 | 0.5 hour |
| Phase 4 | Run Time 표시 수정 | 1.5 hours |
| Phase 5 | 노드 편집 개선 | 2 hours |
| Phase 6 | 자원(Res) 관리 | 3 hours |
| Phase 7 | 모델 선택 및 정보 표시 | 2.5 hours |
| **Total** | | **14.5 hours** |

---

## Dependencies

### External Dependencies
- Zustand (상태 관리)
- ReactFlow (노드 시각화)
- Process Groups API (자원 선택)
- Similarity Engine (유사품 검색)

### Internal Dependencies
- Phase 6는 ProcessGroupsWorkspace 구현 완료 필요
- Phase 2는 Phase 1 완료 후 테스트 가능
- Phase 5는 Phase 4 완료 후 테스트 가능

---

## Risks and Mitigations

### Risks

1. **유사품 알고리즘 변경 리스크**
   - 유사도 threshold 조정 시 기존 추천 결과 변경 가능
   - **Mitigation**: A/B 테스트, 기존 결과 비교 검증

2. **자동 새로고침 성능 이슈**
   - 저장 시마다 전체 UI 리렌더링 시 성능 저하 가능
   - **Mitigation**: React.memo, useMemo 활용, 선택적 리렌더링

3. **자원(Res) 필드 백엔드 마이그레이션**
   - 기존 데이터에 resourceGroupId 필드 없음
   - **Mitigation**: 기본값(null) 허용, 마이그레이션 스크립트

---

## Open Questions

1. Similar Items의 적절한 `top_k` 값은? (3, 5, 10?)
2. 유사도 threshold 기본값은? (0.7, 0.8, 0.9?)
3. 자원(Res) 필드는 필수인가, 선택인가?
4. 공정그룹 선택 시 default_columns를 자동 적용해야 하는가?

---

**END OF PRD**
