# Checklist: Routing ML System Improvements

**PRD**: [PRD_2025-10-21_routing-ml-system-improvements.md](PRD_2025-10-21_routing-ml-system-improvements.md)
**작성일**: 2025-10-21
**최종 업데이트**: 2025-10-21

## Phase 0: 피처/가중치 점검 도구 구현

### 0.1 점검 스크립트 작성
- [ ] `scripts/inspect_training_features.py` 파일 생성
- [ ] TRAIN_FEATURES 읽기 기능 구현
- [ ] 최신 모델 파일 로드 기능 구현
- [ ] 피처 목록 출력 기능 구현
- [ ] 가중치 로드 및 표시 기능 구현
- [ ] 차원 검증 로직 구현

### 0.2 스크립트 실행 및 검증
- [ ] 스크립트 실행하여 현재 피처 구성 확인
- [ ] 가중치 적용 여부 확인
- [ ] 차원 불일치 여부 확인
- [ ] 출력 결과를 보고서에 기록

### 0.3 강제 검증 로직 추가
- [ ] `backend/trainer_ml.py`에 차원 검증 예외 추가
- [ ] `backend/predictor_ml.py`에 차원 검증 예외 추가
- [ ] 단위 테스트 작성

### 0.4 Git Workflow
- [ ] 변경사항 commit
- [ ] 251014 브랜치에 push
- [ ] main 브랜치로 merge
- [ ] main push
- [ ] 251014 브랜치로 복귀

---

## Phase 1: WORK_ORDER_RESULTS 통합

### 1.1 Backend 수정
- [ ] `backend/database.py:fetch_work_results_for_item()` 함수 확인
- [ ] `backend/predictor_ml.py:predict_routing_from_similar_items()` 수정
  - [ ] WORK_ORDER_RESULTS 조회 로직 추가
  - [ ] 공정별 평균 시간 계산
  - [ ] 라우팅 데이터와 병합
- [ ] 예측 시간 필드 추가 (predicted_setup_time, predicted_run_time)
- [ ] work_order_count 필드 추가

### 1.2 데이터 품질 검증
- [ ] 실적 건수 < 3인 경우 fallback 로직 구현
- [ ] 이상치 필터링 (IQR 방식)
- [ ] NULL 처리 로직 추가

### 1.3 API 응답 스키마 업데이트
- [ ] `backend/api/schemas.py` 수정
- [ ] PredictionResponse 스키마에 predicted_time 필드 추가
- [ ] API 문서 업데이트

### 1.4 단위 테스트
- [ ] `tests/test_predictor_work_order_integration.py` 작성
- [ ] WORK_ORDER 조회 테스트
- [ ] 평균 시간 계산 테스트
- [ ] fallback 로직 테스트

### 1.5 training_request.json 수정
- [ ] `models/test_phase2/training_request.json` 수정
- [ ] `dbo.BI_ROUTING_HIS_VIEW` → `dbo.BI_ROUTING_VIEW` 변경
- [ ] 다른 버전 폴더도 확인 및 수정

### 1.6 Git Workflow
- [ ] 변경사항 commit
- [ ] 251014 브랜치에 push
- [ ] main 브랜치로 merge
- [ ] main push
- [ ] 251014 브랜치로 복귀

---

## Phase 2: Feature Recommendations 수정

### 2.1 JSON 파일 재생성
- [ ] `backend/feature_weights.py` 확인
- [ ] feature_recommendations.json 생성 로직 확인
- [ ] UTF-8 인코딩으로 재생성
- [ ] JSON 유효성 검증

### 2.2 가중치 추천 UI 구현
- [ ] `frontend-prediction/src/components/FeatureWeightManager.tsx` 생성
- [ ] feature_recommendations.json API 엔드포인트 구현
- [ ] 추천 가중치 목록 UI 구현
- [ ] 사용자 선택 기능 구현
- [ ] 선택 → 가중치 업데이트 → 재학습 트리거

### 2.3 백엔드 API 구현
- [ ] `backend/api/routes/feature_weights.py` (신규 or 수정)
- [ ] GET /api/feature-weights/recommendations
- [ ] POST /api/feature-weights/apply
- [ ] 가중치 업데이트 로직 구현

### 2.4 통합 테스트
- [ ] 추천 UI 로드 테스트
- [ ] 가중치 선택 → 업데이트 → 재학습 flow 테스트
- [ ] 재학습 후 예측 결과 변화 확인

### 2.5 Git Workflow
- [ ] 변경사항 commit
- [ ] 251014 브랜치에 push
- [ ] main 브랜치로 merge
- [ ] main push
- [ ] 251014 브랜치로 복귀

---

## Phase 3: 유사 품목 노드 리스트 구현

### 3.1 RoutingCanvas 수정
- [ ] `frontend-prediction/src/components/routing/RoutingCanvas.tsx` 읽기
- [ ] 상단에 유사 품목 노드 리스트 섹션 추가
- [ ] `selectedCandidateId` 상태 추가
- [ ] 후보 목록 매핑하여 노드 카드 생성

### 3.2 노드 카드 컴포넌트
- [ ] `CandidateNodeCard.tsx` 생성 (선택적)
- [ ] 품목 코드 표시
- [ ] 유사도 점수 표시
- [ ] 클릭 이벤트 핸들러 연결
- [ ] 선택된 노드 하이라이트 스타일

### 3.3 레이아웃 조정
- [ ] 상단 노드 리스트 영역 (20% 높이)
- [ ] 하단 Canvas 영역 (80% 높이)
- [ ] 반응형 레이아웃 확인
- [ ] 스크롤 처리 (노드 수 > 10개)

### 3.4 Git Workflow
- [ ] 변경사항 commit
- [ ] 251014 브랜치에 push
- [ ] main 브랜치로 merge
- [ ] main push
- [ ] 251014 브랜치로 복귀

---

## Phase 4: 노드 클릭 인터랙션

### 4.1 상태 관리
- [ ] `selectedCandidateId` 상태 정의
- [ ] `activeTimeline` 계산 로직 구현
- [ ] `setSelectedCandidateId` 핸들러 구현

### 4.2 클릭 이벤트
- [ ] 노드 카드 onClick 이벤트 추가
- [ ] selectedCandidateId 업데이트
- [ ] activeTimeline 자동 변경 확인

### 4.3 Canvas 재렌더링
- [ ] useEffect로 activeTimeline 변경 감지
- [ ] ReactFlow 노드/엣지 업데이트
- [ ] 애니메이션 효과 추가 (선택적)

### 4.4 사용자 경험 개선
- [ ] 로딩 인디케이터 추가
- [ ] 노드 전환 애니메이션
- [ ] 에러 처리 (후보 없음 등)

### 4.5 Git Workflow
- [ ] 변경사항 commit
- [ ] 251014 브랜치에 push
- [ ] main 브랜치로 merge
- [ ] main push
- [ ] 251014 브랜치로 복귀

---

## Phase 5: 통합 및 검증

### 5.1 End-to-End 테스트
- [ ] 품목 입력 → 추천 실행
- [ ] 예측 결과 확인 (WORK_ORDER 시간 포함)
- [ ] 유사 품목 노드 리스트 표시 확인
- [ ] 노드 클릭 → 라우팅 전환 확인
- [ ] Canvas 와이어 연결 확인

### 5.2 성능 테스트
- [ ] 예측 응답 시간 측정 (< 3초 목표)
- [ ] Canvas 렌더링 성능 측정
- [ ] 메모리 사용량 확인

### 5.3 문서화
- [ ] Phase별 작업 보고서 작성
- [ ] 최종 통합 보고서 작성
- [ ] README 업데이트 (필요 시)

### 5.4 Git Workflow
- [ ] 최종 변경사항 commit
- [ ] 251014 브랜치에 push
- [ ] main 브랜치로 merge
- [ ] main push
- [ ] 251014 브랜치로 복귀

---

## 진행 상황 요약

| Phase | 상태 | 완료율 | 비고 |
|-------|------|--------|------|
| Phase 0 | ⏳ Pending | 0% | 피처/가중치 점검 도구 |
| Phase 1 | ⏳ Pending | 0% | WORK_ORDER 통합 |
| Phase 2 | ⏳ Pending | 0% | Feature Recommendations |
| Phase 3 | ⏳ Pending | 0% | 유사 품목 노드 리스트 |
| Phase 4 | ⏳ Pending | 0% | 노드 클릭 인터랙션 |
| Phase 5 | ⏳ Pending | 0% | 통합 및 검증 |

**전체 진행률**: 0%

---

## 이슈 및 블로커

| ID | 이슈 | 상태 | 해결 방법 |
|----|------|------|-----------|
| - | - | - | - |

---

## 변경 이력

| 날짜 | Phase | 변경 내용 | 작성자 |
|------|-------|-----------|--------|
| 2025-10-21 | All | 초기 Checklist 작성 | Claude |
