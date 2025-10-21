# Routing ML Training & Prediction QA Review — 2025-10-21

## Executive Summary
- 최신 학습 파이프라인은 324,919행·41개 피처를 활용해 128차원 유사도 벡터를 생성하지만, `ITEM_NM_ENG`, `DRAW_USE`, `GROUP3` 등 일부 피처의 결측률이 84~100% 수준으로 높다.citemodels/default/training_metrics.json
- 가중치 관리(`FeatureWeightManager`)는 기본 33개 활성 피처와 평균 1.137, 표준편차 0.655의 가중치를 적용하며, 씰 제조 최적화 프로필과 요약 통계를 제공한다.citebackend/feature_weights.py:18backend/feature_weights.py:443models/default/feature_weights.jsonmodels/default/feature_weights.json
- 예측 파이프라인은 기존 라우팅 우선 반환 후, ML 경로를 계산하지만 첫 번째 유사 품목의 라우팅만 사용하고 `WORK_ORDER` 실적은 입력 품목에 대해서만 조회한다. 유사 품목 목록은 UI에 노출되지 않는다.citebackend/predictor_ml.py:757backend/predictor_ml.py:1185backend/predictor_ml.py:1231backend/predictor_ml.py:1384frontend-prediction/src/store/routingStore.ts:1194
- 저장소(DB) 계층은 RSL/라우팅 그룹 저장용 SQLAlchemy 모델을 PostgreSQL URL로 전환했지만, 테스트와 몇몇 스크립트는 여전히 SQLite 또는 하드코딩 자격증명을 사용한다. 학습용 ERP 연결(`backend/database.py`)은 여전히 MSSQL 전용이다.citebackend/models/routing_groups.py:18backend/database_rsl.py:171tests/test_training_service_manifest.py:24scripts/create_postgres_db.py:14backend/database.py:60backend/database.py:246
- 프런트엔드 추천 스토어는 API가 반환하는 `candidates` 배열을 무시하고 있어 “유사 품목 노드”가 시각화 레이어로 전달되지 않는다.citefrontend-prediction/src/types/routing.ts:95frontend-prediction/src/store/routingStore.ts:1194

## Training Pipeline Assessment
### Feature Coverage & Data Quality
| 항목 | 값 |
| --- | --- |
| 전체 샘플 수 | 324,919 |
| 고유 품목 수 | 324,919 |
| 사용 피처 수 (원본) | 41 |
| 활성 피처 수 (`FeatureWeightManager`) | 33 |
| 벡터 차원 | 128 |
| 학습 소요 시간 | 29.98초 |
| Variance Threshold | 0.001 |
| Similarity Threshold (런타임) | 0.85 |
| Trim Range | 3% ~ 97% |

> 출처: `models/default/training_metrics.json`, `models/default/training_metadata.json`citemodels/default/training_metrics.jsonmodels/default/training_metadata.json

고결측 피처 상위 6개:

| 피처 | 결측률 |
| --- | --- |
| DRAW_USE | 100.00% |
| ITEM_NM_ENG | 100.00% |
| GROUP3 | 99.07% |
| RAW_MATL_KINDNM | 96.97% |
| SealTypeGrup | 84.22% |
| ROTATE_CTRCLOCKWISE | 75.84% |

> 출처: `models/default/training_metrics.json`citemodels/default/training_metrics.json

### Feature Weights & Validation
- 기본 가중치 요약: 평균 1.137, 표준편차 0.655, 최소 0.3, 최대 2.5 (41개 피처).citemodels/default/feature_weights.json
- 최우선 피처(가중치 ≥2.2): `ITEM_TYPE`, `PART_TYPE`, `SealTypeGrup`, `RAW_MATL_KIND`, `ITEM_MATERIAL`.citemodels/default/feature_weights.json
- 씰 제조 특화 프로필은 주요 치수/씰 피처 가중치를 2.5~3.0 수준으로 증폭한다.citebackend/feature_weights.py:443
- 가중치 검증/요약 도구: `FeatureWeightManager.get_summary_statistics()`로 활성 피처 수, 평균/분산을 확인하고 JSON·joblib 동시 저장을 지원한다.citebackend/feature_weights.py:18backend/feature_weights.py:512
- 학습 루프(`train_model_with_ml_improved`)는 범주형 라벨 인코딩 → 수치 정규화 → (선택적) 분산 임계 → StandardScaler → 가중치 적용 순으로 전처리한다.citebackend/trainer_ml.py:867backend/trainer_ml.py:929backend/trainer_ml.py:966

## Prediction Pipeline Assessment
1. **기존 라우팅 우선 반환**: `predict_single_item_with_ml_enhanced`는 `fetch_routing_for_item`으로 최신 라우팅 존재 시 요약/상세 모드로 즉시 반환한다.citebackend/predictor_ml.py:757backend/predictor_ml.py:773
2. **ML 경로 계산**:
   - 입력 품목 인코딩: `_clean_and_encode_enhanced`가 캐시, 라벨 인코딩, 스케일링, 가중치 적용을 수행하며 결측률을 산출한다.citebackend/predictor_ml.py:647
   - 유사 품목 탐색: HNSW/HNSWSearch 기반으로 `find_similar(vec, top_k)` 실행, 이후 `predict_routing_from_similar_items` 호출.citebackend/predictor_ml.py:841backend/predictor_ml.py:1185
   - **제한사항**: 첫 번째로 라우팅이 존재하는 유사 품목을 찾으면 즉시 루프를 종료 (`break`), 다른 후보의 공정 정보는 버려진다.citebackend/predictor_ml.py:1231
   - 시간 통계: 가중치 기반 평균 + Z-score 이상치 제거 후 최적/표준/안전 시간 산출.citebackend/predictor_ml.py:1352backend/predictor_ml.py:1380backend/predictor_ml.py:1053
   - WORK_ORDER 실적 연동: `fetch_and_calculate_work_order_times`는 입력 품목 기준 PROC_SEQ/JOB_CD 매칭 데이터만 집계한다. 유사 품목 실적은 활용되지 않는다.citebackend/predictor_ml.py:1384backend/predictor_ml.py:1096backend/database.py:1078
3. **후처리/요약**: 후보 목록은 `cand_df`로 작성되나 `PredictionResponse.candidates`와 UI 스토어에서 소비되지 않는다.citebackend/predictor_ml.py:863frontend-prediction/src/store/routingStore.ts:1194frontend-prediction/src/types/routing.ts:95

### Issues & Impact
- **단일 후보 선호**: 한 개의 유사 품목만 라우팅 제공 ⇒ 다양한 경로 비교/조합 불가, 예측 안정성 저하.
- **WORK_ORDER 목적 미충족**: 요구사항(유사 품목 실적 반영·예측) 대비, 입력 품목 실적만 존재 시 값이 None으로 남아 시각화에 영향 없음.
- **UI 미연동**: 유사 품목 노드, 추천 노드 클릭 시 그래프 반영 기능 부재. 결과적으로 요구사항의 “유사 품목 리스트 상단 노드화” 불이행.

## Visualization & UI Findings
- `RecommendationBucket` 구조는 후보 공정(OperationStep)만 보유하며, 유사 품목 메타(`CandidateRouting`)를 별도로 보존하지 않는다.citefrontend-prediction/src/store/routingStore.ts:115frontend-prediction/src/store/routingStore.ts:1194
- `PredictionResponse.candidates`는 전체 스토어/컴포넌트에서 미사용으로 확인되었다 → 유사 품목 랭킹·유사도 UI 노출 불가.citefrontend-prediction/src/types/routing.ts:95frontend-prediction/src/store/routingStore.ts:1194
- 추천 패널(`CandidatePanel`)은 bucket 단위 공정을 카드화할 뿐 유사 품목 전환 버튼이나 클릭 이벤트(노드 전환)가 없다.citefrontend-prediction/src/components/CandidatePanel.tsx:1frontend-prediction/src/components/CandidatePanel.tsx:61

## Legacy Model Reuse Readiness
- `FeatureWeightManager`는 모델 디렉터리에 있는 `feature_weights.json/joblib`와 `active_features.json`을 자동 로드하고, 누락 시 기본값으로 회귀한다.citebackend/feature_weights.py:466backend/feature_weights.py:494
- `predictor_ml`는 개선된 저장 포맷 감지 후, 레거시 `.joblib`/`.npy` 가중치를 `_load_legacy_weights`로 변환한다.citebackend/predictor_ml.py:219backend/predictor_ml.py:190
- `models/save_load.py`는 PCA/VarianceSelector/FeatureWeightManager까지 포함한 매니페스트 저장을 제공하고, 레거시 임베딩 호환 API(encoder/scaler/item_vectors)도 유지한다.citemodels/save_load.py:15models/save_load.py:170models/save_load.py:280
- **재사용 절차 제안**: (1) `models/releases/v1` 등 기존 모델 디렉터리 확보 → (2) `similarity_engine.joblib` 등 필수 자산 검증 → (3) `training_metadata.json` 부재 시 최소 메타 작성 → (4) `FeatureWeightManager.load_weights()`로 활성 상태 점검.

## Database Migration QA
### 현재 상태
- 내부 저장용 SQLAlchemy 모델(`routing_groups`, `RSL`)은 `postgresql+psycopg` URL을 기반으로 엔진을 생성한다.citebackend/models/routing_groups.py:18backend/database_rsl.py:171
- `.env`/`.env.example`/`docker-compose.yml`은 PostgreSQL URL을 기본값으로 노출하였으나, 실제 비밀번호가 저장소에 포함되어 있어 비밀 관리 필요.cite.env.env.exampledocker-compose.yml
- ERP 조회용 `backend/database.py`는 `DB_TYPE != MSSQL`일 경우 즉시 RuntimeError를 발생시켜, Access→PostgreSQL 뷰 전환은 미구현.citebackend/database.py:60backend/database.py:246
- `scripts/migrate_access_to_postgres.py`는 Access 뷰 → `routing.*` 스키마 테이블로 변환, NULL 비율 경고, 레코드 수 검증을 제공한다.citescripts/migrate_access_to_postgres.py:40scripts/migrate_access_to_postgres.py:362scripts/migrate_access_to_postgres.py:502
- `scripts/create_postgres_db.py`는 하드코딩된 루트 계정과 비밀번호를 사용, 환경 변수 지원 없음.citescripts/create_postgres_db.py:14
- 테스트 스위트는 여전히 `sqlite:///:memory:` URL을 주입하므로 PostgreSQL 전환 검증이 자동화되지 않는다.citetests/test_training_service_manifest.py:24tests/test_training_service_status.py:13

### 리스크
- **보안**: `.env`와 스크립트에 평문 비밀번호 존재 → 실환경 노출 위험.
- **테스트 갭**: SQLite 기반 테스트는 PostgreSQL 특성(트랜잭션, JSONB, 인덱스)을 검증하지 못함.
- **ERP 파이프라인 이중화**: Access/MSSQL → PostgreSQL 뷰 전환 전략이 미비. 전환 완료 전까지 `DB_TYPE` 상수로 인해 혼합 사용 불가.

## Recommendations
| 우선순위 | 항목 | 제안 |
| --- | --- | --- |
| 🔴 High | 유사 품목 라우팅 조합 | `predict_routing_from_similar_items`에서 `break` 제거 후 다수 후보 병합/가중 평균 로직 구현. `SIMILARITY_SCORES`와 `SOURCE_ITEMS` 기반 후보별 기여도 기록. |
| 🔴 High | WORK_ORDER 활용성 | `fetch_and_calculate_work_order_times`를 유사 품목 수준으로 확장하고, 입력 품목 실적이 없을 때 대체 후보 실적을 병합하도록 개선. |
| 🔴 High | UI 후보 노출 | `PredictionResponse.candidates`를 `routingStore.loadRecommendations`에 저장, 상단 노드 탭/클릭 시 `timeline`을 교체하도록 컴포넌트 업데이트. |
| 🟠 Medium | 데이터 결측 정리 | 결측률 80% 이상 피처(`DRAW_USE`, `ITEM_NM_ENG`, `GROUP3`, `SealTypeGrup`)는 제거/대체 전략 수립 후 학습 전 전처리에서 제외. |
| 🟠 Medium | Legacy 모델 체크리스트 | `models/releases` 디렉터리 기준 가중치·피처 일치 여부를 검사하는 CLI (`--verify-weights`, `--list-active-features`) 추가. |
| 🟠 Medium | PostgreSQL 테스트 전환 | pytest에서 `postgresql+psycopg` Docker 컨테이너를 활용해 RSL/라우팅 그룹 CRUD를 검증하고, SQLite 전용 fixture 제거. |
| 🟡 Low | DB 비밀 관리 | `.env`에서 비밀번호 제거, `scripts/create_postgres_db.py`를 환경 변수 기반으로 수정하고, 문서에 Vault/Secret Manager 절차 추가. |
| 🟡 Low | ERP 뷰 전환 로드맵 | `backend/database.py`의 `DB_TYPE` 상수 분기를 확장해 PostgreSQL/Access 병용 모드(Feature Flag)와 마이그레이션 체크리스트 작성. |

## Quantitative Appendix
1. Feature Weights Summary (JSON) — `models/default/feature_weights.json`
2. Missing Rates — `models/default/training_metrics.json`
3. Training Request/Runtime Settings — `models/default/training_metadata.json`, `models/default/training_request.json`
4. Prediction Scenario Defaults — `backend/predictor_ml.py:45-55`
5. Migration Scripts — `scripts/migrate_access_to_postgres.py`, `migration/schema.sql`

