# Database Configuration API Specification

**문서 ID:** API-DB-CONFIG-2025-10-15
**버전:** 1.0.0
**작성일:** 2025-10-15
**Base URL:** `http://localhost:8000/api/database`

---

## 목차
1. [개요](#개요)
2. [인증](#인증)
3. [API 엔드포인트](#api-엔드포인트)
4. [데이터 모델](#데이터-모델)
5. [에러 코드](#에러-코드)

---

## 개요

Database Configuration API는 MSSQL 데이터베이스 연결 설정 및 뷰 이름을 런타임에서 관리할 수 있는 엔드포인트를 제공합니다.

### 주요 기능
- 데이터베이스 연결 설정 조회/변경
- 연결 테스트 (비밀번호 포함)
- 뷰 이름 동적 변경
- 데이터베이스 정보 조회

---

## 인증

모든 API 엔드포인트는 **JWT 인증**이 필요합니다.

```http
Authorization: Bearer <JWT_TOKEN>
```

---

## API 엔드포인트

### 1. 현재 설정 조회

#### `GET /api/database/config`

현재 데이터베이스 연결 설정을 조회합니다.

**인증:** 필수

**응답:**
```json
{
  "server": "K3-DB.ksm.co.kr,1433",
  "database": "KsmErp",
  "user": "FKSM_BI",
  "encrypt": false,
  "trust_certificate": true,
  "item_view": "dbo.BI_ITEM_INFO_VIEW",
  "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
  "work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
  "purchase_order_view": "dbo.BI_PUR_PO_VIEW",
  "password_saved": true
}
```

**응답 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `server` | string | MSSQL 서버 주소 (호스트:포트 또는 호스트,포트) |
| `database` | string | 데이터베이스 이름 |
| `user` | string | 사용자 ID |
| `encrypt` | boolean | 암호화 연결 사용 여부 |
| `trust_certificate` | boolean | 서버 인증서 신뢰 여부 |
| `item_view` | string | 품목 마스터 뷰 이름 |
| `routing_view` | string | 라우팅 기준 뷰 이름 |
| `work_result_view` | string | 작업 실적 뷰 이름 |
| `purchase_order_view` | string | 발주 뷰 이름 |
| `password_saved` | boolean | 비밀번호 저장 여부 (보안상 실제 비밀번호는 반환 안 함) |

**에러:**
- `401 Unauthorized` - 인증 토큰 없음 또는 만료
- `500 Internal Server Error` - 서버 내부 오류

---

### 2. 설정 변경

#### `POST /api/database/config`

데이터베이스 연결 설정을 변경합니다.

**인증:** 필수

**요청 바디:**
```json
{
  "server": "K3-DB.ksm.co.kr,1433",
  "database": "KsmErp",
  "user": "FKSM_BI",
  "password": "your_password_here",
  "encrypt": false,
  "trust_certificate": true,
  "item_view": "dbo.BI_ITEM_INFO_VIEW",
  "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
  "work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
  "purchase_order_view": "dbo.BI_PUR_PO_VIEW"
}
```

**요청 필드:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `server` | string | ✅ | MSSQL 서버 주소 |
| `database` | string | ✅ | 데이터베이스 이름 |
| `user` | string | ✅ | 사용자 ID |
| `password` | string | ⚠️ | 비밀번호 (변경 시에만 전송, 선택적) |
| `encrypt` | boolean | ❌ | 기본값: `false` |
| `trust_certificate` | boolean | ❌ | 기본값: `true` |
| `item_view` | string | ✅ | 품목 마스터 뷰 이름 |
| `routing_view` | string | ✅ | 라우팅 기준 뷰 이름 |
| `work_result_view` | string | ✅ | 작업 실적 뷰 이름 |
| `purchase_order_view` | string | ✅ | 발주 뷰 이름 |

**응답 (성공):**
```json
{
  "message": "설정이 저장되었습니다. 즉시 반영됩니다."
}
```

**응답 (실패):**
```json
{
  "detail": "허용되지 않은 문자가 포함되어 있습니다: item_view"
}
```

**에러:**
- `400 Bad Request` - 잘못된 요청 (필수 필드 누락, 유효하지 않은 값)
- `401 Unauthorized` - 인증 토큰 없음
- `422 Unprocessable Entity` - 유효성 검증 실패 (SQL 인젝션 시도 등)
- `500 Internal Server Error` - 서버 내부 오류

**Validation 규칙:**
- **뷰 이름**: 영문자, 숫자, `.`, `_`만 허용
- **뷰 이름 길이**: 최대 128자
- **서버 주소**: 빈 값 불가

---

### 3. 연결 테스트

#### `POST /api/database/test-connection`

데이터베이스 연결을 테스트합니다.

**인증:** 필수

**요청 바디:**
```json
{
  "server": "K3-DB.ksm.co.kr,1433",
  "database": "KsmErp",
  "user": "FKSM_BI",
  "password": "your_password_here",
  "encrypt": false,
  "trust_certificate": true,
  "item_view": "dbo.BI_ITEM_INFO_VIEW",
  "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
  "work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
  "purchase_order_view": "dbo.BI_PUR_PO_VIEW"
}
```

**요청 필드:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `server` | string | ✅ | MSSQL 서버 주소 |
| `database` | string | ✅ | 데이터베이스 이름 |
| `user` | string | ✅ | 사용자 ID |
| `password` | string | ✅ | 비밀번호 (테스트용, 저장 안 함) |
| `encrypt` | boolean | ❌ | 기본값: `false` |
| `trust_certificate` | boolean | ❌ | 기본값: `true` |
| `item_view` | string | ⚠️ | 품목 뷰 (선택, 뷰 접근 테스트 시 사용) |
| `routing_view` | string | ⚠️ | 라우팅 뷰 (선택) |
| `work_result_view` | string | ⚠️ | 작업 실적 뷰 (선택) |
| `purchase_order_view` | string | ⚠️ | 발주 뷰 (선택) |

**응답 (성공):**
```json
{
  "success": true,
  "message": "데이터베이스 연결 성공",
  "details": {
    "connection_status": "정상",
    "server": "K3-DB",
    "database": "KsmErp",
    "views": {
      "item_view": true,
      "routing_view": true,
      "work_result_view": true,
      "purchase_order_view": false
    }
  }
}
```

**응답 (실패):**
```json
{
  "success": false,
  "message": "데이터베이스 연결 실패: Login failed for user 'FKSM_BI'",
  "details": {
    "connection_status": "오류: Login failed",
    "server": "K3-DB.ksm.co.kr,1433",
    "database": "KsmErp"
  }
}
```

**응답 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 연결 성공 여부 |
| `message` | string | 결과 메시지 |
| `details.connection_status` | string | 연결 상태 ("정상" 또는 에러 메시지) |
| `details.server` | string | 실제 연결된 서버명 |
| `details.database` | string | 실제 연결된 데이터베이스명 |
| `details.views` | object | 각 뷰의 접근 가능 여부 (true/false) |

**에러:**
- `401 Unauthorized` - 인증 토큰 없음
- `500 Internal Server Error` - 서버 내부 오류

**참고:**
- 연결 테스트는 **현재 설정을 변경하지 않습니다**.
- 비밀번호는 테스트에만 사용되고 서버에 저장되지 않습니다.
- 뷰 접근 테스트는 각 뷰에 대해 `SELECT TOP 1` 쿼리를 실행합니다.

---

### 4. 데이터베이스 정보 조회

#### `GET /api/database/info`

현재 연결된 데이터베이스의 정보를 조회합니다.

**인증:** 필수

**응답:**
```json
{
  "connection_status": "정상",
  "server": "K3-DB",
  "database": "KsmErp",
  "database_size_mb": 1234.56,
  "tables_info": {
    "item_master": {
      "name": "dbo.BI_ITEM_INFO_VIEW",
      "row_count": 15000,
      "last_updated": "2025-10-15T10:30:00Z"
    },
    "routing": {
      "name": "dbo.BI_ROUTING_HIS_VIEW",
      "row_count": 8500,
      "last_updated": "2025-10-15T09:15:00Z"
    },
    "work_result": {
      "name": "dbo.BI_WORK_ORDER_RESULTS",
      "row_count": 25000,
      "last_updated": "2025-10-15T11:00:00Z"
    },
    "purchase_order": {
      "name": "dbo.BI_PUR_PO_VIEW",
      "row_count": 3200,
      "last_updated": "2025-10-15T08:45:00Z"
    }
  }
}
```

**응답 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `connection_status` | string | 연결 상태 ("정상" 또는 에러 메시지) |
| `server` | string | 서버명 |
| `database` | string | 데이터베이스명 |
| `database_size_mb` | number | 데이터베이스 크기 (MB) |
| `tables_info` | object | 각 테이블/뷰의 정보 |
| `tables_info.*.name` | string | 실제 뷰 이름 |
| `tables_info.*.row_count` | number | 행 개수 (근사치) |
| `tables_info.*.last_updated` | string | 마지막 업데이트 시간 (ISO 8601) |

**에러:**
- `401 Unauthorized` - 인증 토큰 없음
- `500 Internal Server Error` - 서버 내부 오류 (DB 연결 불가)

---

## 데이터 모델

### DatabaseConfig

```typescript
interface DatabaseConfig {
  server: string;                // MSSQL 서버 주소
  database: string;              // 데이터베이스 이름
  user: string;                  // 사용자 ID
  password?: string;             // 비밀번호 (선택적)
  encrypt: boolean;              // 암호화 연결 사용
  trust_certificate: boolean;    // 인증서 신뢰
  item_view: string;             // 품목 뷰 이름
  routing_view: string;          // 라우팅 뷰 이름
  work_result_view: string;      // 작업 실적 뷰 이름
  purchase_order_view: string;   // 발주 뷰 이름
  password_saved?: boolean;      // 비밀번호 저장 여부 (응답만)
}
```

### ConnectionTestPayload

```typescript
interface ConnectionTestPayload {
  server: string;
  database: string;
  user: string;
  password: string;              // 필수
  encrypt: boolean;
  trust_certificate: boolean;
  item_view?: string;            // 선택적
  routing_view?: string;
  work_result_view?: string;
  purchase_order_view?: string;
}
```

### ConnectionTestResponse

```typescript
interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details: {
    connection_status: string;
    server: string;
    database: string;
    views?: {
      item_view: boolean;
      routing_view: boolean;
      work_result_view: boolean;
      purchase_order_view: boolean;
    };
  };
}
```

### DatabaseInfo

```typescript
interface DatabaseInfo {
  connection_status: string;
  server: string;
  database: string;
  database_size_mb?: number;
  tables_info?: {
    [key: string]: {
      name: string;
      row_count: number;
      last_updated: string;
    };
  };
}
```

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| `200 OK` | 성공 | 요청이 성공적으로 처리됨 |
| `400 Bad Request` | 잘못된 요청 | 필수 필드 누락 또는 잘못된 형식 |
| `401 Unauthorized` | 인증 실패 | JWT 토큰 없음 또는 만료 |
| `422 Unprocessable Entity` | 유효성 검증 실패 | SQL 인젝션 시도, 허용되지 않은 문자 등 |
| `500 Internal Server Error` | 서버 오류 | 예상치 못한 서버 내부 오류 |

### 에러 응답 형식

```json
{
  "detail": "에러 메시지",
  "field": "server",           // 선택적: 문제가 있는 필드
  "code": "INVALID_FORMAT"     // 선택적: 에러 코드
}
```

### 에러 코드 목록

| 코드 | 설명 |
|------|------|
| `INVALID_FORMAT` | 필드 형식이 올바르지 않음 |
| `INVALID_CHARACTERS` | 허용되지 않은 문자 포함 |
| `FIELD_REQUIRED` | 필수 필드 누락 |
| `CONNECTION_FAILED` | 데이터베이스 연결 실패 |
| `AUTHENTICATION_FAILED` | 인증 실패 (잘못된 사용자명/비밀번호) |
| `VIEW_NOT_FOUND` | 뷰를 찾을 수 없음 |
| `PERMISSION_DENIED` | 권한 부족 |

---

## 예제 시나리오

### 시나리오 1: 초기 설정 로드 후 연결 테스트

```bash
# 1. 현재 설정 조회
curl -X GET http://localhost:8000/api/database/config \
  -H "Authorization: Bearer <JWT_TOKEN>"

# 응답:
# {
#   "server": "K3-DB.ksm.co.kr,1433",
#   "database": "KsmErp",
#   "user": "FKSM_BI",
#   ...
# }

# 2. 연결 테스트 (비밀번호 포함)
curl -X POST http://localhost:8000/api/database/test-connection \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "server": "K3-DB.ksm.co.kr,1433",
    "database": "KsmErp",
    "user": "FKSM_BI",
    "password": "your_password_here",
    "encrypt": false,
    "trust_certificate": true,
    "item_view": "dbo.BI_ITEM_INFO_VIEW"
  }'

# 응답:
# {
#   "success": true,
#   "message": "데이터베이스 연결 성공",
#   "details": { ... }
# }
```

### 시나리오 2: 뷰 이름 변경

```bash
# 뷰 이름 변경
curl -X POST http://localhost:8000/api/database/config \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "server": "K3-DB.ksm.co.kr,1433",
    "database": "KsmErp",
    "user": "FKSM_BI",
    "password": "your_password_here",
    "encrypt": false,
    "trust_certificate": true,
    "item_view": "dbo.BI_ITEM_INFO_VIEW_TEST",
    "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
    "work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
    "purchase_order_view": "dbo.BI_PUR_PO_VIEW"
  }'

# 응답:
# {
#   "message": "설정이 저장되었습니다. 즉시 반영됩니다."
# }
```

---

**문서 버전:** 1.0.0
**최종 업데이트:** 2025-10-15
**관련 문서:**
- [DATABASE_RUNTIME_CONFIG_DESIGN.md](../../Design/DATABASE_RUNTIME_CONFIG_DESIGN.md)
- [DATABASE_RUNTIME_CONFIG_OPERATION_GUIDE.md](../DATABASE_RUNTIME_CONFIG_OPERATION_GUIDE.md)
