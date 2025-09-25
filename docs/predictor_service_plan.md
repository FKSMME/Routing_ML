# Stage 3 예측 서비스(predictor) 설계 및 실행 계획

## 게이트 리뷰 결과 요약
- Stage 2 학습 파이프라인 산출물 확인: HNSW 출력, 메타데이터 규약 이상 없음.
- Stage 3 범위(API, 로더, 후보 생성, 테스트/배포) 전체 리뷰 완료.

## 1. API 인터페이스 설계
| 엔드포인트 | 메서드 | 요청 스키마 | 응답 스키마 | 설명 |
| --- | --- | --- | --- | --- |
| `/predict` | POST | `{ "item_cd": str, "revision": str, "constraints": {"inside_only": bool, "top_k": int, "min_similarity": float} }` | `{ "item_cd": str, "candidates": [ {"routing_id": str, "similarity": float, "operations": [...] } ] }` | 단건 예측 |
| `/candidates/save` | POST | `{ "item_cd": str, "routing_id": str, "selected_operations": [...], "user_id": str }` | `{ "status": "accepted", "record_id": str }` | 후보 저장 |
| `/health` | GET | - | `{ "status": "ok", "uptime": float }` | 헬스체크 |
| `/metrics` | GET | - | Prometheus text format | 지표 노출 |

- 인증: 내부망 JWT 또는 mTLS (Stage 7에서 확정).
- Rate limit: 30 req/min/user, 100 req/min/service.

## 2. HNSW 로더 및 파라미터 처리
- 인덱스 경로: `models/hnsw_index.bin`
- 메타데이터: `models/training_metadata.json`, `models/tb_projector/metadata.tsv`
- 로딩 프로세스
  1. 인덱스 파일 로드 후 ef parameter를 `ef_search=128`로 설정.
  2. `top_k` 파라미터 기본값 10, `min_similarity` 기본값 0.3.
  3. 입력 제약(`inside_only`) 설정 시 외주 공정 제거 필터 적용.
- 캐싱 전략: 인덱스와 메타데이터는 프로세스 시작 시 단일 로드, 30분마다 갱신 체크.

## 3. 메타-앙상블 후보 생성 로직
1. HNSW 결과 상위 `top_k_raw = max(top_k * 3, 30)` 추출.
2. 후보 라우팅별 공정 리스트 매핑, 공정별 유사도 가중 평균 계산.
3. 외주 제외 필터 적용 후 후보가 1개 미만일 경우 `inside_flag` 완화 전략 수행.
4. 후보 점수 산식: `score = 0.7 * similarity + 0.3 * process_alignment_score`.
5. Top-N(기본 3) 후보를 반환하며, 후보 간 공정 중복 최소화 heuristic 적용.
6. `/candidates/save` 요청 시 SQL 매퍼 통해 `routing_candidates`, `routing_candidate_operations` 스키마에 매핑.

## 4. SQL 출력 매퍼 설계
- 매핑 대상 스키마
  - `routing_candidates(record_id, item_cd, routing_id, generated_at, generator_version, selected_by)`
  - `routing_candidate_operations(record_id, op_seq, workcenter_cd, process_type, std_time_min, note)`
- 저장 시나리오
  1. 트랜잭션 시작.
  2. 상위 테이블 insert 후 생성된 `record_id`를 operations 테이블에 사용.
  3. 커밋 전 데이터 검증(필수 필드 null 여부, 외주 제외 여부).
  4. 실패 시 전체 롤백 및 로그 기록.

## 5. 테스트 및 벤치마크 계획
- **단건 요청**: 최대 60초 (인덱스 쿼리 10초 이하, 후보 정제 20초 이하, 저장 선택 시 추가 10초).
- **배치 10건**: 비동기 처리로 10분 이내 완료.
- **부하 테스트**: 100건 동시 요청 시 평균 응답 45초 이내.
- **계측 지표**: 요청 수, 성공/실패율, 평균/최대 응답시간, 후보 생성 실패 원인.
- **통합 테스트**: Stage 2 학습 결과와 Stage 1 데이터 파이프라인 모킹으로 end-to-end 검증.

## 6. 컨테이너 및 운영 계획
- 베이스 이미지: `python:3.12-slim`
- 런타임 의존성: `fastapi`, `uvicorn`, `pydantic`, `hnswlib`, `pandas`
- 환경 변수: `MODEL_PATH`, `METADATA_PATH`, `DB_DSN`, `DB_USER`, `DB_PASSWORD`
- 프로브: liveness(`/health`), readiness(인덱스 로드 완료 여부), startup(초기 캐시 로드 확인)
- 로깅: 구조화 JSON (`request_id`, `item_cd`, `latency_ms`, `candidate_count`)
- 배포: Stage 7에서 Helm 차트에 readiness/liveness 구성, 현재는 docker-compose 서비스 정의 초안 준비.

## 7. Stage 종료 조건
- API 명세 및 후보 생성 로직 승인.
- SQL 매핑 규격 확정 후 DB팀 사전 검토.
- 벤치마크/부하 테스트 계획 승인.
- Stage 4 착수 전 프런트엔드와 API 계약서 공유.

