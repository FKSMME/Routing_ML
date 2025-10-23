# RoutingMLMonitor Membership Management - QA Test Plan

**Date**: 2025-10-23
**Phase**: Phase 3 - Integration Testing & Verification
**Related Documents**:
- PRD: [docs/planning/PRD_2025-10-23_routingmlmonitor-membership-management.md](../planning/PRD_2025-10-23_routingmlmonitor-membership-management.md)
- Checklist: [docs/planning/CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md](../planning/CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md)
- Audit: [docs/analysis/2025-10-23_membership-management-audit.md](../analysis/2025-10-23_membership-management-audit.md)

**Test Environment**:
- Build Version: RoutingMLMonitor_v5.6.0.exe (with Phase 2.5 fixes)
- Backend API: Running with admin authentication enabled
- Database: Test instance with sample pending users

---

## 1. Pre-Test Setup

### 1.1 Environment Variables

Required environment variables for testing:

```bash
# Admin Credentials
MONITOR_ADMIN_USERNAME=<admin_username>
MONITOR_ADMIN_PASSWORD=<admin_password>

# API Configuration
ROUTING_ML_API_URL=https://localhost:8000  # or your API server URL

# SSL Configuration (for self-signed certs in dev)
ROUTING_ML_VERIFY_SSL=false  # Set to false for development, true for production

# Optional
MONITOR_API_TIMEOUT=8
```

### 1.2 Test Accounts Needed

Create these test accounts in the database before testing:

**Admin Account** (for monitor login):
- Username: `admin_tester`
- Password: `<secure_password>`
- Status: `approved`
- Is_admin: `true`

**Pending Users** (at least 3):
1. Username: `pending_user_1`
   - Email: `pending1@test.com`
   - Full_name: `Test User One`
   - Status: `pending`

2. Username: `pending_user_2`
   - Email: `pending2@test.com`
   - Full_name: `Test User Two`
   - Status: `pending`

3. Username: `pending_user_3`
   - Email: `pending3@test.com`
   - Full_name: `Test User Three`
   - Status: `pending`

**Standard User** (for permission testing):
- Username: `standard_user`
- Password: `<secure_password>`
- Status: `approved`
- Is_admin: `false`

### 1.3 Database Preparation

Run SQL to verify test data:

```sql
-- Check pending users count
SELECT COUNT(*) FROM users WHERE status = 'pending';

-- Check admin account
SELECT username, is_admin, status FROM users WHERE username = 'admin_tester';

-- List all pending users
SELECT id, username, email, full_name, created_at, status
FROM users
WHERE status = 'pending'
ORDER BY created_at DESC;
```

---

## 2. Test Scenarios

### Scenario 1: Monitor Login & UI Access ✅

**Objective**: Verify admin can launch monitor and access membership tab

**Prerequisites**:
- Monitor executable available
- Environment variables set
- Backend API running

**Steps**:
1. Launch `RoutingMLMonitor_v5.6.0.exe`
2. Monitor should auto-authenticate using env var credentials
3. Navigate to "회원 관리" (User Management) tab
4. Verify tab loads without errors

**Expected Results**:
- ✅ Monitor launches successfully (no crash)
- ✅ Authentication succeeds (no error messagebox)
- ✅ User Management tab is accessible
- ✅ Status label shows "회원 목록 로딩 중..." then updates with count

**Acceptance Criteria**:
- No authentication errors
- Tab displays within 3 seconds
- UI is responsive

**Pass/Fail**: [ ]

**Notes**:
```
Tester: _____________
Date/Time: _____________
Issues Found: _____________
```

---

### Scenario 2: Pending Users List Display ✅

**Objective**: Verify pending users load correctly with accurate count

**Prerequisites**:
- Scenario 1 passed
- At least 3 pending users in database

**Steps**:
1. In User Management tab, observe initial list load
2. Click "🔄 새로 고침" (Refresh) button
3. Count displayed user cards
4. Verify each card shows:
   - Username (bold, large)
   - Full name and email (if available)
   - "관리자" checkbox
   - "✓ 승인" (Approve) button
   - "✗ 거절" (Reject) button

**Expected Results**:
- ✅ Status label shows "대기 중 회원: N명" where N matches database count
- ✅ All pending users displayed as cards
- ✅ Cards show correct user information
- ✅ Buttons are clickable and styled correctly
- ✅ Scrollable if more than ~5 users

**Acceptance Criteria**:
- Count matches database query result
- No missing or duplicate cards
- All UI elements visible and functional

**Pass/Fail**: [ ]

**Database Verification**:
```sql
-- Run this query and compare count with UI
SELECT COUNT(*) FROM users WHERE status = 'pending';

-- Expected: Should match "대기 중 회원: N명"
```

**Notes**:
```
Card Count in UI: _____
Database Count: _____
Match: Yes/No
Issues Found: _____________
```

---

### Scenario 3: User Approval Flow ✅

**Objective**: Verify user approval updates database and UI correctly

**Prerequisites**:
- Scenario 2 passed
- At least 1 pending user available

**Test Case 3.1: Standard User Approval**

**Steps**:
1. Select a pending user (e.g., `pending_user_1`)
2. Do NOT check "관리자" checkbox
3. Click "✓ 승인" button
4. Confirm in the dialog: Click "예" (Yes)
5. Wait for success message
6. Observe UI refresh

**Expected Results**:
- ✅ Confirmation dialog appears: "'{username}' 회원을 승인하시겠습니까?"
- ✅ After confirmation, success message: "'{username}' 회원이 승인되었습니다."
- ✅ User card disappears from list
- ✅ Pending count decrements by 1
- ✅ Status label updates automatically

**Database Verification**:
```sql
-- After approval, verify user status
SELECT username, status, is_admin, approved_at
FROM users
WHERE username = 'pending_user_1';

-- Expected:
-- status: 'approved'
-- is_admin: false (0)
-- approved_at: <recent timestamp>
```

**Audit Log Verification**:
```bash
# Check backend logs for audit entry
grep "사용자 승인" <log_file> | grep "pending_user_1"

# Expected entry with:
# - target: pending_user_1
# - approved_by: ServerMonitor
# - make_admin: false
```

**Pass/Fail**: [ ]

**Notes**:
```
Username Tested: _____________
Status Before: _____________
Status After: _____________
Is Admin After: _____________
Approved At: _____________
Issues Found: _____________
```

---

**Test Case 3.2: Admin User Approval**

**Steps**:
1. Select another pending user (e.g., `pending_user_2`)
2. **Check** "관리자" checkbox
3. Click "✓ 승인" button
4. Confirm in the dialog
5. Wait for success message
6. Observe UI refresh

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ Success message shown
- ✅ User card disappears
- ✅ Pending count decrements
- ✅ UI updates automatically

**Database Verification**:
```sql
SELECT username, status, is_admin, approved_at
FROM users
WHERE username = 'pending_user_2';

-- Expected:
-- status: 'approved'
-- is_admin: true (1)  ⭐ KEY DIFFERENCE
-- approved_at: <recent timestamp>
```

**Audit Log Verification**:
```bash
grep "사용자 승인" <log_file> | grep "pending_user_2"

# Expected:
# - make_admin: true ⭐
```

**Pass/Fail**: [ ]

**Notes**:
```
Username Tested: _____________
Is Admin After: _____________  (should be true/1)
Issues Found: _____________
```

---

### Scenario 4: User Rejection Flow ✅

**Objective**: Verify user rejection updates database and UI correctly

**Prerequisites**:
- At least 1 pending user available

**Steps**:
1. Select a pending user (e.g., `pending_user_3`)
2. Click "✗ 거절" button
3. In the input dialog, enter rejection reason: "테스트 계정 거절"
4. Click OK
5. Wait for confirmation message
6. Observe UI refresh

**Expected Results**:
- ✅ Input dialog appears: "'{username}' 회원 승인을 거절하시겠습니까?\n\n거절 사유 (선택 입력):"
- ✅ Can enter reason text
- ✅ After OK, confirmation message: "'{username}' 회원이 거절 처리되었습니다."
- ✅ User card disappears from list
- ✅ Pending count decrements by 1
- ✅ Status label updates

**Database Verification**:
```sql
SELECT username, status, rejected_at
FROM users
WHERE username = 'pending_user_3';

-- Expected:
-- status: 'rejected'
-- rejected_at: <recent timestamp>
-- NOTE: rejection_reason NOT stored in DB (only in logs)
```

**Audit Log Verification**:
```bash
grep "사용자 거절" <log_file> | grep "pending_user_3"

# Expected entry with:
# - target: pending_user_3
# - rejected_by: ServerMonitor
# - reason: "테스트 계정 거절"
```

**⚠️ Known Limitation**:
Rejection reason is NOT stored in database, only in audit logs. If logs are rotated/deleted, reason is permanently lost. This is documented as a High Priority issue but not fixed in Phase 2.5.

**Pass/Fail**: [ ]

**Notes**:
```
Username Tested: _____________
Rejection Reason: _____________
Status After: _____________
Rejected At: _____________
Reason in Logs: Yes/No
Issues Found: _____________
```

---

### Scenario 5: Approved User Login & Permissions ✅

**Objective**: Verify approved users can log in and access appropriate resources

**Prerequisites**:
- Test Case 3.1 passed (standard user approved)
- Test Case 3.2 passed (admin user approved)

**Test Case 5.1: Standard User Login**

**Steps**:
1. Open web browser
2. Navigate to API frontend URL
3. Log in with `pending_user_1` (now approved)
4. Observe available menu items
5. Try accessing admin-only routes:
   - `/api/training/*`
   - `/api/workflow/*`
   - `/api/logs/*`

**Expected Results**:
- ✅ Login succeeds
- ✅ User can access:
   - `/api/predict`
   - `/api/master-data/*`
   - `/api/health`
- ✅ User CANNOT access admin routes (403 Forbidden)
- ✅ Frontend hides admin-only menu items

**Pass/Fail**: [ ]

**Notes**:
```
Login Success: Yes/No
Available Menus: _____________
403 on Admin Routes: Yes/No
Issues Found: _____________
```

---

**Test Case 5.2: Admin User Login**

**Steps**:
1. Log out from previous test
2. Log in with `pending_user_2` (approved as admin)
3. Observe available menu items
4. Try accessing admin routes:
   - `/api/training/*`
   - `/api/workflow/*`
   - `/api/logs/*`

**Expected Results**:
- ✅ Login succeeds
- ✅ User can access ALL routes (admin + user)
- ✅ Frontend shows all menu items including admin sections
- ✅ Admin API calls return 200 OK (not 403)

**Pass/Fail**: [ ]

**Notes**:
```
Login Success: Yes/No
All Menus Visible: Yes/No
Admin Routes Accessible: Yes/No
Issues Found: _____________
```

---

### Scenario 6: Rejected/Pending User Login Blocked ✅

**Objective**: Verify unapproved users cannot access system

**Prerequisites**:
- Test Case 4 passed (user rejected)
- At least 1 user still pending

**Test Case 6.1: Rejected User Login Attempt**

**Steps**:
1. Try to log in with `pending_user_3` (rejected user)
2. Observe error message

**Expected Results**:
- ✅ Login fails
- ✅ Error message: "Your account is not approved yet" or similar
- ✅ No access granted to any routes

**Pass/Fail**: [ ]

**Notes**:
```
Error Message: _____________
Access Granted: Yes/No (should be No)
Issues Found: _____________
```

---

**Test Case 6.2: Pending User Login Attempt**

**Steps**:
1. Create a new pending user or use existing
2. Try to log in while status is still "pending"
3. Observe error message

**Expected Results**:
- ✅ Login fails
- ✅ Error message indicates account not approved
- ✅ No access granted

**Pass/Fail**: [ ]

**Notes**:
```
Username: _____________
Error Message: _____________
Access Granted: Yes/No (should be No)
Issues Found: _____________
```

---

### Scenario 7: API Endpoint Authorization ✅

**Objective**: Verify admin-only API endpoints return 403 for non-admin users

**Prerequisites**:
- Standard user account available (from Test Case 5.1)
- Admin account available (from Test Case 5.2)

**Admin-Only Endpoints to Test**:

| Endpoint | Admin Access | User Access | Expected |
|----------|--------------|-------------|----------|
| `GET /api/logs/*` | 200 OK | 403 Forbidden | ✅ |
| `POST /api/training/*` | 200 OK | 403 Forbidden | ✅ |
| `POST /api/workflow/*` | 200 OK | 403 Forbidden | ✅ |
| `GET /api/data-quality/*` | 200 OK | 403 Forbidden | ✅ |
| `GET /api/dashboard/*` | 200 OK | 403 Forbidden | ✅ |

**Test Method**:
1. Use browser dev tools or Postman
2. Authenticate as standard user
3. Call admin-only endpoints
4. Verify 403 response
5. Check audit logs for authorization denial

**Audit Log Verification**:
```bash
# Should see authorization_denied events
grep "Authorization denied" <log_file> | grep "<username>"

# Expected fields:
# - event: authorization_denied
# - user_id: <id>
# - username: <username>
# - client_ip: <ip>
# - requested_path: <endpoint>
# - requested_method: GET/POST
```

**Pass/Fail**: [ ]

**Notes**:
```
Endpoints Tested: _____________
All Returned 403: Yes/No
Audit Logs Found: Yes/No
Issues Found: _____________
```

---

### Scenario 8: Error Handling & Edge Cases ✅

**Objective**: Verify monitor handles error conditions gracefully

**Test Case 8.1: API Server Down**

**Steps**:
1. Stop backend API server
2. Launch monitor or refresh user list
3. Observe error handling

**Expected Results**:
- ✅ Error messagebox shown (not crash)
- ✅ Status label shows error state: "⚠️ API 연결 실패" or "오류: ..."
- ✅ Monitor remains usable (can retry)

**Pass/Fail**: [ ]

---

**Test Case 8.2: Invalid Credentials**

**Steps**:
1. Set wrong `MONITOR_ADMIN_PASSWORD` env var
2. Launch monitor
3. Observe error handling

**Expected Results**:
- ✅ Error messagebox: "API 인증 실패" with details
- ✅ Status label: "⚠️ API 연결 실패"
- ✅ User prompted to check credentials
- ✅ Monitor doesn't crash (graceful failure)

**Pass/Fail**: [ ]

---

**Test Case 8.3: Malformed API Response (Phase 2.5 Fix)**

**Prerequisites**:
- Phase 2.5 KeyError fix applied

**Test Method** (requires API modification or mock):
1. Temporarily modify backend to return user without `username` field
2. Load pending users in monitor
3. Observe behavior

**Expected Results** (with Phase 2.5 fix):
- ✅ Monitor does NOT crash (KeyError prevented)
- ✅ Malformed user card skipped (early return)
- ✅ Other valid users displayed correctly
- ✅ Count may be inaccurate but app remains stable

**Note**: This test is optional and requires API modification. Main goal is to verify the fix prevents crashes.

**Pass/Fail**: [ ]

---

**Test Case 8.4: Network Timeout**

**Steps**:
1. Set `MONITOR_API_TIMEOUT=1` (very short)
2. Call API from slow network or add delay
3. Observe timeout handling

**Expected Results**:
- ✅ Timeout error caught
- ✅ Error messagebox shown
- ✅ Monitor remains responsive

**Known Limitation**: No automatic retry (documented as Medium Priority issue)

**Pass/Fail**: [ ]

---

### Scenario 9: SSL Configuration Testing ✅

**Objective**: Verify SSL verification environment variable works correctly

**Test Case 9.1: SSL Verification Enabled (Production Default)**

**Steps**:
1. Set `ROUTING_ML_VERIFY_SSL=true` (or leave unset)
2. Use API server with valid SSL certificate
3. Launch monitor
4. Verify connection succeeds

**Expected Results**:
- ✅ SSL certificate validated
- ✅ Connection succeeds if cert is valid
- ✅ Connection fails if cert is invalid/self-signed (secure behavior)

**Pass/Fail**: [ ]

---

**Test Case 9.2: SSL Verification Disabled (Development)**

**Steps**:
1. Set `ROUTING_ML_VERIFY_SSL=false`
2. Use API server with self-signed certificate
3. Launch monitor
4. Verify connection succeeds

**Expected Results**:
- ✅ SSL certificate NOT validated
- ✅ Connection succeeds even with self-signed cert
- ⚠️ Warning: This is insecure, only for development

**Pass/Fail**: [ ]

---

### Scenario 10: UI Refresh & Concurrent Admin Testing ✅

**Objective**: Verify UI refresh behavior with multiple admins

**Prerequisites**:
- 2 admin accounts available
- At least 2 pending users

**Steps**:
1. Admin A: Launch monitor, view pending users
2. Admin B: Launch monitor (separate machine or instance)
3. Admin B: Approve a user
4. Admin A: Observe list (NO auto-refresh by design)
5. Admin A: Click "🔄 새로 고침" button
6. Admin A: Verify list updated

**Expected Results**:
- ✅ Admin A does NOT see automatic update (by design)
- ✅ After manual refresh, Admin A sees updated list
- ✅ Count is accurate after refresh
- ✅ No conflicts or errors

**Known Limitation**: No auto-refresh (documented as Medium Priority enhancement)

**Pass/Fail**: [ ]

---

## 3. Test Summary

### Overall Test Results

| Scenario | Pass | Fail | N/A | Notes |
|----------|------|------|-----|-------|
| 1. Monitor Login & UI Access | [ ] | [ ] | [ ] | |
| 2. Pending Users List Display | [ ] | [ ] | [ ] | |
| 3.1. Standard User Approval | [ ] | [ ] | [ ] | |
| 3.2. Admin User Approval | [ ] | [ ] | [ ] | |
| 4. User Rejection Flow | [ ] | [ ] | [ ] | |
| 5.1. Standard User Login | [ ] | [ ] | [ ] | |
| 5.2. Admin User Login | [ ] | [ ] | [ ] | |
| 6.1. Rejected User Blocked | [ ] | [ ] | [ ] | |
| 6.2. Pending User Blocked | [ ] | [ ] | [ ] | |
| 7. API Authorization | [ ] | [ ] | [ ] | |
| 8.1. API Server Down | [ ] | [ ] | [ ] | |
| 8.2. Invalid Credentials | [ ] | [ ] | [ ] | |
| 8.3. Malformed Response | [ ] | [ ] | [ ] | |
| 8.4. Network Timeout | [ ] | [ ] | [ ] | |
| 9.1. SSL Enabled | [ ] | [ ] | [ ] | |
| 9.2. SSL Disabled | [ ] | [ ] | [ ] | |
| 10. Concurrent Admin | [ ] | [ ] | [ ] | |

**Total Scenarios**: 16
**Passed**: _____
**Failed**: _____
**N/A**: _____
**Pass Rate**: _____%

---

## 4. Issues & Observations

### Critical Issues Found
```
1. [Issue Description]
   Severity: Critical/High/Medium/Low
   Steps to Reproduce:
   Expected:
   Actual:
   Impact:

2. ...
```

### Known Limitations (Not Bugs)
- ✅ No auto-refresh for pending users list (manual refresh required)
- ✅ No automatic retry on network failures
- ✅ Rejection reason not stored in database (only in logs)
- ✅ No token expiration handling (requires restart after 24h)

---

## 5. Recommendations

### Must Fix Before Production
```
- [List any critical or high-severity issues found]
```

### Should Fix (High Priority)
```
- [List high-priority enhancements]
```

### Could Fix (Nice to Have)
```
- Implement auto-refresh with configurable interval
- Add automatic retry with exponential backoff
- Add token expiration handling with re-auth
```

---

## 6. Sign-Off

**Tester Name**: _____________________
**Date**: _____________________
**Test Environment**: _____________________
**Monitor Version**: _____________________
**Backend API Version**: _____________________

**Approval for Production**: Yes / No / Conditional

**Conditions** (if conditional):
```
- [List conditions that must be met before production deployment]
```

**QA Lead Signature**: _____________________
**Date**: _____________________

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Status**: Ready for Testing
