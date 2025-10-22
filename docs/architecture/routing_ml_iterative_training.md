# Routing ML 반복 최적화 설계 문서 (2025-10-22)

본 문서는 `.claude/WORKFLOW_DIRECTIVES.md`의 절차와 품질 기준을 준수하며, Routing ML 시스템을 반복적으로 학습·평가·개선하기 위한 상세 설계안을 제시한다. 모든 모듈, 데이터 흐름, 운영 절차를 다른 작업자도 즉시 이해할 수 있도록 최대한 구체적으로 기술한다.

---

## 1. 배경과 목적

1. **현황**
   - ITEM_INFO 기반 임베딩 + HNSW 검색을 통해 유사 품목을 추천하는 모델을 운영 중이다.
   - ROUTING_VIEW 및 WORK_ORDER_RESULTS 데이터를 후처리에 활용해 실적 기반 보정(세트업 시간, 런 타임, 외주 전환 등)을 수행한다.
   - 모델 학습은 수동으로 이루어지며, 예측 품질을 정량적으로 모니터링하는 체계가 부족하다.

2. **문제점**
   - 실적 데이터의 변동, 신규 품목 등장, 외주 전환 정책 변화에 따라 예측 품질이 급격히 떨어질 수 있으나, 이를 조기에 감지할 장치가 없다.
   - 재학습을 무작정 반복하면 자원 낭비 및 모델 불안정이 발생할 수 있으므로, 반복 학습에 대한 명확한 기준과 절차가 필요하다.

3. **목적**
   - 학습 → 예측 → 실적 비교 → 품질 평가 → 재학습 여부 판단의 사이클을 자동화한다.
   - scikit-learn 기반 MLP/Stacking 등 경량 모델을 이용해 대안 모델을 학습하고, 기존 모델과 비교 평가한다.
   - PowerShell 콘솔에서 실시간 로그를 모니터링하고, 사이클 종료 시 상세 리포트를 저장해 운영자가 추적할 수 있도록 한다.

---

## 2. 전체 아키텍처 요약

```
[사용자/스케줄러] ──▶ [학습 서비스] ──▶ [품질 평가 워커]
                                  │               │
                                  │               ├─ 샘플링 (ITEM_INFO)
                                  │               ├─ 예측 실행 (기존 모델)
                                  │               ├─ WORK_ORDER 비교/지표 산출
                                  │               └─ 재학습 큐 enqueue
                                  │
                                  └─ 재학습 엔진 (Baseline / MLP / Stacking)
                                              │
                                              ├─ 교차검증, 모델 비교
                                              ├─ FeatureWeightManager 갱신
                                              └─ 모델 배포 (models/version_xxx)
```

---

## 3. 세부 기능 설계

### 3.1 품질 평가 워커

1. **샘플링 (SamplingStage)**
   - 입력: `sample_size`, `strategy`, `seed`.
   - 전략:
     - `random`: 단순 무작위 추출.
     - `stratified`: 품목군, Part Type 등 분류 기준을 바탕으로 균형 잡힌 샘플링.
     - `recent_bias`: 최근 생성/수정 품목에 가중치를 두어 신선도를 확보.
   - 출력 데이터 구조:
     ```json
     {
       "cycle_id": "2025-10-22T05:30:00Z",
       "items": [
         {"item_cd": "120-00001", "reason": "stratified:TYPE_A"},
         ...
       ]
     }
     ```

2. **예측 (PredictionStage)**
   - API: 기존 `predict_items_with_ml_optimized`.
   - 결과: 후보 라우팅, 공정별 예측 시간, 유사도, WORK_ORDER_COUNT, OUTSOURCING_REPLACED 등.
   - 예시:
     ```json
     {
       "item_cd": "120-00001",
       "routing": [...],
       "candidates": [
         {
           "CANDIDATE_ITEM_CD": "ML_PREDICTED",
           "SIMILARITY_SCORE": 1.0,
           "WORK_ORDER_COUNT": 12,
           "WORK_ORDER_CONFIDENCE": 0.82
         }
       ]
     }
     ```

3. **실적 비교 (EvaluationStage)**
   - 데이터: `dbo_BI_WORK_ORDER_RESULTS`에서 ITEM_CD + PROC_SEQ + JOB_CD 기반 실적 시간 조회.
   - 결측 처리: 숫자 컬럼은 `trim_ratio`(기본 10%) 기준으로 극단값 제거 후 평균/표준편차 계산.
   - 지표:
     | 지표 | 의미 |
     | --- | --- |
     | `MAE` | 평균 절대 오차 (분) |
     | `Trim-MAE` | 극단값 제거 후 MAE |
     | `RMSE` | 제곱 평균 제곱근 오차 |
     | `ProcessMatch` | 공정 시그니처 일치율 (추천 공정 중 실제 공정 포함 비율) |
     | `OutsourcingSuccess` | 외주→사내 전환 성공률 |
     | `CV` | 변동계수 (표준편차/평균) |
     | `SampleCount` | 실적 데이터 수 |
   - 기준:
     - `MAE <= 5`, `ProcessMatch >= 0.8`, `SampleCount >= 3`.
     - `CV >= 0.5`이면 “변동성 높음” 경고.

4. **지표 기록 및 로그 스트리밍**
   - 실시간 로그 (`logs/performance/performance.quality.log`):
     ```
     [2025-10-22T05:30:12Z] INFO  cycle=42 sampling=500 strategy=stratified
     [2025-10-22T05:30:45Z] WARN  cycle=42 item=120-00001 proc=PROC_A cv=0.62 samples=2 action=enqueued_retrain
     ```
   - 사이클 종료 산출물:
     - `logs/performance/performance.quality_<cycle>.log`
     - `deliverables/quality_metrics_<cycle>.json` (모든 지표)
     - `deliverables/quality_metrics_<cycle>.csv`
     - `deliverables/quality_summary_<cycle>.md` (핵심 요약)

5. **재학습 큐 관리**
   - 큐 엔트리 예시:
     ```json
     {
       "queue_id": "retrain_20251022T053045Z",
       "cycle_id": "20251022T053000Z",
       "items": ["120-00001", "120-00002"],
       "metrics": {"mae": 5.8, "process_match": 0.62},
       "status": "pending"
     }
     ```
   - 큐 크기 제한 `max_queue`: 기본 3. 가득 차면 새로운 작업은 deferred 처리.
   - 상태: `pending`, `running`, `failed`, `succeeded`.
   - 실패 시 재시도 설정 (`retry.max_attempts`, `retry.backoff_sec`).

### 3.2 재학습 엔진

1. **모델 후보**
   - **Baseline**: 현행 ITEM_INFO 임베딩 + HNSW.
   - **MLPRegressor**:
     - 입력: 임베딩 + 유사 품목 통계(TrimMean, SampleCount, Confidence).
     - 출력: 공정별 SETUP/RUN 예측.
     - 파라미터: hidden_layer_sizes, activation, alpha, max_iter, learning_rate_init 등.
   - **StackingRegressor**:
     - Base estimators: KNNRegressor, RandomForestRegressor, MLPRegressor.
     - Final estimator: RidgeCV 또는 ElasticNet.
     - 어텐션 유사 효과: 각 base 모델의 예측을 가중 합해 특징별 상관관계를 학습.

2. **교차검증**
   - K-Fold (기본 5), Fold마다 Trim-MAE, ProcessMatch 계산.
   - 빠른 계산을 위해 joblib 병렬화 적용.
   - 결과 예:
     ```
     model=baseline mae=4.8 trim_mae=3.5 match=0.78
     model=mlp      mae=3.9 trim_mae=2.8 match=0.83
     model=stacking mae=3.7 trim_mae=2.6 match=0.85
     ```

3. **모델 채택 기준**
   - Baseline 대비 MAE가 5% 이상 개선되고, ProcessMatch도 향상되면 새로운 모델을 채택.
   - 개선이 없거나 오히려 악화되면 기존 모델 유지, 큐 엔트리 상태는 `skipped`로 기록.

4. **모델 저장/배포**
   - 모델 경로: `models/version_<timestamp>` (searcher, encoder, scaler, feature_weights 등).
   - `ModelManifest` 업데이트 → predictor 서비스 캐시 무효화.
   - `FeatureWeightManager`로 피처 가중치 자동 저장 (`feature_weights.json`, `active_features.json`).

5. **파라미터 튜닝**
   - `iter_training.yaml`에서 허용된 범위 내에서 Grid/Random 탐색.
   - 예시:
     ```yaml
     tuning:
       enabled: true
       max_trials: 5
       mlp_search_space:
         hidden_layer_sizes: [[128, 64], [256, 128, 64]]
         alpha: [0.0001, 0.001]
         learning_rate_init: [0.001, 0.01]
     ```

### 3.3 로그 및 운영 프로세스

1. **PowerShell 스트림**
   - 운영자는 `Get-Content -Wait logs/performance/performance.quality.log`로 실시간 상태 모니터링.
   - 경고/오류 발생 시 색상/심벌을 통해 가시성 제공(예: WARN=노란색, ERROR=빨간색).

2. **사이클 리포트**
   - JSON: 모든 지표, 경고, 재학습 큐 상태.
   - CSV: 아이템/공정 단위 지표.
   - Markdown: 관리자 보고용 요약 (핵심 지표/경고/권장 조치).

3. **알림 조건**
   - `MAE > threshold`, `ProcessMatch < threshold`, `SampleCount < min_samples`.
   - 추후 Slack/Webhook 등으로 확장 가능하도록 JSON 라인 로그 구조 유지.

---

## 4. 프런트엔드 확장 설계

1. **추천 페이지 메타데이터 표시**
   - 노드 Hover 시: setup/run/wait/move, TrimMean, 샘플 수, 신뢰도, 표준편차, 외주전환 배지.
   - 후보 탭: 샘플 수/신뢰도/외주전환, 추천 우선순위, 최근 평가 날짜 표시.
   - 추천 실행 헤더: “현재 모델: version_xxx, 마지막 평가: 2025-10-22, MAE 3.9분” 등 요약 표시.

2. **품질 대시보드**
   - 최근 N회 품질 사이클 히스토리(그래프 + 테이블).
   - 경고 목록(높은 CV 공정, 샘플 부족 품목, 재학습 실패 등).
   - 결과 다운로드 버튼(JSON/CSV).

3. **설정 UI**
   - `iter_training.yaml`의 주요 파라미터를 수정할 수 있는 Form.
   - 변경 시 백엔드 Config API 호출 -> 저장 -> 적용 결과 로그로 확인.
   - 설정 변경 내역을 감사 로그/체크리스트에 기록.

---

## 5. 체크리스트 및 단계별 산출물

`.claude/WORKFLOW_DIRECTIVES.md`의 Phase 절차를 따르며, 각 단계에서 즉시 체크리스트를 업데이트한다.

1. **Phase 0 – 요구사항 정리**
   - PRD/체크리스트 업데이트.
   - 본 설계 문서 작성 및 공유.

2. **Phase 1 – 백엔드 설계 확정**
   - 품질 워커, 재학습 큐, 모델 비교 로직 상세 설계 문서 작성.
   - Config/로그 포맷 정의.

3. **Phase 2 – 구현**
   - 품질 워커, 재학습 엔진, 모델 저장/배포 코드 작성.
   - 유닛/통합 테스트 추가.

4. **Phase 3 – 프런트 구현**
   - 추천 페이지 메타데이터, 대시보드, 설정 UI 구현.
   - API 명세 반영.

5. **Phase 4 – QA 및 운영 준비**
   - 자동/수동 테스트 수행.
   - QA 보고서 작성(`deliverables/QA_REPORT_YYYY-MM-DD_routing-ml-iterative.md`).
   - Monitor 빌드 시퀀스 실행, 로그/산출물 보관.
   - 이해관계자 리뷰 및 회의록 작성.

---

## 6. 향후 로드맵

- **단기**: 품질 평가 워커 구현, MLP/Stacking 모델 실험, 파라미터 설정 UI 구축.
- **중기**: 품질 지표 대시보드 고도화, 자동 파라미터 탐색(Grid/Random), 경고/알림 시스템.
- **장기**: Active Learning 도입(불확실성이 높은 품목 우선 재학습), 데이터 파이프라인 최적화, 모델 앙상블 자동 관리.

---

## 7. 부록

1. **데이터 파일 구조 예시**
   ```
   backend/
     quality_evaluator.py
     iter_training/
       config_loader.py
       models.py
   config/
     iter_training.yaml
   deliverables/
     quality_metrics_20251022T053000Z.json
     quality_metrics_20251022T053000Z.csv
     quality_summary_20251022T053000Z.md
   logs/performance/
     performance.quality.log
     performance.quality_20251022T053000Z.log
   ```

2. **예외 시나리오 체크리스트**
   - [ ] 샘플링 결과 0건 → 워커 종료 + 경고 로그.
   - [ ] 예측 API 실패 → 재시도 후 실패 시 에러 로그 + 사이클 중단.
   - [ ] 실적 매칭 0건 → `HAS_WORK_DATA=false`, 재학습 큐 등록 여부 판단.
   - [ ] 재학습 큐 가득 참 → 새로운 작업 `deferred` 처리, 경고 로그.
   - [ ] 모델 저장 실패 → 기존 모델 유지, 에러 로그 + 운영자 알림.

3. **Quality Metrics JSON 샘플**
   ```json
   {
     "cycle_id": "2025-10-22T05:30:00Z",
     "sample_size": 500,
     "strategy": "stratified",
     "mae": 3.92,
     "trim_mae": 2.85,
     "rmse": 5.41,
     "process_match": 0.83,
     "outsourcing_success": 0.91,
     "alerts": [
       {
         "item_cd": "120-00001",
         "proc_cd": "PROC_A",
         "issue": "HIGH_CV",
         "cv": 0.62,
         "sample_count": 2
       }
     ]
   }
   ```

---

- 작성자: Codex ML  
- 작성일: 2025-10-22  
- 비고: 본 문서는 `.claude/WORKFLOW_DIRECTIVES.md`를 준수하여 Phase 0 산출물로 등록하며, 이후 단계별 체크리스트 업데이트와 Monitor 빌드 시퀀스 수행을 전제한다.
