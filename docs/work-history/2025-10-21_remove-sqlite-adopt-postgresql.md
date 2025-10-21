# 2025-10-21 – remove-sqlite-adopt-postgresql 작업 히스토리

## 개요
- SQLite 의존성을 제거하고 내부 저장소(`RSL_DATABASE_URL`, `ROUTING_GROUPS_DATABASE_URL`, `MODEL_REGISTRY_URL`)를 PostgreSQL 연결로 전환.
- 환경 파일(.env, .env.example), docker-compose 및 서비스 시작 스크립트에서 PostgreSQL 기본값을 노출.
- 시스템 개요 API가 PostgreSQL 연결 정보를 반영하도록 UI 메타데이터 수정.
- SQLAlchemy 기반 모델/서비스/도구가 PostgreSQL을 정상적으로 생성·조회하도록 검증.
- 관련 테스트 스위트 3종 통과 확인.

## 주요 변경 사항
- `.env`, `.env.example`에 `postgresql+psycopg` URL 샘플 및 가이드 추가.
- `docker-compose.yml`, `restart-clean.sh`, `start-all-services.sh` 스크립트의 기본 DB URL을 PostgreSQL로 교체.
- `backend/api/routes/system_overview.py`에서 데이터 노드 설명과 연결 요약을 PostgreSQL 기준으로 갱신.
- `approve_user.py`, `scripts/train_build_index.py` 등 CLI 도구가 PostgreSQL URL 사용을 안내.
- `requirements.txt`에 `psycopg[binary]` 의존성 추가.
- PRD/체크리스트 문서를 PostgreSQL 전환 흐름과 후속 과제로 업데이트.

## 테스트
- `python -m pytest tests/test_training_service_status.py -q`
- `python -m pytest tests/test_training_service_manifest.py -q`
- `python -m pytest tests/backend/api/test_training_service_dataset_loading.py -q`

모두 통과 확인.

## 후속 권장 사항
- SQLite 잔여 데이터를 PostgreSQL로 이전하는 마이그레이션 스크립트를 Phase 3 이후 작성 및 검증.
- SQLite 전용 가이드(`docs/guides/SQLITE_LOCAL_DEVELOPMENT.md` 등)를 Postgres 안내로 대체 또는 폐기.
- 새 환경 변수와 자격 증명을 배포 파이프라인/비밀 관리에 반영하고 `.env` 민감 정보 노출 여부 검사.
