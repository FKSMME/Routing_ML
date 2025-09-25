# Stage 1 데이터 파이프라인 설계 및 실행 계획

## 게이트 리뷰 결과 요약
- Stage 0 산출물(거버넌스, 추적표, 템플릿) 재검토: 미해결 오류 없음 확인.
- Stage 1 범위(Access 원본 스키마 정의, 파이프라인 설계, 테스트/배포 계획)에 대한 전 범위 리뷰 완료.
- 외부 DB/문서 접근 필요 시 승인 경로 확인(데이터 소유자, 보안팀) 및 사내망 한정 사용 확약.

## 1. 데이터 원천 및 스키마 정의
**원본 파일**: `routing_data/ROUTING AUTO TEST.accdb` (MS Access)

| 테이블 | 주요 키 | 핵심 컬럼 | 비고 |
| --- | --- | --- | --- |
| `dbo_BI_ITEM_INFO_VIEW` | `ITEM_CD` (PK) | PART_TYPE, ITEM_SPEC, ITEM_MATERIAL, OUTDIAMETER, INDIAMETER, OUTTHICKNESS, SealTypeGrup, RAW_MATL_KIND 등 | 임베딩 벡터 생성 기준. 전 컬럼을 피처 후보로 사용하고 컬럼명 변경 시 매핑 테이블로 관리 |
| `dbo_BI_ROUTING_VIEW` | `(ITEM_CD, PROC_SEQ)` | INSIDE_FLAG, JOB_CD, JOB_NM, RES_CD, RES_DIS, TIME_UNIT, MFG_LT, SETUP_TIME, RUN_TIME, WAIT_TIME, MOVE_TIME, ROUT_DOC, NC_PROGRAM 등 | 라우팅 공정 이력. 외주/사내 구분, NC 프로그램 정보 포함 |
| `dbo_BI_WORK_ORDER_RESULTS` | `idx` (PK), ITEM_CD, PROC_SEQ | WORKER_ID, REPORT_DT, RES_CD, MACH_WORKED_HOURS, ACT_SETUP_TIME, ACT_RUN_TIME, WAIT_TIME, MOVE_TIME, ROUT_NO | 실적 데이터. 공정별 실제 작업 시간 및 결과 |

### 조인 정의
- 기본 조인: `dbo_BI_ITEM_INFO_VIEW.ITEM_CD = dbo_BI_ROUTING_VIEW.ITEM_CD`
- 실적 결합: `dbo_BI_ROUTING_VIEW.ITEM_CD = dbo_BI_WORK_ORDER_RESULTS.ITEM_CD` AND `dbo_BI_ROUTING_VIEW.PROC_SEQ = dbo_BI_WORK_ORDER_RESULTS.PROC_SEQ`
- 필터 조건: `STANDARD_YN = 'Y'` 또는 운영 정책에 따른 활성 플래그, `dbo_BI_ROUTING_VIEW.VALID_TO_DT >= CURRENT_DATE`, 실적은 최근 N년(`REPORT_DT >= DATEADD('yyyy', -3, DATE())`) 범위.
- 외주 제외: `INSIDE_FLAG = '사내'` 또는 `JOB_CD` 패턴 기반 필터링. 외주 공정은 별도 태그로 유지하여 후순위 추천에 활용.

### 파생 키/색인 권고
- `dbo_BI_ROUTING_VIEW`에 `(ITEM_CD, PROC_SEQ, ROUT_NO)` 복합 인덱스 생성.
- `dbo_BI_WORK_ORDER_RESULTS`에 `(ITEM_CD, PROC_SEQ, REPORT_DT)` 인덱스 생성 및 `ROUT_NO` 조회 보조 인덱스 추가.
- 컬럼 명칭 변경 대비: `common/schema_mappings.yaml` (예정)에서 Access 뷰 컬럼 ↔ 내부 명칭 매핑 유지.

## 2. Feature 사전 초안
| 피처명 | 출처 | 유형 | 전처리 | 비고 |
| --- | --- | --- | --- | --- |
| ITEM_CD | ITEM_INFO | 식별자 | 그대로 유지 | 키. 임베딩 인덱스 |
| PART_TYPE, ITEM_TYPE, ITEM_GRP1, SealTypeGrup | ITEM_INFO | 범주형 | OrdinalEncoder → OneHot/Target 혼합 | 유사도 0.8 이상 확보 위한 가중치 적용 |
| OUTDIAMETER, INDIAMETER, OUTTHICKNESS | ITEM_INFO | 수치형 | Safe numeric → StandardScaler | 단위(인치/밀리미터) 표준화, 결측 0 |
| ITEM_MATERIAL, RAW_MATL_KIND | ITEM_INFO | 범주형 | OrdinalEncoder | 재질 가중치 반영 |
| ROTATE_CLOCKWISE, ROTATE_CTRCLOCKWISE | ITEM_INFO | 이진 | BooleanEncoder | 기계 가공 방향 특성 |
| NC_PROGRAM, JOB_CD, RES_CD | ROUTING_VIEW | 범주형 | High-cardinality Encoder (Hash/Target) | 라우팅 후보 특징 |
| MFG_LT, SETUP_TIME, RUN_TIME, WAIT_TIME, MOVE_TIME | ROUTING_VIEW | 수치형 | RobustScaler + Log1p | 음수 클리핑, 0.8 임계 계산용 |
| MACH_WORKED_HOURS, ACT_SETUP_TIME, ACT_RUN_TIME | WORK_ORDER_RESULTS | 수치형 | Safe numeric → StandardScaler | 실적 기반 자기지도 업데이트 |

- 결측 처리 우선순위: 실적값 → 라우팅 기준값 → 중앙값/도메인 기본값.
- 스케일링 순서: 데이터 정제 → 범주형 인코딩 → 수치형 스케일링 → VarianceThreshold(0.001) → PCA(옵션, 설명분산 ≥ 0.9).
- 임베딩 벡터 정규화 후 코사인 유사도 계산. 유사도 0.8 미만 후보는 별도 태그(`SIMILARITY_TIER = 'LOW'`)로 저장.

## 3. 파이프라인 구현 계획
### ODBC 커넥터 스크립트
- 환경 변수: `ACCESS_DSN_ROUTING`, `ACCESS_UID`, `ACCESS_PWD` (사내 Key Vault와 연동, 로컬 `.env` 금지).
- 연결 드라이버: `Microsoft Access Driver (*.mdb, *.accdb)` — Windows 서비스 또는 unixODBC + MDBTools 대안 검토.
- 재시도 정책: 최대 3회, 지수 백오프(2s → 4s → 8s), 실패 시 로그에 승인 ID 포함.
- 오류 로깅: 연결 실패, 스키마 불일치, 컬럼 누락. 명칭 변경 시 매핑 갱신 경고.

### 쿼리 모듈
- 파라미터: `ITEM_CD` 리스트, 기간(`REPORT_DT`), `INSIDE_FLAG` 필터, 유사도 하위 티어 제외 여부.
- 출력 포맷: pandas DataFrame, Access 컬럼명 유지 + 내부 매핑 컬럼(`COLUMN_ALIAS`).
- 모듈 구조: `common/data_access/access_client.py`, `common/data_access/query_templates.py`.
- 샘플 쿼리: `SELECT * FROM dbo_BI_ITEM_INFO_VIEW WHERE ITEM_CD IN (?)` / `SELECT * FROM dbo_BI_ROUTING_VIEW WHERE ITEM_CD = ? ORDER BY PROC_SEQ`.

### 피처 빌더 모듈
- 경로: `common/features/pipeline_builder.py`.
- 구성: `AccessFieldMapper` → `DataCleaner` → `CategoricalEncoder` → `NumericalScaler` → `VarianceThresholdReducer` → `PCAReducer`.
- 설정 파일: `config/pipeline.yml`에 Access 컬럼 ↔ 내부 명칭 매핑, 임계값(0.8), 제외 컬럼 리스트 관리.
- 자기지도 업데이트: 실적 테이블에서 ACT_* 값을 라우팅 기준값과 비교하여 피드백 가중치 갱신.

### 외주 공정 제외 로직
- 규칙: `INSIDE_FLAG = '사내'` && `SUBCONTRACT_PRC IS NULL` || `JOB_CD` 사내 공정 코드 패턴(`A%`, `B%`, `Q%`).
- 외주 공정을 제외한 후보가 3개 미만일 경우: 외주 공정 포함 후보를 후순위(`priority = 'fallback'`)로 추가.
- 라우팅 조합 생성 시 외주 공정을 맨 뒤로 재배치하여 사용자 검토 용이성 확보.

## 4. 테스트 계획
- **샘플 데이터 스냅샷**: Access에서 추출한 비식별 CSV 100건 생성, Python 조인 결과와 Access 쿼리 결과 비교.
- **단위 테스트**: 인코더/스케일러별 성공·예외 케이스(pytest), 컬럼 매핑 누락 시 경고 발생 여부 확인.
- **성능 예비 측정**: 10,000 품목 조회 시 45초 이내, 피처 빌드 60초 이내 목표 (사내망 대역폭 기준).
- **로그 검증**: 커넥터/파이프라인 각 단계 INFO 로그 + 0.8 미만 유사도 후보 WARN 로그 기록 여부 확인.

## 5. 배포 및 운영 계획
- 시크릿 관리: 운영은 사내 Key Vault, 개발은 암호화된 `.env.enc` + 승인 기록.
- 배치 스케줄: 매일 02:00 KST, 백그라운드 ETL 잡. 실패 시 재시도 + 사내 메신저 알림.
- 모니터링: 쿼리 시간, 변환 시간, 누락률, 유사도 분포(0.8 이상/미만 비율)를 Prometheus exporter에 전달.
- Stage 1 종료 후 Stage 2 착수 전 승인 요청: 본 문서 + 로그 + 테스트 계획 제출, 절대 조건 체크리스트 첨부.

