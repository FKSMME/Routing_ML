# PostgreSQL 전환 PRD

## Executive Summary
- 기존 MSSQL 기반으로 정비된 백엔드/운영 도구 구성을 PostgreSQL 연결 문자열과 호환성으로 전환한다.
- 환경 변수 및 배포 스크립트, 백엔드 DB 계층, 테스트/문서 흐름을 Postgres 중심으로 재조정하여 운영 환경과 일치시키는 것이 목표다.

## Problem Statement
- 최근 작업으로 SQLite 의존성을 제거하고 MSSQL 구성을 기본으로 도입했으나, 실제 운영 인프라는 PostgreSQL 사용을 요구한다.
- 현재 코드와 스크립트, 문서가 MSSQL 전용 설정을 반영하고 있어 Postgres 환경에서 연결 실패, 타입 불일치, 운영 절차 혼선을 초래한다.

## Goals and Objectives
1. 모든 필수 환경 변수(`RSL_DATABASE_URL`, `ROUTING_GROUPS_DATABASE_URL`, `MODEL_REGISTRY_URL`)가 PostgreSQL 접두사 예시를 제공하도록 갱신한다.
2. SQLAlchemy 기반 DB 초기화 로직이 PostgreSQL 드라이버 옵션 및 JSON/BYTEA 타입 호환성을 보장하도록 검증한다.
3. 유지보수 스크립트 및 관리자 도구가 Postgres 연결 문자열을 수용하며, 불필요한 MSSQL 특화 옵션을 제거한다.
4. 테스트 및 운영 문서가 Postgres 흐름을 설명하고 체크리스트가 최신 단계와 일치한다.

## Requirements
- `.env`, `docker-compose.yml`, `restart-clean.sh`, `start-all-services.sh`, `scripts/train_build_index.py`, `approve_user.py` 등 환경 관련 자산이 PostgreSQL URL 및 자격증명을 사용하도록 업데이트되어야 한다.
- `backend/api/config.py` 및 SQLAlchemy 엔진 생성 모듈은 PostgreSQL 연결 시도 시 즉시 실패 여부를 분명히 검사해야 한다.
- `backend/maintenance/model_registry.py` 등 DB 접근 계층은 Postgres의 스키마/JSON 타입과 세션 lifecycle에 맞는 옵션을 적용해야 한다.
- 테스트 픽스처(`tests/conftest.py` 등)는 로컬 파일 기반 SQLite 대신 Postgres용 테스트 URL을 사용하거나 명확히 문서화된 in-memory 대안을 제공해야 한다.
- 관련 운영 문서와 체크리스트는 Postgres 마이그레이션 절차, 비밀 관리 반영, Phase 3 후속 작업을 포함해야 한다.

## Phase Breakdown
- **Phase 1 – 환경 구성 정비**: 환경 변수 예시, docker-compose, 실행 스크립트를 Postgres 기본값으로 갱신하고 필요한 비밀 키 항목을 정리한다.
- **Phase 2 – 백엔드 코드 호환성 확인**: SQLAlchemy 엔진, 모델 레이어, 서비스 호출부가 Postgres 드라이버(`psycopg` 등)와 호환되도록 수정 및 검증한다.
- **Phase 3 – 테스트 및 문서화**: pytest 스위트 실행, 실패 시 수정, 체크리스트 업데이트, 운영/PRD 문서 추적을 완료한다.

## Success Criteria
- Postgres URL만 설정된 상태에서 모든 주요 서비스가 부팅 가능하고 테스트가 통과한다.
- `.env`와 배포 스크립트가 실제 사용될 Postgres 자격증명 키를 정확히 반영한다.
- 체크리스트와 문서가 Postgres 운영 흐름을 명시하고 잔여 SQLite/MSSQL 참조가 제거된다.

## Timeline Estimates
- Phase 1: 1.5시간 – 환경 변수, 스크립트, docker-compose 업데이트 및 수동 검증.
- Phase 2: 3시간 – DB 모듈/서비스 코드 분석 및 Postgres 맞춤 수정, 로컬 테스트.
- Phase 3: 1.5시간 – pytest 실행, 문서/체크리스트 및 후속 Phase 제안 정리.

## Next Steps & Recommendations
- SQLite에 남아 있는 데이터/스냅샷을 신규 PostgreSQL 인스턴스로 마이그레이션하는 자동화 스크립트를 Phase 3 이후 작성하고 검증한다.
- `docs/guides/SQLITE_LOCAL_DEVELOPMENT.md`와 유사 가이드를 Postgres 전용 안내로 대체하거나 폐기하여 운영 절차 혼선을 방지한다.
- 새로운 환경 변수(`MODEL_REGISTRY_URL`, Postgres 접속 정보)를 배포 파이프라인과 비밀 관리 시스템에 반영하고, `.env` 템플릿의 민감 정보 노출 여부를 재검토한다.
