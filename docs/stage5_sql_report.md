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

### 스키마 정의
- **`routing_candidates`**
  - 기본 키: `(candidate_id UUID PRIMARY KEY)`
  - 주요 컬럼: `work_order_id VARCHAR(40)`, `routing_id VARCHAR(40)`, `model_version VARCHAR(32)`, `score_similarity NUMERIC(5,4)`, `score_quality NUMERIC(5,4)`, `predicted_duration_minutes INTEGER`, `predicted_cost NUMERIC(12,2)`, `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
  - 인덱스: `idx_routing_candidates_work_order`, `idx_routing_candidates_model_version`.
  - 제약: `work_order_id` NOT NULL, `score` 계열 0~1 범위 체크, `predicted_duration_minutes` >= 0.
- **`routing_candidate_operations`**
  - 기본 키: `(candidate_operation_id UUID PRIMARY KEY)`
  - 외래 키: `candidate_id UUID REFERENCES routing_candidates(candidate_id) ON DELETE CASCADE`.
  - 컬럼: `operation_sequence SMALLINT`, `operation_code VARCHAR(30)`, `expected_machine VARCHAR(40)`, `expected_duration_minutes INTEGER`, `expected_yield NUMERIC(5,2)`, `confidence NUMERIC(5,4)`.
  - 인덱스: `idx_candidate_operations_candidate`, `idx_candidate_operations_sequence`.
  - 제약: `operation_sequence` >= 1, `confidence` 0~1 범위 체크.

### 데이터 품질 규칙
- 후보 테이블에서 `(work_order_id, routing_id, model_version)` 조합은 UNIQUE.
- 동일 `candidate_id`에 연결된 작업 순서는 연속 정수(1..n)이며 중복 불가.
- NULL 허용 필드: `expected_machine`, `expected_yield`(예측 불가 시).
- 수치형 필드 범위 및 단위 문서화, 소수점 자리수 제한 명시.

### 출력 포맷 명세
- **CSV 내보내기**: UTF-8, 헤더 포함, 구분자 `,`, 날짜 ISO8601. 후보 테이블 1행 + 작업 테이블 다중행을 별도 파일(`routing_candidates.csv`, `routing_candidate_operations.csv`).
- **INSERT 스크립트**: 트랜잭션 블록 사용(`BEGIN; ... COMMIT;`), 각 행은 명시적 컬럼 리스트 포함.
- **API ↔ SQL 매핑**: predictor 응답 `candidates[*].steps[*]` 구조를 SQL 테이블 스키마에 매핑하는 필드 표 작성.

### DDL 구성
- 마이그레이션 툴: `alembic` 기반, 리비전 네이밍 `20250925_stage5_create_routing_tables`.
- DDL 순서: 후보 테이블 생성 → 작업 테이블 생성 → 인덱스 생성 → CHECK 제약 추가.
- 롤백 전략: `DROP TABLE routing_candidate_operations; DROP TABLE routing_candidates;` 실행 전 백업 스냅샷 확보.

### 저장 및 내보내기 플로우
- Predictor 서비스에서 `/candidates/save` 호출 시 후보/작업을 트랜잭션으로 저장, 실패 시 전체 롤백.
- 내보내기 스크립트는 주간 배치에서 실행, S3 버킷으로 CSV 업로드. 업로드 전 SHA256 해시 계산.
- 에러 핸들링: 중복 후보 발견 시 `409 Conflict`, DB 오류 시 재시도 정책(지수 백오프 최대 3회) 적용.

### 테스트 계획
- **스키마 검증**: Alembic offline 체크, `psql`로 `\d` 검사, CHECK 제약 위반 케이스 삽입 시도.
- **데이터 매핑**: 샘플 예측 JSON을 SQL 인서트로 변환하는 파이썬 스크립트 단위 테스트 작성.
- **성능 테스트**: 10,000행 배치 삽입 시간 측정(목표 < 120초), 인덱스 유효성 확인.
- **CSV 정합성**: 해시 비교 및 Null 처리 검증, QA 체크리스트 작성.

### 배포 준비
- 운영 반영 전 승인 단계: 개발 → QA → 운영 순, 각 단계에서 승인 로그 남김.
- 백업 전략: 마이그레이션 전 `pg_dump --schema-only` 수행, 실패 시 롤백.
- 버전 관리: 스키마 변경 시 `schema_version` 테이블 업데이트, UI/문서에 버전 호환성 명시.
- 게이트 종료: Stage 5 완료 보고 후 Stage 6 승인 요청, 선행 단계 오류 미존재 확인 결과 첨부.

### 위험 및 후속 조치
- 대용량 저장 시 인덱스 재구성 필요 가능 → 주간 유지보수 창 예약.
- Alembic 스크립트 충돌 위험 → 브랜치 보호 정책에 DB 리뷰어 추가.
- CSV 업로드 실패 대비 재시도/알람 구성 Stage 7에서 상세 설계 예정.

