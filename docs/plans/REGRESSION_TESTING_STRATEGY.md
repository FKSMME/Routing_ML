# Regression Testing Strategy

**Project**: Routing ML System
**Date**: 2025-10-09
**Status**: 🧪 Automated Testing Framework

---

## 📊 Overview

This document defines the comprehensive regression testing strategy integrated into the CI/CD pipeline to maintain system stability and prevent breaking changes.

### Testing Pyramid

```
                  ┌─────────────┐
                  │     E2E     │  7 tests
                  │  (Slowest)  │  ~5 min
                  └─────────────┘
                 ┌───────────────┐
                 │  Integration  │  15+ tests
                 │   (Medium)    │  ~2 min
                 └───────────────┘
               ┌─────────────────────┐
               │    Unit Tests       │  56+ tests
               │     (Fastest)       │  ~1 min
               └─────────────────────┘
```

---

## 🎯 Testing Strategy by Layer

### Layer 1: Unit Tests (Backend - 56 tests)

**Purpose**: Test individual functions and classes in isolation

**Location**: `tests/backend/`

**Categories**:
- ✅ JSON logging (11 tests)
- ✅ Audit logging (2 tests)
- ✅ Data quality (5 tests)
- ✅ Routing groups (4 tests)
- ✅ Workflow sync (4 tests)
- ✅ Database access (5 tests)
- ✅ Performance benchmarks (21 tests)
- ✅ Training CLI (4 tests)

**Execution**:
```bash
# Local
pytest tests/backend -v --tb=short

# CI/CD (in GitHub Actions)
pytest tests/backend \
  --cov=backend \
  --cov=common \
  --cov-report=xml \
  --junitxml=pytest-report.xml
```

**Quality Gates**:
- ✅ 100% pass rate required
- ✅ 70%+ code coverage required
- ⏱️ Max execution time: 2 minutes

---

### Layer 2: Component Tests (Frontend - 5+ tests)

**Purpose**: Test React components in isolation

**Location**: `frontend-prediction/src/components/__tests__/`

**Categories**:
- ✅ Navigation components
- ✅ Workspace components
- ✅ Master data components
- ✅ Routing components

**Execution**:
```bash
# Local
cd frontend-prediction
npm test -- --run

# CI/CD
npm test -- --run --coverage --reporter=junit --outputFile=vitest-report.xml
```

**Quality Gates**:
- ✅ 100% pass rate required
- ✅ 60%+ component coverage recommended
- ⏱️ Max execution time: 1 minute

---

### Layer 3: Integration Tests (API - In pipeline)

**Purpose**: Test API endpoints with database

**Location**: `tests/backend/api/`

**Categories**:
- ✅ Audit logging API
- ✅ Master data tree API
- ✅ Routing groups API
- ✅ Training service API

**Execution**:
```bash
# With test database
export JWT_SECRET_KEY="test-key"
pytest tests/backend/api -v
```

**Quality Gates**:
- ✅ All API endpoints return expected status codes
- ✅ Response schemas validated
- ⏱️ Max response time: 500ms per endpoint

---

### Layer 4: E2E Tests (Playwright - 7 specs)

**Purpose**: Test complete user workflows

**Location**: `frontend-prediction/tests/e2e/`

**Critical Workflows**:
1. **Login Flow** (`login-flow.spec.ts`)
   - User authentication
   - Session persistence
   - Logout functionality

2. **Routing Groups** (`routing-groups.spec.ts`)
   - Create/edit routing groups
   - Apply routing rules
   - Export to CSV/JSON

3. **Offline Sync** (`routing-offline-sync.spec.ts`)
   - Offline data persistence (IndexedDB)
   - Sync on reconnection
   - Conflict resolution

4. **Training Status** (`trainingStatusWorkspace.spec.tsx`)
   - View training progress
   - Monitor metrics
   - Download trained models

**Execution**:
```bash
# Local (headless)
cd frontend-prediction
npm run test:e2e

# CI/CD (with screenshots)
PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e

# Debug mode
npm run test:e2e:debug
```

**Quality Gates**:
- ✅ 100% pass rate required
- ✅ All critical user paths covered
- ⏱️ Max execution time: 5 minutes
- 📸 Screenshots captured on failure

---

## 🔄 CI/CD Pipeline Integration

### Regression Testing Workflow

```yaml
# .github/workflows/ci-cd-pipeline.yml (already created)

on:
  push:
    branches: [main, develop, feature/**, fix/**]
  pull_request:
    branches: [main, develop]

jobs:
  # Stage 1: Parallel linting & type checking
  backend-lint:          # ~30s
  frontend-lint:         # ~30s

  # Stage 2: Parallel unit tests
  backend-test:          # ~1-2min (after lint)
  frontend-test:         # ~1min (after lint)

  # Stage 3: Integration tests
  backend-integration:   # ~2min (after unit tests)

  # Stage 4: E2E tests
  frontend-e2e:          # ~5min (after all above)

  # Stage 5: Build & deploy (only on success)
  docker-build:          # ~3-5min
  deploy-staging:        # ~2min (on develop branch)
  deploy-production:     # ~2min (on main branch, manual approval)
```

### Total Pipeline Duration
- **Full run**: ~10-15 minutes
- **Fast fail**: ~30 seconds (lint errors)
- **Partial run** (PR): ~5-8 minutes (no deployment)

---

## 📋 Regression Test Checklist

### Pre-Merge Requirements (Pull Requests)

**Automated Checks** (must pass):
- [ ] Backend linting (flake8, black, isort)
- [ ] Frontend linting (ESLint)
- [ ] TypeScript type checking (0 errors)
- [ ] Backend unit tests (56/56 passing)
- [ ] Frontend component tests (5/5 passing)
- [ ] Backend code coverage (>70%)
- [ ] Security scan (no critical vulnerabilities)

**Manual Checks** (recommended):
- [ ] Code review approved
- [ ] No merge conflicts
- [ ] CHANGELOG.md updated
- [ ] Documentation updated (if API changes)

---

### Pre-Deploy Requirements (Staging)

**Automated Checks** (must pass):
- [ ] All PR checks passed
- [ ] E2E tests (7/7 Playwright specs passing)
- [ ] Docker build successful
- [ ] No breaking changes in API schema

**Manual Checks**:
- [ ] Smoke test on staging environment
- [ ] Database migration tested (if applicable)
- [ ] Environment variables verified

---

### Pre-Deploy Requirements (Production)

**Automated Checks** (must pass):
- [ ] All staging checks passed
- [ ] Production Docker images built
- [ ] Backup completed successfully

**Manual Checks** (required):
- [ ] Staging environment stable (24h+)
- [ ] Load testing completed (if major changes)
- [ ] Rollback plan documented
- [ ] On-call engineer notified
- [ ] Change approved by team lead

---

## 🧪 Test Data Management

### Test Database

**Strategy**: Isolated test database per CI job

**Setup**:
```bash
# GitHub Actions uses ephemeral SQLite
# No cleanup needed (container destroyed)

# Local development uses separate test DB
pytest tests/backend --db=sqlite:///test.db
```

**Fixtures**:
- Shared fixtures in `tests/conftest.py`
- Database seeding in `tests/backend/fixtures.py`
- Cleanup after each test (pytest-fixture cleanup)

---

### Mock Data

**External Services**:
- ✅ MSSQL database → SQLite in-memory
- ✅ Access database → Mocked file system
- ✅ SMTP server → pytest-mock
- ✅ Slack/PagerDuty → HTTP mocks

**Example**:
```python
# tests/backend/conftest.py
@pytest.fixture
def mock_smtp(monkeypatch):
    mock_send = MagicMock()
    monkeypatch.setattr('smtplib.SMTP.send_message', mock_send)
    return mock_send
```

---

## 📊 Test Metrics & Reporting

### Metrics Tracked

**Coverage Metrics**:
- Backend code coverage (target: 70%+)
- Frontend component coverage (target: 60%+)
- E2E scenario coverage (target: 100% of critical paths)

**Performance Metrics**:
- Test execution time (tracked per job)
- Flaky test detection (retry count > 1)
- Build time (total pipeline duration)

**Quality Metrics**:
- Test pass rate (target: 100%)
- Mean time to fix (MTTF) broken tests
- Regression detection rate

---

### Test Reports

**Artifacts Generated** (in CI/CD):
1. **JUnit XML Reports**
   - `pytest-report.xml` (backend)
   - `vitest-report.xml` (frontend)
   - Uploaded to CI artifacts

2. **Coverage Reports**
   - `coverage.xml` (backend)
   - `lcov.info` (frontend)
   - Uploaded to Codecov

3. **Playwright Reports**
   - `playwright-report/` (HTML)
   - Screenshots of failures
   - Video recordings (on failure)

4. **Security Reports**
   - `bandit-report.json` (backend security scan)
   - `safety-report.json` (dependency scan)

**Viewing Reports**:
```bash
# Download from GitHub Actions artifacts
gh run view <run-id> --log

# View locally
open frontend-prediction/playwright-report/index.html
```

---

## 🔍 Flaky Test Management

### Detection

**Criteria for Flaky Tests**:
- Passes in retry but failed initially
- Fails intermittently (< 95% pass rate)
- Depends on timing/external services

**Monitoring**:
```yaml
# Playwright retry configuration
retries: process.env.CI ? 2 : 0

# Pytest retry plugin
pytest --maxfail=1 --reruns 2 --reruns-delay 1
```

---

### Mitigation Strategies

**1. Add Explicit Waits**:
```typescript
// BAD: Implicit wait (flaky)
await page.click('button');
expect(page.locator('.result')).toBeVisible();

// GOOD: Explicit wait
await page.click('button');
await expect(page.locator('.result')).toBeVisible({ timeout: 10000 });
```

**2. Stabilize Selectors**:
```typescript
// BAD: CSS selector (fragile)
await page.click('.btn-primary');

// GOOD: data-testid
await page.click('[data-testid="submit-btn"]');
```

**3. Isolate External Dependencies**:
```python
# Mock external API calls
@pytest.fixture
def mock_api(monkeypatch):
    monkeypatch.setattr('requests.post', lambda *args, **kwargs: MockResponse())
```

---

## 🚨 Regression Alert Protocol

### Alert Triggers

**Critical (Pipeline Failed)**:
- Backend tests failing
- E2E tests failing
- Security scan detected critical vulnerabilities
- Build failed

**Action**: Block merge, notify author immediately

---

**Warning (Quality Gates Not Met)**:
- Code coverage dropped below 70%
- New flaky test detected
- Build time increased >20%

**Action**: Create issue, schedule fix

---

### Notification Channels

**GitHub Actions**:
- ❌ Failed status on PR
- 📧 Email to commit author
- 💬 Comment on PR with failure details

**Slack** (optional):
```yaml
# Add to .github/workflows/ci-cd-pipeline.yml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚨 Regression test failed: ${{ github.event.pull_request.html_url }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 📅 Test Maintenance Schedule

### Daily
- [ ] Monitor CI/CD pipeline health
- [ ] Review failed test reports
- [ ] Fix broken tests immediately

### Weekly
- [ ] Review flaky test metrics
- [ ] Update test data/fixtures
- [ ] Check code coverage trends

### Monthly
- [ ] Audit test suite completeness
- [ ] Remove obsolete tests
- [ ] Update Playwright/Vitest versions
- [ ] Review test execution time (optimize slow tests)

### Quarterly
- [ ] Comprehensive E2E scenario review
- [ ] Load testing (if needed)
- [ ] Test infrastructure upgrade
- [ ] Security test update

---

## 🎓 Best Practices

### Writing Good Regression Tests

**1. Test Behavior, Not Implementation**:
```python
# BAD: Testing implementation details
def test_calculate_total_uses_sum():
    assert calculator._sum_method_called == True

# GOOD: Testing behavior
def test_calculate_total_returns_correct_value():
    assert calculator.calculate_total([1, 2, 3]) == 6
```

**2. Use Descriptive Test Names**:
```python
# BAD
def test_1():
    ...

# GOOD
def test_audit_batch_persists_events_to_log_file():
    ...
```

**3. Arrange-Act-Assert Pattern**:
```python
def test_user_login():
    # Arrange
    user = create_test_user(username="test", password="pass")

    # Act
    result = login(username="test", password="pass")

    # Assert
    assert result.success == True
    assert result.user_id == user.id
```

**4. Independent Tests** (no shared state):
```python
# BAD: Tests depend on execution order
def test_create_user():
    global user_id
    user_id = create_user()

def test_update_user():
    update_user(user_id)  # Fails if run alone!

# GOOD: Self-contained
@pytest.fixture
def user():
    return create_user()

def test_update_user(user):
    update_user(user.id)
```

---

## 🔗 Related Documents

- [FRONTEND_TESTING_GUIDE.md](./FRONTEND_TESTING_GUIDE.md) - Frontend test details
- [CI_CD_PIPELINE.md](./.github/workflows/ci-cd-pipeline.yml) - Pipeline configuration
- [WORK_LOG_2025-10-09_FINAL_COMPLETION.md](./WORK_LOG_2025-10-09_FINAL_COMPLETION.md)

---

## ✅ Success Criteria

**Regression testing is successful when**:
- ✅ Pipeline executes <15 minutes
- ✅ 100% test pass rate on main branch
- ✅ 95%+ test pass rate on feature branches
- ✅ <5% flaky test rate
- ✅ Critical bugs caught before production
- ✅ Zero production incidents from untested code

---

**Status**: ✅ Fully Automated & Integrated
**Maintenance**: Ongoing, monitored daily
**Next Review**: Monthly test audit
