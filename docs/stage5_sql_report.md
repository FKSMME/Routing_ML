# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## Stage 5 Execution Report: 출력/SQL 규격

### Gate Review Summary
- 승인 타임스탬프: 2025-09-25T07:45:00Z (Stage 4 산출물 점검 후 오류 없음 확인)
- 범위 검토: 후보 저장용 테이블 구조, 예측 서비스 연계 방식, 마이그레이션 전략, 데이터 검증 흐름
- 승인 전 확인 사항: Stage 4 UI에서 사용하는 필드 매핑과 predictor 응답 스키마 재검토, DB 뷰어 접근 승인 로그 확보

### 스키마 정의 (Access 7.1 구조 준수)
- **`routing_candidates`**
  - 기본 키: `(item_cd, candidate_id)` 복합.
  - 주요 컬럼: `routing_signature VARCHAR(200)`(예: "CNC선반3차+MCT"), `similarity_score NUMERIC(5,4)`, `priority VARCHAR(16)`(primary/fallback), `similarity_tier VARCHAR(8)`(HIGH/LOW), `generator_version VARCHAR(32)`, `generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
  - 보조 인덱스: `idx_routing_candidates_item`, `idx_routing_candidates_priority`.
  - 제약: `similarity_score` 0~1 범위 체크, `similarity_tier` ENUM('HIGH','LOW'). 0.8 이상은 HIGH.
- **`routing_candidate_operations`**
  - 기본 키: `(item_cd, candidate_id, proc_seq)` 복합.
  - 외래 키: `(item_cd, candidate_id) REFERENCES routing_candidates(item_cd, candidate_id) ON DELETE CASCADE`.
  - 컬럼 (Access 7.1 샘플과 동일): `PROC_SEQ SMALLINT`, `INSIDE_FLAG VARCHAR(16)`, `dbo_BI_ROUTING_VIEW_JOB_CD VARCHAR(32)`, `JOB_NM VARCHAR(64)`, `RES_CD VARCHAR(32)`, `RES_DIS VARCHAR(64)`, `TIME_UNIT VARCHAR(16)`, `MFG_LT NUMERIC(10,2)`, `QUEUE_TIME NUMERIC(10,2)`, `SETUP_TIME NUMERIC(10,2)`, `MACH_WORKED_HOURS NUMERIC(10,2)`, `ACT_SETUP_TIME NUMERIC(10,2)`, `ACT_RUN_TIME NUMERIC(10,2)`, `WAIT_TIME NUMERIC(10,2)`, `MOVE_TIME NUMERIC(10,2)`, `RUN_TIME_QTY NUMERIC(10,2)`, `RUN_TIME_UNIT VARCHAR(16)`, `BATCH_OPER VARCHAR(8)`, `BP_CD VARCHAR(16)`, `dbo_BI_ROUTING_VIEW_CUST_NM VARCHAR(64)`, `CUR_CD VARCHAR(8)`, `SUBCONTRACT_PRC NUMERIC(14,2)`, `TAX_TYPE VARCHAR(8)`, `MILESTONE_FLG CHAR(1)`, `INSP_FLG CHAR(1)`, `ROUT_ORDER VARCHAR(32)`, `VALID_FROM_DT DATE`, `VALID_TO_DT DATE`, `dbo_BI_ROUTING_VIEW_REMARK VARCHAR(200)`, `ROUT_DOC VARCHAR(64)`, `DOC_INSIDE VARCHAR(8)`, `DOC_NO VARCHAR(64)`, `NC_PROGRAM VARCHAR(64)`, `NC_PROGRAM_WRITER VARCHAR(32)`, `NC_WRITER_NM VARCHAR(32)`, `NC_WRITE_DATE DATE`, `NC_REVIEWER VARCHAR(32)`, `NC_REVIEWER_NM VARCHAR(32)`, `NC_REVIEW_DT DATE`, `RAW_MATL_SIZE VARCHAR(32)`, `JAW_SIZE VARCHAR(32)`, `VALIDITY VARCHAR(32)`, `PROGRAM_REMARK VARCHAR(200)`, `OP_DRAW_NO VARCHAR(64)`, `MTMG_NUMB VARCHAR(32)`.
  - 인덱스: `idx_candidate_operations_item_seq`, `idx_candidate_operations_candidate`.
  - 제약: `PROC_SEQ` > 0, `INSIDE_FLAG` 값 집합('사내','외주'), 시간 컬럼 0 이상.

### 데이터 품질 규칙
- 후보 테이블에서 `(item_cd, candidate_id)` 조합은 UNIQUE.
- `similarity_score >= 0.8`인 경우 `similarity_tier='HIGH'`로 저장, 미만은 `LOW` + 후순위 추천.
- 동일 `candidate_id`에 연결된 `PROC_SEQ`는 연속 정수(1..n)이며 중복 불가. 누락 시 로그 경고.
- NULL 허용 필드: `SUBCONTRACT_PRC`, `NC_*`, `RAW_MATL_SIZE` 등 Access 원본과 동일. 시간 컬럼은 NULL 대신 0 저장.
- `INSIDE_FLAG='사내'` 기본, 외주 포함 시 `priority='fallback'` 지정.

### 출력 포맷 명세
- **CSV 내보내기**: UTF-8, 헤더 포함, 구분자 `,`, 날짜 ISO8601. 후보(`routing_candidates.csv`)와 공정(`routing_candidate_operations.csv`) 분리, 컬럼명은 Access 명칭 유지.
- **INSERT 스크립트**: 트랜잭션 블록 사용(`BEGIN; ... COMMIT;`), 컬럼 순서 7.1 표준에 맞춰 명시적 컬럼 리스트 사용.

- **API ↔ SQL 매핑**: predictor 응답 `items[*].operations[*]` 구조와 7.1 컬럼 매핑 표 제공. `routing_signature`는 UI 요약용. `/api/workflow/graph`에서 설정 가능한 컬럼 별칭과 동기화.
- **컬럼 매핑/Power Query 프로파일**: `common/config_store.py`의 `SQLColumnConfig`에 프로파일(`Access 7.1 기본` 등)을 정의하고, UI에서 Power Query 스타일 리스트로 선택/저장 가능. `active_profile`은 저장 시 `/api/workflow/graph` 응답에 포함.
=======
- **API ↔ SQL 매핑**: predictor 응답 `items[*].operations[*]` 구조와 7.1 컬럼 매핑 표 제공. `routing_signature`는 UI 요약용.


### DDL 구성
- 마이그레이션 툴: `alembic` 기반, 리비전 네이밍 `20250925_stage5_create_routing_tables`.
- DDL 순서: 후보 테이블 생성 → 작업 테이블 생성 → FK/인덱스 생성 → CHECK 제약 추가(0.8 임계, INSIDE_FLAG 등).
- 롤백 전략: `DROP TABLE routing_candidate_operations; DROP TABLE routing_candidates;` 실행 전 Access 원본 스냅샷 + DB 백업 확보.

### 저장 및 내보내기 플로우
- Predictor 서비스 `/candidates/save` 호출 시 7.1 컬럼 구조로 직렬화 → `routing_candidates` upsert → `routing_candidate_operations` bulk insert. 실패 시 전체 롤백.

- 워크플로우 그래프 UI SAVE → `/api/workflow/graph` PATCH → `config/workflow_settings.json` 갱신 → Predictor/Trainer 런타임과 SQL 매핑 즉시 반영.
=======

- 내보내기 스크립트는 주간 배치에서 실행, 사내 파일 서버/공유 드라이브로 CSV 업로드. 업로드 전 SHA256 해시 계산 및 0.8 이상 후보 비율 보고.
- 에러 핸들링: `(item_cd, candidate_id)` 중복 시 `409 Conflict`, 컬럼 매핑 불일치 시 `422` + 매핑 로그. DB 오류 시 재시도(지수 백오프 최대 3회).

### 테스트 계획
- **스키마 검증**: Alembic offline 체크, `psql`/`sqlcmd`로 `\d` 또는 `sp_help` 검사, CHECK 제약 위반 케이스 삽입 시도.
- **데이터 매핑**: 샘플 예측 JSON(3~4 라우팅 조합)을 SQL 인서트로 변환하는 파이썬 단위 테스트, 7.1 컬럼 순서 검증.

- **컬럼 프로파일 검증**: Power Query 프로파일 전환(`Access 7.1 기본` 등) → `/api/workflow/graph` GET으로 active_profile 확인 → 저장 결과 SQL/CSV와 비교.
=======

- **성능 테스트**: 10,000행 배치 삽입 시간 측정(목표 < 120초), 인덱스 유효성 확인, 0.8 이상 후보 비율 기록.
- **CSV 정합성**: 해시 비교 및 Null 처리 검증, QA 체크리스트 작성, Access 원본과 샘플 비교.

### 배포 준비
- 운영 반영 전 승인 단계: 개발 → QA → 운영 순, 각 단계에서 승인 로그 남김. Access 명칭 변경 여부 확인 체크리스트 추가.
- 백업 전략: 마이그레이션 전 `pg_dump --schema-only` + Access 원본 백업. 실패 시 롤백.
- 버전 관리: 스키마 변경 시 `schema_version` 테이블 업데이트, `schema_mappings.yaml` 버전 증가, UI/문서에 버전 호환성 명시.
- 게이트 종료: Stage 5 완료 보고 후 Stage 6 승인 요청, 절대 조건(0.8 임계, 다중 라우팅) 충족 여부 로그 첨부.

### 위험 및 후속 조치
- 대용량 저장 시 인덱스 재구성 필요 가능 → 주간 유지보수 창 예약.
- Access 컬럼 명칭 변경 시 매핑 불일치 위험 → `schema_mappings.yaml` 관리 및 사전 테스트 강화.
- 0.8 미만 후보가 과도할 경우 → 학습 파이프라인 재학습 큐 가동, Stage 2/3와 협업.
- CSV 업로드 실패 대비 재시도/알람 구성 Stage 7에서 상세 설계 예정.

