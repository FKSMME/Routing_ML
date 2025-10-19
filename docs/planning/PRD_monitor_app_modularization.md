# PRD: Monitor Application Modularization

**Document Version**: 1.0.0
**Date**: 2025-10-20
**Author**: Routing ML Team
**Status**: Draft
**Priority**: High (Priority 5 from Project Review)

---

## 📋 Executive Summary

### Problem Statement

현재 `scripts/server_monitor_dashboard_v5_1.py` 파일이 1,707 라인의 단일 파일로 구성되어 있어 다음과 같은 문제가 발생합니다:

1. **유지보수 어려움**: 모든 기능이 한 파일에 있어 수정 시 영향 범위 파악 어려움
2. **테스트 불가능**: 단일 파일 구조로 인한 unit test 작성 어려움
3. **재사용 불가**: API 클라이언트, 서비스 체커 등 재사용 가능한 코드가 분리되지 않음
4. **가독성 저하**: 1,700+ 라인을 스크롤하며 코드 이해 필요
5. **협업 어려움**: 여러 개발자가 동시에 작업하기 어려움

### Proposed Solution

모니터 앱을 논리적 모듈로 분리하여 유지보수성과 테스트 가능성을 향상시킵니다.

### Success Metrics

- ✅ 모듈 수: 7-8개의 독립적인 모듈
- ✅ 파일당 라인 수: 평균 200-300 lines
- ✅ 테스트 커버리지: 주요 로직 70% 이상
- ✅ Import 시간: 기존 대비 20% 이상 단축

---

## 🎯 Current Architecture

### File Structure (Before)

```
scripts/
└── server_monitor_dashboard_v5_1.py  (1,707 lines)
    ├── Color System (lines 42-82)
    ├── Utility Functions (lines 83-97)
    ├── ApiError (lines 99-100)
    ├── ApiClient (lines 103-207)
    ├── Service dataclass (lines 214-271)
    ├── check_service() (lines 273-305)
    ├── CompactServiceCard (lines 311-427)
    ├── WorkflowCanvas (lines 433-571)
    ├── CompactChart (lines 577-651)
    ├── RoutingMLDashboard (lines 657-1691)
    └── main() (lines 1697-1707)
```

### Class Analysis

| Class | Lines | Responsibility | Dependencies |
|-------|-------|----------------|--------------|
| ApiClient | ~100 | API communication | urllib, ssl, json |
| Service | ~60 | Service definition | dataclass |
| check_service | ~30 | Service health check | socket, urllib |
| CompactServiceCard | ~120 | UI card component | tkinter |
| WorkflowCanvas | ~140 | Workflow visualization | tkinter |
| CompactChart | ~80 | Performance chart | tkinter |
| RoutingMLDashboard | ~1,000 | Main application | All above |

---

## 🔧 Proposed Architecture

### New Module Structure

```
scripts/
├── monitor/
│   ├── __init__.py
│   ├── config.py              # Configuration & constants
│   ├── models.py              # Data models (Service, etc.)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── client.py          # ApiClient
│   │   └── errors.py          # ApiError, exceptions
│   ├── services/
│   │   ├── __init__.py
│   │   └── checker.py         # check_service()
│   ├── ui/
│   │   ├── __init__.py
│   │   ├── colors.py          # Color system
│   │   ├── components/
│   │   │   ├── __init__.py
│   │   │   ├── service_card.py   # CompactServiceCard
│   │   │   ├── workflow_canvas.py # WorkflowCanvas
│   │   │   └── chart.py          # CompactChart
│   │   └── dashboard.py       # RoutingMLDashboard
│   └── utils.py               # Utility functions
│
├── server_monitor_v6.py       # New entry point
└── server_monitor_dashboard_v5_1.py  # Keep for reference
```

### Module Responsibilities

#### 1. `monitor/config.py`
```python
"""Configuration and constants"""
- Color definitions
- API endpoints
- Environment variables
- Default settings
```

#### 2. `monitor/models.py`
```python
"""Data models"""
- Service dataclass
- ServiceStatus enum
- Configuration models
```

#### 3. `monitor/api/client.py`
```python
"""API communication"""
- ApiClient class
- HTTP request methods
- Authentication handling
```

#### 4. `monitor/api/errors.py`
```python
"""Custom exceptions"""
- ApiError
- NetworkError
- AuthenticationError
```

#### 5. `monitor/services/checker.py`
```python
"""Service health checking"""
- check_service() function
- Port checking
- HTTP endpoint testing
```

#### 6. `monitor/ui/colors.py`
```python
"""UI color system"""
- Color constants
- blend_color() utility
```

#### 7. `monitor/ui/components/service_card.py`
```python
"""Service status card UI"""
- CompactServiceCard class
```

#### 8. `monitor/ui/components/workflow_canvas.py`
```python
"""Workflow visualization"""
- WorkflowCanvas class
```

#### 9. `monitor/ui/components/chart.py`
```python
"""Performance charts"""
- CompactChart class
```

#### 10. `monitor/ui/dashboard.py`
```python
"""Main dashboard"""
- RoutingMLDashboard class
```

#### 11. `monitor/utils.py`
```python
"""Utility functions"""
- Helper functions
- Common utilities
```

#### 12. `server_monitor_v6.py`
```python
"""Entry point"""
- main() function
- Minimal orchestration
```

---

## 📐 Implementation Plan

### Phase 1: Create Module Structure (Priority: High)

**Goal**: 기본 디렉토리 구조 생성 및 설정 파일 분리

**Tasks**:
1. ✅ Create directory structure
2. ✅ Extract config.py (colors, constants)
3. ✅ Extract models.py (Service dataclass)
4. ✅ Create __init__.py files
5. ✅ Test imports

**Estimated Time**: 30 minutes

### Phase 2: Extract API & Service Logic (Priority: High)

**Goal**: API 클라이언트와 서비스 체커 분리

**Tasks**:
1. ✅ Extract ApiClient to monitor/api/client.py
2. ✅ Extract ApiError to monitor/api/errors.py
3. ✅ Extract check_service to monitor/services/checker.py
4. ✅ Update imports
5. ✅ Test API functionality

**Estimated Time**: 45 minutes

### Phase 3: Extract UI Components (Priority: Medium)

**Goal**: UI 컴포넌트들을 개별 모듈로 분리

**Tasks**:
1. ✅ Extract color system to monitor/ui/colors.py
2. ✅ Extract CompactServiceCard
3. ✅ Extract WorkflowCanvas
4. ✅ Extract CompactChart
5. ✅ Update imports in dashboard
6. ✅ Test UI rendering

**Estimated Time**: 1 hour

### Phase 4: Refactor Main Dashboard (Priority: Medium)

**Goal**: 메인 대시보드를 깔끔한 orchestrator로 정리

**Tasks**:
1. ✅ Move RoutingMLDashboard to monitor/ui/dashboard.py
2. ✅ Clean up dependencies
3. ✅ Create new entry point (server_monitor_v6.py)
4. ✅ Update batch scripts
5. ✅ Test full application

**Estimated Time**: 45 minutes

### Phase 5: Testing & Documentation (Priority: Low)

**Goal**: 테스트 작성 및 문서화

**Tasks**:
1. ⏭️ Write unit tests for ApiClient
2. ⏭️ Write unit tests for check_service
3. ⏭️ Update README
4. ⏭️ Add docstrings
5. ⏭️ Create migration guide

**Estimated Time**: 1.5 hours

---

## 🧪 Technical Design

### Import Strategy

**Before** (Single File):
```python
# Everything in one file, no imports needed
class ApiClient:
    ...

class RoutingMLDashboard:
    def __init__(self):
        self.api = ApiClient()
```

**After** (Modular):
```python
# server_monitor_v6.py
from monitor.ui.dashboard import RoutingMLDashboard

def main():
    app = RoutingMLDashboard()
    app.mainloop()

# monitor/ui/dashboard.py
from monitor.api.client import ApiClient
from monitor.ui.components.service_card import CompactServiceCard

class RoutingMLDashboard:
    def __init__(self):
        self.api = ApiClient()
```

### Dependency Graph

```
server_monitor_v6.py
    └── monitor.ui.dashboard
        ├── monitor.api.client
        │   └── monitor.api.errors
        ├── monitor.services.checker
        │   └── monitor.models
        ├── monitor.ui.components.service_card
        │   └── monitor.ui.colors
        ├── monitor.ui.components.workflow_canvas
        │   └── monitor.ui.colors
        └── monitor.ui.components.chart
            └── monitor.ui.colors
```

### Configuration Example

```python
# monitor/config.py
import os

# API Configuration
API_BASE_URL = os.getenv("ROUTING_ML_API_URL", "https://localhost:8000")
API_TIMEOUT = float(os.getenv("MONITOR_API_TIMEOUT", "8"))
USER_AGENT = "RoutingML-Monitor/6.0"

# UI Configuration
POLL_INTERVAL_SECONDS = 5.0
PERFORMANCE_HISTORY_SIZE = 60

# Color System
BG_PRIMARY = "#0d1117"
BG_SECONDARY = "#161b22"
ACCENT_PRIMARY = "#2188ff"
# ... more colors
```

---

## ⚠️ Risk Assessment

### Risk 1: Breaking Existing Functionality

**Probability**: Medium
**Impact**: High
**Mitigation**:
- Keep v5_1 file as reference
- Incremental refactoring
- Test after each phase
- Side-by-side comparison

### Risk 2: Import Circular Dependencies

**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Clear dependency hierarchy
- Use dependency injection
- Avoid cross-module imports at module level

### Risk 3: Performance Degradation

**Probability**: Low
**Impact**: Low
**Mitigation**:
- Profile import time
- Lazy loading for heavy modules
- Benchmark before/after

### Risk 4: PyInstaller Compatibility

**Probability**: Medium
**Impact**: High
**Mitigation**:
- Test PyInstaller build after each phase
- Update hidden imports list
- Verify all modules bundled correctly

---

## 📊 Success Metrics

### Quantitative Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Lines per file | 1,707 | <300 | Line count |
| Number of modules | 1 | 7-8 | File count |
| Testable components | 0 | 5+ | Unit test count |
| Import time | ~500ms | <400ms | timeit |
| Cyclomatic complexity | High | Medium | radon |

### Qualitative Metrics

- ✅ Code is easier to navigate
- ✅ Individual components can be tested
- ✅ Clear separation of concerns
- ✅ Documentation is clear
- ✅ New developers can contribute faster

---

## 🔗 Related Documents

- [Project Review 2025-10-20](../reports/2025-10-20-0740-routing-ml-project-review.md)
- Monitor App User Guide (TBD)
- Testing Strategy (TBD)

---

## 📝 Migration Path

### For Developers

**Old way**:
```bash
python scripts/server_monitor_dashboard_v5_1.py
```

**New way**:
```bash
python scripts/server_monitor_v6.py
```

### For PyInstaller Build

**Old spec**:
```python
# RoutingMLMonitor_v5.2.4.spec
a = Analysis(
    ['scripts/server_monitor_dashboard_v5_1.py'],
    ...
)
```

**New spec**:
```python
# RoutingMLMonitor_v6.0.0.spec
a = Analysis(
    ['scripts/server_monitor_v6.py'],
    hiddenimports=['monitor', 'monitor.api', 'monitor.ui', ...],
    ...
)
```

---

## 📦 Rollback Plan

If modularization fails:
1. Keep `server_monitor_dashboard_v5_1.py` unchanged
2. Can revert to v5.1 anytime
3. Git revert commits
4. Restore batch scripts

Time to rollback: < 5 minutes

---

**Document Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 - Create Module Structure
**Approver**: Routing ML Team
**Last Updated**: 2025-10-20
