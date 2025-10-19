# Tasklist: Backend Test Environment Fix

**Project**: Routing ML Backend Test Fixes
**Version**: 1.0.0
**Date**: 2025-10-20
**Status**: In Progress
**Owner**: Routing ML Team

---

## 📋 Overview

이 Tasklist는 PRD_backend_test_fixes.md에 정의된 요구사항을 구현하기 위한 상세 작업 목록입니다.

---

## 🎯 Phase 1: Quick Fix (Mock Database) - PRIORITY 1

### 목표
백엔드 테스트를 즉시 통과시키기 위한 Mock 기반 솔루션 구현

### ✅ Task 1.1: Analyze Current Test Failures

- [ ] 백엔드 테스트 실행 및 실패 원인 파악
  ```bash
  cd backend
  pytest tests/ -v --tb=short
  ```
- [ ] SQLite 관련 에러 목록 작성
- [ ] auth_service 의존성 분석
- [ ] 영향받는 테스트 파일 목록 작성
- [ ] 실패율 계산 (현재 vs 목표)

**Acceptance Criteria**:
- [x] 모든 실패 원인 문서화
- [ ] 영향받는 파일 목록 완성
- [ ] 우선순위 설정 완료

---

### ✅ Task 1.2: Create Test Configuration

- [ ] `backend/tests/conftest.py` 파일 생성
- [ ] pytest fixtures 정의
  - [ ] `mock_auth_service` fixture
  - [ ] `mock_database` fixture
  - [ ] `test_client` fixture (FastAPI)
- [ ] `pytest.ini` 설정 파일 생성
  - [ ] Test discovery 패턴
  - [ ] 환경 변수 설정
  - [ ] Coverage 옵션
- [ ] `.env.test` 파일 생성
  ```ini
  TESTING=true
  DATABASE_URL=sqlite:///:memory:
  SECRET_KEY=test-secret-key
  ```

**Acceptance Criteria**:
- [ ] conftest.py 생성 완료
- [ ] pytest.ini 설정 완료
- [ ] 환경 변수 파일 생성 완료

---

### ✅ Task 1.3: Create Mock Auth Service

- [ ] `backend/tests/mocks/mock_auth.py` 생성
- [ ] Mock 인증 함수 구현
  ```python
  def mock_get_current_user():
      return {"username": "test_user", "role": "admin"}

  def mock_create_user(user_data):
      return {"id": 1, **user_data}

  def mock_authenticate(username, password):
      return {"access_token": "test_token"}
  ```
- [ ] Mock 데이터베이스 세션 구현
- [ ] Fixture로 등록

**Acceptance Criteria**:
- [ ] 모든 auth_service 함수 모킹 완료
- [ ] 테스트에서 사용 가능한 fixture 생성
- [ ] Docstring 작성 완료

---

### ✅ Task 1.4: Update Existing Tests

- [ ] 기존 테스트 파일에서 auth_service import 제거
- [ ] Mock fixture 사용으로 변경
  ```python
  # Before
  from backend.services import auth_service

  # After
  def test_something(mock_auth_service):
      # Use mock_auth_service
  ```
- [ ] 각 테스트 파일 업데이트
  - [ ] `test_auth.py`
  - [ ] `test_api.py`
  - [ ] `test_routes.py`
  - [ ] 기타 auth 의존 테스트
- [ ] Docstring 및 주석 추가

**Acceptance Criteria**:
- [ ] 모든 테스트 파일 업데이트 완료
- [ ] Import 에러 없음
- [ ] 테스트 실행 가능 상태

---

### ✅ Task 1.5: Run Tests and Fix Failures

- [ ] 전체 테스트 실행
  ```bash
  pytest backend/tests/ -v
  ```
- [ ] 실패한 테스트 개별 수정
- [ ] Coverage 리포트 생성
  ```bash
  pytest --cov=backend --cov-report=html
  ```
- [ ] Coverage 70% 이상 확인
- [ ] 모든 테스트 통과 확인

**Acceptance Criteria**:
- [ ] 테스트 성공률 100%
- [ ] Coverage >= 70%
- [ ] 실행 시간 < 30초
- [ ] 에러 로그 없음

---

### ✅ Task 1.6: Documentation

- [ ] Phase 1 구현 문서 작성
  - [ ] 아키텍처 다이어그램
  - [ ] Mock strategy 설명
  - [ ] 사용법 가이드
- [ ] README.md 업데이트
  - [ ] 테스트 실행 방법
  - [ ] 환경 변수 설명
- [ ] 주석 및 Docstring 검토

**Acceptance Criteria**:
- [ ] 문서 작성 완료
- [ ] README 업데이트 완료
- [ ] 코드 주석 충분

---

## 🔧 Phase 2: Configuration-based Approach - PRIORITY 2

### 목표
환경별 설정 분리 및 실제 데이터베이스 사용

### ✅ Task 2.1: Create Environment Configuration

- [ ] `.env.example` 템플릿 생성
  ```ini
  # Production
  DATABASE_URL=mssql+pyodbc://...
  SECRET_KEY=your-secret-key

  # Testing
  TESTING=false
  ```
- [ ] `.env.test` 업데이트
  ```ini
  DATABASE_URL=sqlite:///./test.db
  TESTING=true
  SECRET_KEY=test-secret-key
  ```
- [ ] `.gitignore` 업데이트
  ```
  .env
  .env.local
  test.db
  ```
- [ ] 환경 변수 검증 로직 추가

**Acceptance Criteria**:
- [ ] 템플릿 파일 생성 완료
- [ ] .gitignore 업데이트 완료
- [ ] 환경 변수 문서화 완료

---

### ✅ Task 2.2: Refactor Database Configuration

- [ ] `backend/database.py` 업데이트
  ```python
  import os
  from sqlalchemy import create_engine
  from sqlalchemy.orm import sessionmaker

  def get_database_url():
      if os.getenv("TESTING") == "true":
          return "sqlite:///./test.db"
      return os.getenv("DATABASE_URL")

  engine = create_engine(get_database_url())
  SessionLocal = sessionmaker(bind=engine)
  ```
- [ ] 환경 감지 로직 구현
- [ ] 데이터베이스 연결 테스트
- [ ] Error handling 추가

**Acceptance Criteria**:
- [ ] 환경별 DB URL 분리 완료
- [ ] 연결 테스트 통과
- [ ] 에러 핸들링 구현

---

### ✅ Task 2.3: Refactor Auth Service

- [ ] `backend/services/auth_service.py` 리팩토링
- [ ] SQLite 하드코딩 제거
  ```python
  # Before
  DB_PATH = "data/users.db"  # Hard-coded

  # After
  from backend.database import SessionLocal
  db = SessionLocal()
  ```
- [ ] Dependency injection 패턴 적용
- [ ] 설정 기반 초기화
- [ ] Unit test 업데이트

**Acceptance Criteria**:
- [ ] 하드코딩 제거 완료
- [ ] DI 패턴 적용 완료
- [ ] 테스트 통과

---

### ✅ Task 2.4: Create Test Fixtures

- [ ] `backend/tests/fixtures.py` 생성
- [ ] 데이터베이스 fixture 구현
  ```python
  @pytest.fixture(scope="function")
  def test_db():
      # Setup
      engine = create_engine("sqlite:///./test.db")
      Base.metadata.create_all(bind=engine)

      yield SessionLocal()

      # Teardown
      Base.metadata.drop_all(bind=engine)
  ```
- [ ] 테스트 데이터 factory 구현
- [ ] Cleanup 로직 추가

**Acceptance Criteria**:
- [ ] Fixture 생성 완료
- [ ] 테스트 격리 확인
- [ ] Cleanup 동작 확인

---

### ✅ Task 2.5: Update Tests for Real Database

- [ ] Mock에서 실제 DB fixture로 전환
- [ ] 테스트 데이터 준비 로직 추가
- [ ] Transaction rollback 구현
- [ ] 테스트 실행 및 검증

**Acceptance Criteria**:
- [ ] 실제 DB 사용 테스트 통과
- [ ] 테스트 격리 확인
- [ ] 성능 허용 범위 내

---

### ✅ Task 2.6: Integration Testing

- [ ] API 엔드포인트 통합 테스트 작성
- [ ] CRUD 작업 테스트
- [ ] 인증/권한 테스트
- [ ] 에러 케이스 테스트

**Acceptance Criteria**:
- [ ] 통합 테스트 작성 완료
- [ ] 모든 테스트 통과
- [ ] Coverage >= 80%

---

### ✅ Task 2.7: Documentation Update

- [ ] Phase 2 구현 문서 작성
- [ ] 설정 가이드 업데이트
- [ ] 개발자 온보딩 문서 업데이트
- [ ] Troubleshooting 섹션 추가

**Acceptance Criteria**:
- [ ] 문서 업데이트 완료
- [ ] 예제 코드 포함
- [ ] FAQ 섹션 추가

---

## 🚀 Phase 3: Production Deployment Preparation (Future)

### ✅ Task 3.1: MSSQL Integration Testing

- [ ] MSSQL 테스트 환경 설정
- [ ] Connection string 설정
- [ ] 통합 테스트 실행
- [ ] 성능 테스트

**Acceptance Criteria**:
- [ ] MSSQL 연결 성공
- [ ] 통합 테스트 통과
- [ ] 성능 기준 충족

---

### ✅ Task 3.2: CI/CD Integration

- [ ] GitHub Actions 워크플로우 생성
- [ ] 자동 테스트 실행 설정
- [ ] Coverage 리포팅 설정
- [ ] 배포 파이프라인 구성

**Acceptance Criteria**:
- [ ] CI/CD 파이프라인 동작
- [ ] 자동 테스트 실행
- [ ] Coverage 리포트 자동 생성

---

## 📊 Progress Tracking

### Overall Progress

```
Phase 1 (Quick Fix):        [ ] 0/6 tasks completed (0%)
Phase 2 (Configuration):    [ ] 0/7 tasks completed (0%)
Phase 3 (Production):       [ ] 0/2 tasks completed (0%)

Total:                      [ ] 0/15 tasks completed (0%)
```

### Milestones

- [ ] **Milestone 1**: Phase 1 완료 (테스트 100% 통과)
- [ ] **Milestone 2**: Phase 2 완료 (실제 DB 사용)
- [ ] **Milestone 3**: Documentation 완료
- [ ] **Milestone 4**: Git merge to main
- [ ] **Milestone 5**: v1 branch로 복귀

---

## 🎯 Quality Gates

각 Phase 완료 시 다음 기준을 충족해야 합니다:

### Phase 1 Quality Gates
- [x] 모든 테스트 통과 (100%)
- [ ] Coverage >= 70%
- [ ] 실행 시간 < 30초
- [ ] 에러 로그 없음
- [ ] 문서화 완료

### Phase 2 Quality Gates
- [ ] 실제 DB 테스트 통과
- [ ] Coverage >= 80%
- [ ] 환경 설정 문서화
- [ ] 코드 리뷰 완료
- [ ] 통합 테스트 통과

---

## 🐛 Known Issues & Blockers

### Current Blockers
- None

### Known Issues
1. ⚠️ SQLite in-memory DB는 영구 데이터 저장 불가
   - **Solution**: Phase 2에서 파일 기반 DB 사용

2. ⚠️ Mock 데이터와 실제 데이터 불일치 가능
   - **Solution**: Phase 2에서 실제 DB로 전환

3. ⚠️ MSSQL 테스트 환경 미구축
   - **Solution**: Phase 3에서 처리 (PoC에서는 불필요)

---

## 📝 Notes

### Important Reminders
- 각 Task 완료 시 [x]로 체크
- 모든 변경사항은 git commit
- 테스트 통과 후 다음 Task 진행
- 문서화는 실시간으로 업데이트

### Best Practices
- Commit 단위: 하나의 Task 당 하나의 commit
- Commit 메시지: "test: [Task 번호] 작업 내용"
- Branch: 현재 251014 사용
- Review: 각 Phase 완료 후 self-review

---

## 🔗 Related Documents

- [PRD_backend_test_fixes.md](./PRD_backend_test_fixes.md)
- [Backend Test Strategy](../testing/backend_test_strategy.md) (TBD)
- [Configuration Guide](../guides/configuration_guide.md) (TBD)

---

## ✅ Final Checklist

작업 완료 후 다음 항목을 확인하세요:

- [ ] 모든 Task 완료 ([x]로 체크)
- [ ] 모든 테스트 통과 (100%)
- [ ] Coverage 목표 달성 (>=70%)
- [ ] 문서화 완료
- [ ] Git commit & push
- [ ] Merge to main
- [ ] v1 branch로 복귀
- [ ] 작업 이력 문서화 (docs/)

---

**Last Updated**: 2025-10-20
**Next Review**: After Phase 1 completion
**Owner**: Routing ML Team
