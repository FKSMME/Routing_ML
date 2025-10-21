# Checklist: Remove SQLite and Adopt Unified MSSQL Storage

**Date**: 2025-10-21  
**Owner**: syyun  
**Status**: 🚧 In Progress

---

## Phase 1: Discovery & Planning

- [x] P1-T1 영향 범위 식별 (SQLite 사용 파일, 환경 변수, 스크립트)
- [x] P1-T2 MSSQL 연결 파라미터 명세 정리 (`.env`, Docker, 배포 스크립트)
- [x] P1-T3 위험 요소/의존성 목록화 및 DBA 확인

**Estimated Time**: 0.5 day  
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: Implementation

- [x] P2-T1 FastAPI 설정/서비스 레이어에서 SQLite 기본값 제거
- [x] P2-T2 SQLAlchemy 엔진 및 모델 레지스트리 리팩터링
- [x] P2-T3 CLI & 스크립트의 DB 의존성 업데이트
- [x] P2-T4 단위/통합 테스트 수정 및 통과

**Estimated Time**: 1.5 days  
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Migration & Documentation

- [ ] P3-T1 SQLite → MSSQL 데이터 이전 스크립트/자동화 작성
- [ ] P3-T2 운영/배포 문서, README, 환경 가이드 업데이트
- [ ] P3-T3 최종 검증 및 QA 보고

**Estimated Time**: 1 day  
**Status**: Not Started

**Git Operations**:
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [█████] 100% (3/3 tasks)
Phase 2: [█████] 100% (4/4 tasks)
Phase 3: [░░░░░] 0% (0/3 tasks)

Total: [███████░░░░] 70% (7/10 tasks)
```

---

## Dependencies

- DBA 접속 권한 승인
- SQLAlchemy MSSQL 드라이버 설치 상태
- 기존 SQLite 데이터 위치 파악

---

## Acceptance Criteria

- [ ] 모든 체크박스 완료
- [ ] Phase별 Git 작업 수행 완료
- [ ] 마이그레이션/운영 문서 최신화
- [ ] QA 승인 및 운영팀 인수 확인

---

**Last Updated**: 2025-10-21  
**Next Review**: Phase 1 완료 시
