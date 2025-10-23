# PRD: User Bulk Registration

**Date**: 2025-10-23
**Priority**: P0 (Critical)
**Status**: Planning

---

## Executive Summary

Register 54 users with standardized credentials and clean up existing email-format accounts.

### Quick Facts
- **Users to Register**: 54 users
- **Admin User**: syyun only
- **Regular Users**: 53 users
- **Default Password**: ksm@1234
- **Username Format**: ID only (not email)

---

## Problem Statement

### Current State
- Users registered with email format (e.g., syyun@ksm.co.kr)
- Need to switch to username-only format (e.g., syyun)
- Need bulk user registration

### Desired State
- All users registered with username format
- syyun: admin role
- Others: user role (can be promoted via admin panel)
- Standardized password: ksm@1234

---

## Requirements

### User List (54 users)

**Admin (1)**:
- syyun (윤수용) - ADMIN

**Regular Users (53)**:
1. sjlee (이석중)
2. sylee (이승용)
3. YHLee (이연홍)
4. hmkim (김형민)
5. sangmkim (김상민-FKSM)
6. kjlee (이경재)
7. dsseo (서동수)
8. nrkim (김나리)
9. kbkim (김기범)
10. tkyunkim (김택균)
11. ecshin (신은철)
12. celim (임채언)
13. shyoon (윤석현)
14. jaeblee (이재범)
15. hmna (나현민)
16. moongkim (김문기)
17. bjpark (박지석)
18. sbshin (신상범)
19. crpark (박차라)
20. jwjun (전재원)
21. nylee (이남용)
22. mgsong (송민권)
23. minscho (조민상)
24. yskang (강연수)
25. minjea (김민제)
26. sjyang (양소진)
27. jihmin (민지현)
28. dhsung (성대훈)
29. smkim (김상민-KSM)
30. splee (이순필)
31. jongjlee (이종주)
32. kjhwang (황광준)
33. jyshin (신주용)
34. jrcho (조정래)
35. gwangman (안광민)
36. ijyoon (윤인중)
37. csoh (오창성)
38. arsmproctec (강동진)
39. kbim (임경복)
40. sungjbang (방성진)
41. ywoh (오영원)
42. smko (고승민)
43. minsukim (김민수)
44. jhapark (박정하)
45. shjun (전상현)
46. khoh (오기호)
47. ygkim (김영곤)
48. jnmoon (문정남)
49. drkim (김동록)
50. hgjung (정혜경)
51. hdbyun (변희동)
52. mwkim (김민우)
53. joohwan (김주환)
54. choh (오창훈)

Note: "변호석" has duplicate ID "khoh" with "오기호" - needs resolution

---

## Phase Breakdown

### Phase 1: Preparation (10 min)
1. Read auth service code
2. Check database schema
3. Identify delete/register endpoints
4. Create user registration script

### Phase 2: Cleanup (5 min)
1. Check existing users
2. Delete email-format accounts (syyun@ksm.co.kr)
3. Verify deletion

### Phase 3: Bulk Registration (10 min)
1. Create Python script for bulk registration
2. Register syyun as admin
3. Register 53 users as regular users
4. Verify registration

### Phase 4: Verification (5 min)
1. Query all users
2. Verify syyun is admin
3. Verify others are regular users
4. Test login with sample accounts

---

## Success Criteria

- [ ] 54 users registered
- [ ] syyun has admin role
- [ ] 53 users have user role
- [ ] All users can login with ksm@1234
- [ ] Old email-format accounts deleted

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
