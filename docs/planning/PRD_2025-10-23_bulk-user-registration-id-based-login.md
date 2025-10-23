# PRD: Bulk User Registration & ID-based Login Migration

**Date**: 2025-10-23
**Priority**: P0 (Critical - User Management)
**Status**: Planning
**Type**: User Management & System Configuration

---

## Executive Summary

Migrate from email-based to ID-based user authentication and perform bulk registration of 54 company users with standardized credentials.

### Quick Facts
- **Users to Register**: 54 employees
- **Authentication Change**: Email-based → ID-based
- **Standard Password**: ksm@1234
- **Existing Account**: syyun@ksm.co.kr → DELETE (migrate to ID: syyun)
- **API**: `/api/auth/admin/bulk-register` (already exists)
- **Estimated Time**: 1-2 hours

---

## Problem Statement

### Current Issues
1. **Email-based Login**: Currently using email format (syyun@ksm.co.kr)
2. **Single User**: Only one user account exists
3. **No Bulk Registration**: 54 employees need individual accounts
4. **Inconsistent Auth**: Mix of email and ID-based authentication

### Desired State
- **ID-based Login**: All users authenticate with username (e.g., "syyun")
- **54 Users Registered**: All employees have accounts
- **Standardized Password**: Initial password = ksm@1234
- **Clean Database**: Old email-based account removed

---

## Goals and Objectives

### Primary Goals
1. ✅ Delete existing email-based account (syyun@ksm.co.kr)
2. ✅ Bulk register 54 users with ID-based usernames
3. ✅ All users auto-approved and activated
4. ✅ Standard password (ksm@1234) for all users
5. ✅ Verify ID-based login works

### Success Criteria
- [ ] Old email account deleted
- [ ] 54 users successfully registered
- [ ] All users can login with ID + password
- [ ] No email-based accounts remain
- [ ] System audit log records all changes

---

## User List (54 Total)

```
이석중 sjlee
이승용 sylee
이연홍 YHLee
김형민 hmkim
윤수용 syyun
김상민(FKSM) sangmkim
이경재 kjlee
서동수 dsseo
김나리 nrkim
김기범 kbkim
김택균 tkyunkim
신은철 ecshin
임채언 celim
윤석현 shyoon
이재범 jaeblee
나현민 hmna
김문기 moongkim
박지석 bjpark
신상범 sbshin
박차라 crpark
전재원 jwjun
이남용 nylee
송민권 mgsong
조민상 minscho
강연수 yskang
김민제 minjea
양소진 sjyang
민지현 jihmin
성대훈 dhsung
김상민(KSM) smkim
이순필 splee
이종주 jongjlee
황광준 kjhwang
신주용 jyshin
조정래 jrcho
안광민 gwangman
윤인중 ijyoon
오창성 csoh
강동진 arsmproctec
임경복 kbim
방성진 sungjbang
오영원 ywoh
고승민 smko
김민수 minsukim
박정하 jhapark
전상현 shjun
오기호 khoh
변호석 hsbyun
김영곤 ygkim
문정남 jnmoon
김동록 drkim
정혜경 hgjung
변희동 hdbyun
김민우 mwkim
김주환 joohwan
오창훈 choh
```

---

## Requirements

### Functional Requirements

#### FR-1: Delete Email-based Account
**Target**: `syyun@ksm.co.kr`
**Method**: Direct database deletion or admin API
**Reason**: Migrate to ID-based authentication

#### FR-2: Bulk User Registration
**API**: `POST /api/auth/admin/bulk-register`
**Payload Structure**:
```json
{
  "users": [
    {
      "username": "syyun",
      "full_name": "윤수용",
      "password": "ksm@1234",
      "make_admin": false
    },
    // ... 53 more users
  ],
  "auto_approve": true,
  "force_password_change": false,
  "notify": false,
  "overwrite_existing": false
}
```

**Requirements**:
- User-Agent: `RoutingML-Monitor` (API authentication)
- All users auto-approved
- No password change required on first login
- No email notifications

#### FR-3: User Data Mapping
**Format**: "Full Name Username"
**Example**: "윤수용 syyun"

**Mapping**:
- `username`: Second token (e.g., "syyun")
- `full_name`: First token (e.g., "윤수용")
- `display_name`: First token (same as full_name)
- `password`: "ksm@1234" (all users)
- `make_admin`: false (regular users)
- `email`: None (optional, not required)

#### FR-4: ID-based Login
**Login Format**:
- Username: `syyun` (NOT `syyun@ksm.co.kr`)
- Password: `ksm@1234`

**Frontend Changes**: None required (already supports ID-based login)

---

## Phase Breakdown

### Phase 1: System Analysis & Preparation (15 min)
**Goal**: Understand current system and prepare data

Tasks:
1. Check existing bulk registration API
2. Verify User-Agent requirement
3. Check database user table schema
4. Prepare 54-user JSON payload
5. Identify user deletion method

**Deliverables**:
- Bulk registration payload (JSON)
- User deletion script/API call

### Phase 2: Delete Existing Email Account (10 min)
**Goal**: Remove old email-based account

Tasks:
1. Verify syyun@ksm.co.kr exists
2. Execute deletion (database or API)
3. Verify account deleted
4. Backup account data if needed

**Deliverables**:
- Email account deleted
- Audit log entry

### Phase 3: Bulk User Registration (20 min)
**Goal**: Register all 54 users

Tasks:
1. Create bulk registration script/payload
2. Execute POST `/api/auth/admin/bulk-register`
3. Verify all 54 users created
4. Check for any failures
5. Verify auto-approval status

**Deliverables**:
- 54 users registered
- Registration success report

### Phase 4: Verification & Testing (20 min)
**Goal**: Verify ID-based login works

Tasks:
1. Test login with ID (syyun) + password (ksm@1234)
2. Test login with 3-5 random users
3. Verify no email-based accounts exist
4. Check user list in admin panel
5. Verify audit logs

**Deliverables**:
- Login tests passed
- System verification complete

### Phase 5: Documentation & Git Workflow (15 min)
**Goal**: Document changes and commit

Tasks:
1. Document user list
2. Update system documentation
3. Git commit
4. Git workflow (push → merge → return)

**Deliverables**:
- Documentation updated
- Git workflow complete

---

## Technical Specifications

### API Endpoint
```
POST /api/auth/admin/bulk-register
Headers:
  User-Agent: RoutingML-Monitor
  Content-Type: application/json
```

### Request Payload Example
```json
{
  "users": [
    {"username": "sjlee", "full_name": "이석중", "password": "ksm@1234", "make_admin": false},
    {"username": "sylee", "full_name": "이승용", "password": "ksm@1234", "make_admin": false},
    {"username": "YHLee", "full_name": "이연홍", "password": "ksm@1234", "make_admin": false},
    // ... (51 more)
  ],
  "auto_approve": true,
  "force_password_change": false,
  "notify": false,
  "overwrite_existing": false,
  "invited_by": "SystemAdmin"
}
```

### Response Structure
```json
{
  "successes": [
    {
      "username": "syyun",
      "status": "created",
      "is_admin": false,
      "approved": true,
      "temporary_password": null,
      "message": null
    }
  ],
  "failures": [],
  "total": 54
}
```

### User Deletion
**Method 1**: Direct Database Query
```sql
DELETE FROM user_accounts WHERE normalized_username = 'syyun@ksm.co.kr';
```

**Method 2**: Admin API (if exists)
```
DELETE /api/auth/admin/users/{username}
```

---

## Timeline Estimates

| Phase | Estimated Time | Buffer | Total |
|-------|---------------|--------|-------|
| Phase 1 | 15 min | 5 min | 20 min |
| Phase 2 | 10 min | 5 min | 15 min |
| Phase 3 | 20 min | 10 min | 30 min |
| Phase 4 | 20 min | 10 min | 30 min |
| Phase 5 | 15 min | 5 min | 20 min |
| **Total** | **1h 20m** | **35m** | **1h 55m** |

---

## Risks and Mitigations

### Risk 1: Bulk Registration Failure
**Probability**: Low
**Impact**: High
**Mitigation**: API already tested and stable, use small batch test first

### Risk 2: User-Agent Authentication Failure
**Probability**: Medium
**Impact**: Medium
**Mitigation**: Use curl with proper User-Agent header

### Risk 3: Duplicate Username Conflicts
**Probability**: Low
**Impact**: Low
**Mitigation**: `overwrite_existing: false` prevents overwrites

### Risk 4: Email Account Deletion Breaks System
**Probability**: Low
**Impact**: Low
**Mitigation**: Account will be recreated with ID-based username

---

## Acceptance Criteria

### Must Have
- [ ] Email account (syyun@ksm.co.kr) deleted
- [ ] 54 users successfully registered
- [ ] All users have status = "approved"
- [ ] ID-based login works (username + password)
- [ ] No email-based accounts exist
- [ ] Audit logs record all changes
- [ ] Git workflow complete

### Should Have
- [ ] Test login for 5+ random users
- [ ] Verify admin panel shows all users
- [ ] Documentation updated

### Nice to Have
- [ ] User list exported as CSV
- [ ] Email notification to users (future)
- [ ] Password change required on first login (future)

---

## Security Considerations

### Password Security
- **Initial Password**: ksm@1234 (weak but temporary)
- **Recommendation**: Force password change on first login (future enhancement)
- **Current**: No forced password change to simplify onboarding

### Authentication
- **User-Agent**: RoutingML-Monitor required for bulk registration
- **Admin Only**: Only admin users can perform bulk operations
- **Audit Log**: All operations logged

---

## Post-Implementation

### Validation Checklist
1. ✅ 54 users registered
2. ✅ All users auto-approved
3. ✅ ID-based login works
4. ✅ No email-based accounts
5. ✅ Audit logs complete
6. ✅ Git workflow done

### Follow-up Tasks
- [ ] Send initial credentials to users (manual)
- [ ] Enable forced password change (optional)
- [ ] Create user onboarding guide
- [ ] Setup email notifications (optional)

---

## References

- **WORKFLOW_DIRECTIVES**: `.claude/WORKFLOW_DIRECTIVES.md`
- **Auth Service**: `backend/api/services/auth_service.py`
- **Auth Routes**: `backend/api/routes/auth.py`
- **Schemas**: `backend/api/schemas.py`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Author**: Claude Code
**Approved By**: [Pending User Review]
