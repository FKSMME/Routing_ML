# Backend Test Failure Analysis

**Date**: 2025-10-20
**Analyzer**: Routing ML Team
**Status**: Completed
**Related**: PRD_backend_test_fixes.md, TASKLIST_backend_test_fixes.md

---

## Executive Summary

백엔드 테스트 실패의 근본 원인은 `backend/api/services/auth_service.py`에서 모듈 import 시 즉시 `AuthService` 인스턴스를 생성하여 SQLite 데이터베이스 파일을 강제로 열도록 설계되어 있기 때문입니다.

### Key Findings

- **Root Cause**: Module-level instantiation in `auth_service.py:439`
- **Error Type**: `sqlite3.OperationalError: unable to open database file`
- **Impact**: 100% of auth-related tests fail to collect
- **Severity**: 🔴 Critical - Blocks all testing

---

## Detailed Analysis

### 1. Error Stack Trace

```python
# Error Location Chain:
tests/test_auth_service.py:14
    from backend.api.services.auth_service import AuthService

backend/api/services/auth_service.py:439
    auth_service = AuthService()  # ❌ Module-level instantiation

backend/api/services/auth_service.py:50
    bootstrap_schema()  # Called in __init__

backend/database_rsl.py:230
    Base.metadata.create_all(engine)  # Tries to create tables

# Final Error:
sqlite3.OperationalError: unable to open database file
```

### 2. Problem Code

#### File: `backend/api/services/auth_service.py`

**Line 439** (Module Level):
```python
# ❌ PROBLEM: Global instantiation
auth_service = AuthService()
```

**Line 50** (`__init__` method):
```python
class AuthService:
    def __init__(self, db_path: str = "data/rsl_users.db"):  # ❌ Hard-coded path
        self.db_path = db_path
        self.engine = create_engine(f"sqlite:///{db_path}")
        bootstrap_schema()  # ❌ Immediate DB access
```

#### File: `backend/database_rsl.py`

**Line 230**:
```python
def bootstrap_schema():
    Base.metadata.create_all(engine)  # ❌ Requires existing DB
```

### 3. Why Tests Fail

1. **Import Time Execution**:
   ```python
   # Test file attempts import:
   from backend.api.services.auth_service import AuthService

   # This immediately triggers:
   auth_service = AuthService()  # Module-level

   # Which calls:
   __init__() → bootstrap_schema() → create_all()

   # Which requires:
   data/rsl_users.db file to exist
   ```

2. **Missing Database File**:
   - Test environment doesn't have `data/rsl_users.db`
   - No mechanism to create it for tests
   - Hard-coded path prevents mocking

3. **No Dependency Injection**:
   - Can't pass mock database
   - Can't configure for test environment
   - Can't skip schema bootstrap

---

## Affected Test Files

### Critical (Cannot Collect)

These tests fail immediately at import time:

1. **tests/test_auth_service.py**
   ```python
   from backend.api.services.auth_service import AuthService  # ❌ Fails here
   ```

2. **Any test importing auth-related routes**
   ```python
   from backend.api.routes.auth import router  # ❌ Imports auth_service
   ```

### Potentially Affected

Tests that may use auth but haven't been run yet:

- `tests/backend/api/test_routing_interface.py`
- `tests/backend/api/test_audit_logging.py`
- `tests/backend/api/test_master_data_tree.py`

---

## Impact Assessment

### Current State

| Metric | Value | Status |
|--------|-------|--------|
| Test Collection | ❌ 0 items | FAIL |
| Test Execution | ❌ Cannot run | BLOCKED |
| Coverage | ❌ 0% | UNKNOWN |
| CI/CD | ❌ Blocked | BROKEN |

### Business Impact

- 🔴 **Development**: Developers cannot verify their changes
- 🔴 **QA**: No automated testing possible
- 🔴 **Deployment**: Cannot deploy with confidence
- 🔴 **Maintenance**: Regression testing blocked

---

## Root Cause Analysis (5 Whys)

**Problem**: Backend tests fail to run

1. **Why?** Because test collection fails with SQLite error
2. **Why?** Because `auth_service` tries to open database at import time
3. **Why?** Because module-level instantiation (`auth_service = AuthService()`)
4. **Why?** Because singleton pattern implemented at module level
5. **Why?** Because no dependency injection or configuration management

**Root Cause**: **Lack of separation between module import and resource initialization**

---

## Proposed Solutions

### Solution 1: Remove Module-Level Instantiation (Recommended)

**Change**:
```python
# backend/api/services/auth_service.py

# ❌ Before (Line 439):
auth_service = AuthService()

# ✅ After:
def get_auth_service() -> AuthService:
    """Factory function for dependency injection"""
    if os.getenv("TESTING") == "true":
        return MockAuthService()
    return AuthService()

auth_service = None  # Lazy initialization
```

**Pros**:
- ✅ Allows test environment detection
- ✅ Enables dependency injection
- ✅ Production code unchanged

**Cons**:
- ⚠️ Requires refactoring all imports
- ⚠️ Need to update routes to use factory

### Solution 2: Mock at Test Level (Quick Fix) ⭐ SELECTED

**Change**:
```python
# tests/conftest.py

import pytest
from unittest.mock import MagicMock

@pytest.fixture(autouse=True)
def mock_auth_service(monkeypatch):
    """Mock auth_service before any imports"""
    mock = MagicMock()
    mock.get_current_user.return_value = {"username": "test"}

    # Prevent module-level instantiation
    monkeypatch.setattr(
        "backend.api.services.auth_service.AuthService",
        lambda: mock
    )
    return mock
```

**Pros**:
- ✅ No production code changes
- ✅ Tests can run immediately
- ✅ Easy to implement

**Cons**:
- ⚠️ Doesn't test real auth logic
- ⚠️ Mock may diverge from reality

### Solution 3: Configuration-based Initialization (Long-term)

**Change**:
```python
# backend/config.py
class Settings(BaseSettings):
    database_url: str = "sqlite:///data/rsl_users.db"
    testing: bool = False

# backend/api/services/auth_service.py
from backend.config import settings

class AuthService:
    def __init__(self):
        if settings.testing:
            self.engine = create_engine("sqlite:///:memory:")
        else:
            self.engine = create_engine(settings.database_url)
```

**Pros**:
- ✅ Clean separation of concerns
- ✅ Environment-based configuration
- ✅ Real DB testing possible

**Cons**:
- ⚠️ Medium refactoring effort
- ⚠️ Requires .env file management

---

## Implementation Plan

### Phase 1: Quick Fix (SELECTED)

**Duration**: 1-2 hours

**Steps**:
1. [ ] Create `tests/conftest.py`
2. [ ] Add `mock_auth_service` fixture
3. [ ] Configure `autouse=True` to mock before imports
4. [ ] Test with `pytest tests/test_auth_service.py -v`

**Expected Outcome**:
- ✅ Tests collect successfully
- ✅ Tests execute (may fail on assertions)
- ✅ No SQLite errors

### Phase 2: Configuration Migration

**Duration**: 2-4 hours

**Steps**:
1. [ ] Implement `backend/config.py`
2. [ ] Update `auth_service.py` to use config
3. [ ] Create `.env.test` file
4. [ ] Update tests to use real DB

### Phase 3: Dependency Injection

**Duration**: 1 day

**Steps**:
1. [ ] Refactor to factory pattern
2. [ ] Update all route dependencies
3. [ ] Add integration tests

---

## Test Execution Results

### Before Fix

```bash
$ pytest tests/test_auth_service.py -v

============================= test session starts =============================
collected 0 items / 1 error

=================================== ERRORS ====================================
_________________ ERROR collecting tests/test_auth_service.py _________________
sqlite3.OperationalError: unable to open database file

============================ no tests ran in 0.02s ============================
```

**Result**: 🔴 FAIL

### After Fix (Expected)

```bash
$ pytest tests/test_auth_service.py -v

============================= test session starts =============================
collected 5 items

tests/test_auth_service.py::test_create_user PASSED                     [ 20%]
tests/test_auth_service.py::test_authenticate PASSED                    [ 40%]
tests/test_auth_service.py::test_get_user PASSED                        [ 60%]
tests/test_auth_service.py::test_update_user PASSED                     [ 80%]
tests/test_auth_service.py::test_delete_user PASSED                     [100%]

========================== 5 passed in 0.45s ==============================
```

**Result**: 🟢 PASS

---

## Recommendations

### Immediate Actions

1. ✅ **Implement Solution 2** (Mock-based quick fix)
   - Timeline: Today
   - Owner: Development Team
   - Priority: P0

2. ✅ **Document workaround**
   - Timeline: Today
   - Owner: Documentation Team
   - Priority: P1

### Short-term Actions

3. ⏭️ **Plan Phase 2 refactoring**
   - Timeline: Next sprint
   - Owner: Tech Lead
   - Priority: P2

4. ⏭️ **Review other services**
   - Check for similar patterns
   - Timeline: This week
   - Priority: P2

### Long-term Actions

5. 🔮 **Establish architecture guidelines**
   - No module-level side effects
   - Always use dependency injection
   - Timeline: Q4 2025

6. 🔮 **CI/CD integration**
   - Automated test runs
   - Coverage reporting
   - Timeline: Q4 2025

---

## Lessons Learned

### What Went Wrong

1. **Module-level side effects**: Resource initialization at import time
2. **Hard-coded paths**: No configuration management
3. **Tight coupling**: Direct dependency on SQLite
4. **No test strategy**: Tests written after implementation

### Best Practices to Adopt

1. ✅ **Lazy initialization**: Initialize resources when needed, not at import
2. ✅ **Dependency injection**: Pass dependencies explicitly
3. ✅ **Configuration management**: Use environment-specific configs
4. ✅ **Test-first**: Write tests before implementation

### Prevention

- [ ] Code review checklist item: "No module-level instantiation"
- [ ] Linter rule: Detect module-level side effects
- [ ] Architecture review: Before implementing new services

---

## Appendix

### A. Files Requiring Changes

**Phase 1** (Mock):
- `tests/conftest.py` (new)
- `pytest.ini` (update)

**Phase 2** (Config):
- `backend/config.py` (update)
- `backend/api/services/auth_service.py` (refactor)
- `.env.test` (new)

**Phase 3** (DI):
- All route files importing `auth_service`
- `backend/dependencies.py` (new)

### B. Related Issues

- Similar pattern may exist in other services
- Need to audit all `backend/api/services/*.py`

### C. Testing Checklist

- [ ] Unit tests for `AuthService`
- [ ] Integration tests with SQLite
- [ ] Integration tests with MSSQL (future)
- [ ] Mock tests for API routes
- [ ] E2E tests for auth flow

---

**Analysis Completed**: 2025-10-20
**Next Steps**: Proceed to Task 1.2 (Create conftest.py)
**Status**: ✅ Task 1.1 Complete
