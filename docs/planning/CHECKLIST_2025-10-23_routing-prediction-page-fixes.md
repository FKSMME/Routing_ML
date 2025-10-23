# Checklist: 라우팅 생성 페이지 수정 및 개선

**Date**: 2025-10-23
**Related PRD**: [docs/planning/PRD_2025-10-23_routing-prediction-page-fixes.md](./PRD_2025-10-23_routing-prediction-page-fixes.md)
**Status**: In Progress

---

## Phase 1: 도면 조회 및 품목 전환 수정

**Estimated Time**: 1-2 hours
**Status**: Completed ✅

### Tasks

- [x] **1.1** activeItemId 설정 경로 검증 및 로그 추가
  - ✅ routingStore.loadRecommendations에 로그 추가
  - ✅ RoutingTabbedWorkspace에서 activeItemId 변경 추적
  - ✅ DrawingViewerButton에서 itemCode 수신 로그 추가

- [x] **1.2** DrawingViewerButton 에러 처리 개선
  - ✅ fetchDrawingInfo() 호출 및 응답 로그 추가
  - ✅ 도면 정보 없을 시 상세 메시지 (품목코드, DRAW_NO 포함)
  - ✅ DRAW_NO 빈 값 검증 추가
  - ✅ 네트워크 오류/타임아웃별 상세 에러 메시지

- [x] **1.3** 품목 전환 시 상태 초기화 로직 추가
  - ✅ App.tsx에 handlePredictionSubmit 함수 추가
  - ✅ refetch 호출 전 predictionError 초기화
  - ✅ 품목 전환 시 로그 출력

- [x] **1.4** 품목 전환 UI 피드백 개선
  - ✅ PredictionControls.handleSubmit에 로그 추가
  - ✅ 품목 코드 유효성 검증 강화 (빈 값, 개수 초과)
  - ✅ 명확한 alert 메시지 제공

**Acceptance Criteria**:
- activeItemId가 현재 선택된 품목 코드와 일치
- 도면 조회 시 DRAW_NO가 정확히 전달됨
- 새로운 품목 입력 시 이전 상태 완전 초기화
- 품목 전환 시 부드러운 UI 전환

**Git Operations**:
- [x] **Git staging 완전성 확인** (필수!)
  - ✅ `git status` 실행
  - ✅ Phase 1 관련 파일만 선택적으로 스테이징
  - ✅ `git status` 재확인 → 관련 파일만 staged
- [x] Commit Phase 1 ✅ (commit e7bfbd4b)
- [x] Push to 251014 ✅
- [ ] **Merge 전 검증** (필수!) - Phase 2-4 완료 후 수행
  - `git diff main..251014` 확인
  - 예상치 못한 변경사항 없음 확인
- [ ] Merge to main - 전체 Phase 완료 후
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: 모델 로딩 상태 표시

**Estimated Time**: 2-3 hours
**Status**: Completed ✅

### Tasks

- [x] **2.1** 백엔드 모델 상태 조회 API 추가/확인
  - ✅ predictor_ml.py의 get_loaded_model 함수 확인
  - ✅ `/api/model/status` 엔드포인트 추가 (backend/api/routes/prediction.py)
  - ✅ 응답 스키마: { "loaded": bool, "model_dir": str, "version": str, "loaded_at": str | null, "is_enhanced": bool }

- [x] **2.2** 프론트엔드 모델 상태 조회 hook 추가
  - ✅ 새 파일 생성: frontend-prediction/src/hooks/useModelStatus.ts
  - ✅ apiClient.ts에 fetchModelStatus() 함수 추가
  - ✅ React Query로 주기적 폴링 (30초 간격)

- [x] **2.3** PredictionControls에 모델 상태 UI 추가
  - ✅ 모델 로딩 상태 인디케이터 (로딩됨: 녹색, 미로딩: 빨강)
  - ✅ 모델 버전 표시 (version 필드)
  - ✅ "추천 실행" 버튼 위에 배치
  - ✅ 모델 미로딩 시 버튼 비활성화

- [x] **2.4** 모델 미로딩 시 예측 실행 차단
  - ✅ onSubmit 핸들러에서 모델 상태 검증
  - ✅ 모델 미로딩 시 경고 alert 표시
  - ✅ "추천 실행" 버튼 비활성화 (2.3에서 구현)

**Acceptance Criteria**:
- 모델 로딩 상태가 UI에 실시간 표시됨
- 모델 버전 및 로딩 시각 정확히 표시
- 모델 미로딩 시 명확한 경고 메시지
- 예측 실행 전 모델 상태 검증 완료

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Canvas 기능 검증 및 수정

**Estimated Time**: 1-2 hours
**Status**: Not Started

### Tasks

- [ ] **3.1** RecommendationsTab Canvas 뷰 렌더링 확인
  - RecommendationsTab.tsx 파일 읽기
  - "canvas" 뷰/탭 ID 확인
  - 조건부 렌더링 로직 검증

- [ ] **3.2** RoutingCanvas 컴포넌트 마운트 확인
  - TimelinePanel에서 RoutingCanvas import 확인
  - RoutingCanvas props 전달 검증
  - React DevTools로 컴포넌트 트리 확인

- [ ] **3.3** 탭 전환 이벤트 핸들링 확인
  - Tabs 컴포넌트의 onTabChange 핸들러 확인
  - activeTab 상태 업데이트 로직 검증
  - Canvas 탭 선택 시 로그 추가

- [ ] **3.4** 에러 로그 분석 및 수정
  - 브라우저 콘솔에서 Canvas 관련 에러 검색
  - React 렌더링 에러 확인
  - 에러 원인 파악 및 수정

**Acceptance Criteria**:
- Canvas 탭 선택 시 정상 렌더링
- RoutingCanvas 컴포넌트 정상 마운트
- 타임라인 노드 표시 및 상호작용 가능
- 콘솔에 에러 없음

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: 테스트 및 검증

**Estimated Time**: 1 hour
**Status**: Not Started

### Tasks

- [ ] **4.1** 도면 조회 기능 end-to-end 테스트
  - 품목 코드 3H54529WD49 입력
  - "추천 실행" 버튼 클릭
  - 시각화 탭의 "도면 조회" 버튼 클릭
  - DRAW_NO(3H54529)로 도면 표시 확인

- [ ] **4.2** 품목 전환 시나리오 테스트
  - 품목 A 입력 → 추천 실행 → 결과 확인
  - 품목 B 입력 → 추천 실행 → 결과 확인
  - activeItemId가 품목 B로 변경 확인
  - 품목 A 결과가 초기화되었는지 확인

- [ ] **4.3** 모델 로딩 상태 표시 테스트
  - 페이지 로드 시 모델 상태 표시 확인
  - 모델 로딩 전/후 UI 변화 확인
  - 모델 미로딩 시 경고 메시지 확인

- [ ] **4.4** Canvas 탭 작동 테스트
  - "시각화" 탭 선택
  - Canvas 하위 뷰/탭 선택 (있는 경우)
  - 타임라인 노드 렌더링 확인
  - 노드 드래그 앤 드롭 테스트

**Acceptance Criteria**:
- 모든 기능이 PRD의 Success Criteria 충족
- 에러 없이 정상 작동
- 사용자 시나리오 완료 가능
- 성능 기준 충족 (도면 조회 < 2초)

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 4
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [█████] 100% (4/4 tasks) ✅
Phase 2: [█████] 100% (4/4 tasks) ✅
Phase 3: [░░░░░] 0% (0/4 tasks)
Phase 4: [░░░░░] 0% (0/4 tasks)

Total: [████░░░░░░] 50% (8/16 tasks)
```

---

## Acceptance Criteria (Overall)

- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged to main
- [ ] All Success Criteria from PRD met
- [ ] No empty checkboxes [ ] remaining
- [ ] Work history document created
- [ ] RoutingMLMonitor 재빌드 (버전 업데이트 필요 시)

---

## Notes

### 발견된 이슈
- (Phase 진행 중 발견된 이슈를 여기에 기록)

### 결정 사항
- (Phase 진행 중 내린 결정을 여기에 기록)

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
