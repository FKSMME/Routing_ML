# Checklist: Bulk User Registration & ID-based Login Migration

**Date**: 2025-10-23
**Related PRD**: [PRD_2025-10-23_bulk-user-registration-id-based-login.md](PRD_2025-10-23_bulk-user-registration-id-based-login.md)
**Status**: Not Started
**Priority**: P0 (Critical)
**Branch**: 251014

---

## Phase 1: System Analysis & Preparation (20 min)

**Goal**: Verify bulk registration API and prepare user data

### Tasks

- [ ] 1.1 Verify `/api/auth/admin/bulk-register` endpoint exists
- [ ] 1.2 Check User-Agent requirement (RoutingML-Monitor)
- [ ] 1.3 Review BulkRegisterRequest schema
- [ ] 1.4 Check database user table (user_accounts)
- [ ] 1.5 Parse 54-user list into structured data
- [ ] 1.6 Create JSON payload for bulk registration
- [ ] 1.7 Verify curl/requests can set User-Agent header
- [ ] 1.8 Check if user deletion API exists
- [ ] 1.9 Prepare database deletion query as backup

**Estimated Time**: 20 minutes
**Status**: Not Started

**Completion Criteria**:
- Bulk registration API confirmed
- User data prepared
- Deletion method identified

---

## Phase 2: Delete Existing Email Account (15 min)

**Goal**: Remove syyun@ksm.co.kr account

### Tasks

#### Verify Existing Account
- [ ] 2.1 Query database for syyun@ksm.co.kr
- [ ] 2.2 Check normalized_username field
- [ ] 2.3 Backup user data if needed

#### Execute Deletion
- [ ] 2.4 Use database query OR API endpoint
- [ ] 2.5 Execute: `DELETE FROM user_accounts WHERE normalized_username = 'syyun@ksm.co.kr'`
- [ ] 2.6 Verify deletion successful
- [ ] 2.7 Check audit log entry

**Estimated Time**: 15 minutes
**Status**: Not Started

**Completion Criteria**:
- syyun@ksm.co.kr account deleted
- Audit log recorded
- Database clean

---

## Phase 3: Create Bulk Registration Script (30 min)

**Goal**: Prepare 54-user bulk registration payload

### Tasks

#### Data Preparation
- [ ] 3.1 Parse user list from text format
- [ ] 3.2 Split "Full Name Username" into fields
- [ ] 3.3 Create Python script for payload generation
- [ ] 3.4 Verify all 54 users formatted correctly

#### Payload Creation
- [ ] 3.5 Create BulkRegisterRequest JSON with 54 users
- [ ] 3.6 Set password = "ksm@1234" for all users
- [ ] 3.7 Set auto_approve = true
- [ ] 3.8 Set force_password_change = false
- [ ] 3.9 Set notify = false
- [ ] 3.10 Set overwrite_existing = false
- [ ] 3.11 Validate JSON format

#### Script Creation
- [ ] 3.12 Create Python script with requests library
- [ ] 3.13 Add User-Agent: RoutingML-Monitor header
- [ ] 3.14 Add error handling
- [ ] 3.15 Add success/failure reporting

**Estimated Time**: 30 minutes
**Status**: Not Started

**Completion Criteria**:
- 54-user JSON payload ready
- Python script functional
- Payload validated

---

## Phase 4: Execute Bulk Registration (30 min)

**Goal**: Register all 54 users via API

### Tasks

#### Pre-execution Verification
- [ ] 4.1 Verify backend API server running (port 8000)
- [ ] 4.2 Test API endpoint accessibility
- [ ] 4.3 Verify database connection

#### Test Registration (Small Batch)
- [ ] 4.4 Test with 3 users first
- [ ] 4.5 Verify test users created
- [ ] 4.6 Check auto-approval status
- [ ] 4.7 Test login with test user

#### Full Registration
- [ ] 4.8 Execute bulk registration for all 54 users
- [ ] 4.9 Monitor API response
- [ ] 4.10 Check successes count = 54
- [ ] 4.11 Check failures count = 0
- [ ] 4.12 Review any error messages

#### Verification
- [ ] 4.13 Query database: SELECT COUNT(*) FROM user_accounts
- [ ] 4.14 Verify all 54 users exist
- [ ] 4.15 Verify all users have status = 'approved'
- [ ] 4.16 Verify passwords are hashed correctly
- [ ] 4.17 Check audit log entries

**Estimated Time**: 30 minutes
**Status**: Not Started

**Completion Criteria**:
- 54 users registered successfully
- All users auto-approved
- No registration failures
- Audit logs complete

---

## Phase 5: Testing & Verification (30 min)

**Goal**: Verify ID-based login works for all users

### Tasks

#### Login Testing
- [ ] 5.1 Test login: username=syyun, password=ksm@1234
- [ ] 5.2 Verify JWT token issued
- [ ] 5.3 Verify /api/auth/me returns user data
- [ ] 5.4 Test login with 5 random users:
  - [ ] sjlee / ksm@1234
  - [ ] hmkim / ksm@1234
  - [ ] sangmkim / ksm@1234
  - [ ] dsseo / ksm@1234
  - [ ] nrkim / ksm@1234
- [ ] 5.5 Verify all logins successful

#### System Verification
- [ ] 5.6 Check user list API: GET /api/auth/admin/users
- [ ] 5.7 Verify no email-based accounts exist
- [ ] 5.8 Verify all usernames are ID format (not email)
- [ ] 5.9 Check database: no '@' in normalized_username
- [ ] 5.10 Verify audit logs show all registrations

#### Frontend Testing
- [ ] 5.11 Test frontend login with ID-based credentials
- [ ] 5.12 Verify frontend accepts username (not email)
- [ ] 5.13 Test logout
- [ ] 5.14 Test re-login

**Estimated Time**: 30 minutes
**Status**: Not Started

**Completion Criteria**:
- All login tests passed
- No email-based accounts
- Frontend works with ID-based login
- System verified clean

---

## Phase 6: Documentation & Git Workflow (20 min)

**Goal**: Document changes and commit

### Tasks

#### Documentation
- [ ] 6.1 Create user list document (CSV or MD)
- [ ] 6.2 Document initial password (ksm@1234)
- [ ] 6.3 Update system admin guide
- [ ] 6.4 Record audit log summary

#### Git Staging
- [ ] 6.5 Run `git status` to review changes
- [ ] 6.6 Run `git add -A` to stage all changes
- [ ] 6.7 Run `git status` again to verify staging completeness
- [ ] 6.8 Verify "Changes not staged" section is empty

#### Git Commit
- [ ] 6.9 Create detailed commit message
- [ ] 6.10 Include user count and password info
- [ ] 6.11 Run `git commit`
- [ ] 6.12 Verify commit success

#### Git Workflow
- [ ] 6.13 Push to 251014: `git push origin 251014`
- [ ] 6.14 Checkout main: `git checkout main`
- [ ] 6.15 Merge 251014: `git merge 251014 -m "Merge 251014: Bulk user registration"`
- [ ] 6.16 Push main: `git push origin main`
- [ ] 6.17 Return to 251014: `git checkout 251014`
- [ ] 6.18 Verify clean working tree: `git status`

**Estimated Time**: 20 minutes
**Status**: Not Started

**Completion Criteria**:
- Documentation complete
- All changes committed
- Git workflow complete
- Working tree clean

---

## Progress Tracking

```
Phase 1: [░░░░░] 0% (0/9 tasks)
Phase 2: [░░░░░] 0% (0/7 tasks)
Phase 3: [░░░░░] 0% (0/15 tasks)
Phase 4: [░░░░░] 0% (0/17 tasks)
Phase 5: [░░░░░] 0% (0/14 tasks)
Phase 6: [░░░░░] 0% (0/18 tasks)

Total: [░░░░░░░░░░] 0% (0/80 tasks)
```

---

## Acceptance Criteria

### Must Have ✅
- [ ] All tasks completed and marked [x]
- [ ] syyun@ksm.co.kr account deleted
- [ ] 54 users registered successfully
- [ ] All users auto-approved (status = "approved")
- [ ] ID-based login works (username + password)
- [ ] No email-based accounts exist
- [ ] Audit logs complete
- [ ] Git workflow complete
- [ ] Working tree clean

### Should Have
- [ ] Test login for 5+ users successful
- [ ] Frontend login verified
- [ ] Documentation updated

### Nice to Have
- [ ] User list exported
- [ ] System admin guide updated
- [ ] Email notification setup (future)

---

## Files Modified (Expected)

### Documentation
- `docs/planning/PRD_2025-10-23_bulk-user-registration-id-based-login.md`
- `docs/planning/CHECKLIST_2025-10-23_bulk-user-registration-id-based-login.md`
- `docs/admin/user-list-2025-10-23.md` (NEW)

### Scripts
- `scripts/bulk_register_users.py` (NEW - temporary)

### Database
- `user_accounts` table (54 new rows, 1 deleted row)

---

## User List (54 Users)

```
sjlee, sylee, YHLee, hmkim, syyun, sangmkim, kjlee, dsseo,
nrkim, kbkim, tkyunkim, ecshin, celim, shyoon, jaeblee, hmna,
moongkim, bjpark, sbshin, crpark, jwjun, nylee, mgsong, minscho,
yskang, minjea, sjyang, jihmin, dhsung, smkim, splee, jongjlee,
kjhwang, jyshin, jrcho, gwangman, ijyoon, csoh, arsmproctec, kbim,
sungjbang, ywoh, smko, minsukim, jhapark, shjun, khoh, hsbyun,
ygkim, jnmoon, drkim, hgjung, hdbyun, mwkim, joohwan, choh
```

**Total**: 54 users
**Password**: ksm@1234 (all users)
**Auto-approved**: Yes

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase completion
**Estimated Total Time**: 2h 25m (including buffer)
