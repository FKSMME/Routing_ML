# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# Routing ML 에러 위험 점검 체크리스트 (2025-09-25)
> ✅ = 현재 구조와 문법, 함수 연결을 점검해 위험이 통제됨 / ⚠️ = 후속 조치 필요

## 1. 데이터베이스 · ODBC 구간
- [x] **Access 파일 검색** — `backend/database.py::_latest_db`
  - 최신 `.accdb`를 찾지 못하면 `FileNotFoundError`가 나므로 `routing_data` 폴더 동기화 상태를 주기적으로 확인합니다.
- [x] **ODBC 연결 생성** — `backend/database.py::_create_connection`
  - Microsoft Access 드라이버가 없으면 `ConnectionError`가 발생합니다. 설치 가이드 2장과 `verify_odbc.ps1`로 대비합니다.
- [x] **연결 풀 재사용 경로** — `ConnectionPool.get_connection` → `_create_connection`
  - 예외 발생 시 연결이 닫히도록 구현되어 있음. 다만 동시 연결 5개 제한이므로 대량 호출 시 큐가 쌓일 수 있어 모니터링이 필요합니다.
- [ ] **ODBC 드라이버 버전 혼용 위험**
  - 32비트/64비트 혼용 시 연결이 실패하므로 배포 대상 PC의 드라이버 버전을 점검하는 자동화가 추가로 필요합니다.

## 2. 워크플로우 설정 · 런타임 반영
- [x] **API ↔ 설정 저장소 경로** — `backend/api/routes/workflow.py`
  - PATCH 시 `workflow_config_store.update_*` → `apply_trainer_runtime_config` / `apply_predictor_runtime_config` 순으로 호출됨을 확인했습니다.
- [x] **Config Store 기본값** — `common/config_store.py`
  - `TrainerRuntimeConfig`와 `PredictorRuntimeConfig`의 기본 Trim 범위(5%~95%)가 Tasklist 요구와 일치함을 검증했습니다.
- [x] **SQL 컬럼 매핑 프로파일** — `SQLColumnConfig`
  - Power Query 프로파일이 기본으로 로딩되고 UI에서 선택 시 `active_profile`로 저장되는 구조입니다.

## 3. 예측 서비스 (predictor)
- [x] **라우팅 정규화 경로** — `normalize_routing_frame`
  - `get_routing_output_columns()` → `ROUTING_OUTPUT_COLS` 재정렬 순으로 구성되어, 7.1 포맷 컬럼을 강제합니다.
- [x] **Trimmed-STD 계산** — `calculate_manufacturing_time_stats`
  - `_apply_weighted_trimmed_range`에서 상·하위 5%를 제거한 뒤 가중 평균과 표준편차를 계산하는 로직이 활성화되어 있습니다.
- [x] **런타임 설정 반영** — `apply_runtime_config`
  - `/api/workflow/graph`에서 전달한 similarity, variant, trim 값이 `SCENARIO_CONFIG`에 즉시 저장됩니다.
- [ ] **대용량 Pandas 연산 부하**
  - 후보 10건 × 공정 수백 건일 때 `groupby`/`merge` 단계에서 응답 지연이 발생할 수 있으므로 벤치마크와 캐시 전략 추가 검토가 필요합니다.

## 4. 학습 서비스 (trainer)
- [x] **Feature 전처리** — `ImprovedPreprocessor`
  - 숫자/문자형 안전 변환과 VarianceThreshold, PCA 선택 로직이 존재하며, FeatureWeightManager와의 연결도 정상입니다.
- [x] **런타임 설정 공유** — `apply_trainer_runtime_config`
  - 설정 저장소에서 불러오고, 실패 시 기본값을 사용하도록 예외 처리되어 있습니다.
- [ ] **동시 학습 실행 시 잠금 부재**
  - 학습을 여러 번 병렬 실행하면 모델 파일 덮어쓰기가 일어날 수 있으므로 파일 잠금 또는 작업 큐 도입이 필요합니다.

## 5. 프런트엔드 · 워크플로우 UI
- [x] **SAVE 버튼 흐름** — React UI에서 `/api/workflow/graph` PATCH 호출 후 설정이 즉시 반영되는 구조를 확인했습니다.
- [ ] **주니어용 용어 검토 필요**
  - UI 문구 일부가 기술 용어 중심이므로 다음 디자인 스프린트에서 쉬운 표현으로 교체해야 합니다.

## 6. 문법·오타·선언문 점검 요약
- [x] 주요 Python 파일에서 `flake8` 스타일 치명 오류(예: 미사용 변수, 문법 오류)는 발견되지 않았습니다.
- [x] `backend/predictor_ml.py`에서 `ROUTING_OUTPUT_COLS` 미import 문제를 발견하여 상단 import에 추가했습니다.
- [ ] 자동 린터/테스트가 CI에서 돌지 않으므로 로컬 `ruff` 또는 `flake8` 도입이 필요합니다.

## 7. 추가 권장 로컬 테스트
- [ ] `python -m compileall backend common`으로 문법 검증 자동화를 수행한다.
- [ ] 샘플 Access 데이터로 `/api/predict` 엔드투엔드 호출 후 SQL 저장 결과를 `routing_candidate_operations` 스키마와 비교한다.
- [ ] 프런트엔드 워크플로우 UI에서 SAVE → API 응답까지 수동 확인한다.

> ⚠️ 체크되지 않은 항목은 후속 태스크로 분리하여 진행해야 합니다.
