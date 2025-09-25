# Stage 3 예측 서비스(predictor) 설계 및 실행 계획

## 게이트 리뷰 결과 요약
- Stage 2 학습 파이프라인 산출물 확인: Access 기반 임베딩/0.8 유사도 임계/HNSW 출력, 메타데이터 규약 이상 없음.
- Stage 3 범위(API, 로더, 다중 라우팅 조합, 7.1 SQL 매핑, 테스트/배포) 전체 리뷰 완료.

## 1. API 인터페이스 설계
| 엔드포인트 | 메서드 | 요청 스키마 | 응답 스키마 | 설명 |
| --- | --- | --- | --- | --- |
| `/predict` | POST | `{ "item_codes": [str], "top_k": int=10, "similarity_threshold": 0.8, "mode": "detailed" }` | `{ "items": [ {"ITEM_CD": str, "CANDIDATE_ID": str, "operations": [7.1 컬럼...]} ], "candidates": [ {"CANDIDATE_ITEM_CD": str, "SIMILARITY_SCORE": float, "ROUTING_SIGNATURE": str, "ROUTING_SUMMARY": str} ], "metrics": {...} }` | 품목 다건 예측, 기본 0.8 임계 |
| `/candidates/save` | POST | `{ "item_code": str, "candidate_id": str, "payload": {"summary": {...}, "operations": [7.1 컬럼...]} }` | `{ "item_code": str, "candidate_id": str, "saved_path": str }` | 후보 저장 (Access 7.1 구조 유지) |
| `/health` | GET | - | `{ "status": "ok", "detail": str }` | 헬스체크 |
| `/metrics` | GET | - | Prometheus text format | 지표 노출 (0.8 이상/미만 비율 포함) |

| `/workflow/graph` | GET | - | `{ "graph": {...}, "trainer": {...}, "predictor": {...}, "sql": {...}, "updated_at": str }` | 워크플로우 그래프/런타임/SQL 매핑 조회 |
| `/workflow/graph` | PATCH | `{ "graph"?: {...}, "trainer"?: {...}, "predictor"?: {...}, "sql"?: {...} }` | 상동 | SAVE 버튼 → trainer/predictor 런타임 및 SQL 매핑 즉시 적용 |
=======


- 인증: 내부망 JWT 또는 mTLS (Stage 7에서 확정).
- Rate limit: 30 req/min/user, 100 req/min/service.

## 2. HNSW 로더 및 파라미터 처리
- 인덱스 경로: `models/hnsw_index.bin`
- 메타데이터: `models/training_metadata.json`, `models/tb_projector/metadata.tsv`, `common/schema_mappings.yaml`
- 로딩 프로세스
  1. 인덱스 파일 로드 후 `ef_search=256` 적용, 0.8 임계 설정을 메타데이터에서 읽어옴.
  2. `top_k` 기본값 10, `similarity_threshold` 기본값 0.8. 임계 미만 후보는 `similarity_tier='LOW'`로 표시.
  3. 입력 제약(`inside_only`) 또는 `include_external` 옵션에 따라 외주 공정 제외/후순위 큐 처리.
- 캐싱 전략: 인덱스와 메타데이터는 프로세스 시작 시 단일 로드, 30분마다 갱신 체크. 컬럼 매핑 변경 시 핫 리로드 지원.

- 런타임 설정: `common/config_store.workflow_config_store`에서 유사도 임계, 후보 최대 개수, 트림 표준편차 설정을 읽어와 `apply_runtime_config`로 모듈 전역값 갱신.
=======


## 3. 메타-앙상블 후보 생성 로직
1. HNSW 결과 상위 `top_k_raw = max(top_k * 3, 30)` 추출 (유사도 0.8 이상 우선, 미만은 후보 목록 후순위 추가).
2. 후보 라우팅별 공정 리스트 매핑, 공정별 유사도 가중 평균 계산 + 실적 보정(`MACH_WORKED_HOURS`).
3. 외주 제외 필터 적용 후 후보가 3개 미만일 경우 외주 공정 포함 후보를 후순위(`priority='fallback'`)로 채움.
4. 후보 점수 산식: `score = 0.6 * similarity + 0.2 * process_alignment + 0.2 * performance_alignment` (실적 대비 차이 최소화).
5. Top-N(기본 4) 라우팅 조합을 생성: 각 조합은 Job/RES/공정 시퀀스를 문자열로 요약(`CNC선반3차+MCT`, `MTM 3차` 등)하고 7.1 컬럼 구조로 정렬.
6. `/candidates/save` 요청 시 SQL 매퍼 통해 `routing_candidates`, `routing_candidate_operations` 스키마에 매핑. 명칭 변경은 매핑 파일 참조.

- `/workflow/graph` PATCH 시 `SQLColumnConfig`에 저장된 컬럼/별칭/프로파일이 즉시 반영되어 `/candidates/save` 직렬화 결과가 업데이트된다.
=======


## 4. SQL 출력 매퍼 설계
- 매핑 대상 스키마 (7.1 Access 구조)
  - `routing_candidates(item_cd, candidate_id, routing_signature, similarity_score, generated_at, generator_version, priority, similarity_tier)`
  - `routing_candidate_operations(item_cd, candidate_id, PROC_SEQ, INSIDE_FLAG, dbo_BI_ROUTING_VIEW_JOB_CD, JOB_NM, RES_CD, RES_DIS, TIME_UNIT, MFG_LT, QUEUE_TIME, SETUP_TIME, MACH_WORKED_HOURS, ACT_SETUP_TIME, ACT_RUN_TIME, WAIT_TIME, MOVE_TIME, RUN_TIME_QTY, RUN_TIME_UNIT, BATCH_OPER, BP_CD, dbo_BI_ROUTING_VIEW_CUST_NM, CUR_CD, SUBCONTRACT_PRC, TAX_TYPE, MILESTONE_FLG, INSP_FLG, ROUT_ORDER, VALID_FROM_DT, VALID_TO_DT, dbo_BI_ROUTING_VIEW_REMARK, ROUT_DOC, DOC_INSIDE, DOC_NO, NC_PROGRAM, NC_PROGRAM_WRITER, NC_WRITER_NM, NC_WRITE_DATE, NC_REVIEWER, NC_REVIEWER_NM, NC_REVIEW_DT, RAW_MATL_SIZE, JAW_SIZE, VALIDITY, PROGRAM_REMARK, OP_DRAW_NO, MTMG_NUMB)`
- 저장 시나리오
  1. 트랜잭션 시작.
  2. `routing_candidates` upsert (ITEM_CD+candidate_id) → `routing_candidate_operations` bulk insert.
  3. 커밋 전 데이터 검증(필수 필드 null 여부, 유사도 0.8 이상 여부, 외주 제외 여부).
  4. 실패 시 전체 롤백 및 로그 기록, Access 원본과의 컬럼 맵 mismatch 시 경고.

## 5. 테스트 및 벤치마크 계획
- **단건 요청**: 최대 60초 (인덱스 쿼리 10초 이하, 후보 정제 20초 이하, 라우팅 조합 생성 20초 이하, 저장 선택 시 추가 10초).
- **배치 10건**: 비동기 처리로 10분 이내 완료. 각 품목별 3~4개 라우팅 조합 반환 여부 확인.
- **부하 테스트**: 100건 동시 요청 시 평균 응답 45초 이내, 0.8 이상 후보 비율 70% 이상 유지.
- **계측 지표**: 요청 수, 성공/실패율, 평균/최대 응답시간, 후보 생성 실패 원인, 유사도 분포(0.8 이상/미만), 라우팅 조합 수.
- **통합 테스트**: Stage 2 학습 결과와 Stage 1 데이터 파이프라인 모킹으로 end-to-end 검증, 7.1 SQL 매핑 검증 포함.

- **워크플로우 API 테스트**: `/workflow/graph` GET/PATCH → `config/workflow_settings.json` 업데이트 확인 → 후속 `/predict` 응답의 임계/컬럼 매핑 반영 여부 검증.


## 6. 컨테이너 및 운영 계획
- 베이스 이미지: `python:3.12-slim`
- 런타임 의존성: `fastapi`, `uvicorn`, `pydantic`, `hnswlib`, `pandas`, `pyodbc`
- 환경 변수: `MODEL_PATH`, `METADATA_PATH`, `DB_DSN`, `DB_USER`, `DB_PASSWORD`, `SIMILARITY_THRESHOLD=0.8`

- 설정 파일: `config/workflow_settings.json` 읽기/쓰기 권한 필요, Stage 7 운영 문서와 연동.


- 프로브: liveness(`/health`), readiness(인덱스 로드 및 컬럼 매핑 적용 여부), startup(초기 캐시 로드 + 0.8 임계 적용 확인)
- 로깅: 구조화 JSON (`request_id`, `item_cd`, `latency_ms`, `candidate_count`, `above_threshold_ratio`)
- 배포: Stage 7에서 Helm 차트에 readiness/liveness 구성, Access DSN 시크릿 주입, docker-compose 서비스 정의 초안 준비.

## 7. Stage 종료 조건
- API 명세 및 후보 생성 로직 승인(0.8 임계, 3~4개 라우팅 조합, Access 컬럼 명칭 유지).
- SQL 매핑 규격 확정 후 DB팀 사전 검토, 7.1 구조와 일치 여부 확인.
- 벤치마크/부하 테스트 계획 승인(유사도 분포, 라우팅 조합 수 포함).
- Stage 4 착수 전 프런트엔드와 API 계약서 공유(7.1 응답 스키마 문서화, 다국어 라벨 제공).

## 2025-02-15 구현 업데이트
- FastAPI 앱 팩토리 및 `/api` 라우터 구현 — `backend/api/app.py`, `backend/api/routes/prediction.py`.
- PredictionService 계층에서 Pandas DataFrame 직렬화 및 후보 저장 로직 구현(7.1 컬럼 시리얼라이즈, 0.8 임계값 반영) — `backend/api/services/prediction_service.py`.
- 운영 실행 스크립트 추가 (`backend/run_api.py`) 및 설정 모듈 작성 (`backend/api/config.py`).

## 2025-02-16 품질 업데이트
- `predictor_ml`에서 `SETUP_TIME`, `MACH_WORKED_HOURS` 예측 시 유사 품목 실적의 상·하위 5%를 제외한 가중 표준편차를 적용해 이상치를 제거하고, `MACH_WORKED_HOURS` 기반 시나리오/신뢰도 산식으로 교체.
- TimeScenarioConfig에 트림 비율/활성화 옵션을 노출해 UI·API에서 추후 조정 가능하도록 확장.

