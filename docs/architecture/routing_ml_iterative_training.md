# Routing ML 반복 최적화 알고리즘 설계 (2025-10-22)

## 1. 목표 및 요구사항
- ITEM_INFO 기반 임베딩 모델을 유지하면서, 실시간 예측 품질을 지속적으로 향상시키는 반복 학습(online-like) 루프 설계를 수립한다.
- 학습~예측~실적 비교까지 하나의 사이클로 자동 수행하고, 각 사이클에서 품질 지표를 계산해 재학습/파라미터 튜닝 의사결정을 내린다.
- 딥러닝 프레임워크(TensorFlow/PyTorch)는 사용하지 않으며, scikit-learn 등 범용 ML 도구를 활용한다.
- 결과 로그는 서버 파워쉘 콘솔로 스트리밍하며, 종료 시 전체 로그/지표를 파일로 저장한다.

## 2. 전체 아키텍처 개요
```
┌────────────┐      ┌───────────────────────┐
│ 신규 데이터 ├────▶│ 샘플링 (ITEM_INFO)     │
└─────┬──────┘      └────────┬──────────────┘
      │                       │
      │                       ▼
      │              ┌─────────────────────┐
      │              │ 모델 예측 (현재 버전) │
      │              └────────┬────────────┘
      │                       │
      │                       ▼
      │              ┌───────────────────────┐
      │              │ WORK_ORDER 비교/평가    │
      │              └────────┬──────────────┘
      │                       │
      │                       ▼
      │              ┌─────────────────────┐
      │              │ 품질 지표 산출 & 로그 │
      │              └────────┬────────────┘
      │                       │
      │        품질 ↓         │ 품질 ↑
      │                       ▼
      │              ┌─────────────────────┐
      │              │ 재학습 큐/파라미터    │
      │              └─────────────────────┘
      │
      ▼
┌────────────────────────┐
│ 업데이트된 모델 배포       │
└────────────────────────┘
```

## 3. 사이클 세부 단계

### 3.1 샘플링 단계
- 대상 뷰: `dbo_BI_ITEM_INFO_VIEW`.
- 샘플 수: 기본 500건, 설정 파일(`config/iter_training.yaml`)로 조정.
- 샘플링 전략:
  - 고정 시드로 랜덤 추출 → 재현성 확보.
  - 품목군/제품군별 균형을 위한 Stratified Sampling 옵션.
  - 최근 신규 품목을 우선 포함하는 “freshness” 가중치 제공.

### 3.2 예측 단계
- 기존 파이프라인 `predict_items_with_ml_optimized` 재사용.
- OUTPUT:
  - 후보 라우팅 (ML 생성 + 보조 스코어 반영).
  - 공정별 예상 Setup/Run/Wait.
  - 유사도, 샘플 수, 외주 전환 여부 등 메타데이터.

### 3.3 실적 비교 및 품질 평가
- `dbo_BI_WORK_ORDER_RESULTS`에서 동일 ITEM_CD, PROC_SEQ, JOB_CD 기준 실측 시간 조회.
- 평가 지표(기본):
  - `MAE`, `Trimmed MAE (10%)`, `RMSE`.
  - 공정 시그니처 일치율 (Top-K 중 실제 사용된 공정 포함 여부).
  - 외주→사내 전환 성공률.
  - 샘플 수와 표준편차.
- 품질 기준 예시:
  - MAE ≤ 5분, 공정 일치율 ≥ 80% 미만 시 경고.
  - CV ≥ 0.5이면 해당 공정은 “불안정”으로 플래그.

### 3.4 로그 및 리포팅
- 실시간 로그 스트리밍:
  - PowerShell 콘솔 `Get-Content -Wait logs/performance/performance.quality.log`.
  - 로그 레벨: INFO (진행상황), WARN (결측/샘플 부족), ERROR (실패).
- 사이클 종료 후 산출물:
  - `logs/performance/performance.quality_{timestamp}.log`
  - `deliverables/quality_metrics_{date}.json`
  - `deliverables/quality_metrics_{date}.csv`
  - `deliverables/quality_summary_{date}.md` (옵션)

### 3.5 재학습/튜닝 의사결정
- 평가 지표에 따라 두 경로로 분기:
  1. **품질 만족**: 현 모델 유지, 지표만 기록.
  2. **품질 미달**: 재학습 Workflow 진입.
     - 재학습 큐에 품목 샘플 + 지표 + 시간 정보 등록.
     - 재학습 전 파라미터 탐색(그리드/랜덤) 실행 여부 판단.

## 4. 반복 학습 알고리즘 설계

### 4.1 모델 구성 옵션
1. **Baseline**: ITEM_INFO 임베딩 + KNN/HNSW (현재 모델 유지).
2. **확장형 MLP** (scikit-learn MLPRegressor)
   - 입력: ITEM_INFO 임베딩 + 후보 공정 통계(Trim Mean, 샘플 수, 유사도).
   - 출력: 공정별 SETUP/RUN 시간을 다중 출력 회귀로 예측.
   - 파라미터(예: hidden_layer_sizes, activation, alpha, max_iter, learning_rate_init).
3. **스태킹 Regressor**
   - Base estimators: (KNN, RandomForestRegressor, MLPRegressor).
   - Final estimator: Ridge 혹은 ElasticNet으로 블렌딩 → 어텐션 대체.
4. **피드백 Weighting**
   - 실적 품질이 낮은 공정(샘플 부족, CV 높음)에 대해 가중치를 축소.
   - 품질 평가 후 피처 중요도를 업데이트(`feature_weights.json`).

### 4.2 반복 최적화 절차
1. 품질 평가 → 지표 계산.
2. 임계치 미달 시 재학습 큐에 작업 등록 (`quality_jobs` 테이블).
3. 재학습 Job 실행:
   - 샘플 확장 (최근 N 사이클 데이터 축적).
   - 모델 후보 (Baseline vs MLP vs Stacking) 학습.
   - 교차 검증(예: K=5) + 평가 지표 비교.
4. 가장 성능이 좋은 모델 채택 → `models/version_{timestamp}` 저장.
5. `feature_weight` 및 `routing_postprocess` 통계 파라미터 업데이트.
6. 변경 사항 `ModelManifest`에 기록 → predictor 서비스에 반영.

## 5. 파라미터 설정 및 UI/Config
- `config/iter_training.yaml` 예시:
  ```yaml
  sampling:
    sample_size: 500
    stratified: true
    seed: 20251022
  metrics:
    trim_ratio: 0.1
    mae_threshold: 5.0
    process_match_threshold: 0.8
  retrain:
    enable: true
    max_queue: 3
    models:
      - baseline
      - mlp
      - stacking
    mlp_params:
      hidden_layer_sizes: [128, 64]
      activation: relu
      alpha: 0.0001
      max_iter: 300
      learning_rate_init: 0.001
  ```
- 프런트/CLI 옵션:
  - 학습 횟수(max_iter), Loss(early stopping 조건), Trim Ratio 등 변경 UI 제공.
  - 품질 지표이력 조회 페이지(추후 React 컴포넌트) 구성.

## 6. 로그 및 모니터링
- 실행 로그 구조:
  ```
  [2025-10-22T05:30:12] INFO  quality_evaluator: cycle=42 sampling=500 items
  [2025-10-22T05:30:45] INFO  quality_evaluator: mae=4.12 trim_mae=3.01 match_rate=0.84
  [2025-10-22T05:30:46] WARN  quality_evaluator: process=PROC_120 CV=0.62 samples=2 (flag=RETRAIN)
  [2025-10-22T05:31:10] INFO  quality_evaluator: enqueue retrain_job=20251022053110
  ```
- 모니터링:
  - PowerShell `Get-Content -Wait logs/performance/performance.quality.log`.
  - Alert 조건: MAE > threshold, match_rate < threshold, 샘플 수 < 최소값 등.

## 7. 워크플로 매핑 (WORKFLOW_DIRECTIVES 준수)
- **Phase 0 (요구정의)**: 본 문서 작성 및 PRD/체크리스트 업데이트.
- **Phase 1 (설계)**: 품질 평가 파이프라인, 재학습 큐 구조, Config 설계.
- **Phase 2 (구현 & 테스트)**: Worker, 로그, 재학습 플로우 코딩, QA.
- **Phase 3 (관리 & 배포)**: 문서화, QA 보고, 빌드 시퀀스, 이해관계자 리뷰.

## 8. 향후 로드맵
- 단기: 품질 평가 Worker + MLP 실험 + 파라미터 UI.
- 중기: 품질 지표 대시보드, 자동 파라미터 탐색(Grid/Random), 시나리오별 알람.
- 장기: Active Learning 개념 도입(불확실성이 높은 품목 위주 재학습), 서브시스템간 데이터 파이프라인 고도화.

---
- 작성자: Codex ML
- 작성일: 2025-10-22
- 참고: `.claude/WORKFLOW_DIRECTIVES.md`를 준수하여 Phase 0 산출물로 기록
