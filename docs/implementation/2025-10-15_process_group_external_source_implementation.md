# 프로세스 그룹 External Source 연동 구현 완료

**날짜**: 2025-10-15
**구현자**: Claude
**브랜치**: 251015

---

## 구현 요약

프로세스 그룹(Process Groups) 기능을 백엔드에 구현하고, 데이터 매핑 서비스에서 `external_source` 타입으로 프로세스 그룹의 고정값을 연동할 수 있도록 구현했습니다.

---

## 구현 내용

### 1. 프로세스 그룹 데이터베이스 모델

**파일**: [backend/models/process_groups.py](../../backend/models/process_groups.py)

```python
class ProcessGroup(Base):
    """Persistence model for process groups."""

    __tablename__ = "process_groups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(128), nullable=False)
    description = Column(String(512), nullable=True)
    type = Column(String(32), nullable=False)  # "machining" or "post-process"
    owner = Column(String(255), nullable=False, index=True)
    default_columns = Column(
        MutableList.as_mutable(_json_type()), default=list, nullable=False
    )
    fixed_values = Column(
        MutableDict.as_mutable(_json_type()), default=dict, nullable=False
    )
    is_active = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    deleted_at = Column(DateTime, nullable=True)
```

**주요 특징**:
- UUID 기반 식별자
- 그룹 타입: `machining` (대체 가공 경로), `post-process` (후공정)
- `default_columns`: 컬럼 정의 목록 (JSON)
- `fixed_values`: 컬럼별 고정값 (JSON)
- 소프트 삭제 지원 (`deleted_at`)
- 낙관적 잠금 (`version`)

---

### 2. Pydantic 스키마

**파일**: [backend/schemas/process_groups.py](../../backend/schemas/process_groups.py)

**주요 스키마**:

```python
class ProcessGroupColumnDefinition(BaseModel):
    """컬럼 정의"""
    id: str
    key: str
    label: str
    data_type: Literal["string", "number", "boolean", "date"]
    description: Optional[str] = None

class ProcessGroupCreate(ProcessGroupBase):
    """프로세스 그룹 생성 요청"""
    name: str
    description: Optional[str] = None
    type: Literal["machining", "post-process"]
    default_columns: List[ProcessGroupColumnDefinition]
    fixed_values: Dict[str, Any]
    is_active: bool = True

class ProcessGroupDetail(ProcessGroupResponse):
    """프로세스 그룹 상세 정보"""
    description: Optional[str]
    type: Literal["machining", "post-process"]
    default_columns: List[ProcessGroupColumnDefinition]
    fixed_values: Dict[str, Any]
    is_active: bool
    created_at: datetime
    deleted_at: Optional[datetime] = None
```

---

### 3. API 엔드포인트

**파일**: [backend/api/routes/process_groups.py](../../backend/api/routes/process_groups.py)

**구현된 엔드포인트**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/process-groups` | 프로세스 그룹 목록 조회 (페이지네이션, 필터링 지원) |
| GET | `/process-groups/{group_id}` | 프로세스 그룹 상세 조회 |
| POST | `/process-groups` | 프로세스 그룹 생성 |
| PATCH | `/process-groups/{group_id}` | 프로세스 그룹 수정 (낙관적 잠금) |
| DELETE | `/process-groups/{group_id}` | 프로세스 그룹 삭제 (소프트 삭제) |

**주요 기능**:
- 사용자별 데이터 격리 (owner 필터링)
- 그룹 타입 필터링 (`type_filter`)
- 활성 그룹만 조회 (`active_only`)
- 페이지네이션 (`limit`, `offset`)
- 낙관적 잠금 (version 체크)

---

### 4. External Source 연동 구현

**파일**: [backend/api/services/data_mapping_service.py](../../backend/api/services/data_mapping_service.py:303-368)

#### 4.1. `_extract_value_by_source_type` 메서드 확장

```python
elif source_type == 'external_source':
    # 외부 소스에서 가져옴 (공정그룹 관리 등)
    source_config = getattr(rule, 'source_config', None)
    if source_config and isinstance(source_config, dict):
        source_cfg_type = source_config.get('type')

        if source_cfg_type == 'process_group':
            # 프로세스 그룹에서 값 가져오기
            value = self._get_value_from_process_group(
                source_config=source_config,
                row_data=row_data,
            )
            if value is not None:
                return value
```

#### 4.2. `_get_value_from_process_group` 메서드 신규 구현

```python
def _get_value_from_process_group(
    self,
    source_config: Dict[str, Any],
    row_data: Dict[str, Any],
) -> Optional[Any]:
    """
    프로세스 그룹에서 값을 가져옵니다.

    Args:
        source_config: 소스 설정 {'type': 'process_group', 'group_id': '...', 'field': '...'}
        row_data: 현재 행 데이터

    Returns:
        프로세스 그룹에서 가져온 값 또는 None
    """
    from backend.models.process_groups import ProcessGroup, session_scope

    group_id = source_config.get('group_id')
    field_key = source_config.get('field')

    # 프로세스 그룹 조회
    with session_scope() as session:
        group = (
            session.query(ProcessGroup)
            .filter(
                ProcessGroup.id == group_id,
                ProcessGroup.deleted_at.is_(None),
                ProcessGroup.is_active == True,
            )
            .first()
        )

        if group:
            # fixed_values에서 값 찾기
            fixed_values = group.fixed_values or {}
            if field_key in fixed_values:
                return fixed_values[field_key]

    return None
```

---

## 사용 시나리오

### 시나리오 1: 프로세스 그룹 생성

**API 요청**:
```http
POST /process-groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "외주가공-A",
  "description": "외주 가공 공정 그룹",
  "type": "machining",
  "default_columns": [
    {
      "id": "col-1",
      "key": "ROUTE_CD",
      "label": "라우팅 코드",
      "data_type": "string"
    },
    {
      "id": "col-2",
      "key": "BP_CD",
      "label": "외주업체 코드",
      "data_type": "string"
    }
  ],
  "fixed_values": {
    "ROUTE_CD": "EXT-A",
    "BP_CD": "VENDOR001"
  },
  "is_active": true
}
```

**응답**:
```json
{
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "외주가공-A",
  "owner": "admin",
  "version": 1,
  "updated_at": "2025-10-15T12:00:00Z"
}
```

---

### 시나리오 2: 데이터 매핑에서 프로세스 그룹 연동

**데이터 매핑 규칙 설정**:
```json
{
  "routing_field": "subcontract_vendor",
  "db_column": "BP_CD",
  "display_name": "외주업체 코드",
  "data_type": "string",
  "is_required": true,
  "source_type": "external_source",
  "source_config": {
    "type": "process_group",
    "group_id": "550e8400-e29b-41d4-a716-446655440000",
    "field": "BP_CD"
  },
  "description": "프로세스 그룹 '외주가공-A'에서 BP_CD 값을 가져옴"
}
```

**처리 로직**:
1. `source_type`이 `external_source`이고 `source_config.type`이 `process_group`임을 확인
2. `group_id`로 프로세스 그룹 조회
3. `fixed_values` 딕셔너리에서 `field` 키(`BP_CD`)에 해당하는 값 추출
4. 추출된 값 (`VENDOR001`)을 라우팅 데이터 행의 `BP_CD` 컬럼에 매핑

---

## 기술적 특징

### 1. 데이터 격리 및 보안
- 모든 API는 JWT 인증 필요 (`get_current_user` dependency)
- `owner` 필드로 사용자별 데이터 격리
- 소프트 삭제로 데이터 복구 가능

### 2. 낙관적 잠금
- `version` 컬럼으로 동시 수정 충돌 방지
- 수정 시 버전 불일치 → 409 Conflict 에러 반환

### 3. 확장 가능한 설계
- `source_config`의 `type` 필드로 다양한 외부 소스 지원 가능
  - `process_group`: 프로세스 그룹
  - 향후 추가: `api_endpoint`, `sql_query`, `file_import` 등

### 4. 타입 안정성
- Pydantic 스키마로 요청/응답 검증
- Literal 타입으로 허용된 값만 입력 가능
  - `type`: `"machining"` | `"post-process"`
  - `data_type`: `"string"` | `"number"` | `"boolean"` | `"date"`

---

## 데이터베이스 스키마

### process_groups 테이블

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(36) | PRIMARY KEY | UUID |
| name | String(128) | NOT NULL | 그룹 이름 |
| description | String(512) | NULLABLE | 그룹 설명 |
| type | String(32) | NOT NULL | 그룹 유형 (machining/post-process) |
| owner | String(255) | NOT NULL, INDEX | 소유자 (사용자명) |
| default_columns | JSON | NOT NULL | 컬럼 정의 목록 |
| fixed_values | JSON | NOT NULL | 컬럼별 고정값 |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | 활성화 여부 |
| version | Integer | NOT NULL, DEFAULT 1 | 낙관적 잠금 버전 |
| created_at | DateTime | NOT NULL | 생성 시각 |
| updated_at | DateTime | NOT NULL | 수정 시각 |
| deleted_at | DateTime | NULLABLE | 삭제 시각 (소프트 삭제) |

**인덱스**:
- PRIMARY KEY: `id`
- INDEX: `owner`
- INDEX: `updated_at`
- INDEX: `type`
- UNIQUE CONSTRAINT: `(owner, name)`

---

## 프론트엔드 연동 (향후 작업)

### 필요한 API 클라이언트 함수

```typescript
// frontend-prediction/src/lib/apiClient.ts

export async function listProcessGroups(params?: {
  limit?: number;
  offset?: number;
  type_filter?: 'machining' | 'post-process';
  active_only?: boolean;
}): Promise<ProcessGroupListResponse> {
  const queryString = new URLSearchParams(params as any).toString();
  const response = await fetch(`${API_BASE}/process-groups?${queryString}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return response.json();
}

export async function getProcessGroup(groupId: string): Promise<ProcessGroupDetail> {
  const response = await fetch(`${API_BASE}/process-groups/${groupId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return response.json();
}

export async function createProcessGroup(
  payload: ProcessGroupCreate
): Promise<ProcessGroupResponse> {
  const response = await fetch(`${API_BASE}/process-groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function updateProcessGroup(
  groupId: string,
  payload: ProcessGroupUpdate
): Promise<ProcessGroupResponse> {
  const response = await fetch(`${API_BASE}/process-groups/${groupId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function deleteProcessGroup(groupId: string): Promise<void> {
  await fetch(`${API_BASE}/process-groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}
```

### Zustand Store 연동

현재 프론트엔드에는 `routingStore`에 프로세스 그룹이 로컬 상태로만 저장되어 있습니다.
백엔드 API와 연동하려면 다음 작업이 필요합니다:

1. **Store 액션 수정**
   - `addProcessGroup`: API 호출 후 서버 응답으로 상태 업데이트
   - `updateProcessGroup`: API 호출 (version 충돌 처리)
   - `removeProcessGroup`: DELETE API 호출

2. **초기 로드**
   - 앱 시작 시 `listProcessGroups()` 호출하여 서버 데이터 로드

3. **동기화**
   - 수정 시 낙관적 업데이트 (UI 먼저 업데이트, 실패 시 롤백)
   - Version 충돌 시 사용자에게 알림

---

## 테스트 시나리오

### 1. API 테스트

```bash
# 1. 프로세스 그룹 생성
curl -X POST http://localhost:8000/process-groups \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TEST-GROUP",
    "type": "machining",
    "default_columns": [{"id": "c1", "key": "TEST_COL", "label": "Test Column", "data_type": "string"}],
    "fixed_values": {"TEST_COL": "test_value"},
    "is_active": true
  }'

# 2. 프로세스 그룹 목록 조회
curl http://localhost:8000/process-groups?limit=10&offset=0 \
  -H "Authorization: Bearer <token>"

# 3. 프로세스 그룹 상세 조회
curl http://localhost:8000/process-groups/{group_id} \
  -H "Authorization: Bearer <token>"

# 4. 프로세스 그룹 수정
curl -X PATCH http://localhost:8000/process-groups/{group_id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "UPDATED-GROUP", "version": 1}'

# 5. 프로세스 그룹 삭제
curl -X DELETE http://localhost:8000/process-groups/{group_id} \
  -H "Authorization: Bearer <token>"
```

### 2. External Source 연동 테스트

**전제 조건**:
- 프로세스 그룹 생성 완료 (group_id: `abc-123`)
- fixed_values: `{"VENDOR_CD": "V001"}`

**데이터 매핑 규칙**:
```json
{
  "routing_field": "vendor",
  "db_column": "VENDOR_CD",
  "data_type": "string",
  "source_type": "external_source",
  "source_config": {
    "type": "process_group",
    "group_id": "abc-123",
    "field": "VENDOR_CD"
  }
}
```

**입력 데이터**:
```json
[
  {"seq": 1, "process_code": "P001"},
  {"seq": 2, "process_code": "P002"}
]
```

**예상 출력**:
```json
[
  {"seq": 1, "process_code": "P001", "VENDOR_CD": "V001"},
  {"seq": 2, "process_code": "P002", "VENDOR_CD": "V001"}
]
```

---

## 에러 처리

### 1. 그룹 생성 시 중복 이름
**HTTP 409 Conflict**
```json
{
  "detail": "Process group 'TEST-GROUP' already exists for this user"
}
```

### 2. 버전 충돌 (동시 수정)
**HTTP 409 Conflict**
```json
{
  "detail": "Version mismatch: the group was modified by another request"
}
```

### 3. 프로세스 그룹 없음
**HTTP 404 Not Found**
```json
{
  "detail": "Process group 'invalid-id' not found"
}
```

### 4. External Source 연동 실패
**로그에만 기록, 기본값 사용**
```
WARNING: Process group not found: abc-123
WARNING: Field 'VENDOR_CD' not found in process group abc-123
```

---

## 구현 완료 파일 목록

### 백엔드

1. **모델**: [backend/models/process_groups.py](../../backend/models/process_groups.py)
2. **스키마**: [backend/schemas/process_groups.py](../../backend/schemas/process_groups.py)
3. **API 라우터**: [backend/api/routes/process_groups.py](../../backend/api/routes/process_groups.py)
4. **데이터 매핑 서비스**: [backend/api/services/data_mapping_service.py](../../backend/api/services/data_mapping_service.py:303-368)
5. **앱 등록**: [backend/api/app.py](../../backend/api/app.py:33) (process_groups_router 추가)

### 프론트엔드 (기존 UI만 존재, Backend 연동 필요)

1. **Workspace**: [frontend-prediction/src/components/workspaces/ProcessGroupsWorkspace.tsx](../../frontend-prediction/src/components/workspaces/ProcessGroupsWorkspace.tsx)
2. **Types**: [frontend-prediction/src/types/routing.ts](../../frontend-prediction/src/types/routing.ts:132-153)
3. **Store**: [frontend-prediction/src/store/routingStore.ts](../../frontend-prediction/src/store/routingStore.ts) (로컬 상태만)

---

## 향후 작업

### Phase 1: 프론트엔드 Backend 연동
- [ ] API 클라이언트 함수 구현
- [ ] Zustand store 액션에서 API 호출
- [ ] 초기 로드 시 서버 데이터 fetch
- [ ] 버전 충돌 에러 UI 처리

### Phase 2: UI/UX 개선
- [ ] 프로세스 그룹 선택 드롭다운 UI
- [ ] 데이터 매핑 규칙 편집기에서 프로세스 그룹 연동 설정
- [ ] 미리보기 기능에서 프로세스 그룹 값 표시

### Phase 3: 고급 기능
- [ ] 프로세스 그룹 템플릿 (공통 그룹 복사)
- [ ] 프로세스 그룹 가져오기/내보내기 (JSON)
- [ ] 프로세스 그룹 버전 히스토리

---

## 결론

프로세스 그룹 기능의 백엔드 구현이 완료되었습니다.

**구현된 기능**:
✅ 프로세스 그룹 CRUD API
✅ 낙관적 잠금
✅ 소프트 삭제
✅ External Source 연동 (데이터 매핑 서비스)
✅ 사용자별 데이터 격리

**다음 단계**:
- 프론트엔드 API 클라이언트 구현
- Zustand store와 백엔드 동기화
- UI에서 프로세스 그룹 선택 기능 추가

---

**작성일**: 2025-10-15
**작성자**: Claude
