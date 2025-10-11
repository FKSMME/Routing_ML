# Routing ML 프로젝트 종합 진단 (2025-10-09)

## 1. 코드베이스 계량 지표
- 전체 소스 라인 수: 약 123,000 LOC (주요 언어: TypeScript/TSX 45k, Python 26k, CSS 12k)
- 디렉터리별 대표 LOC  
  - `frontend-prediction`: 43,590 LOC (TS/TSX 32,201, CSS 6,956 등)  
  - `frontend-training`: 36,867 LOC  
  - `backend`: 21,817 LOC (Python 124파일)  
  - `tests`: 5,272 LOC (Python 22파일, Playwright 10 스펙)
- 테스트 스위트 구성: Python 단위 테스트 22개, Playwright/비주얼 스펙 10개 → 총 32개. `scripts/run_ci.sh`는 현재 백엔드 테스트만 호출
- 대형 모델/데이터 아티팩트: `.joblib` 10개(약 350k 레코드), Access `.accdb` 2개(총 110k 레코드) → 저장소 용량 1.1 GB 이상
- 핵심 의존성 수: Python 19개(`requirements.txt`), 프런트엔드 monorepo 의존성 43개 (`frontend-prediction/package.json` 기준)

## 2. 실패 시나리오 Top 10
1. **JWT 시크릿 미설정으로 API 부팅 실패**  
   `backend/api/config.py:64`는 기본값을 즉시 차단하므로 `.env`에 32자 이상 `JWT_SECRET_KEY`가 없으면 FastAPI 기동이 100% 실패. 단독 운영자는 서버 재기동 시마다 환경 변수를 보장해야 함.
2. **pyodbc / Access 드라이버 의존**  
   `backend/database.py:74` 기본 `DB_TYPE=ACCESS`이며 Linux 컨테이너에는 Access ODBC가 없음. 드라이버 미설치 시 훈련·예측 API 전체가 동작하지 못한다. MSSQL 전환 지연 시 배포 실패.
3. **환경 패키지 누락 시 테스트 전면 중단**  
   `pytest` 실행 시 `ModuleNotFoundError: pydantic_settings`를 바로 내며 CI 미동작(로컬 재현). 패키지 설치 스크립트 부재는 테스트 자동화를 막아 실패 탐지 불가.
4. **SQLite 단일 파일 인증 저장소 잠금**  
   기본 `logs/rsl_store.db` SQLite(`backend/api/services/auth_service.py:30`)는 다중 워커에서 잠금 경합. 동시 사용자 로그인/승인 시 Deadlock → 인증 서비스 중단.
5. **프런트엔드 코드 중복 폭증**  
   `frontend-prediction`과 `frontend-training`이 80k LOC 중 68% 유사 구성이나 `frontend-shared`는 비어있음. 기능 추가 시 복제 수정 누락 → UI 기능 불일치/버그.
6. **모델 캐싱/메모리 폭주**  
   `ManifestLoader`(`backend/api/services/prediction_service.py:52`)와 HNSW 인덱스는 동일 프로세스 내에서만 캐시. 멀티 프로세스(Uvicorn workers>1) 배포 시 각 워커가 2~3GB 모델을 중복 로드 → OOM으로 API 다운.
7. **데모 모드/실데이터 분기 유지보수 실패**  
   `backend/database.py:34`의 `demo_mode_enabled()` 분기와 실제 ODBC 쿼리가 혼재. 실데이터 스키마 변경 시 데모 모드 테스트가 통과해도 실서비스는 오류 발생 가능.
8. **타임라인 집계 성능 병목**  
   `backend/api/services/time_aggregator.py:18` Polars/NumExpr 스레드 수를 CPU 코어로 고정. Kubernetes 등 제한 환경에서 코어 수 > 할당량이면 OS가 스로틀링 → 응답 지연·타임아웃.
9. **승인 프로세스 운영 중단 위험**  
   초기 관리자 계정이 자동 생성되지 않아 `approve_user.py` 수동 실행 필요. 로그 디렉터리 비어 있으면 SQLite가 생성되지 않아 승인 자체가 막히는 케이스 존재.
10. **CI에서 프런트엔드 회귀 미탐지**  
    현 `scripts/run_ci.sh`는 Playwright/React 테스트 10건을 실행하지 않는다. 배포 전 빌드/타입체크가 빠져 있어 43k LOC UI 변경 시 런타임 오류가 그대로 사용자에게 노출.

## 3. 성공 비전 (1인 운영 기준)
- **Phase 1 – 안정화 (D+7)**: 공통 `.env` 템플릿으로 환경 변수를 표준화하고 Docker Compose에 MSSQL 모드 설정을 강제. 단일 CI 스크립트에서 Python/TypeScript 테스트, 빌드, 정적 분석을 자동화.
- **Phase 2 – 효율화 (D+30)**: `frontend-shared`에 공용 상태/컴포넌트를 이관해 중복 LOC 25% 절감. 모델 로딩을 gRPC 추론 서버로 분리하여 API 메모리 사용량 60% 감소 목표.
- **Phase 3 – 확장 (D+90)**: Access → MSSQL 데이터 파이프라인 전환을 마치고, Prometheus `/api/metrics` 기반 SLA(예측 95p latency 2.5s 이하, 성공률 99.5%)를 달성. 운영 자동화(로그 로테이션, 백업)로 1인 유지 가능 상태 확보.

## 4. 명예 심사단 비평
- **스티브 잡스 (기업가)**  
  “이 제품은 아름답지만, 두 개의 프런트엔드가 같은 이야기를 반복하고 있어요. 단일 경험으로 정제해야 사람들이 사랑합니다. 덜어내고, 본질적 흐름에 집중하세요.”
- **엘리자베스 1세 (지도자)**  
  “왕국을 다스리려면 질서가 필요하듯, 당신의 배포 절차에도 의식이 필요합니다. 비밀 열쇠(JWT)를 잊는 순간 궁문은 닫힙니다. 규범을 명확히 하고 문지기를 세우십시오.”
- **샘 알트만 (AI 전문가)**  
  “모델이 커질수록 운영 비용과 위험은 기하급수적으로 늘어요. 멀티 워커가 같은 모델을 반복해 로드하는 구조는 투자자에게 신뢰를 주지 못합니다. 추론 경량화와 Observatory 구축이 필수입니다.”

## 5. 개발자 우선순위 체크리스트
1. [ ] `.env` 표준 템플릿 배포 및 `JWT_SECRET_KEY` 자동 검증 스크립트 작성 → FastAPI 부팅 실패 예방  
2. [ ] Docker/CI 모두 `DB_TYPE=MSSQL` 기본값으로 전환하고 ODBC 연결 검증 테스트 추가  
3. [ ] `scripts/run_ci.sh` 확장: `pip install -r requirements.txt`, `npm ci`, 프런트 빌드/테스트 포함  
4. [ ] 모델 로딩 분리: HNSW 인덱스를 별도 서비스 혹은 lazy loader로 변경하여 메모리 소비 측정(목표 <1.5 GB/worker)  
5. [ ] `frontend-shared` 활성화 및 중복 컴포넌트 20개 이상 이관, 스토리북/비주얼 테스트 재정렬  
6. [ ] 인증 DB 마이그레이션: SQLite → PostgreSQL(or MSSQL), 초기 관리자 프로비저닝 스크립트 추가  
7. [ ] Access 추상화 제거: 실데이터와 데모 데이터를 분리한 리포지터리/테스트 픽스처 정비  
8. [ ] `/api/metrics` 대시보드에 SLA 경보 설정(P95 latency, 오류율) 및 로그 보존 정책 확립  
9. [ ] 대형 아티팩트(.joblib, .accdb) 아카이브 분리 또는 Git LFS 전환으로 저장소 용량 관리  
10. [ ] 운영 자동화: `approve_user.py` CLI 개선(초기 admin 생성, 경로 인자화) 및 makefile/workflow 정리

