# PRD: Remove SQLite and Adopt Unified MSSQL Storage

**Date**: 2025-10-21  
**Status**: 🚧 IN PROGRESS  
**Priority**: CRITICAL  
**Related Tickets**: TBD

---

## Executive Summary

현재 백엔드 다수 모듈이 SQLite 파일(`logs/rsl_store.db`, `logs/routing_groups.db`, `models/registry.db` 등)을 기본 저장소로 사용하고 있다. 실제 운영 환경은 이미 MSSQL 접속 정보가 `.env` 에 정의되어 있어 데이터 일관성과 운영 정책이 충돌한다. 본 작업의 목적은 모든 SQLite 의존성을 제거하고, 백엔드/테스트/도구가 공통된 MSSQL(또는 지정된 외부 DB)으로 통합되도록 인프라와 코드를 정비하는 것이다.

---

## Problem Statement

- 기본 설정이 SQLite 파일을 가리켜 테스트나 서비스 시작 시 로컬 파일을 생성한다.
- 백엔드 서비스는 `.env` 의 MSSQL 자격 증명을 사용하지만, 보조 저장소는 여전히 SQLite를 열어 일관성이 깨진다.
- 파일 경로 권한 문제로 `sqlite3.OperationalError: unable to open database file` 가 반복 발생한다.
- 운영 보안 정책상 로컬 DB 파일 사용이 금지되어 있으며 감사 추적도 어려움.

### Current SQLite Footprint (2025-10-21 스캔 결과)

- `backend/api/config.py` 기본 URL (`sqlite:///logs/...`)
- `backend/database_rsl.py`, `backend/models/{routing_groups,process_groups}.py` 내 SQLite 전용 분기 및 JSON 타입
- `backend/maintenance/model_registry.py` 의 직접 `sqlite3` 사용
- `backend/api/routes/system_overview.py`, `backend/api/services/prediction_service.py` 등에서 SQLite 경로 로그 노출
- `approve_user.py`, `restart-clean.sh`, 여러 가이드 문서(`docs/guides/SQLITE_LOCAL_DEVELOPMENT.md` 등)
- Docker Compose, 스크립트, 테스트 픽스처가 SQLite 환경변수에 의존

---

## Goals and Objectives

1. **설정 통합**: `Settings` 기본값과 관련 환경 변수 정의를 MSSQL 우선 구조로 전환.
2. **ORM/DAO 정비**: SQLAlchemy 엔진, 모델 레지스트리, 인증 저장소 등 SQLite 의존 코드를 MSSQL 호환 방식으로 변경.
3. **마이그레이션 경로 제공**: 기존 SQLite 데이터가 있다면 MSSQL 테이블로 이전할 스크립트/문서 제공.
4. **테스트 적응**: pytest 및 자동화 환경에서 MSSQL 더블 또는 in-memory 대안을 사용하도록 픽스처 수정.
5. **운영 문서 갱신**: README, 설정 가이드, 배포 문서에 DB 변경 사항 반영.

---

## Requirements

### Functional Requirements

- FR-1: FastAPI 설정(`backend/api/config.py`)은 기본적으로 MSSQL 연결 문자열을 요구하며, 누락 시 명확한 오류를 반환한다.
- FR-2: 인증/라우팅 그룹/모델 레지스트리 등 모든 데이터 저장 모듈이 공통 SQLAlchemy 엔진을 통해 MSSQL에 연결한다.
- FR-3: 모델 레지스트리(`backend/maintenance/model_registry.py`)는 SQLite API 대신 RDB-agnostic(SQLAlchemy) 구현으로 교체한다.
- FR-4: CLI 및 보조 스크립트(예: `approve_user.py`)가 MSSQL을 사용하도록 업데이트된다.

### Non-Functional Requirements

- NFR-1: 연결 실패 시 친절한 오류 메시지와 재시도 지침 제공.
- NFR-2: DB 연결 정보는 `.env` 및 배포 스크립트에서 일관되게 관리.
- NFR-3: 마이그레이션 작업은 1시간 이내 수행 가능해야 하며, 다운타임 최소화.

### Target MSSQL Parameter Map

| Context | Key | Source | Notes |
|---------|-----|--------|-------|
| FastAPI settings | `RSL_DATABASE_URL`, `ROUTING_GROUPS_DATABASE_URL` | `.env`, Docker, Windows 서비스 | ODBC 드라이버 문자열 필요 |
| Model registry | `MODEL_REGISTRY_URL` (신규) | `.env` | 기존 `model_registry_path` 대체 |
| CLI/Tools | `DATABASE_URL`, `RSL_DATABASE_URL` | Batch/PowerShell 스크립트 | 12Factor 준수 위해 `.env` 참조 |
| Tests | `pytest.ini` / fixtures | `os.environ` overrides | 로컬 개발 시 테스트용 MSSQL 또는 모킹 필요 |

---

## Phase Breakdown

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| Phase 1 | 아키텍처 분석 및 설정 정리 | 영향 범위 목록, PRD/체크리스트 완료, 환경 변수 설계 |
| Phase 2 | 코드 베이스 수정 | SQLAlchemy 구성 통합, SQLite 코드 제거, 테스트 보완 |
| Phase 3 | 마이그레이션 및 문서화 | 데이터 이전 스크립트, 운영 문서 갱신, 최종 검증 보고 |

---

## Success Criteria

- ✅ 코드베이스 내 SQLite 전용 로직이 전부 제거된다.
- ✅ `.env`, Docker, 배포 스크립트가 동일한 MSSQL 설정을 사용한다.
- ✅ 단위/통합 테스트가 새로운 DB 레이어에서 모두 통과한다.
- ✅ 마이그레이션 가이드에 따라 기존 데이터 손실 없이 이전 가능하다.
- ✅ 운영팀이 새 설정으로 서비스 기동 및 점검을 완료했다는 승인을 받는다.

---

## Timeline Estimates

| Phase | Estimated Effort | Target Completion |
|-------|------------------|-------------------|
| Phase 1 | 0.5 day | 2025-10-21 |
| Phase 2 | 1.5 days | 2025-10-23 |
| Phase 3 | 1 day | 2025-10-24 |

---

## Dependencies & Risks

- MSSQL 접근 권한 및 네트워크 허용 여부 확인 필요.
- SQLAlchemy 드라이버/ODBC 버전 문제 발생 가능성.
- 이전 SQLite 데이터의 스키마와 MSSQL 스키마 불일치.

---

## Approvals

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | TBD | - | Pending |
| Tech Lead | TBD | - | Pending |
| DBA | TBD | - | Pending |

---

**Last Updated**: 2025-10-21  
**Next Review**: Phase 1 완료 시
