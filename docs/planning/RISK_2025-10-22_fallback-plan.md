# 위험 및 대응 계획 (2025-10-22)

## 1. DB 접근 지연 시 대체 측정
- **상황**: 운영 Postgres/MSSQL 접근 권한 확보 지연
- **대응**:
  1. 로컬 Docker Compose(Postgres 15, MSSQL Express)로 샘플 데이터 적재
  2. `scripts/create_postgres_db.py` 로 빈 스키마 생성 후 `tests/data/*.csv` 로 최소 데이터 로드
  3. MSSQL 지연 측정은 PowerShell/Python 타이머로 대체하고 Prometheus에는 `testdata/mssql_latency.prom` 파일 제출
- **검증**: Placeholder 데이터 기반 Grafana 대시보드 캡처

## 2. Canvas 와이어 저장 일정 지연 시 조치
- **위험**: 백엔드 마이그레이션 또는 API 복구 일정 지연으로 프로덕션 반영 지연
- **대응**:
  1. 기술 부채 항목 등록: `JIRA-ROUTING-1823` (Canvas manual connections persistence)
  2. 프론트엔드/백엔드 기능 flag (`ENABLE_MANUAL_CONNECTIONS`) 도입으로 부분 배포 가능
  3. 주간 보고서에 진행률/차단 요인 공유
- **확인**: Checklist Phase 3 완료 및 온보딩 문서에 부채 항목 기재
