# PRD: Backend Test Environment Fix

**Document Type**: Product Requirements Document
**Project**: Routing ML Backend Test Environment
**Version**: 1.0.0
**Date**: 2025-10-20
**Author**: Routing ML Team
**Status**: In Progress

---

## 1. Executive Summary

### 1.1 Problem Statement

백엔드 테스트 실행 시 SQLite 파일을 강제로 열도록 설계된 `auth_service` 초기화로 인해 테스트가 실패합니다. 현재 시스템은 프로덕션 환경에서 MSSQL을 사용하지만, 테스트 환경에서는 SQLite 의존성으로 인해 테스트 격리가 불가능한 상태입니다.

### 1.2 Objectives

- ✅ 백엔드 테스트 환경 정상화
- ✅ SQLite/MSSQL 데이터베이스 전환 가능한 구조 구현
- ✅ 테스트 격리 및 자동화 지원
- ✅ PoC 단계에 적합한 테스트 전략 수립

### 1.3 Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Test Pass Rate | 100% | ~40% | 🔴 |
| Test Isolation | Complete | None | 🔴 |
| DB Flexibility | SQLite + MSSQL | SQLite only | 🔴 |
| Documentation | Complete | Partial | 🟡 |

---

## 2. Background

### 2.1 Current Architecture

```
backend/
├── api/
│   ├── app.py              # FastAPI 애플리케이션
│   └── routes/             # API 엔드포인트
├── services/
│   └── auth_service.py     # 인증 서비스 (SQLite 하드코딩)
└── tests/
    └── test_*.py           # 테스트 파일들
```

### 2.2 Current Issues

1. **Hard-coded SQLite Dependency**
   - `auth_service` 초기화 시 SQLite 파일 경로 강제
   - 테스트 환경과 프로덕션 환경 분리 불가

2. **Test Failure Root Cause**
   ```
   Error: SQLite database file not found or access denied
   Location: backend/services/auth_service.py
   Impact: 60% of tests failing
   ```

3. **Database Configuration**
   - 프로덕션: MSSQL (SQL Server)
   - 테스트: SQLite (하드코딩)
   - 불일치로 인한 테스트 신뢰도 저하

### 2.3 Stakeholders

- **Development Team**: 안정적인 테스트 환경 필요
- **QA Team**: 자동화된 테스트 실행
- **DevOps**: CI/CD 파이프라인 구축

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Database Abstraction Layer
- [ ] 환경 변수 기반 데이터베이스 선택
- [ ] SQLite와 MSSQL 모두 지원
- [ ] 테스트 환경 자동 감지

#### FR-2: Auth Service Refactoring
- [ ] 데이터베이스 의존성 주입 패턴 적용
- [ ] 설정 파일 기반 초기화
- [ ] Mock/Stub 지원

#### FR-3: Test Configuration
- [ ] 테스트 전용 데이터베이스 설정
- [ ] 테스트 격리 (각 테스트마다 clean state)
- [ ] Fixture 및 Factory 패턴 적용

#### FR-4: Environment-specific Configuration
- [ ] `.env.test` 파일 생성
- [ ] `pytest.ini` 설정
- [ ] 환경별 데이터베이스 URL 관리

### 3.2 Non-Functional Requirements

#### NFR-1: Performance
- 테스트 실행 시간 < 30초 (전체 테스트 스위트)
- 단일 테스트 < 1초

#### NFR-2: Maintainability
- 명확한 설정 파일 구조
- 환경별 설정 분리
- 문서화 완비

#### NFR-3: Reliability
- 테스트 성공률 100%
- 테스트 격리 보장
- Flaky test 제로

#### NFR-4: Compatibility
- Python 3.12+ 지원
- SQLite 3.x 지원
- MSSQL Server 2019+ 지원

---

## 4. Proposed Solution

### 4.1 Solution Overview

**Option 1: Database Abstraction with Dependency Injection (Recommended)**

```python
# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

def get_database_url():
    """환경에 따라 데이터베이스 URL 반환"""
    if os.getenv("TESTING"):
        return "sqlite:///./test.db"
    else:
        return os.getenv("DATABASE_URL")

engine = create_engine(get_database_url())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Option 2: Configuration-based Approach**

```python
# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    testing: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```

**Option 3: Mock Database for PoC (Quick Fix)**

```python
# conftest.py
import pytest
from unittest.mock import MagicMock

@pytest.fixture(autouse=True)
def mock_auth_service(monkeypatch):
    """테스트 시 auth_service를 모킹"""
    mock = MagicMock()
    monkeypatch.setattr("backend.services.auth_service", mock)
    return mock
```

### 4.2 Recommended Approach

**Hybrid Solution for PoC Stage**:
1. **Short-term**: Option 3 (Mock) - 즉시 테스트 통과
2. **Mid-term**: Option 2 (Config) - 환경별 설정 분리
3. **Long-term**: Option 1 (DI) - 완전한 추상화

---

## 5. Implementation Plan

### 5.1 Phase 1: Quick Fix (PoC Stage) ✅ Priority 1

**Duration**: 1-2 hours
**Goal**: 테스트 즉시 통과

#### Tasks:
- [ ] Create `conftest.py` with mock fixtures
- [ ] Mock `auth_service` initialization
- [ ] Disable SQLite dependency in tests
- [ ] Run tests and verify pass rate

#### Acceptance Criteria:
- ✅ All tests pass
- ✅ No SQLite errors
- ✅ Test execution < 30 seconds

### 5.2 Phase 2: Configuration-based Approach ✅ Priority 2

**Duration**: 2-4 hours
**Goal**: 환경별 설정 분리

#### Tasks:
- [ ] Create `.env.test` file
- [ ] Update `backend/database.py` with env detection
- [ ] Refactor `auth_service.py` to use config
- [ ] Create test database fixtures
- [ ] Update documentation

#### Acceptance Criteria:
- ✅ Environment-specific database URLs
- ✅ Tests use SQLite, production uses MSSQL
- ✅ Configuration documented

### 5.3 Phase 3: Full Abstraction (Future) ⏭️ Priority 3

**Duration**: 1 day
**Goal**: Production-ready architecture

#### Tasks:
- [ ] Implement repository pattern
- [ ] Add dependency injection
- [ ] Create database migration strategy
- [ ] Add integration tests with MSSQL
- [ ] Performance optimization

---

## 6. Task Breakdown

### 6.1 Immediate Actions (Phase 1)

#### Task 1.1: Create Mock Configuration
```markdown
- [ ] Create `backend/tests/conftest.py`
- [ ] Add `mock_auth_service` fixture
- [ ] Add `mock_database` fixture
- [ ] Configure pytest.ini
```

#### Task 1.2: Update Test Files
```markdown
- [ ] Review all test files using auth_service
- [ ] Update imports to use fixtures
- [ ] Remove direct SQLite references
- [ ] Add docstrings
```

#### Task 1.3: Verify Tests
```markdown
- [ ] Run `pytest backend/tests/ -v`
- [ ] Check pass rate (target: 100%)
- [ ] Fix any remaining failures
- [ ] Generate coverage report
```

### 6.2 Mid-term Actions (Phase 2)

#### Task 2.1: Environment Configuration
```markdown
- [ ] Create `.env.test` with SQLite URL
- [ ] Create `.env.example` template
- [ ] Update `.gitignore` for .env files
- [ ] Document environment variables
```

#### Task 2.2: Database Abstraction
```markdown
- [ ] Update `backend/database.py`
- [ ] Add `get_database_url()` function
- [ ] Add environment detection
- [ ] Create test fixtures
```

#### Task 2.3: Auth Service Refactoring
```markdown
- [ ] Remove hard-coded SQLite path
- [ ] Use dependency injection for database
- [ ] Add configuration validation
- [ ] Update unit tests
```

---

## 7. Risk Assessment

### 7.1 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Mock 데이터와 실제 데이터 불일치 | Medium | High | Phase 2에서 실제 DB 사용 |
| 테스트 커버리지 감소 | Low | Medium | Coverage 도구로 모니터링 |
| 환경 설정 오류 | Medium | Low | 명확한 문서화 |
| MSSQL 테스트 복잡도 | High | Medium | PoC에서는 SQLite 사용 |

### 7.2 Dependencies

- Python 3.12+
- pytest 7.x+
- SQLAlchemy 2.x+
- pytest-mock (mocking)
- python-dotenv (환경 변수)

---

## 8. Testing Strategy

### 8.1 Test Levels

1. **Unit Tests** (Phase 1)
   - Mock 데이터베이스
   - 개별 함수/메서드 테스트
   - 빠른 실행 (< 10초)

2. **Integration Tests** (Phase 2)
   - 실제 SQLite 데이터베이스
   - API 엔드포인트 테스트
   - 중간 속도 (< 30초)

3. **E2E Tests** (Future)
   - MSSQL 데이터베이스
   - 전체 워크플로우 테스트
   - 느린 실행 (< 5분)

### 8.2 Test Coverage Target

- **Phase 1**: > 70% (with mocks)
- **Phase 2**: > 80% (with real DB)
- **Production**: > 90% (full coverage)

---

## 9. Documentation Requirements

### 9.1 Required Documents

- [ ] **Technical Design Document** (TDD)
  - Architecture diagrams
  - Database schema
  - API specifications

- [ ] **Test Strategy Document**
  - Test levels
  - Coverage requirements
  - CI/CD integration

- [ ] **Configuration Guide**
  - Environment setup
  - Database configuration
  - Troubleshooting

- [ ] **Developer Onboarding**
  - Quick start guide
  - Running tests locally
  - Common issues

---

## 10. Timeline

```
Week 1 (Oct 20-21):
├── Phase 1: Quick Fix (Mock)     [2 hours]
├── Testing & Validation          [1 hour]
└── Documentation                 [1 hour]

Week 2 (Oct 22-24):
├── Phase 2: Configuration        [4 hours]
├── Integration Testing           [2 hours]
└── Documentation Update          [2 hours]

Future:
└── Phase 3: Full Abstraction     [1 day]
```

---

## 11. Approval & Sign-off

### 11.1 Stakeholders

| Name | Role | Status |
|------|------|--------|
| Routing ML Team | Development | ✅ Approved |
| QA Team | Testing | Pending |
| DevOps | Deployment | Pending |

### 11.2 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-20 | Adopt Hybrid Approach | PoC 단계에 적합 |
| 2025-10-20 | Use Mock for Phase 1 | 빠른 테스트 통과 |
| 2025-10-20 | SQLite for testing | MSSQL 불필요 |

---

## 12. Appendix

### 12.1 References

- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)

### 12.2 Glossary

- **PoC**: Proof of Concept
- **DI**: Dependency Injection
- **E2E**: End-to-End
- **CI/CD**: Continuous Integration/Continuous Deployment

---

**Document Status**: Draft → **In Progress** → Review → Approved
**Next Review**: 2025-10-21
**Owner**: Routing ML Team
