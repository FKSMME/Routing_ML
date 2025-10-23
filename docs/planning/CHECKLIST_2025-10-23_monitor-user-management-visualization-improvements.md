# Checklist: Server Monitor User Management & Visualization Improvements

**Date**: 2025-10-23
**Related PRD**: [PRD_2025-10-23_monitor-user-management-visualization-improvements.md](PRD_2025-10-23_monitor-user-management-visualization-improvements.md)
**Status**: Not Started

---

## Phase 1: Server Monitor User Management Integration

**Estimated Time**: 3-4 hours
**Status**: Not Started

### Tasks

- [ ] Add user management tab to server_monitor_dashboard_v5_1.py
- [ ] Extend ApiClient class with user management methods
  - [ ] Add `get_pending_users()` method
  - [ ] Add `approve_user(username, make_admin)` method
  - [ ] Add `reject_user(username)` method
- [ ] Create User Management UI components
  - [ ] Create "User Management" tab in main notebook
  - [ ] Add Treeview widget for user list display
  - [ ] Add "Refresh" button
  - [ ] Add "Approve as Admin" button
  - [ ] Add "Approve as User" button
  - [ ] Add "Reject" button
- [ ] Implement UI event handlers
  - [ ] Implement refresh button handler
  - [ ] Implement approve as admin handler with confirmation dialog
  - [ ] Implement approve as user handler with confirmation dialog
  - [ ] Implement reject handler with confirmation dialog
- [ ] Add error handling and user feedback
  - [ ] Display loading indicator during API calls
  - [ ] Show success message after operations
  - [ ] Show error message on API failures
  - [ ] Add retry logic for network errors
- [ ] Test user management functionality
  - [ ] Test script runs without errors
  - [ ] Test API connection and authentication
  - [ ] Test user list display
  - [ ] Test approve as admin function
  - [ ] Test approve as user function
  - [ ] Test reject function
  - [ ] Test error scenarios (network failure, auth failure)

**Git Operations**:
- [ ] **Git staging completeness check** (required!)
  - `git status` executed ✅
  - `git add -A` executed ✅
  - `git status` re-check → "Changes not staged" section empty ✅
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] **Merge pre-validation** (required!)
  - `git diff main..251014` checked ✅
  - No unexpected changes confirmed ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: Frontend-Home Visualization Mapping Improvements

**Estimated Time**: 2-3 hours
**Status**: Not Started

### Tasks

- [ ] Update frontend-home/index.html with data source labels
  - [ ] Add data source label to "라우팅 생성 추세" chart
  - [ ] Add data source label to "품목 분포" chart
  - [ ] Add data source label to "모델 성능 지표" chart
  - [ ] Add data source label to "시스템 상태" chart
  - [ ] Add tooltip with detailed mapping information
- [ ] Create mapping visualization in view-explorer.html
  - [ ] Add "Column Mapping Diagram" section
  - [ ] Implement column → chart connection visualization
  - [ ] Add chart usage indicator for each column
  - [ ] Highlight unused columns in gray
- [ ] Implement mapping data structure
  - [ ] Define mapping config JSON schema
  - [ ] Load mapping config from API/localStorage
  - [ ] Save mapping config when saving view configuration
  - [ ] Sync mapping between view-explorer and index.html
- [ ] Add interactive mapping features
  - [ ] Add info icon (ℹ️) next to each chart title
  - [ ] Show detailed mapping on icon hover/click
  - [ ] Display column data type and sample values
- [ ] Test visualization improvements
  - [ ] Verify data source labels display correctly
  - [ ] Verify mapping diagram renders properly
  - [ ] Verify tooltip shows correct information
  - [ ] Test in Chrome, Edge, Firefox
  - [ ] Verify user can understand mapping in < 3 seconds

**Git Operations**:
- [ ] **Git staging completeness check** (required!)
  - `git status` executed ✅
  - `git add -A` executed ✅
  - `git status` re-check → "Changes not staged" section empty ✅
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] **Merge pre-validation** (required!)
  - `git diff main..251014` checked ✅
  - No unexpected changes confirmed ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Build & Testing

**Estimated Time**: 1-2 hours
**Status**: Not Started

### Tasks

- [ ] Determine version number (Major/Minor/Patch)
  - [ ] Review changes (new feature: user management, visualization improvement)
  - [ ] Decision: v5.6.1 → v5.7.0 (Minor version bump)
- [ ] Backup old version to old/ directory
  - [ ] Create old/ directory if not exists
  - [ ] Move RoutingMLMonitor_v5.6.1.spec to old/
  - [ ] Move RoutingMLMonitor_v5.6.1.exe to old/ (if exists)
- [ ] Create new spec file
  - [ ] Copy RoutingMLMonitor_v5.6.1.spec to RoutingMLMonitor_v5.7.0.spec
  - [ ] Update exe_name in spec file to RoutingMLMonitor_v5.7.0
  - [ ] Update version info in spec file
- [ ] Pre-build script test (CRITICAL!)
  - [ ] Run: `.venv/Scripts/python.exe scripts/server_monitor_dashboard_v5_1.py --help`
  - [ ] Verify runs for at least 10 seconds without errors
  - [ ] If errors occur: fix code, re-test, do NOT proceed with build
- [ ] Rebuild executable
  - [ ] Run: `.venv/Scripts/python.exe -m PyInstaller --clean --noconfirm RoutingMLMonitor_v5.7.0.spec`
  - [ ] Verify dist/RoutingMLMonitor_v5.7.0.exe created
  - [ ] Check file size ~12MB
  - [ ] Move exe to project root
- [ ] Post-build cleanup (CRITICAL!)
  - [ ] Remove old exe files from dist/
  - [ ] Clean dist/ and build/ directories
  - [ ] Verify only latest version exists in project root
- [ ] Post-build executable test (CRITICAL!)
  - [ ] Run: `./RoutingMLMonitor_v5.7.0.exe`
  - [ ] Verify runs for at least 30 seconds without errors
  - [ ] Verify UI loads correctly
  - [ ] Verify no Tkinter exceptions or error popups
  - [ ] Check console for error logs
  - [ ] If errors occur: fix code, rebuild from step 1
- [ ] Functional testing
  - [ ] Test Dashboard tab displays correctly
  - [ ] Test User Management tab displays correctly
  - [ ] Test user list loads
  - [ ] Test approve/reject buttons work
  - [ ] Test frontend-home visualization mapping
  - [ ] Test all error scenarios

**Git Operations**:
- [ ] **Git staging completeness check** (required!)
  - `git status` executed ✅
  - `git add -A` executed ✅
  - `git status` re-check → "Changes not staged" section empty ✅
- [ ] Commit Phase 3: "build: Rebuild monitor v5.7.0 - User management & visualization improvements"
- [ ] Push to 251014
- [ ] **Merge pre-validation** (required!)
  - `git diff main..251014` checked ✅
  - No unexpected changes confirmed ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: Documentation & Git Workflow

**Estimated Time**: 30 minutes
**Status**: Not Started

### Tasks

- [ ] Create work history document
  - [ ] Document all changes made
  - [ ] List all files modified
  - [ ] Include git commit hashes
  - [ ] Add quantitative metrics (lines changed, files modified)
- [ ] Update project documentation
  - [ ] Update README if needed
  - [ ] Document new user management features
  - [ ] Document visualization mapping improvements
- [ ] Final git operations
  - [ ] Verify all changes committed
  - [ ] Verify main branch up to date
  - [ ] Verify 251014 branch up to date
  - [ ] Verify working tree clean

**Git Operations**:
- [ ] **Git staging completeness check** (required!)
  - `git status` executed ✅
  - `git add -A` executed ✅
  - `git status` re-check → "Changes not staged" section empty ✅
- [ ] Commit Phase 4: "docs: Add work history for user management & visualization improvements"
- [ ] Push to 251014
- [ ] **Merge pre-validation** (required!)
  - `git diff main..251014` checked ✅
  - No unexpected changes confirmed ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [░░░░░░░░░░] 0% (0/23 tasks)
Phase 2: [░░░░░░░░░░] 0% (0/15 tasks)
Phase 3: [░░░░░░░░░░] 0% (0/21 tasks)
Phase 4: [░░░░░░░░░░] 0% (0/8 tasks)

Total: [░░░░░░░░░░] 0% (0/67 tasks)
```

---

## Acceptance Criteria

### Phase 1 Acceptance

- [ ] Server monitor displays "User Management" tab
- [ ] Pending users list loads correctly
- [ ] "Approve as Admin" button approves user with admin role
- [ ] "Approve as User" button approves user without admin role
- [ ] "Reject" button rejects user registration
- [ ] Error messages display on API failures
- [ ] Script runs standalone without errors

### Phase 2 Acceptance

- [ ] Each chart displays data source label
- [ ] Mapping diagram shows column → chart connections
- [ ] Tooltip displays detailed mapping information
- [ ] User can understand mapping in < 3 seconds
- [ ] Configuration saves mapping information

### Phase 3 Acceptance

- [ ] RoutingMLMonitor_v5.7.0.exe builds successfully
- [ ] Executable file size ~12MB
- [ ] Executable runs without errors for 30+ seconds
- [ ] UI loads correctly
- [ ] User management features work correctly
- [ ] No crashes or Tkinter exceptions
- [ ] old/ directory contains v5.6.1 backup

### Phase 4 Acceptance

- [ ] Work history document created
- [ ] All changes documented
- [ ] Git commits include detailed messages
- [ ] Main branch merged and up to date
- [ ] 251014 branch returned to
- [ ] Working tree clean

---

## Work Completion Checklist

✅ PRD document created
✅ Checklist document created
- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged
- [ ] RoutingMLMonitor rebuilt with new version
- [ ] Old version backed up to old/
- [ ] Work history document created
- [ ] No empty checkboxes [ ] remaining

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion

**END OF CHECKLIST**
