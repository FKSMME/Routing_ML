# Database Runtime Configuration - 설계 문서

**작성 시작:** 2025-10-15 09:47:40
**작성자:** Claude (AI Assistant)
**프로젝트:** Routing ML System - Database Configuration Enhancement

---

## 1. 요구사항 정리

### 1.1 목표
- MSSQL 데이터베이스 연결 설정 및 뷰 이름을 **런타임에서 UI를 통해 변경** 가능하도록 개선
- 기존 환경변수(`.env`) 방식에서 **config_store 기반 설정 관리**로 전환
- 설정 변경 후 **애플리케이션 재시작 없이 즉시 반영**

### 1.2 현재 상태 분석

#### 기존 구조
1. **연결 설정**: `backend/database.py`에서 환경변수로 관리
   - `MSSQL_SERVER`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`
   - `MSSQL_ENCRYPT`, `MSSQL_TRUST_CERTIFICATE`

2. **뷰 이름**: 환경변수 기반 getter 함수
   - `get_item_view_name()` → `MSSQL_ITEM_VIEW` (기본: `dbo.BI_ITEM_INFO_VIEW`)
   - `get_routing_view_name()` → `MSSQL_ROUTING_VIEW` (기본: `dbo.BI_ROUTING_HIS_VIEW`)
   - `get_work_result_view_name()` → `MSSQL_WORK_RESULT_VIEW` (기본: `dbo.BI_WORK_ORDER_RESULTS`)
   - `get_purchase_order_view_name()` → `MSSQL_PURCHASE_ORDER_VIEW` (기본: `dbo.BI_PUR_PO_VIEW`)

3. **설정 저장**: `backend/api/routes/database_config.py`
   - POST `/api/database/config`: `.env` 파일에 저장 (파일 잠금 + 원자적 쓰기)
   - **문제점**: 재시작 필요, 환경변수만 사용

4. **config_store**: `common/config_store.py`
   - `DataSourceConfig`: 오프라인 데이터셋 경로, 테이블 프로파일 등 관리
   - **현재는 MSSQL 연결 정보 미포함**

#### 문제점
- 설정 변경 시 `.env` 파일 수정 → 애플리케이션 재시작 필요
- UI에서 실시간 테스트/변경 불가능
- 비밀번호를 `.env` 파일에 평문 저장 (보안 위험)
- `config_store`와 `.env` 설정이 분리되어 관리 복잡도 증가

### 1.3 최종 요구사항 확정

#### A. 비밀번호 저장 정책
- **결정**: `workflow_settings.json` (config_store)에 암호화하지 않고 저장
  - 이유: 파일 권한 제어로 보안 관리 (운영 환경에서 파일 접근 제한)
  - 로그 출력 시 비밀번호 마스킹 필수 (`****`)

#### B. config_store 전략
- **결정**: `DataSourceConfig`를 확장하여 MSSQL 연결 정보 포함
  - 새 필드 추가:
    ```python
    mssql_server: str = "K3-DB.ksm.co.kr,1433"
    mssql_database: str = "KsmErp"
    mssql_user: str = "FKSM_BI"
    mssql_password: str = ""
    mssql_encrypt: bool = False
    mssql_trust_certificate: bool = True
    mssql_item_view: str = "dbo.BI_ITEM_INFO_VIEW"
    mssql_routing_view: str = "dbo.BI_ROUTING_HIS_VIEW"
    mssql_work_result_view: str = "dbo.BI_WORK_ORDER_RESULTS"
    mssql_purchase_order_view: str = "dbo.BI_PUR_PO_VIEW"
    ```

#### C. UI 필드
- **Database Settings 화면** (프런트엔드)에 추가할 필드:
  1. 서버 주소 (Server)
  2. 데이터베이스 이름 (Database)
  3. 사용자 ID (User)
  4. 비밀번호 (Password) - 마스킹 처리
  5. 암호화 옵션 (Encrypt) - 체크박스
  6. 인증서 신뢰 (Trust Certificate) - 체크박스
  7. 품목 뷰 이름 (Item View)
  8. 라우팅 뷰 이름 (Routing View)
  9. 작업 결과 뷰 이름 (Work Result View)
  10. 발주 뷰 이름 (Purchase Order View)

---

## 2. 설계 상세

### 2.1 아키텍처 플로우

```
[Frontend UI]
    ↓ (사용자 입력)
    ↓ POST /api/database/config
    ↓
[Backend API: database_config.py]
    ↓ update_mssql_runtime_config()
    ↓ config_store.update_data_source_config()
    ↓
[Config Store: workflow_settings.json]
    ↓ (파일 저장 + 메모리 캐시 갱신)
    ↓
[Database Layer: database.py]
    ↓ get_item_view_name() 등 getter 함수
    ↓ (런타임 설정 반영)
    ↓
[MSSQL Connection]
```

### 2.2 백엔드 Config 구조 변경

#### 2.2.1 `common/config_store.py` - DataSourceConfig 확장

```python
@dataclass
class DataSourceConfig:
    """MSSQL 연결 정보 및 데이터셋 구성."""

    # 기존 필드
    offline_dataset_path: Optional[str] = None
    default_table: str = "dbo_BI_ITEM_INFO_VIEW"
    # ... (기존 필드 유지)

    # 새로 추가할 MSSQL 연결 정보
    mssql_server: str = "K3-DB.ksm.co.kr,1433"
    mssql_database: str = "KsmErp"
    mssql_user: str = "FKSM_BI"
    mssql_password: str = ""  # 평문 저장 (파일 권한으로 보안)
    mssql_encrypt: bool = False
    mssql_trust_certificate: bool = True

    # 뷰 이름
    mssql_item_view: str = "dbo.BI_ITEM_INFO_VIEW"
    mssql_routing_view: str = "dbo.BI_ROUTING_HIS_VIEW"
    mssql_work_result_view: str = "dbo.BI_WORK_ORDER_RESULTS"
    mssql_purchase_order_view: str = "dbo.BI_PUR_PO_VIEW"
```

#### 2.2.2 `backend/database.py` - 런타임 설정 처리

**변경 전략:**
1. 기존 환경변수 우선순위 유지 (하위 호환성)
2. config_store 값이 있으면 우선 사용
3. 캐시 무효화 메커니즘 추가

**주요 함수 수정:**
```python
def get_item_view_name() -> str:
    """config_store → 환경변수 → 기본값 순으로 조회"""
    from common.config_store import workflow_config_store
    config = workflow_config_store.get_data_source_config()
    if config.mssql_item_view:
        return config.mssql_item_view
    return _get_env_view("MSSQL_ITEM_VIEW", DEFAULT_ITEM_VIEW)

def update_mssql_runtime_config(...) -> None:
    """런타임 설정 갱신 + config_store 저장"""
    from common.config_store import workflow_config_store

    # config_store 업데이트
    config = workflow_config_store.get_data_source_config()
    if server is not None:
        config.mssql_server = server
    # ... (모든 필드 업데이트)

    workflow_config_store.update_data_source_config(config)

    # 캐시 무효화
    invalidate_all_caches()

    # 연결 풀 리셋
    cleanup_connections()
```

### 2.3 백엔드 API 확장

#### 2.3.1 `backend/api/routes/database_config.py`

**GET `/api/database/config` 응답 확장:**
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
  "purchase_order_view": "dbo.BI_PUR_PO_VIEW"
}
```

**POST `/api/database/config` 요청 스키마:**
```python
class DatabaseConfig(BaseModel):
    server: str
    database: str
    user: str
    password: Optional[str] = None  # 변경 시에만 전송
    encrypt: bool = False
    trust_certificate: bool = True
    item_view: str = "dbo.BI_ITEM_INFO_VIEW"
    routing_view: str = "dbo.BI_ROUTING_HIS_VIEW"
    work_result_view: str = "dbo.BI_WORK_ORDER_RESULTS"
    purchase_order_view: str = "dbo.BI_PUR_PO_VIEW"
```

**POST `/api/database/test-connection` 요청 스키마:**
```python
class DatabaseConnectionTest(BaseModel):
    # 기존 필드 유지
    # 뷰 접근 테스트 추가
    test_views: bool = True  # 뷰 접근 가능 여부 테스트
```

**GET `/api/database/info` 응답 확장:**
- `tables_info`에서 동적 뷰 이름 사용 (하드코딩 제거)

### 2.4 프런트엔드 UI 설계

#### 2.4.1 Database Settings 컴포넌트 구조

**위치:** `frontend-training/src/components/DatabaseSettings.tsx` (신규 생성 추정)

**UI 구성:**
```
┌─────────────────────────────────────────┐
│ Database Settings                       │
├─────────────────────────────────────────┤
│ Connection Settings                     │
│  Server:        [K3-DB.ksm.co.kr,1433 ]│
│  Database:      [KsmErp               ]│
│  User:          [FKSM_BI              ]│
│  Password:      [••••••••]  [Show]     │
│  □ Encrypt                             │
│  ☑ Trust Certificate                   │
│                                         │
│ View Settings                           │
│  Item View:     [dbo.BI_ITEM_INFO_VIEW]│
│  Routing View:  [dbo.BI_ROUTING_HIS_VIEW]│
│  Work Result:   [dbo.BI_WORK_ORDER_RESULTS]│
│  Purchase:      [dbo.BI_PUR_PO_VIEW]   │
│                                         │
│ [Test Connection] [Save] [Cancel]      │
└─────────────────────────────────────────┘
```

**상태 관리:**
- Zustand store: `useDatabaseConfigStore`
- 입력 validation:
  - 서버 주소: 빈 값 불가, 형식 검증 (`host:port` 또는 `host,port`)
  - 뷰 이름: SQL 인젝션 방지 (영문자, 숫자, `_`, `.`만 허용)

**저장 플로우:**
1. 사용자 입력
2. Validation
3. Test Connection (선택적, 권장)
4. POST `/api/database/config`
5. 성공 시: Toast 알림 "설정이 저장되었습니다"
6. 실패 시: 에러 메시지 표시

---

## 3. 각 단계별 변경 범위

### 3.1 백엔드 Config 저장 (사용자 담당)

**파일:**
- `common/config_store.py`
  - `DataSourceConfig` 클래스: 필드 추가
  - `to_dict()`, `from_dict()` 메서드 수정

**변경 내용:**
```python
# 추가 필드
mssql_server: str = field(default="K3-DB.ksm.co.kr,1433")
mssql_database: str = field(default="KsmErp")
mssql_user: str = field(default="FKSM_BI")
mssql_password: str = field(default="")
mssql_encrypt: bool = field(default=False)
mssql_trust_certificate: bool = field(default=True)
mssql_item_view: str = field(default="dbo.BI_ITEM_INFO_VIEW")
mssql_routing_view: str = field(default="dbo.BI_ROUTING_HIS_VIEW")
mssql_work_result_view: str = field(default="dbo.BI_WORK_ORDER_RESULTS")
mssql_purchase_order_view: str = field(default="dbo.BI_PUR_PO_VIEW")
```

**단위 테스트:**
- `tests/test_config_store.py` 추가/수정
  - `test_data_source_config_to_dict_with_mssql()`
  - `test_data_source_config_from_dict_with_mssql()`

### 3.2 백엔드 database.py 수정 (사용자 담당)

**파일:**
- `backend/database.py`

**변경 함수:**
1. `get_item_view_name()`: config_store 우선 조회
2. `get_routing_view_name()`: config_store 우선 조회
3. `get_work_result_view_name()`: config_store 우선 조회
4. `get_purchase_order_view_name()`: config_store 우선 조회
5. `update_mssql_runtime_config()`: config_store 저장 추가
6. `_create_mssql_connection()`: config_store에서 연결 정보 우선 조회
7. **신규 함수:**
   ```python
   def invalidate_all_caches() -> None:
       """모든 캐시 무효화 (설정 변경 후 호출)"""
       invalidate_item_master_cache()
       invalidate_routing_cache()
       cleanup_connections()
   ```

**테스트:**
- `tests/test_database.py` 추가/수정
  - `test_get_view_name_from_config_store()`
  - `test_update_mssql_runtime_config_updates_config_store()`
  - `test_invalidate_all_caches()`

### 3.3 백엔드 API 확장 (사용자 담당)

**파일:**
- `backend/api/routes/database_config.py`

**수정 API:**
1. `GET /api/database/config`:
   - 응답에 뷰 이름 4개 추가
   - config_store에서 읽기

2. `POST /api/database/config`:
   - 요청 스키마에 뷰 이름 4개 추가
   - `update_mssql_runtime_config()` 호출 시 뷰 이름 전달
   - **`.env` 파일 저장 제거** (config_store만 사용)
   - `invalidate_all_caches()` 호출

3. `POST /api/database/test-connection`:
   - 뷰 접근 테스트 추가 (4개 뷰 각각 `SELECT TOP 1` 실행)

4. `GET /api/database/info`:
   - 하드코딩된 뷰 이름 제거
   - `get_item_view_name()` 등 getter 함수 사용

**테스트:**
- `tests/backend/api/test_database_config.py` 추가
  - `test_get_database_config_with_views()`
  - `test_update_database_config_with_views()`
  - `test_test_connection_with_views()`

### 3.4 프런트엔드 UI (Claude 담당)

**파일:**
- `frontend-training/src/components/DatabaseSettings.tsx` (신규 또는 기존 수정)
- `frontend-training/src/lib/apiClient.ts` (타입 추가)
- `frontend-training/src/stores/databaseConfigStore.ts` (신규)

**구현 내용:**
1. **DatabaseSettings 컴포넌트:**
   - 입력 폼 (10개 필드)
   - Validation 로직
   - Test Connection 버튼
   - Save/Cancel 버튼

2. **apiClient.ts:**
   ```typescript
   export interface DatabaseConfig {
     server: string;
     database: string;
     user: string;
     password?: string;
     encrypt: boolean;
     trust_certificate: boolean;
     item_view: string;
     routing_view: string;
     work_result_view: string;
     purchase_order_view: string;
   }

   export async function getDatabaseConfig(): Promise<DatabaseConfig>
   export async function updateDatabaseConfig(config: DatabaseConfig): Promise<any>
   export async function testDatabaseConnection(config: DatabaseConfig): Promise<any>
   ```

3. **Zustand Store:**
   ```typescript
   interface DatabaseConfigState {
     config: DatabaseConfig | null;
     loading: boolean;
     error: string | null;
     fetchConfig: () => Promise<void>;
     updateConfig: (config: DatabaseConfig) => Promise<void>;
     testConnection: (config: DatabaseConfig) => Promise<boolean>;
   }
   ```

**테스트:**
- 수동 QA 시나리오 (Claude 담당)

### 3.5 마이그레이션 스크립트 (Claude 담당)

**파일:**
- `scripts/migrate_database_config.py` (신규)

**기능:**
- `.env` 파일에서 MSSQL 설정 읽기
- `config/workflow_settings.json`의 `data_source` 섹션에 병합
- 백업 생성 (`workflow_settings.json.backup`)

**실행:**
```bash
python scripts/migrate_database_config.py
```

---

## 4. 잠재 위험 요소 및 대응

### 4.1 config_store 충돌
**위험:** 여러 스레드에서 동시 업데이트 시 데이터 손실
**대응:**
- `WorkflowConfigStore._lock` (RLock) 활용
- `apply_patch_atomic()` 메서드 사용

### 4.2 기존 캐시
**위험:** `_fetch_*_cached`가 구 뷰 이름 적용
**대응:**
- `invalidate_all_caches()` 함수 추가
- 설정 변경 시 자동 호출

### 4.3 권한 이슈
**위험:** `workflow_settings.json` 쓰기 권한 없음
**대응:**
- 파일 생성 시 권한 확인 (예외 처리)
- 에러 메시지: "설정 파일 쓰기 권한이 없습니다. 관리자에게 문의하세요."

### 4.4 비밀번호 저장
**위험:** 평문 저장 시 접근 제한 필요
**대응:**
- 파일 권한: `chmod 600 config/workflow_settings.json` (Unix)
- 로그 마스킹: `logger.info("연결 정보: %s", mask_password(config))`
  ```python
  def mask_password(config: dict) -> dict:
      masked = config.copy()
      if "password" in masked:
          masked["password"] = "****"
      return masked
  ```

### 4.5 레이스 조건
**위험:** 설정 변경 직후 일부 요청이 이전 설정 사용
**대응:**
- `update_mssql_runtime_config()` 후 연결 풀 리셋
- 캐시 무효화로 새 연결 강제

---

## 5. 테스트 시나리오

### 5.1 단위 테스트 (사용자 담당)
1. `config_store.py`:
   - DataSourceConfig 직렬화/역직렬화
   - 기본값 검증
2. `database.py`:
   - getter 함수 우선순위 (config_store > 환경변수 > 기본값)
   - `update_mssql_runtime_config()` 저장 검증
3. `database_config.py`:
   - GET/POST API 응답 검증

### 5.2 통합 테스트 (사용자 담당)
1. API → database.py → MSSQL 연결 플로우
2. 설정 변경 후 캐시 무효화 확인
3. 뷰 이름 변경 후 쿼리 정상 작동

### 5.3 QA 시나리오 (Claude 담당)
1. **기본 설정 로드:**
   - Database Settings 화면 열기
   - 기존 설정 표시 확인
2. **연결 테스트:**
   - 잘못된 서버 주소 입력 → 에러 메시지 확인
   - 올바른 설정 → "연결 성공" 메시지
3. **뷰 이름 변경:**
   - Item View를 `dbo.BI_ITEM_INFO_VIEW_TEST`로 변경
   - Save → 품목 조회 API 호출 → 새 뷰 사용 확인
4. **비밀번호 변경:**
   - 비밀번호 입력 → 마스킹 확인
   - Save → 로그에 `****` 표시 확인
5. **캐시 무효화:**
   - 뷰 이름 변경 전후 데이터 조회
   - 새 데이터 반환 확인

---

## 6. 마일스톤 및 일정

**Day 0-1:** 요구사항 정리 및 설계 확정 ✅ (완료: 2025-10-15 09:47)
**Day 1-3:** 백엔드 Config 구조 및 런타임 처리 (사용자)
**Day 3-4:** 백엔드 API 확장 (사용자)
**Day 4-6:** 프런트엔드 UI (Claude)
**Day 6-7:** 통합 테스트/QA (상호)
**Day 7-8:** 문서화 및 릴리즈 준비 (상호)

---

## 7. 다음 단계

### Claude 담당 (즉시 착수):
1. ✅ 설계 문서 작성 완료
2. 🔄 마이그레이션 스크립트 작성
3. 🔄 운영 가이드 초안 작성

### 사용자 담당 (대기):
1. `common/config_store.py` 수정
2. `backend/database.py` 수정
3. `backend/api/routes/database_config.py` 수정
4. 단위 테스트 작성

---

**문서 업데이트:** 2025-10-15 09:47:40
**상태:** 설계 확정 완료, 구현 대기
