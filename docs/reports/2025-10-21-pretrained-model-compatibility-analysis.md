# 2025-10-21 사전 학습 모델 호환성 분석 보고서

## 1. 개요
- 목적: `models/` 디렉터리에 존재하는 사전 학습 모델이 최신 학습 파이프라인(`backend/trainer_ml.py`)과 호환되는지 검증하고, 즉시 재사용 가능 여부 및 잠재적인 문제점을 도출함.
- 범위: 백엔드 학습 스크립트, 예측 서비스(`backend/predictor_ml.py`)와의 인터페이스, 사전 학습 아티팩트(`models/default`, `models/version_*`) 전반.
- 산출물: 호환성 평가, 재현된 오류 로그, 개선 권고 사항.

## 2. 현재 학습 파이프라인 구조
- 핵심 진입점: `backend/trainer_ml.py`의 `train_model_with_ml_improved()` → 내부 `_train_model_with_ml_improved_core()`(639행 부근).
  - 입력: `ITEM_CD`, `ITEM_NM`을 제외한 모든 피처 컬럼.
  - 처리 흐름: 범주형 라벨 인코딩(`LabelEncoder`), 수치형 표준화(`StandardScaler`), 분산 임계치 필터, 128차원 균형(PCA/패딩), HNSW 인덱스 빌드, `FeatureWeightManager` 가중치 반영.
  - 출력 아티팩트: `similarity_engine.joblib`, `encoder.joblib`, `scaler.joblib`, `feature_columns.joblib`, `training_metadata.json` 등.
- 런타임 의존성: `common/config_store.TrainerRuntimeConfig`를 통해 HNSW와 트리밍 파라미터가 실시간 반영(`apply_trainer_runtime_config`).
- 문제 징후:
  - 라벨 인코딩 단계에서 단일 `LabelEncoder` 인스턴스를 컬럼별로 재사용(697~716행). 다중 컬럼을 학습한 정보가 저장되지 않아 예측 시 열 정보(`feature_names_in_`)를 제공하지 못함.
  - 향상된 전처리기(`ImprovedPreprocessor` 클래스 정의, 292행 이하)는 아직 본 파이프라인에 통합되지 않아 `OrdinalEncoder` 기반 플로우가 활성화되지 않음.

## 3. 사전 학습 모델 실사 결과
### 3.1 `models/default`
- 파일 구성 (2025-10-21 11:18 기준):
  - `similarity_engine.joblib` (≈3.5MB, `backend.index_hnsw.HNSWSearch` 인스턴스).
  - `encoder.joblib` (`sklearn.preprocessing.LabelEncoder` 한 개 컬럼만 학습).
  - `scaler.joblib` (`StandardScaler`, `feature_names_in_ = ['ITEM_TYPE', 'RAW_MATL_KIND']`, 2개 컬럼만 적합).
  - `feature_columns.joblib` → `['ITEM_TYPE', 'RAW_MATL_KIND']`.
  - `active_features.json` / `feature_weights.(json|joblib)` → 41개 피처에 대한 도메인 가중치 목록(33개 활성).
  - `training_metadata.json` → 총 아이템 5개, 총 피처 10개로 기록(실제 아티팩트와 불일치).
- 정합성 점검:
  - 파이프라인이 기대하는 41개 피처 대비 실제 학습된 피처 2개 → 대다수 피처 미포함.
  - `LabelEncoder`가 컬럼 이름 메타데이터(`feature_names_in_`)를 제공하지 않아 향상된 예측 루틴에서 필수 정보 누락.

### 3.2 `models/version_20251021004829`, `version_20251021004836`
- 구성: `manifest.json`, `training_request.json`만 존재.
- 메타데이터: API 트레이닝 서비스가 기록한 Dry-run (dry_run=true), 실제 임베딩/인코더 파일 미생성.
- 결론: 실모델 아티팩트 부재, 예측·배포에 활용 불가.

### 3.3 기타
- `models/releases/v0.9.0` → `manifest.json`만 존재, 구버전 기록용.
- `models/tb_projector/` → 2025-09-09 생성된 TensorBoard 체크포인트(구학습 결과). 최신 파이프라인과 차원/스키마 일치 여부 미검증 상태.

## 4. 호환성 평가
| 항목 | 최신 학습 파이프라인 요구사항 | 사전 학습 모델 현황 | 평가 |
|------|-------------------------------|----------------------|------|
| 피처 컬럼 | `FeatureWeightManager` 기준 41개, 128차원 벡터 | `feature_columns.joblib` → 2개 | ❌ 불일치 |
| 인코더 | `OrdinalEncoder` + `feature_names_in_` 메타데이터 | `LabelEncoder` (메타데이터 없음) | ❌ 호환 실패 |
| 스케일러 | 전 컬럼 표준화, `feature_names_in_` 활용 | 2개 컬럼만 적합 | ❌ 불일치 |
| 메타데이터 | `model_metadata.json`, `vector_statistics.joblib` 등 선택적 확장 | 미존재 | ⚠️ 관리 지표 부족 |
| 예측 파이프라인 (`_clean_and_encode_enhanced`) | `encoder.feature_names_in_` 접근 필수 | `LabelEncoder`는 해당 속성 미보유 | ❌ 실행 시 예외 |

## 5. 재현된 오류
- 재현 환경: `EnhancedModelManager('models/default').load()` 후 `_clean_and_encode_enhanced()` 호출.
- 입력: 최소 컬럼(`ITEM_TYPE`, `RAW_MATL_KIND`)만 포함한 단일 품목 DataFrame.
- 결과:
```text
AttributeError: 'LabelEncoder' object has no attribute 'feature_names_in_'
```
- 영향: 프론트엔드/백엔드 예측 서비스는 향상된 인코딩 루틴을 기본으로 호출(`backend/predictor_ml.py` 828행). 해당 예외 발생 시 품목 예측이 전면 중단됨.

## 6. 원인 및 리스크 분석
1. **인코더 구현 불일치**  
   - 학습 단계에서 `LabelEncoder`를 반복 사용해 범주형 피처를 처리하나, 저장 시 다중 컬럼 정보가 유지되지 않음.  
   - 예측 단계는 `OrdinalEncoder` 스타일 메타데이터를 기대하여 구조적 불일치 발생.
2. **피처 축소 및 데이터 품질**  
   - 실제 학습 데이터가 2개 컬럼만 포함(가능성: 전처리/데이터 소스 연결 실패).  
   - `training_metadata.json`의 `total_items=5` → 극도로 제한된 샘플 수. 임베딩 품질 기대 불가.
3. **Dry-run 아티팩트 혼재**  
   - `version_*` 디렉터리가 실모델로 오인될 수 있으며, 배포 파이프라인이 잘못 참조할 위험 존재.
4. **메타데이터 미동기화**  
   - 아티팩트 갱신 후 `manifest.json`, `training_metadata.json` 등 업데이트 누락. 제품·감사 추적에 혼선.

## 7. 권장 조치
1. **전처리/인코더 개편 (필수)**  
   - `ImprovedPreprocessor`를 파이프라인에 통합하여 `OrdinalEncoder` 기반 다중 컬럼 인코딩 및 `feature_names_in_` 보존.  
   - 또는 `LabelEncoder` 사용 유지 시, 예측 파이프라인에서 컬럼별 인코더 딕셔너리를 저장·로딩하도록 구조 변경.
2. **데이터 검증 및 재학습 (필수)**  
   - 학습 입력 데이터 소스/전처리 경로 점검 후 최소 41개 피처가 유지되는지 확인.  
   - 데이터 품질 검증(Null 비율, 범주 다양성) 후 전체 데이터셋으로 재학습하여 신규 아티팩트 생성.
3. **모델 호환성 수동 점검**  
   - `models/default` 등 기존 모델을 프로덕션에서 제거하거나 레거시 호환 모드(구 예측 루틴)와 명확히 분리.  
   - `models/version_*` 디렉터리를 Dry-run 로그 전용으로 표기(예: README 또는 네이밍 수정).
4. **메타데이터/매니페스트 자동화**  
   - 학습 완료 시 `model_metadata.json`, `feature_metadata.json`, `vector_statistics.joblib` 생성 로직 활성화.  
   - `manifest.py`를 통해 해시/버전 정보 자동 갱신, 유효성 검증 스크립트 추가.
5. **테스트 케이스 확충**  
   - 예측 서비스 단위 테스트에 `encoder.feature_names_in_` 존재 여부와 `_clean_and_encode_enhanced` 호출 경로를 포함.  
   - 모델 로딩 시 필수 파일 누락(`similarity_engine.joblib`) 검출 및 경고.

## 8. 후속 일정 제안
- D+1: 데이터 소스/전처리 점검, 파이프라인 내 인코더 구조 수정 설계.
- D+3: 수정 코드 적용 및 샘플 재학습, 예측 루틴 통합 테스트.
- D+5: 전체 데이터 재학습, 신규 모델 배포 전 사전 검증(샌드박스 환경).
- D+7: 운영 배포 및 모니터링, Dry-run 디렉터리 정리/아카이빙.

## 9. 결론
- 현재 `models/` 내 사전 학습 모델은 최신 학습/예측 구조와 **직접 호환되지 않으며**, 즉시 사용 시 예측 서비스가 실패함.
- 필수 조치: 인코더 구조 정비 및 재학습. 기존 아티팩트는 레거시 테스트 용도로만 제한할 것을 권고.
