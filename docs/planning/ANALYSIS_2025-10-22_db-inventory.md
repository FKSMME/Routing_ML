# DB 자산 전수 점검 노트 (2025-10-22)

**작성자**: Codex  
**목적**: Phase 1 체크리스트 기준으로 내부 PostgreSQL 구조, ERP MSSQL 뷰, 잔존 SQLite 의존 경로를 인벤토리화하고 후속 측정/교체 계획을 정리한다.

---

## 1. 내부 저장소 (PostgreSQL) 테이블 매트릭스

| 구분 | 테이블 | 주요 컬럼 | 사용처 | 현황 메모 |
| --- | --- | --- | --- | --- |
| 마스터 | `item_master` | `item_cd`, 품목 속성, 규격 필드 | 추론·추천 시 참조 | 행 수/NULL 비율 실측 필요 |
| 라우팅 | `routing_master` | `item_cd`, `proc_seq`, 시간 정보 | 라우팅 후보 생성 | 동기화 대상 (ERP→Postgres) |
| 예측로그 | `ml_predictions` | `item_cd`, `candidate_id`, `score` | 전달용 Export, QA | 로그 보존 정책 재확인 필요 |
| 사용자 | `users` | `username`, `status`, `argon2 hash` | 로컬 인증 (fallback) | 운영선은 Postgres 사용중 |
| 라우팅그룹 | `routing_groups` | `group_name`, `steps(JSON)` | Routing Workspace 저장 | Canvas 연동 지표 수집 예정 |
| 모델레지스트리 | `model_registry` | `version_name`, `status`, `active_flag` | 학습/추론 파이프라인 | Postgres 초기화 완료 |
| 드리프트 | `concept_drift_log` | `metric`, `value`, `observed_at` | 모니터링 | 샘플 데이터 확보 필요 |
| 감시/감사 | `audit_log` | `event`, `username`, `metadata` | 감사, KPI | 파티셔닝 설계 검토 중 |

> 출처: `migration/schema.sql` 21~438 행

### 측정 계획
- 공통 항목: Row count, 최신 `updated_at`, 핵심 지표(NULL %, 고유도).
- 도구: `psql \dt+`, `SELECT count(*)`, `SELECT column_name, null_frac FROM pg_stats`.
- 미가용 시 대비: `scripts/create_postgres_db.py` 로 로컬 DB 생성 후 샘플 데이터 적재.

---

## 2. ERP MSSQL 뷰 의존성

| 상수 | 실제 뷰 | 용도 | 체크 항목 |
| --- | --- | --- | --- |
| `VIEW_ITEM_MASTER` | `dbo.BI_ITEM_INFO_VIEW` | 품목 메타 | COUNT, 최신 `INSRT_DT`, 응답 지연 |
| `VIEW_ROUTING` | `dbo.BI_ROUTING_VIEW` | 공정 라우팅 | COUNT, `PROC_SEQ` 분포 |
| `VIEW_WORK_RESULT` | `dbo.BI_WORK_ORDER_RESULTS` | 실적 데이터 | 최신 실적 시각 & 응답시간 |
| `VIEW_PURCHASE_ORDER` | `dbo.BI_PUR_PO_VIEW` | 발주 정보 | COUNT, NULL 필드 비율 |

> 출처: `backend/database.py` 60~87 행

### 측정 계획
- API: `backend/database.get_database_info()` 를 이용해 서버/DB 이름·뷰 접근성 확인.
- 추가 스크립트: `SELECT COUNT(*)`, `SELECT MAX(insrt_dt)`.
- 성능 로그: `SET STATISTICS TIME ON` 으로 지연(ms) 측정 → Phase 1 리포트에 반영.

---

## 3. 잔존 SQLite 경로 분류

| 범주 | 파일/경로 | 용도 | 조치 제안 |
| --- | --- | --- | --- |
| **문서** | `docs/guides/SQLITE_LOCAL_DEVELOPMENT.md`, `docs/guides/root/LOCAL_TESTING_GUIDE.md`, `docs/plans/MSSQL_MIGRATION.md` 등 10건 | 로컬 개발/역사 기록 | Postgres 기반 안내로 업데이트, 별도 Appendix 로 유지 |
| **테스트** | `tests/conftest.py`, `tests/backend/api/test_routing_groups_snapshots.py`, `tests/test_training_service_manifest.py` 등 8건 | pytest in-memory DB | `pytest` fixture 를 Postgres test container 로 전환, 임시로 sqlite fallback 허용 |
| **스크립트** | `scripts/run_ci.sh`, `scripts/setup_test_env.sh`, `scripts/profile_model_memory.py` | CI·벤치마크 속도 최적화 | 환경변수 기본값을 Postgres URL 로 교체하고 `--use-sqlite` 옵션화 |
| **분석/리포트** | `docs/analysis/test_failure_analysis_2025-10-20.md`, `deliverables/QA_REPORT_2025-10-21_...` | 회고용 | 참조만 유지 (운영 영향 없음) |
| **기타** | `docs/planning/TASKLIST_backend_test_fixes.md` 등 3건 | 히스토리 문서 | 상태 플래그 “Legacy 사용 중” 표기 |

전체 목록은 `rg "sqlite:///"` 출력(2025-10-22)을 첨부 폴더에 저장.  
우선순위는 테스트/CI 스크립트 → 개발 가이드 → 기타 문서 순으로 개편.

---

## 4. 후속 Action Items (Phase 1 기준)

1. **PostgreSQL 실측**  
   - [ ] 운영/스테이징 Postgres 접속 정보 확보  
   - [ ] 테이블별 `COUNT`, 최신 timestamp 추출  
   - [ ] NULL/고유도 지표를 시트로 정리

2. **MSSQL 성능 검사**  
   - [ ] `get_database_info()` 호출 로그 확보  
   - [ ] 각 뷰별 `COUNT` & 지연(ms) 측정 (3회 평균)  
   - [ ] 1초 SLA 초과 시 DBA 협의

3. **SQLite 제거 플랜**  
   - [ ] 테스트 fixture → Postgres test DB 전환 PoC  
   - [ ] CI 스크립트 기본값 Postgres 로 교체 (옵션화)  
   - [ ] 가이드 문서를 Postgres 중심으로 업데이트하고 Legacy Appendix 분리

---

## 5. 미해결 이슈 & 리스크

- Postgres·MSSQL 실환경 접근 권한 미확정 → 로컬 샘플 데이터로 임시 측정 필요.
- 테스트 전환 시 CI 속도 저하 우려 → in-memory Postgres (e.g., `pg_tmp`) 또는 Docker compose 활용 검토.
- 문서 업데이트 범위가 광범위하여 QA/문서팀 협업 필요.

---

> 본 노트는 Phase 1 보고서의 기초 자료이며, 실제 계측 값은 접근 권한 확보 후 별도 테이블에 추가할 예정이다.
