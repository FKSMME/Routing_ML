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
- [ ] Extract config.py (colors, constants)
- [ ] Extract models.py (Service dataclass, SERVICES)

**Status**: 20% Complete

---

## ⏭️ Phase 2: Extract API & Services

- [ ] Extract ApiClient to monitor/api/client.py (lines 103-207)
- [ ] Extract ApiError to monitor/api/errors.py (lines 99-100)
- [ ] Create monitor/api/__init__.py
- [ ] Extract check_service to monitor/services/checker.py (lines 273-305)
- [ ] Create monitor/services/__init__.py
- [ ] Test API functionality

**Status**: Not Started

---

## ⏭️ Phase 3: Extract UI Components

- [ ] Extract color system to monitor/ui/colors.py (lines 42-82)
- [ ] Extract blend_color to monitor/utils.py (lines 83-97)
- [ ] Extract CompactServiceCard to monitor/ui/components/service_card.py (lines 311-427)
- [ ] Extract WorkflowCanvas to monitor/ui/components/workflow_canvas.py (lines 433-571)
- [ ] Extract CompactChart to monitor/ui/components/chart.py (lines 577-651)
- [ ] Create all necessary __init__.py files
- [ ] Test UI rendering

**Status**: Not Started

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
Phase 1 (Setup):         [▓░░░░] 20% (2/10 tasks)
Phase 2 (API/Services):  [░░░░░] 0% (0/6 tasks)
Phase 3 (UI):            [░░░░░] 0% (0/7 tasks)
Phase 4 (Dashboard):     [░░░░░] 0% (0/4 tasks)
Phase 5 (Testing):       [░░░░░] 0% (0/5 tasks)

Total:                   [▓░░░░░░░░░] 6% (2/32 tasks)
```

---

## 🎯 Next Session Tasks

1. Complete Phase 1: Extract config.py and models.py
2. Begin Phase 2: Extract ApiClient and ApiError
3. Test imports work correctly

**Estimated Time**: 2-3 hours for complete modularization

---

**Last Updated**: 2025-10-20
**Next Review**: After Phase 1 completion
