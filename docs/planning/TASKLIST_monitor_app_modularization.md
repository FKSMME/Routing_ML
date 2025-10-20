# Tasklist: Monitor App Modularization

**Project**: Monitor App Refactoring
**Version**: 6.0.0
**Date**: 2025-10-20
**Status**: In Progress
**Owner**: Routing ML Team

---

## 📋 Overview

server_monitor_dashboard_v5_1.py (1,707 lines)를 논리적 모듈로 분리

---

## ✅ Phase 1: Directory Structure Setup

- [x] Create monitor/ directory structure
- [x] Create monitor/api/ directory
- [x] Create monitor/services/ directory
- [x] Create monitor/ui/components/ directory
- [x] Create monitor/__init__.py
- [x] Extract config.py (colors, constants)
- [x] Extract models.py (Service dataclass, SERVICES)

**Status**: 100% Complete ✓

---

## ✅ Phase 2: Extract API & Services

- [x] Extract ApiClient to monitor/api/client.py (lines 103-207)
- [x] Extract ApiError to monitor/api/errors.py (lines 99-100)
- [x] Create monitor/api/__init__.py
- [x] Extract check_service to monitor/services/checker.py (lines 273-305)
- [x] Create monitor/services/__init__.py
- [x] Test API functionality

**Status**: 100% Complete ✓

---

## ✅ Phase 3: Extract UI Components

- [x] Extract color system to monitor/config.py (already in config)
- [x] Extract blend_color to monitor/utils.py (lines 83-97)
- [x] Extract CompactServiceCard to monitor/ui/components/service_card.py (lines 311-427)
- [x] Extract WorkflowCanvas to monitor/ui/components/workflow_canvas.py (lines 433-571)
- [x] Extract CompactChart to monitor/ui/components/chart.py (lines 577-651)
- [x] Create all necessary __init__.py files
- [x] Test UI component imports

**Status**: 100% Complete ✓

---

## ⏭️ Phase 4: Refactor Main Dashboard

- [ ] Move RoutingMLDashboard to monitor/ui/dashboard.py (lines 657-1691)
- [ ] Update all imports in dashboard
- [ ] Create new entry point: server_monitor_v6.py
- [ ] Test full application
- [ ] Update batch scripts if needed

**Status**: Not Started

---

## ⏭️ Phase 5: Testing & Build

- [ ] Test PyInstaller build with new structure
- [ ] Create RoutingMLMonitor_v6.0.0.spec
- [ ] Update deploy scripts
- [ ] Document module structure
- [ ] Create migration guide

**Status**: Not Started

---

## 📊 Progress Tracking

```
Phase 1 (Setup):         [▓▓▓▓▓] 100% (7/7 tasks) ✓
Phase 2 (API/Services):  [▓▓▓▓▓] 100% (6/6 tasks) ✓
Phase 3 (UI):            [▓▓▓▓▓] 100% (7/7 tasks) ✓
Phase 4 (Dashboard):     [░░░░░] 0% (0/4 tasks)
Phase 5 (Testing):       [░░░░░] 0% (0/5 tasks)

Total:                   [▓▓▓▓▓▓░░░░] 62% (20/32 tasks)
```

---

## 🎯 Next Session Tasks

1. ✓ Complete Phase 1: Extract config.py and models.py
2. Begin Phase 2: Extract ApiClient and ApiError
3. Extract check_service to monitor/services/checker.py

**Estimated Time**: 1.5-2 hours remaining for complete modularization

---

**Last Updated**: 2025-10-20
**Next Review**: After Phase 1 completion
