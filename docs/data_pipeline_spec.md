# Stage 1 데이터 파이프라인 설계 및 실행 계획

## 게이트 리뷰 결과 요약
- Stage 0 산출물(거버넌스, 추적표, 템플릿) 재검토: 미해결 오류 없음 확인.
- Stage 1 범위: 스키마 정의, 파이프라인 설계, 테스트/배포 계획에 대한 전 범위 리뷰 완료.
- 외부 DB/문서 접근 필요 시 승인 경로 확인(데이터 소유자, 보안팀).

## 1. 데이터 원천 및 스키마 정의
| 테이블 | 주요 키 | 핵심 컬럼 | 비고 |
| --- | --- | --- | --- |
| ITEM_INFO | ITEM_CD (PK) | ITEM_NM, ITEM_TYPE, REVISION, CREATE_DT, IS_ACTIVE | 품목 마스터, 폐기 구분(IS_ACTIVE) |
| ROUTING_VIEW | ITEM_CD, OP_SEQ (PK) | ROUTING_ID, WORKCENTER_CD, PROCESS_TYPE, INSIDE_FLAG, STD_TIME_MIN | 공정 라우팅 뷰 |
| WORK_ORDER_RESULTS | WORKORDER_ID (PK), ITEM_CD, OP_SEQ | ACTUAL_WORKCENTER, ACTUAL_TIME_MIN, COMPLETE_DT | 실적 정보, 품질 지표 |

### 조인 정의
- 기본 조인: `ITEM_INFO.ITEM_CD = ROUTING_VIEW.ITEM_CD`
- 실적 결합: `ROUTING_VIEW.ITEM_CD = WORK_ORDER_RESULTS.ITEM_CD` AND `ROUTING_VIEW.OP_SEQ = WORK_ORDER_RESULTS.OP_SEQ`
- 필터 조건: `ITEM_INFO.IS_ACTIVE = 'Y'`, `ROUTING_VIEW.EFFECTIVE_TO IS NULL`, `WORK_ORDER_RESULTS.COMPLETE_DT >= DATEADD(year, -2, CURRENT_DATE)`

### 파생 키/색인 권고
- 복합 색인: `ROUTING_VIEW (ITEM_CD, OP_SEQ)`
- 실적 색인: `WORK_ORDER_RESULTS (ITEM_CD, OP_SEQ, COMPLETE_DT)`

## 2. Feature 사전 초안
| 피처명 | 출처 | 유형 | 전처리 | 비고 |
| --- | --- | --- | --- | --- |
| item_type | ITEM_INFO | 범주형 | TargetEncoder(Label) | 신규 품목 추정 시 기본값 "UNKNOWN" |
| revision | ITEM_INFO | 수치형 | MinMaxScaler | 누락 시 0 처리 |
| std_time_min | ROUTING_VIEW | 수치형 | RobustScaler | 음수 값 클리핑(0 이상) |
| process_type | ROUTING_VIEW | 범주형 | OneHot/주요 10개 + 기타 묶기 | |
| inside_flag | ROUTING_VIEW | 이진 | BooleanEncoder | 외주 제외 필터에 활용 |
| actual_time_min | WORK_ORDER_RESULTS | 수치형 | Log1p + StandardScaler | 결측 시 std_time_min 사용 |
| workcenter_family | ROUTING_VIEW/WORK_ORDER_RESULTS | 범주형 | OrdinalEncoder(유사 공정 그룹) | 공정 표준화 |

- 결측 처리 우선순위: 실적 → 기준 → 중앙값/모드.
- 스케일링 순서: 인코딩 → 결측 처리 → 스케일링 → VarianceThreshold → PCA(선택, 설명분산 ≥ 0.9).

## 3. 파이프라인 구현 계획
### ODBC 커넥터 스크립트
- 환경 변수: `ROUTING_DB_DSN`, `ROUTING_DB_UID`, `ROUTING_DB_PWD` (Key Vault 연동 대비 `.env` 로컬 사용 금지 권장)
- 재시도 정책: 최대 3회, 지수 백오프(2s → 4s → 8s)
- 오류 로깅: 연결 실패, 쿼리 타임아웃, 스키마 불일치

### 쿼리 모듈
- 파라미터화: 날짜 범위, 품목 코드 리스트, 활성 상태 필터
- 출력 포맷: pandas DataFrame, 컬럼명 snake_case 유지
- 모듈 구조: `common/data_access/odbc_client.py`, `common/data_access/query_templates.py`

### 피처 빌더 모듈
- 경로: `common/features/pipeline_builder.py`
- 구성: `DataCleaner` → `CategoricalEncoder` → `NumericalScaler` → `VarianceThresholdReducer` → `PCAReducer`
- 설정 파일: `config/pipeline.yml` (Stage 2에서 확장 예정)

### 외주 공정 제외 로직
- 규칙: `inside_flag == 'Y'` 또는 `process_type IN ('INHOUSE', 'MIXED')`
- 후보 라우팅 생성 시 외주 공정 제거 후 재정렬, 최소 1개 공정 이상 유지 확인.

## 4. 테스트 계획
- **샘플 데이터 스냅샷**: 비식별 CSV 100건 생성, 조인 정확도 검증(SQL vs pandas 결과 비교).
- **단위 테스트**: 인코더/스케일러별 성공·예외 케이스(pytest 기반) 설계.
- **성능 예비 측정**: 1만 건 조회 시 30초 이내, 파이프라인 변환 시간 45초 이내 목표.
- **로그 검증**: 커넥터/파이프라인 각 단계 INFO 로그 기록 여부 확인.

## 5. 배포 및 운영 계획
- 시크릿 관리: 로컬 `.env`는 개발 전용, 운영은 Azure Key Vault/HashiCorp Vault 연동.
- 배치 스케줄: 매일 02:00 UTC, 백그라운드 크론 잡. 실패 시 재시도 + 슬랙 알림.
- 모니터링: 쿼리 시간, 변환 시간, 누락률 지표를 Prometheus exporter에 전달.
- Stage 1 종료 후 Stage 2 착수 전 승인 요청: 본 문서 + 로그 + 테스트 계획 제출.

