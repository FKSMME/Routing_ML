# MSSQL 전환 체크리스트 (2025-10-12)

## 1. 사전 점검
- [x] `.env`에서 MSSQL 접속 정보 확인 (`MSSQL_SERVER`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`)
- [ ] 기존 Access 의존 경로 및 설정 전수 조사 (`Access`, `ACCDB`, `ODBC`, `FreeTDS` 사용 부분 포함)
- [ ] 테스트/배포 환경에서 필요 드라이버(PyODBC, ODBC Driver 17/18) 설치 상태 확인

## 2. 백엔드 코드 반영
- [ ] `backend/constants.py`, `backend/database.py` 등 DB 타입 분기 제거 및 MSSQL 전용 로직 정비
- [ ] `backend/api/routes` 및 `services` 계층의 쿼리/스토어드 프로시저가 MSSQL 스키마와 일치하는지 검증
- [ ] `common/config_store.py`, `common/sql_schema.py` 등 공통 모듈에서 Access 문구/구조 제거
- [ ] 테스트 스위트(`tests/backend`)에서 Access 시나리오를 MSSQL 기준으로 갱신

## 3. 프런트엔드 반영 (prediction/training)
- [ ] UI 문구, 도움말, 툴팁에서 Access -> MSSQL 변경
- [ ] API 클라이언트(`frontend-*/src/lib/apiClient.ts`)의 메타데이터 설명 갱신
- [ ] 테스트 코드/Mock (`__tests__`) 접근 방식 Access 언급 제거

## 4. 배포 및 설정
- [ ] `docker-compose.yml`, 배포 스크립트, 인스톨러에서 Access 설정 제거 및 MSSQL 설정 확정
- [ ] `scripts/backup_access_db.sh` 등 Access 관련 유틸을 MSSQL 버전으로 대체하거나 제거
- [ ] 구성 문서(`docs/`)에서 Access 안내 전면 교체

## 5. 검증
- [ ] 백엔드 단위 테스트/통합 테스트 실행
- [ ] 프런트엔드 빌드 및 핵심 스냅샷/단위 테스트 실행
- [ ] API 헬스체크 및 주요 엔드포인트(Master Data, Routing, Workflow) 수동 검증
- [ ] 정량 지표 수집 (변경 파일 수, 테스트 성공 수, 린트 결과 등)

## 6. 보고
- [ ] 시간 단위 작업 로그 업데이트 (`docs/logs/root/WORK_LOG_2025-10-12_MSSQL_MIGRATION.md`)
- [ ] 최종 보고서에 변경 요약, 검증 결과, 정량 지표 기록
