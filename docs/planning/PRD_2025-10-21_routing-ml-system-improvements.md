# PRD: Routing ML System Improvements Based on Audit Findings

**작성일**: 2025-10-21
**작성자**: Claude (AI Assistant)
**우선순위**: Critical
**관련 문서**: [docs/reports/2025-10-21-routing-ml-algorithm-audit.md](../reports/2025-10-21-routing-ml-algorithm-audit.md)

## 1. 개요

Routing ML Algorithm Audit 보고서의 지적사항을 바탕으로 시스템 개선을 진행합니다. 주요 문제점은:
1. 예측 파이프라인이 WORK_ORDER_RESULTS를 활용하지 않음
2. 시각화에서 유사 품목 리스트 및 클릭 인터랙션 미구현
3. Feature recommendations 인코딩 깨짐
4. 학습 피처/가중치 점검 도구 부재

## 2. 배경 및 문제점

### 2.1 현재 예측 파이프라인 구조
```python
# backend/predictor_ml.py:756, 1095
ITEM_INFO 임베딩 → HNSW 유사 품목 검색 → BI_ROUTING_VIEW만 조회 → 첫 번째 라우팅 복제
```

**문제점**:
- `dbo.BI_WORK_ORDER_RESULTS` 뷰를 전혀 활용하지 않음
- `fetch_work_results_for_item()` 함수 미사용
- 본래 목표인 "ITEM INFO 임베딩 → ROUTING + WORK ORDER 비교"가 미달성

### 2.2 프론트엔드 시각화 구조
**현재 구현** ([frontend-prediction/src/components/routing/RoutingCanvas.tsx:1-120](../../frontend-prediction/src/components/routing/RoutingCanvas.tsx)):
- 타임라인 노드와 와이어만 표시
- RecommendationsTab에 후보 목록만 텍스트로 표시

**요구사항 미달**:
- 유사 품목 노드 리스트가 시각화 박스 상단에 표시되지 않음
- 노드 클릭 시 해당 품목의 라우팅으로 전환 기능 없음

### 2.3 Feature Recommendations 인코딩
**파일**: [models/test_phase2/feature_recommendations.json](../../models/test_phase2/feature_recommendations.json)
**문제**: UTF-8 문자열 깨짐으로 가중치 추천 UI 노출 불가

### 2.4 학습 피처/가중치 점검
**현재 상태**:
- 학습 시 피처 구성 확인 방법 불명확
- 가중치 적용 여부 검증 도구 없음
- 벡터 차원/피처 수 불일치 경고만 있고 강제 검증 없음

## 3. 목표

### 3.1 핵심 목표
1. **예측 파이프라인 개선**: WORK_ORDER_RESULTS 통합으로 예측 시간 산출
2. **시각화 완성**: 유사 품목 노드 리스트 + 클릭 인터랙션
3. **가중치 시스템 정비**: 추천 UI 복구 + 적용 검증
4. **점검 도구 제공**: 피처/가중치 확인 스크립트

### 3.2 성공 지표
- WORK_ORDER_RESULTS 기반 예측 시간 산출률 > 90%
- 유사 품목 노드 클릭 시 라우팅 전환 정상 작동
- Feature recommendations UI 정상 표시
- 피처/가중치 점검 스크립트 실행 가능

## 4. 요구사항 상세

### 4.1 예측 파이프라인 개선

#### 4.1.1 WORK_ORDER_RESULTS 통합
**목적**: 본래 설계 목표인 "ROUTING + WORK ORDER 비교" 구현

**구현 범위**:
1. `backend/predictor_ml.py:predict_routing_from_similar_items()` 수정
   - 유사 품목의 BI_ROUTING_VIEW 조회 (기존)
   - 유사 품목의 BI_WORK_ORDER_RESULTS 조회 (신규)
   - 실적 데이터 기반 예측 시간 계산 (신규)

2. `backend/database.py:fetch_work_results_for_item()` 활용
   - 품목 코드별 작업 실적 조회
   - 공정별 평균 setup_time, run_time 계산
   - 라우팅 데이터와 병합

**출력 데이터**:
```python
{
  "operations": [
    {
      "proc_seq": 10,
      "job_cd": "J001",
      "job_nm": "선삭",
      "setup_time": 30,           # BI_ROUTING_VIEW 기준
      "run_time": 120,             # BI_ROUTING_VIEW 기준
      "predicted_setup_time": 28,  # BI_WORK_ORDER_RESULTS 평균 (신규)
      "predicted_run_time": 115,   # BI_WORK_ORDER_RESULTS 평균 (신규)
      "work_order_count": 15,      # 실적 건수 (신규)
      ...
    }
  ]
}
```

#### 4.1.2 training_request.json 뷰 명칭 정렬
**파일**: `models/test_phase2/training_request.json`
**문제**: `dbo.BI_ROUTING_HIS_VIEW` 기재 (구버전)
**수정**: `dbo.BI_ROUTING_VIEW`로 변경 (런타임 기본값과 일치)

### 4.2 시각화 개선

#### 4.2.1 유사 품목 노드 리스트
**파일**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx`

**요구사항**:
- 시각화 박스 상단에 유사 품목 노드 리스트 표시
- 각 노드는 클릭 가능한 버튼/카드 형태
- 현재 선택된 노드 하이라이트

**UI 레이아웃**:
```
┌──────────────────────────────────────────────────────┐
│ 유사 품목 리스트                                       │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │
│ │Item-1│ │Item-2│ │Item-3│ │Item-4│                │
│ │95.2% │ │89.7% │ │85.3% │ │81.9% │ (유사도)      │
│ └──────┘ └──────┘ └──────┘ └──────┘                │
├──────────────────────────────────────────────────────┤
│ 라우팅 시각화 (ReactFlow Canvas)                      │
│ ┌──────┐    ┌──────┐    ┌──────┐                   │
│ │공정1 │───→│공정2 │───→│공정3 │                   │
│ └──────┘    └──────┘    └──────┘                   │
└──────────────────────────────────────────────────────┘
```

#### 4.2.2 노드 클릭 인터랙션
**상태 관리**:
```typescript
const [selectedCandidateId, setSelectedCandidateId] = useState<number>(0);
const activeTimeline = candidates[selectedCandidateId]?.timeline;
```

**동작 흐름**:
1. 유사 품목 노드 클릭 → `selectedCandidateId` 업데이트
2. `activeTimeline` 자동 변경
3. Canvas 재렌더링 → 선택된 품목의 라우팅 표시

### 4.3 Feature Recommendations 수정

#### 4.3.1 JSON 파일 재생성
**파일**: `models/test_phase2/feature_recommendations.json`

**작업**:
1. UTF-8 인코딩으로 재생성
2. 피처 가중치 추천 데이터 검증
3. 프론트엔드 UI 연동 테스트

**데이터 구조**:
```json
{
  "recommendations": [
    {
      "feature": "ITEM_TYPE",
      "current_weight": 2.50,
      "recommended_weight": 2.80,
      "importance": 0.95,
      "reason": "높은 분류 정확도 기여"
    }
  ]
}
```

#### 4.3.2 가중치 추천 UI
**파일**: `frontend-prediction/src/components/FeatureWeightManager.tsx` (신규)

**기능**:
1. feature_recommendations.json 로드
2. 추천 가중치 목록 표시
3. 사용자 선택 → 가중치 업데이트 → 재학습 트리거

### 4.4 피처/가중치 점검 도구

#### 4.4.1 점검 스크립트
**파일**: `scripts/inspect_training_features.py` (신규)

**기능**:
1. 현재 TRAIN_FEATURES, NUMERIC_FEATURES 표시
2. 최신 학습 모델의 피처 목록 로드
3. 가중치 적용 여부 검증
4. 벡터 차원/피처 수 일치 여부 검증

**출력 예시**:
```
=== Training Features Inspection ===
1. TRAIN_FEATURES (backend/constants.py)
   - Total: 41 features
   - Categorical: 33 features
   - Numeric: 8 features

2. Latest Model (models/test_phase2/)
   - feature_columns.joblib: 39 features
   - encoder.joblib: 31 categorical features
   - scaler.joblib: 8 numeric features

3. Feature Weights
   - feature_weights.json: 41 entries
   - Active weights: 33 features
   - Top 5 weights:
     * ITEM_TYPE: 2.50
     * PART_TYPE: 2.50
     * SealTypeGrup: 2.50
     * RAW_MATL_KIND: 2.20
     * ITEM_MATERIAL: 2.00

4. Dimension Validation
   ✅ Feature count matches (39 expected, 39 loaded)
   ✅ Encoder features match (31 expected, 31 loaded)
   ✅ Scaler features match (8 expected, 8 loaded)
   ⚠️  Vector dimension (128) > feature count (39) - zero-padding applied
```

#### 4.4.2 강제 검증 로직
**파일**: `backend/trainer_ml.py`, `backend/predictor_ml.py`

**수정**:
가중치 분석 시 벡터/피처 차원 불일치 발생 시 경고 대신 **예외 발생**으로 변경

```python
if embedding_dim != len(feature_columns):
    raise ValueError(
        f"Dimension mismatch: embedding={embedding_dim}, "
        f"features={len(feature_columns)}"
    )
```

## 5. 구현 단계

### Phase 0: 피처/가중치 점검 도구 구현
- [ ] `scripts/inspect_training_features.py` 작성
- [ ] 현재 학습 피처 구성 확인
- [ ] 가중치 적용 검증
- [ ] Git: commit → push

### Phase 1: WORK_ORDER_RESULTS 통합
- [ ] `backend/predictor_ml.py:predict_routing_from_similar_items()` 수정
- [ ] `fetch_work_results_for_item()` 연동
- [ ] 예측 시간 계산 로직 추가
- [ ] 단위 테스트 작성
- [ ] Git: commit → push

### Phase 2: Feature Recommendations 수정
- [ ] `feature_recommendations.json` UTF-8 재생성
- [ ] 프론트엔드 가중치 추천 UI 구현
- [ ] 가중치 선택 → 재학습 트리거 연동
- [ ] Git: commit → push

### Phase 3: 유사 품목 노드 리스트 구현
- [ ] `RoutingCanvas.tsx` 상단에 노드 리스트 추가
- [ ] `selectedCandidateId` 상태 관리
- [ ] 현재 선택 노드 하이라이트
- [ ] Git: commit → push

### Phase 4: 노드 클릭 인터랙션
- [ ] 클릭 이벤트 핸들러 구현
- [ ] `activeTimeline` 자동 전환
- [ ] Canvas 재렌더링 확인
- [ ] Git: commit → push

### Phase 5: 통합 및 검증
- [ ] 전체 workflow 테스트
- [ ] 피처 가중치 → 추천 → 선택 → 예측 → 시각화 전 과정 검증
- [ ] Git: merge to main → push → return to 251014

## 6. 리스크 및 대응

### 6.1 WORK_ORDER_RESULTS 데이터 품질
**리스크**: 실적 데이터 누락 또는 품질 저하
**대응**:
- 실적 건수 < 3인 경우 BI_ROUTING_VIEW 시간 사용
- 이상치 필터링 (IQR 방식)

### 6.2 시각화 성능
**리스크**: 유사 품목 수 증가 시 렌더링 지연
**대응**:
- 상위 N개 (default: 10개)만 표시
- React.memo() 최적화

### 6.3 가중치 변경 영향
**리스크**: 사용자가 부적절한 가중치 선택
**대응**:
- 추천 가중치에 신뢰도 점수 표시
- 변경 전 확인 모달

## 7. 산출물

### 문서
- [ ] PRD (본 문서)
- [ ] Checklist
- [ ] Phase별 작업 보고서

### 코드
- [ ] `scripts/inspect_training_features.py`
- [ ] `backend/predictor_ml.py` (수정)
- [ ] `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (수정)
- [ ] `frontend-prediction/src/components/FeatureWeightManager.tsx` (신규)

### 데이터
- [ ] `feature_recommendations.json` (재생성)
- [ ] 단위 테스트 케이스

## 8. 일정

- Phase 0: 1일 (피처 점검 도구)
- Phase 1: 1-2일 (WORK_ORDER 통합)
- Phase 2: 1일 (추천 UI)
- Phase 3-4: 1-2일 (시각화)
- Phase 5: 1일 (통합 검증)
- **총 예상 기간**: 5-7일

## 9. 참고 문서

- [Routing ML Algorithm Audit Report](../reports/2025-10-21-routing-ml-algorithm-audit.md)
- [Phase 1 Full Feature Training Report](../reports/2025-10-21_phase1-full-feature-training-completion.md)
- [README.md Workflow](.claude/README.md)
