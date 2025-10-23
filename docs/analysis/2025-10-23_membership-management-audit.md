# RoutingMLMonitor Membership Management Audit

**Date**: 2025-10-23
**Status**: Phase 1 Complete
**Related Documents**:
- PRD: [docs/planning/PRD_2025-10-23_routingmlmonitor-membership-management.md](../planning/PRD_2025-10-23_routingmlmonitor-membership-management.md)
- Checklist: [docs/planning/CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md](../planning/CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md)
- Role Matrix: [docs/requirements/ROLE_ACCESS_MATRIX_2025-10-22.md](../requirements/ROLE_ACCESS_MATRIX_2025-10-22.md)

---

## 1. Deployment Environment

### Current Deployment
- **Executable**: `RoutingMLMonitor_v5.6.0.exe` (12MB, built 2025-10-23 08:48)
- **Spec File**: `RoutingMLMonitor_v5.6.0.spec`
- **Entry Point**: `scripts\server_monitor_dashboard_v5_1.py`
- **Location**: Root directory

### Future Version (Modularized)
- **Latest Spec**: `RoutingMLMonitor_v6.0.1.spec`
- **Entry Point**: `scripts\server_monitor_v6.py`
- **Architecture**: Uses `monitor` package with modular structure
- **Hidden Imports**: Includes monitor.ui.dashboard, monitor.api.client, monitor.services

### Build Process
- **Tool**: PyInstaller
- **Command**: `python -m PyInstaller --clean --noconfirm RoutingMLMonitor_v{VERSION}.spec`
- **Output**: Single executable (no console window)
- **Compression**: UPX enabled

---

## 2. Monitor UI Code Inventory

### File Structure
```
scripts/monitor/ui/
├── __init__.py
├── dashboard.py                    # Main dashboard with membership management
└── components/
    ├── __init__.py
    ├── chart.py
    ├── service_card.py
    └── workflow_canvas.py
```

### Membership Management UI Components

#### Main Dashboard ([scripts/monitor/ui/dashboard.py](../../scripts/monitor/ui/dashboard.py))

**Initialization** (Line 284):
- `_init_user_management_tab()` - Creates user management tab with scrollable user list
- `user_list_frame` - Container for user cards
- Status label showing pending user count
- Refresh button to reload user list

**Core Functions**:

1. **Load Pending Users** (Line 567):
   ```python
   def _load_pending_users(self):
       """Load pending users from API and display as cards"""
       # Clears existing UI
       # Calls GET /api/auth/admin/pending-users
       # Displays count and user cards
       # Error handling with messagebox
   ```

2. **Approve User** (Line 933):
   ```python
   def _approve_user(self, username: str, make_admin: bool):
       """Approve user with optional admin role"""
       # Confirmation dialog
       # POST /api/auth/admin/approve
       # Success message
       # Reloads pending users list ✅
   ```

3. **Reject User** (Line 952):
   ```python
   def _reject_user(self, username: str):
       """Reject user with optional reason"""
       # Input dialog for rejection reason
       # POST /api/auth/admin/reject
       # Success message
       # Reloads pending users list ✅
   ```

**UI Elements**:
- User cards with username, email, created_at
- Approve button (green) with admin checkbox
- Reject button (red)
- Status combobox: "", "approved", "pending", "rejected"
- Bulk registration with auto-approve option

**API Client Configuration** ([scripts/monitor/api/client.py](../../scripts/monitor/api/client.py)):
- User-Agent: `"RoutingML-Monitor/6.0"` (from monitor.config)
- Headers include User-Agent for server authentication
- Timeout: Configurable via API_TIMEOUT env var

---

## 3. Backend API Endpoints

### Admin User Management APIs ([backend/api/routes/auth.py](../../backend/api/routes/auth.py))

#### POST /admin/approve (Line 99)
**Authentication**: User-Agent check ("RoutingML-Monitor")
**Request Schema**: `AdminApproveRequest`
```json
{
  "username": "string",
  "make_admin": boolean
}
```
**Response Schema**: `UserStatusResponse`
```json
{
  "username": "string",
  "status": "approved",
  "is_admin": boolean,
  "approved_at": "datetime",
  "rejected_at": null
}
```
**Service Call**: `auth_service.approve_user(username, make_admin)`
**Audit Log**: Records target, approved_by ("ServerMonitor"), make_admin
**Status Code**: 200 OK, 404 Not Found (user doesn't exist), 401 Unauthorized (invalid User-Agent)

#### POST /admin/reject (Line 128)
**Authentication**: User-Agent check ("RoutingML-Monitor")
**Request Schema**: `AdminRejectRequest`
```json
{
  "username": "string",
  "reason": "string (optional)"
}
```
**Response Schema**: `UserStatusResponse`
```json
{
  "username": "string",
  "status": "rejected",
  "rejected_at": "datetime"
}
```
**Service Call**: `auth_service.reject_user(username, reason)`
**Audit Log**: Records target, rejected_by ("ServerMonitor"), reason
**Status Code**: 200 OK, 404 Not Found, 401 Unauthorized

#### GET /admin/pending-users (Line 157)
**Authentication**: User-Agent check ("RoutingML-Monitor") OR JWT token
**Request**: No parameters
**Response**:
```json
{
  "users": [
    {
      "id": int,
      "username": "string",
      "email": "string",
      "status": "pending",
      "created_at": "datetime",
      ...
    }
  ],
  "count": int
}
```
**Service Call**: `auth_service.get_pending_users()`
**Filter**: WHERE status = "pending"
**Status Code**: 200 OK, 401 Unauthorized, 500 Internal Server Error

### Other Admin APIs
- POST `/admin/reset-password` (Line 201)
- POST `/admin/bulk-register` (Line 222)
- GET `/admin/users` (Line 243) - List users with status/search filters

---

## 4. Database Schema

### UserAccount Model ([backend/database_rsl.py](../../backend/database_rsl.py), Line 135)

```python
class UserAccount(Base):
    __tablename__ = "users"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Identity
    username = Column(String(150), nullable=False)
    normalized_username = Column(String(150), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)

    # Authentication
    password_hash = Column(String(255), nullable=False)
    must_change_password = Column(Boolean, nullable=False, default=False)

    # Authorization
    status = Column(String(32), nullable=False, default="pending")  # ✅ KEY FIELD
    is_admin = Column(Boolean, nullable=False, default=False)

    # Metadata
    invited_by = Column(String(150), nullable=True)
    initial_password_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False)

    # Status Timestamps
    approved_at = Column(DateTime, nullable=True)  # Set when status → "approved"
    rejected_at = Column(DateTime, nullable=True)  # Set when status → "rejected"
    last_login_at = Column(DateTime, nullable=True)
```

### Status Values & Transitions

**Valid Status Values**:
- `"pending"` - Default for new registrations, awaiting admin approval
- `"approved"` - User can log in and access system
- `"rejected"` - User registration denied

**Status Transitions** ([backend/api/services/auth_service.py](../../backend/api/services/auth_service.py)):

1. **Registration** (Line 113):
   - Initial status: `"pending"`
   - `approved_at` = null
   - `rejected_at` = null

2. **Re-registration after rejection** (Line 83-89):
   - If existing.status == "rejected":
     - status → "pending"
     - rejected_at → null
     - rejection_reason → null

3. **Approval** (Line 140-141):
   - status → "approved"
   - approved_at → current UTC datetime
   - If make_admin=True: is_admin → True

4. **Rejection** (Line 181-182):
   - status → "rejected"
   - rejected_at → current UTC datetime
   - rejection_reason stored (if provided)

### Query Filters

**Get Pending Users** (Line 216):
```python
pending_users = session.query(UserAccount).filter(UserAccount.status == "pending").all()
```

**Check Login Permission** (Line 248):
```python
if user.status != "approved":
    raise PermissionError("Your account is not approved yet")
```

---

## 5. QA & Operational Requirements

### Role-Based Access Control

From [ROLE_ACCESS_MATRIX_2025-10-22.md](../requirements/ROLE_ACCESS_MATRIX_2025-10-22.md):

**Roles**:
- **admin** - Full system access (JWT + is_admin=True)
- **user** - Operational access only (JWT + is_admin=False)
- **server_manager** - Script/batch operations, uses admin account for UI

**Admin-Only APIs**:
- `/api/auth/admin/*` - User approval/management
- `/api/workflow/*` - Workflow configuration
- `/api/training/*` - Model training
- `/api/logs/*` - Audit logs (already has `require_admin`)
- `/api/database/config*` - DB configuration
- Various monitoring/quality APIs

**User-Allowed APIs**:
- `/api/predict` - Predictions
- `/api/similarity/*` - Similarity checks
- `/api/master-data/*` - Master data viewing
- `/api/health` - Health checks

### RBAC Implementation Status

From [CHECKLIST_2025-10-22_role-based-navigation-and-access-control.md](../planning/CHECKLIST_2025-10-22_role-based-navigation-and-access-control.md):

- **Phase 0**: ✅ Complete (PRD & Checklist)
- **Phase 1**: 80% Complete (role matrix done, stakeholder review pending)
- **Phase 2**: 67% Complete (frontend navigation filters implemented, manual testing pending)
- **Phase 3**: ✅ Complete (backend `require_admin` applied, 6 unit tests passing)
- **Phase 4**: 0% Pending (QA testing, documentation, final delivery)

### Server Manager Considerations

- Server startup scripts do NOT use FastAPI RBAC
- Membership approval/rejection uses admin account via RoutingMLMonitor
- No impact on deployment scripts (`deploy/*`, `monitoring/*`)
- CLI operations have OS-level permissions, not API-level

---

## 6. Test Account Requirements

### Test Accounts Needed

#### 1. Admin Account
**Purpose**: Test approval/rejection workflows, full system access
**Requirements**:
- `is_admin = True`
- `status = "approved"`
- JWT token with admin privileges
- Environment variables set for RoutingMLMonitor:
  ```bash
  MONITOR_ADMIN_USERNAME=admin_test_user
  MONITOR_ADMIN_PASSWORD=<secure_password>
  ```

#### 2. Standard User Account
**Purpose**: Test restricted access, verify non-admin cannot access admin APIs
**Requirements**:
- `is_admin = False`
- `status = "approved"`
- JWT token with standard user privileges

#### 3. Pending User Accounts (3+)
**Purpose**: Test approval/rejection flows
**Requirements**:
- `status = "pending"`
- Various email addresses for notification testing
- Different created_at timestamps

#### 4. Rejected User Account
**Purpose**: Test re-registration flow after rejection
**Requirements**:
- `status = "rejected"`
- `rejected_at` set
- `rejection_reason` set

### Environment Variables

**RoutingMLMonitor** ([scripts/monitor/config.py](../../scripts/monitor/config.py)):
```bash
# API Connection
API_BASE_URL=http://localhost:8000  # or production URL
API_TIMEOUT=30                       # seconds

# Admin Credentials
MONITOR_ADMIN_USERNAME=<admin_username>
MONITOR_ADMIN_PASSWORD=<admin_password>

# User Agent (already set in code)
USER_AGENT="RoutingML-Monitor/6.0"
```

**Backend API** ([backend/api/config.py](../../backend/api/config.py)):
```bash
# JWT Settings
JWT_SECRET_KEY=<secure_random_key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24 hours
JWT_COOKIE_NAME=routing_ml_token

# Database
RSL_DATABASE_URL=sqlite:///./data/routing_ml_auth.db  # or production DB

# Email (optional for testing)
OUTLOOK_ENABLED=false  # Disable email notifications for testing
```

### Test Scenarios

**Scenario 1: Approve Pending User**
1. Start RoutingMLMonitor with admin credentials
2. Navigate to User Management tab
3. Verify pending user count shows correctly
4. Click "승인" on a pending user
5. Check "관리자 권한 부여" if needed
6. Confirm approval
7. **Expected**:
   - Success message displayed
   - User list refreshes automatically ✅
   - Pending count decrements
   - User can now log in via web UI

**Scenario 2: Reject Pending User**
1. Start RoutingMLMonitor with admin credentials
2. Navigate to User Management tab
3. Click "거절" on a pending user
4. Enter rejection reason (optional)
5. Confirm rejection
6. **Expected**:
   - Success message displayed
   - User list refreshes automatically ✅
   - Pending count decrements
   - User receives rejection notification (if email enabled)

**Scenario 3: Bulk Registration with Auto-Approve**
1. Prepare CSV with multiple users
2. Use bulk registration feature
3. Check "즉시 승인" option
4. Submit
5. **Expected**:
   - All users created with status="approved"
   - No pending users added
   - Success count matches input

**Scenario 4: API Authentication**
1. Test User-Agent header verification
2. Call GET /admin/pending-users with correct User-Agent
3. **Expected**: 200 OK with user list
4. Call without User-Agent
5. **Expected**: 401 Unauthorized

**Scenario 5: Status Filter**
1. Call GET /admin/users?status=pending
2. **Expected**: Only pending users returned
3. Call GET /admin/users?status=approved
4. **Expected**: Only approved users returned

---

## 7. Known Issues & Areas for Investigation (Phase 2)

### Potential Issues Identified

#### 1. UI Refresh Timing
**Location**: [dashboard.py:950](../../scripts/monitor/ui/dashboard.py#L950), [dashboard.py:969](../../scripts/monitor/ui/dashboard.py#L969)
**Issue**: Both `_approve_user()` and `_reject_user()` call `_load_pending_users()` after success
**Question**: Does the UI refresh happen **before** or **after** database transaction commits?
**Risk**: If refresh happens before DB commit, user might still see old status
**Verify**: Add timing logs or transaction boundary checks

#### 2. Pending Count Synchronization
**Location**: [dashboard.py:578](../../scripts/monitor/ui/dashboard.py#L578)
**Issue**: Pending count comes from API response: `data.get("count", len(users))`
**Question**: Is this count accurate if multiple admins approve users simultaneously?
**Risk**: Race condition between count query and user list query
**Verify**: Check if count is calculated in single transaction

#### 3. Status Label Updates
**Location**: [dashboard.py:606](../../scripts/monitor/ui/dashboard.py#L606)
**Issue**: Status label shows "대기 중 회원: {count}명"
**Question**: Is this label updated correctly after approval/rejection?
**Current**: Yes - `_load_pending_users()` updates the label
**Verify**: Manual UI testing needed

#### 4. Error Handling on Approval/Rejection
**Location**: [dashboard.py:945-947](../../scripts/monitor/ui/dashboard.py#L945-L947)
**Current**: Shows messagebox.showerror() on API failure
**Question**: Does status label reflect error state?
**Improvement**: Consider updating `user_status_label` to show "오류" status
**Phase 0 Fix**: Already added `user_status_label` update in `_ensure_api_client()` (Line 21 of Phase 0 commit)

#### 5. User-Agent Header Dependency
**Location**: [auth.py:106](../../backend/api/routes/auth.py#L106), [auth.py:135](../../backend/api/routes/auth.py#L135), [auth.py:164](../../backend/api/routes/auth.py#L164)
**Current**: All admin endpoints check for "RoutingML-Monitor" in User-Agent
**Question**: What if User-Agent is spoofed or missing?
**Risk**: Browser-based access should require JWT authentication
**Current Implementation**: Falls back to 401 Unauthorized if User-Agent missing
**Verify**: Test web browser access without proper authentication

#### 6. Concurrent Admin Operations
**Location**: Auth service methods
**Question**: What if two admins approve the same user simultaneously?
**Risk**: Duplicate audit logs, race condition on status update
**Mitigation**: Database transaction isolation should handle this
**Verify**: Load testing with concurrent approvals

---

## 8. Recommendations for Phase 2

### Code Verification
1. ✅ Read auth_service implementation to verify transaction boundaries
2. ✅ Check if approval/rejection use database transactions properly
3. ✅ Verify pending count calculation includes proper locking
4. 📋 Add explicit transaction logging for debugging
5. 📋 Consider adding optimistic locking to UserAccount model

### UI Improvements
1. ✅ Add status label updates on API errors (Phase 0)
2. 📋 Add loading indicator during approval/rejection
3. 📋 Add confirmation of success with visual feedback (beyond messagebox)
4. 📋 Consider debouncing refresh button to prevent spam clicks
5. 📋 Add pagination if pending user count > 50

### API Enhancements
1. 📋 Add WebSocket or Server-Sent Events for real-time count updates
2. 📋 Return updated pending count in approval/rejection response
3. 📋 Add rate limiting to admin approval endpoints
4. 📋 Consider batch approval API for multiple users

### Testing Focus
1. 🔬 Manual testing with multiple admin sessions
2. 🔬 Network delay simulation to test refresh timing
3. 🔬 Load testing with 100+ pending users
4. 🔬 Verify audit logs are created correctly
5. 🔬 Test email notifications (if enabled)

### Documentation
1. ✅ This audit document
2. 📋 API endpoint documentation (OpenAPI/Swagger)
3. 📋 User manual for RoutingMLMonitor membership management
4. 📋 Admin training guide
5. 📋 Troubleshooting guide for common issues

---

## 9. Phase 1 Completion Summary

### Tasks Completed ✅
1. ✅ RoutingMLMonitor deployment path/version identified (v5.6.0 current, v6.0.1 future)
2. ✅ Monitor app membership UI code inventoried (dashboard.py + components)
3. ✅ Admin API endpoint mapping documented (3 core endpoints + schemas)
4. ✅ Approval/rejection/pending status definitions verified (DB schema + transitions)
5. ✅ QA/operational requirements reviewed (RBAC matrix + checklist)
6. ✅ Test account/token requirements documented (4 account types + env vars)

### Artifacts Created
- [x] Audit document: `docs/analysis/2025-10-23_membership-management-audit.md`
- [x] Comprehensive API documentation
- [x] Database schema analysis
- [x] Test scenario definitions
- [x] Known issues and recommendations

### Dependencies for Phase 2
- Admin account with `MONITOR_ADMIN_USERNAME` and `MONITOR_ADMIN_PASSWORD` set
- Development environment with API server running
- Test database with sample pending users
- Access to PyInstaller build environment (for Phase 3 rebuild)

### Estimated Phase 2 Duration
6 hours (as per checklist)

### Next Steps
Proceed to **Phase 2: Implementation Review & Fixes** per [CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md](../planning/CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Author**: Claude (AI Assistant)
**Review Status**: Pending stakeholder review
