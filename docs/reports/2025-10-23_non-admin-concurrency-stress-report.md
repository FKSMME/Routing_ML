# 비관리자 동시 접속 스트레스 감사 보고서 (2025-10-23)

## 1. 개요
- **요청 범위**: 비관리자 사용자 5명이 동시에 전 페이지에서 작업을 수행할 때 발생 가능한 동시성·권한·성능 문제 전수 검사
- **대상**: `frontend-*` SPA, `backend/api` FastAPI 라우터/서비스, DB/파일 자원, 운영/QA 문서
- **제약**: 실측 부하 테스트 미실시(보안/환경 제한). 코드·문서·구성 분석과 정량 지표 산출로 대체

## 2. 조사 방법
1. **코드 스캔**: FastAPI 라우터 51개(비관리자 인증 엔드포인트)를 AST 기반으로 분류, 파일/DB 접근 경로 조사
2. **구성 분석**: DB 커넥션 풀, 파일 쓰기 경로, 캐시/락 사용 현황 점검
3. **문서 교차 검증**: 기존 PRD/체크리스트/QA 리포트에서 동시성 관련 요구사항 추출
4. **정량 지표 산출**: 엔드포인트 수, 쓰기 연산 수, 커넥션 풀 용량 등 수치화

## 3. 커버리지 & 정량 지표
| 항목 | 값 | 근거 |
|------|-----|------|
| 비관리자 인증 엔드포인트 수 | 51개 | `analysis/non_admin_routes.json` |
| 쓰기 성격 엔드포인트 (POST/PUT/PATCH/DELETE) | 31개 | 동일 데이터 |
| 비관리자 접근 모듈 | 10개 | `auth`, `blueprint`, `items`, `mssql`, `prediction`, `routing`, `routing_groups`, `rsl`, `view_explorer`, `workspace` |
| 프론트 내 사용자 전용 메뉴 | 2/17개 (`routing`, `master-data`) | `frontend-prediction/src/store/workspaceStore.ts` |
| MSSQL 커넥션 풀 용량 | 동시 5커넥션 | `backend/database.py:240` |
| FileLock 사용 쓰기 경로 | 1개 (`workspace` 설정) | `backend/api/routes/workspace.py:44-118` |
| 락 미사용 파일 쓰기 경로 | 1개 (`routing` output profile) | `backend/api/routes/routing.py:137-190` |
| in-memory 캐시 (락 미적용) | 1개 (`blueprint` `_analysis_cache`) | `backend/api/routes/blueprint.py:20-35` |
| 중복 방지 버전 관리 적용 엔드포인트 | 2개 (`routing_groups`, `workspace`) | `backend/api/routing_groups.py:246-333`, `backend/api/routes/workspace.py:83-116` |

## 4. 주요 위험 식별
| ID | 영역 | 위험 내용 | 영향/발생 가능성 | 개선 제안 |
|----|------|-----------|------------------|-----------|
| R1 | 파일 IO (`routing` output profile) | `POST /api/routing/output-profiles` 가 JSON 파일을 FileLock 없이 기록. 동시 요청 시 부분 기록 또는 리스트 뷰에서 파싱 오류 가능 | **중간/중간** – 5명 동시 생성 시 파일 손상 및 500 응답 위험 | `FileLock` 적용 및 임시 파일 → 원본 rename 전략 도입 (`workspace` 구현 참조) |
| R2 | 캐시 경쟁 (`blueprint` 분석) | `_analysis_cache` 전역 dict 에 대한 동시 쓰기 보호 부재. AST 분석 CPU 부하가 커서 5명 요청 시 GIL 경합/응답 지연 위험 | **중간/낮음** – API가 관리자 UI에는 숨음이나 인증만으로 호출 가능 | `threading.Lock` 적용 또는 FastAPI BackgroundTask/작업 큐로 분리, 비관리자 접근 차단 |
| R3 | DB 커넥션 풀이 5개 고정 | `ConnectionPool(max_connections=5)`으로 설정되어 비관리자 5명이 동시에 복수 쿼리 호출 시 대기시간 증가 | **중간/중간** – 각 요청이 연속 쿼리 실행(뷰 컬럼, 데이터 등) | 풀 사이즈 환경 변수화(예: 10), 실패 시 경고 로그 추가, 장기적으로 async 드라이버 고려 |
| R4 | `view_explorer` 풀스캔 | `/views/{view}/sample` 가 정해진 LIMIT 없이 LIKE 검색 수행 → 대형 뷰에서 CPU/IO 급증, cache 없음 | **높음/중간** – 다수 검색 시 DB 부하 급증, 응답 지연 | 서버 측 LIMIT 강제, 인덱스·검색 컬럼 화이트리스트, 요청 단위 rate-limit |
| R5 | 예측 서비스 CPU 공유 | `PredictionService`가 polars/numexpr thread 수를 전역 CPU 수와 동일하게 설정, 요청당 대량 데이터 처리 및 파일 export 수행 | **높음/중간** – 동시 5건이면 CPU 100% 및 응답 지연 | per-request thread 제한(예: 최소(4, CPU)), Celery/워크큐 도입, 예측 API rate-limit |
| R6 | `routing_groups` 스냅샷 merge | `sync_routing_snapshots`가 사용자 `dirty` 상태를 덮어쓰는 과정에서 group 버전 상승 없이 metadata만 수정 → 동시 수정 시 마지막 요청이 선행 수정사항 덮어씀 | **중간/중간** – 동일 그룹을 공유 편집 시 타인 작업 손실 | snapshot merge 시 group.version 비교/증분, `metadata.workspace_state` 병합 로직에 optimistic lock 추가 |
| R7 | `auth` rate-limit 부재 | 로그인/비밀번호 변경/회원 가입에 요청 제한이 없어 5명 반복 시도 시 brute-force 감지 어려움 | **중간/낮음** – 인증 서버 부하 및 보안 위험 | FastAPI `slowapi` 등 적용, 실패 횟수 기반 임시 차단 |
| R8 | `rsl_service` import/export | 대량 CSV/JSON 변환을 단일 요청 내 메모리에 적재, 5명 동시 export 시 메모리 상승 | **중간/낮음** | 스트리밍 응답 또는 페이지네이션 export 지원 |

## 5. 긍정적 통제 사항
- `workspace` 설정 저장은 `FileLock` + 버전 충돌 검증으로 동시 쓰기 안전 확보 (`backend/api/routes/workspace.py`)
- `routing_groups` 주요 CRUD 는 버전 필드를 활용한 낙관적 잠금 적용 (`backend/api/routing_groups.py:260-332`)
- 예측 결과 export 는 사용자/세션 기반 prefix로 파일명 충돌 방지 (`backend/api/services/prediction_service.py:1327-1376`)

## 6. 개선 필요 항목 (우선순위)
1. **즉시 조치 (High)**  
   - R1: FileLock 도입 & 임시파일 commit 패턴 적용  
   - R4: `view_explorer` 쿼리 LIMIT 및 rate-limit 추가  
   - R5: 예측 API에 동시 실행 제한(큐/락) 및 CPU thread caps 도입
2. **단기 (Mid)**  
   - R3: DB 커넥션 풀 사이즈 환경설정화 및 모니터링 지표 추가  
   - R6: 스냅샷 merge 시 version 체크 로직 확장, UI에 재동기화 안내
3. **중기 (Low)**  
   - R2: Blueprint 캐시 락, 접근 권한 강화  
   - R7: 인증 엔드포인트 rate limiting / 감사 로그 강화  
   - R8: RSL export 스트리밍 지원 및 메모리 사용 모니터링

## 7. 후속 작업
- PRD/체크리스트 업데이트 및 Git 커밋 준비 (Phase 3)  
- 개선 항목 티켓화(Jira/Notion) + 일정 추정  
- QA 팀과 부하 테스트 플랜 수립(5 동시 사용자 시나리오)  
- 모니터링 지표: DB connection usage, prediction 서비스 처리 시간, view explorer 쿼리 latency 추가

## 부록
- AST 기반 엔드포인트 분류 JSON: `analysis/non_admin_routes.json`  
- 관련 코드 스냅샷:  
  - 커넥션 풀: `backend/database.py:240-304`  
  - 파일 쓰기 (락 없음): `backend/api/routes/routing.py:137-190`  
  - FileLock 적용 예: `backend/api/routes/workspace.py:83-116`  
  - Blueprint 캐시: `backend/api/routes/blueprint.py:20-35`  
  - Prediction export 경로: `backend/api/services/prediction_service.py:1327-1376`
