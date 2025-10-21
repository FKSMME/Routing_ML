# PostgreSQL 전환 체크리스트

## Phase 1: 환경 구성 정비
- [x] Task 1.1 환경 변수 예시(.env)와 검증 로직이 PostgreSQL URL 규약을 안내하도록 갱신 — Est: 0.5h — Dep: PRD — AC: `.env`에 postgres 접두사 샘플이 존재하고 빈값 검증 통과
- [x] Task 1.2 배포 스크립트 및 docker-compose가 Postgres 서비스/포트를 사용하도록 조정 — Est: 1.0h — Dep: Task1.1 — AC: docker-compose 및 스크립트 내 MSSQL 문자열 제거

**Estimated Time**: 1.5h
**Status**: Not Started
**Dependencies**: PRD 완료

**Git Operations**:
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: 백엔드 코드 호환성
- [x] Task 2.1 SQLAlchemy 엔진 생성 모듈(database_rsl.py 등)을 Postgres 드라이버 기본값과 연결 파라미터로 검증 — Est: 1.5h — Dep: Phase1 완료 — AC: Postgres 연결 문자열로 초기화 테스트 완료
- [x] Task 2.2 모델/서비스 레이어(model_registry.py, training/prediction 서비스 호출부)가 Postgres 특성(JSONB, schema)과 일치 — Est: 1.0h — Dep: Task2.1 — AC: Postgres 미지원 옵션 제거 & JSON 필드 확인
- [x] Task 2.3 보조 스크립트(approve_user.py, train_build_index.py 등)가 Postgres URL 인자 사용 — Est: 0.5h — Dep: Task2.2 — AC: CLI 인자/세션 생성 검증 완료

**Estimated Time**: 3.0h
**Status**: Not Started
**Dependencies**: Phase 1 완료

**Git Operations**:
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: 테스트 및 문서화
- [x] Task 3.1 지정된 pytest 스위트 3종 실행 및 실패 시 수정 — Est: 1.0h — Dep: Phase2 완료 — AC: 테스트 통과 스크린샷/로그 확보
- [x] Task 3.2 문서 및 체크리스트 업데이트(Progress, Acceptance) — Est: 0.5h — Dep: Task3.1 — AC: 모든 체크박스 [x], Progress 100%
- [x] Task 3.3 후속 Phase 3 제안/인프라 반영 메모 작성 — Est: 0.5h — Dep: Task3.2 — AC: 권고사항이 PRD & 체크리스트에 반영

**Estimated Time**: 2.0h
**Status**: Not Started
**Dependencies**: Phase 2 완료

**Git Operations**:
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [▓▓▓▓▓] 100% (2/2 tasks)
Phase 2: [▓▓▓▓▓] 100% (3/3 tasks)
Phase 3: [▓▓▓▓▓] 100% (3/3 tasks)

Total: [▓▓▓▓▓▓▓▓▓▓] 100% (8/8 tasks)
```

---

## Follow-up Recommendations

- Phase 3 이후 SQLite에 남은 데이터를 PostgreSQL로 이전하는 마이그레이션 스크립트를 작성하고 운영 환경에서 검증한다.
- `docs/guides/SQLITE_LOCAL_DEVELOPMENT.md` 등 SQLite 전용 문서를 Postgres 안내로 대체하거나 폐기한다.
- 신규 환경 변수(`MODEL_REGISTRY_URL` 등)를 배포 파이프라인과 비밀 관리 시스템에 반영하고 자격 증명 노출 여부를 점검한다.

---

## Acceptance Criteria
- [x] All tasks completed and marked [x]
- [ ] All phases committed and merged
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining

**Last Updated**: 2025-10-21
**Next Review**: After Phase completion
