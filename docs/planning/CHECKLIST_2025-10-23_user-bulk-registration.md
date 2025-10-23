# Checklist: User Bulk Registration

**Date**: 2025-10-23
**Related PRD**: [PRD_2025-10-23_user-bulk-registration.md](PRD_2025-10-23_user-bulk-registration.md)
**Status**: Not Started
**Priority**: P0 (Critical)
**Branch**: 251014

---

## Phase 1: Preparation (10 min)

### Tasks

- [ ] 1.1 Read `backend/api/services/auth_service.py`
- [ ] 1.2 Read `backend/api/schemas.py` (user-related schemas)
- [ ] 1.3 Check database schema for users table
- [ ] 1.4 Identify user registration endpoint
- [ ] 1.5 Identify user deletion endpoint
- [ ] 1.6 Create user list data structure

**Estimated Time**: 10 minutes
**Status**: Not Started

---

## Phase 2: Create Bulk Registration Script (15 min)

### Tasks

- [ ] 2.1 Create `scripts/bulk_register_users.py`
- [ ] 2.2 Add user list (54 users)
- [ ] 2.3 Add API client code
- [ ] 2.4 Add delete existing users function
- [ ] 2.5 Add bulk register function
- [ ] 2.6 Add verification function
- [ ] 2.7 Test script with dry-run

**Estimated Time**: 15 minutes
**Status**: Not Started

---

## Phase 3: Execute Registration (10 min)

### Tasks

- [ ] 3.1 Delete existing email-format users
- [ ] 3.2 Register syyun as admin
- [ ] 3.3 Register 53 users as regular users
- [ ] 3.4 Verify all 54 users registered
- [ ] 3.5 Check syyun has admin role
- [ ] 3.6 Check others have user role

**Estimated Time**: 10 minutes
**Status**: Not Started

---

## Phase 4: Testing & Verification (10 min)

### Tasks

- [ ] 4.1 Query all users from database
- [ ] 4.2 Verify user count = 54
- [ ] 4.3 Test login with syyun (admin)
- [ ] 4.4 Test login with sample regular user
- [ ] 4.5 Verify admin panel access for syyun
- [ ] 4.6 Verify regular users cannot access admin features

**Estimated Time**: 10 minutes
**Status**: Not Started

---

## Phase 5: Git Workflow (5 min)

### Tasks

- [ ] 5.1 Run `git status`
- [ ] 5.2 Run `git add -A`
- [ ] 5.3 Verify staging completeness
- [ ] 5.4 Commit with descriptive message
- [ ] 5.5 Push to 251014
- [ ] 5.6 Merge to main
- [ ] 5.7 Push main
- [ ] 5.8 Return to 251014

**Estimated Time**: 5 minutes
**Status**: Not Started

---

## Progress Tracking

```
Phase 1: [░░░░░] 0% (0/6 tasks)
Phase 2: [░░░░░] 0% (0/7 tasks)
Phase 3: [░░░░░] 0% (0/6 tasks)
Phase 4: [░░░░░] 0% (0/6 tasks)
Phase 5: [░░░░░] 0% (0/8 tasks)

Total: [░░░░░░░░░░] 0% (0/33 tasks)
```

---

## Acceptance Criteria

- [ ] All tasks completed and marked [x]
- [ ] 54 users registered successfully
- [ ] syyun is admin
- [ ] 53 users are regular users
- [ ] All users can login
- [ ] Git workflow completed

---

**Last Updated**: 2025-10-23
**Estimated Total Time**: 50 minutes
