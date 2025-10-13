# 회원 가입 승인 가이드

**작성일**: 2025-10-13
**작성자**: Claude Code
**대상**: Routing ML 시스템 관리자

---

## 📋 목차

1. [회원 가입 프로세스 개요](#회원-가입-프로세스-개요)
2. [신규 가입 신청 확인 방법](#신규-가입-신청-확인-방법)
3. [회원 승인 처리](#회원-승인-처리)
4. [회원 거절 처리](#회원-거절-처리)
5. [API 엔드포인트 상세](#api-엔드포인트-상세)
6. [데이터베이스 구조](#데이터베이스-구조)
7. [로그 확인](#로그-확인)

---

## 회원 가입 프로세스 개요

Routing ML 시스템은 **관리자 승인 방식**으로 회원 가입을 처리합니다.

### 전체 흐름

```
[사용자] 가입 신청
    ↓
[시스템] pending 상태로 저장
    ↓
[관리자] 신청 내역 확인
    ↓
    ├─→ [승인] approved 상태 → 로그인 가능
    └─→ [거절] rejected 상태 → 로그인 불가
```

### 사용자 상태 (status)

| 상태 | 설명 | 로그인 가능 여부 |
|------|------|----------------|
| `pending` | 가입 신청 대기 중 | ❌ 불가능 |
| `approved` | 관리자 승인 완료 | ✅ 가능 |
| `rejected` | 관리자 거절 | ❌ 불가능 |

---

## 신규 가입 신청 확인 방법

### 방법 1: API 직접 호출

관리자로 로그인한 상태에서 다음 API를 호출합니다:

```bash
curl -X GET "http://localhost:8000/api/auth/admin/pending-users" \
  -H "Cookie: routing_ml_token=YOUR_ADMIN_TOKEN"
```

**응답 예시**:
```json
{
  "users": [
    {
      "username": "hong.gildong",
      "full_name": "홍길동",
      "email": "hong@example.com",
      "created_at": "2025-10-13T10:30:00",
      "status": "pending"
    }
  ],
  "count": 1
}
```

### 방법 2: FastAPI Swagger UI

1. 브라우저에서 `http://10.204.2.28:8000/docs` 접속
2. 우측 상단 **Authorize** 버튼 클릭
3. 관리자 계정으로 로그인
4. `GET /api/auth/admin/pending-users` 엔드포인트 실행

### 방법 3: 서버 모니터 (추후 구현 예정)

서버 모니터 대시보드에서 대기 중인 회원 목록을 바로 확인하고 승인/거절 처리 가능.

---

## 회원 승인 처리

### API 호출 방법

```bash
curl -X POST "http://localhost:8000/api/auth/admin/approve" \
  -H "Content-Type: application/json" \
  -H "Cookie: routing_ml_token=YOUR_ADMIN_TOKEN" \
  -d '{
    "username": "hong.gildong",
    "make_admin": false
  }'
```

### 요청 파라미터

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `username` | string | ✅ | 승인할 사용자명 |
| `make_admin` | boolean | ❌ | 관리자 권한 부여 여부 (기본값: false) |

### 응답 예시

```json
{
  "username": "hong.gildong",
  "status": "approved",
  "is_admin": false,
  "approved_at": "2025-10-13T11:00:00",
  "message": "사용자 승인이 완료되었습니다"
}
```

### 승인 후 처리

1. ✅ 사용자 상태가 `pending` → `approved`로 변경
2. ✅ `approved_at` 타임스탬프 기록
3. ✅ 관리자로 승인한 경우 `is_admin = true` 설정
4. ✅ 감사 로그 자동 기록 (누가, 언제, 누구를 승인했는지)
5. ✅ 사용자는 이제 로그인 가능

---

## 회원 거절 처리

### API 호출 방법

```bash
curl -X POST "http://localhost:8000/api/auth/admin/reject" \
  -H "Content-Type: application/json" \
  -H "Cookie: routing_ml_token=YOUR_ADMIN_TOKEN" \
  -d '{
    "username": "hong.gildong",
    "reason": "회사 내부 직원이 아님"
  }'
```

### 요청 파라미터

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `username` | string | ✅ | 거절할 사용자명 |
| `reason` | string | ❌ | 거절 사유 (로그에 기록됨) |

### 응답 예시

```json
{
  "username": "hong.gildong",
  "status": "rejected",
  "is_admin": false,
  "rejected_at": "2025-10-13T11:05:00",
  "message": "사용자 가입이 거절되었습니다"
}
```

### 거절 후 처리

1. ✅ 사용자 상태가 `pending` → `rejected`로 변경
2. ✅ `rejected_at` 타임스탬프 기록
3. ✅ 거절 사유가 감사 로그에 기록
4. ✅ 사용자가 재가입하면 다시 `pending` 상태로 전환 (재심사 가능)

---

## API 엔드포인트 상세

### 1. 대기 중인 사용자 목록 조회

**엔드포인트**: `GET /api/auth/admin/pending-users`
**권한**: 관리자 전용
**인증**: JWT 토큰 필요

### 2. 사용자 승인

**엔드포인트**: `POST /api/auth/admin/approve`
**권한**: 관리자 전용
**인증**: JWT 토큰 필요

**Request Body**:
```json
{
  "username": "string",
  "make_admin": false
}
```

### 3. 사용자 거절

**엔드포인트**: `POST /api/auth/admin/reject`
**권한**: 관리자 전용
**인증**: JWT 토큰 필요

**Request Body**:
```json
{
  "username": "string",
  "reason": "string (optional)"
}
```

### 4. 전체 사용자 목록 조회

**엔드포인트**: `GET /api/auth/admin/users?limit=50&offset=0`
**권한**: 관리자 전용
**인증**: JWT 토큰 필요

---

## 데이터베이스 구조

### UserAccount 테이블 (SQLite: `models/rsl.db`)

```sql
CREATE TABLE user_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    normalized_username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    full_name TEXT,
    email TEXT,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected
    is_admin BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    last_login_at TIMESTAMP
);
```

### 주요 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `username` | TEXT | 사용자명 (고유) |
| `normalized_username` | TEXT | 정규화된 사용자명 (대소문자 구분 없음) |
| `display_name` | TEXT | 화면 표시명 |
| `password_hash` | TEXT | Argon2 해시된 비밀번호 |
| `status` | TEXT | 계정 상태 (pending/approved/rejected) |
| `is_admin` | BOOLEAN | 관리자 여부 |
| `approved_at` | TIMESTAMP | 승인 시각 |
| `rejected_at` | TIMESTAMP | 거절 시각 |

---

## 로그 확인

### 감사 로그 위치

모든 인증 관련 활동은 감사 로그에 기록됩니다:

```
logs/auth.audit.log
```

### 로그 형식 (JSON)

```json
{
  "timestamp": "2025-10-13T11:00:00.123Z",
  "level": "INFO",
  "message": "사용자 승인",
  "target": "hong.gildong",
  "approved_by": "admin",
  "make_admin": false
}
```

### 주요 이벤트

| 이벤트 | 메시지 | 기록 내용 |
|--------|--------|-----------|
| 가입 신청 | "가입 요청" | username |
| 가입 재신청 | "가입 재요청" | username |
| 사용자 승인 | "사용자 승인" | target, approved_by, make_admin |
| 사용자 거절 | "사용자 거절" | target, rejected_by, reason |
| 로그인 성공 | "로그인 성공" | username, client_host |
| 로그인 실패 | "로그인 실패" | username, client_host |

### 로그 확인 명령어

```bash
# 최근 20개 로그 확인
tail -n 20 logs/auth.audit.log

# 가입 관련 로그만 필터링
grep "가입" logs/auth.audit.log

# 특정 사용자 관련 로그
grep "hong.gildong" logs/auth.audit.log
```

---

## 자주 묻는 질문 (FAQ)

### Q1: 거절된 사용자가 다시 가입할 수 있나요?

**A**: 네, 가능합니다. 거절된 사용자가 동일한 아이디로 다시 가입 신청하면:
- 상태가 `rejected` → `pending`으로 변경
- 새 비밀번호로 업데이트
- 관리자가 다시 심사 가능

### Q2: 일반 사용자를 나중에 관리자로 승격할 수 있나요?

**A**: 현재는 승인 시점에만 관리자 권한을 부여할 수 있습니다. 추후 업데이트 예정입니다.

### Q3: 회원 가입 없이 시스템을 사용할 수 있나요?

**A**: 아니요, 모든 API는 JWT 인증이 필요합니다. 최초 관리자 계정은 시스템 부트스트랩 시 자동 생성됩니다.

### Q4: 비밀번호 재설정은 어떻게 하나요?

**A**: 로그인한 사용자는 `POST /api/auth/change-password` 엔드포인트를 사용하여 비밀번호를 변경할 수 있습니다.

---

## 보안 고려사항

### ✅ 적용된 보안 조치

1. **비밀번호 해싱**: Argon2 알고리즘 사용 (bcrypt보다 강력)
2. **JWT 토큰**: HttpOnly 쿠키로 전송 (XSS 방지)
3. **관리자 전용 엔드포인트**: `require_admin` 데코레이터로 접근 제어
4. **감사 로그**: 모든 인증 이벤트 기록
5. **정규화된 사용자명**: 대소문자 구분 없이 중복 방지

### ⚠️ 주의사항

1. 관리자 토큰이 유출되면 모든 사용자를 승인/거절할 수 있으므로 주의
2. 감사 로그는 정기적으로 백업 권장
3. rejected 상태 사용자도 재가입 가능하므로, 완전 차단이 필요하면 별도 처리 필요

---

## 다음 단계

### 계획된 기능 개선

- [ ] 서버 모니터 대시보드에 회원 관리 UI 추가
- [ ] 이메일 알림 (가입 신청 시 관리자에게, 승인/거절 시 사용자에게)
- [ ] 사용자 역할 관리 (admin, user, viewer 등 세분화)
- [ ] 회원 정보 수정 API
- [ ] 회원 삭제/비활성화 기능

---

**문서 버전**: 1.0
**최종 수정**: 2025-10-13 16:30 KST
