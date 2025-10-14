# New Profile 기능 구현 실행 로그

**작업 일시**: 2025-10-13
**담당**: Claude Code (AI Assistant)
**상태**: ✅ 완료

---

## 📋 작업 개요

출력 설정(Data Output Workspace)에서 "New Profile" 버튼이 비활성화되어 있고, 프로파일 생성 기능이 작동하지 않는 문제를 해결하기 위해 전체 백엔드 API부터 프론트엔드 UI까지 완전히 구현했습니다.

### 문제 정의
- **증상**: [DataOutputWorkspace.tsx:640](../frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx#L640)에서 "New Profile" 버튼이 `disabled` 상태
- **원인**: 백엔드에 프로파일 생성 API가 없고, 프론트엔드에도 관련 UI 구현이 없음
- **요청**: "출력설정 New profile 기능이 작동을 안해"

---

## 🔧 구현 상세

### 1. 백엔드 API 구현 (routing.py)

#### 📁 파일 위치
`backend/api/routes/routing.py`

#### 주요 변경사항

##### 1.1 새로운 Import 추가
```python
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
```

##### 1.2 프로파일 저장 디렉토리 설정
```python
# 프로파일 저장 디렉토리
PROFILES_DIR = Path("data/output_profiles")
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
```

##### 1.3 Pydantic 모델 정의
```python
class OutputProfileMapping(BaseModel):
    """출력 프로파일 컬럼 매핑"""
    source: str
    mapped: str
    type: str = "string"
    required: bool = False
    default_value: str | None = None


class CreateOutputProfileRequest(BaseModel):
    """출력 프로파일 생성 요청"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    format: str = "CSV"
    mappings: List[OutputProfileMapping] = []
```

##### 1.4 헬퍼 함수
```python
def _load_all_profiles() -> List[Dict[str, Any]]:
    """모든 프로파일을 로드 (기본 프로파일 + 파일 시스템)"""
    # 기본 프로파일
    # + data/output_profiles/*.json 파일들

def _load_profile(profile_id: str) -> Dict[str, Any] | None:
    """특정 프로파일을 로드"""
    # 기본 프로파일 또는 {profile_id}.json 파일
```

##### 1.5 신규 엔드포인트
```python
@router.post("/output-profiles")
async def create_output_profile(
    request: CreateOutputProfileRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """새 출력 프로파일 생성"""
    # UUID 생성
    # JSON 파일로 저장
    # 프로파일 정보 반환
```

#### 프로파일 저장 형식
```json
{
  "id": "uuid-string",
  "name": "프로파일 이름",
  "description": "설명 (선택)",
  "format": "CSV",
  "mappings": [],
  "created_by": "username",
  "created_at": "2025-10-13T12:34:56Z",
  "updated_at": "2025-10-13T12:34:56Z",
  "sample": []
}
```

---

### 2. 프론트엔드 API 클라이언트 (apiClient.ts)

#### 📁 파일 위치
`frontend-prediction/src/lib/apiClient.ts`

#### 주요 변경사항

##### 2.1 타입 정의
```typescript
export interface OutputProfileListItem {
  id: string;
  name: string;
  description?: string | null;
  format?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OutputProfileMapping {
  source: string;
  mapped: string;
  type: string;
  required: boolean;
  default_value?: string | null;
}

export interface OutputProfileDetail {
  id: string;
  name: string;
  description?: string | null;
  format: string;
  mappings: OutputProfileMapping[];
  created_at?: string;
  updated_at?: string;
  sample?: Array<Record<string, unknown>>;
}

export interface CreateOutputProfilePayload {
  name: string;
  description?: string | null;
  format?: string;
  mappings?: OutputProfileMapping[];
}

export interface CreateOutputProfileResponse {
  id: string;
  name: string;
  description?: string | null;
  format: string;
  created_at: string;
  updated_at: string;
  message: string;
}
```

##### 2.2 API 함수 구현
```typescript
export async function fetchOutputProfiles(): Promise<OutputProfileListItem[]> {
  const response = await api.get<OutputProfileListItem[]>("/routing/output-profiles");
  return response.data;
}

export async function fetchOutputProfileDetail(profileId: string): Promise<OutputProfileDetail> {
  const response = await api.get<OutputProfileDetail>(`/routing/output-profiles/${profileId}`);
  return response.data;
}

export async function createOutputProfile(payload: CreateOutputProfilePayload): Promise<CreateOutputProfileResponse> {
  const response = await api.post<CreateOutputProfileResponse>("/routing/output-profiles", {
    name: payload.name,
    description: payload.description ?? null,
    format: payload.format ?? "CSV",
    mappings: payload.mappings ?? [],
  });
  return response.data;
}

export async function generateOutputPreview(payload: {
  profileId?: string | null;
  mappings: Array<{...}>;
  format: string;
}): Promise<{ rows: Array<Record<string, unknown>>; columns: string[] }> {
  // 업데이트된 미리보기 생성
}
```

---

### 3. UI 컴포넌트 구현 (DataOutputWorkspace.tsx)

#### 📁 파일 위치
`frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx`

#### 주요 변경사항

##### 3.1 Import 추가
```typescript
import {
  createOutputProfile,
  type CreateOutputProfilePayload,
} from "@lib/apiClient";
import { X } from "lucide-react";
```

##### 3.2 State 추가
```typescript
// New Profile Modal State
const [showNewProfileModal, setShowNewProfileModal] = useState<boolean>(false);
const [newProfileName, setNewProfileName] = useState<string>("");
const [newProfileDescription, setNewProfileDescription] = useState<string>("");
const [newProfileFormat, setNewProfileFormat] = useState<string>("CSV");
const [creatingProfile, setCreatingProfile] = useState<boolean>(false);
const [createProfileError, setCreateProfileError] = useState<string>("");
```

##### 3.3 핸들러 함수
```typescript
const handleOpenNewProfileModal = () => {
  // 모달 열기 및 초기화
};

const handleCloseNewProfileModal = () => {
  // 모달 닫기 (생성 중이 아닐 때만)
};

const handleCreateProfile = async () => {
  // 1. 유효성 검사
  // 2. API 호출
  // 3. 성공 시: 모달 닫기, 새 프로파일 선택, 목록 새로고침
  // 4. 실패 시: 에러 메시지 표시
};
```

##### 3.4 New Profile 버튼 활성화
```tsx
<button
  type="button"
  className="btn-secondary neon-cyan"
  title="Create new profile"
  onClick={handleOpenNewProfileModal}  // ← 추가
>
  <Plus size={16} /> New Profile
</button>
```

##### 3.5 모달 UI
```tsx
{showNewProfileModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
       onClick={handleCloseNewProfileModal}>
    <div className="glass-morphism p-8 rounded-xl w-full max-w-md"
         onClick={(e) => e.stopPropagation()}>
      {/* 헤더 */}
      <header>
        <h2>New Profile</h2>
        <button onClick={handleCloseNewProfileModal}>
          <X size={20} />
        </button>
      </header>

      {/* 입력 필드 */}
      <div>
        {/* Profile Name (필수) */}
        <input id="new-profile-name" ... />

        {/* Description (선택) */}
        <textarea id="new-profile-description" ... />

        {/* Format */}
        <select id="new-profile-format" ...>
          <option value="CSV">CSV</option>
          <option value="EXCEL">Excel</option>
          <option value="JSON">JSON</option>
          <option value="XML">XML</option>
          <option value="TXT">Text</option>
        </select>
      </div>

      {/* 에러 메시지 */}
      {createProfileError && <div className="error">...</div>}

      {/* 액션 버튼 */}
      <div>
        <button onClick={handleCloseNewProfileModal}>Cancel</button>
        <button onClick={handleCreateProfile}
                disabled={creatingProfile || !newProfileName.trim()}>
          {creatingProfile ? "Creating…" : "Create Profile"}
        </button>
      </div>
    </div>
  </div>
)}
```

---

## ✅ 구현 결과

### 기능 검증 체크리스트

- [x] **백엔드 API 동작**
  - [x] POST `/api/routing/output-profiles` 엔드포인트 생성
  - [x] 프로파일 파일 저장 (`data/output_profiles/{uuid}.json`)
  - [x] GET `/api/routing/output-profiles` 파일에서 로드
  - [x] GET `/api/routing/output-profiles/{id}` 상세 조회

- [x] **프론트엔드 API 연동**
  - [x] `createOutputProfile()` 함수 구현
  - [x] `fetchOutputProfiles()` 실제 구현
  - [x] `fetchOutputProfileDetail()` 실제 구현
  - [x] 타입 안전성 확보

- [x] **UI 컴포넌트**
  - [x] "New Profile" 버튼 활성화
  - [x] 모달 디자인 (glass morphism, backdrop blur)
  - [x] 폼 검증 (이름 필수)
  - [x] 로딩 상태 표시
  - [x] 에러 처리
  - [x] 성공 시 자동 선택

- [x] **빌드 및 배포**
  - [x] 프론트엔드 빌드 성공
  - [x] Git 커밋 (1ad87e18)
  - [x] Git 푸시 완료

---

## 📊 파일 변경 요약

| 파일 | 변경 유형 | 라인 변경 | 설명 |
|------|----------|---------|------|
| `backend/api/routes/routing.py` | 수정 | +180 | 프로파일 생성 API 추가 |
| `frontend-prediction/src/lib/apiClient.ts` | 수정 | +90 | API 클라이언트 함수 구현 |
| `frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx` | 수정 | +150 | New Profile 모달 UI 추가 |
| **총계** | - | **+420** | - |

---

## 🎯 사용자 시나리오

### 시나리오 1: 새 프로파일 생성
1. 사용자가 "데이터 출력 설정" 페이지로 이동
2. "Output Profiles" 탭에서 "New Profile" 버튼 클릭
3. 모달이 열리고 다음 정보 입력:
   - **Profile Name**: "Production Export" (필수)
   - **Description**: "운영 서버용 내보내기 프로파일" (선택)
   - **Format**: "CSV" 선택
4. "Create Profile" 버튼 클릭
5. 성공 메시지 표시: "프로파일이 성공적으로 생성되었습니다."
6. 프로파일 목록에 새 프로파일이 추가되고 자동 선택됨
7. "Column Mapping" 탭으로 이동하여 컬럼 매핑 설정 가능

### 시나리오 2: 에러 처리
1. 사용자가 "New Profile" 버튼 클릭
2. 이름을 입력하지 않고 "Create Profile" 클릭 시도
3. 버튼이 비활성화되어 클릭 불가
4. 이름만 공백으로 입력 후 클릭 시:
   - 에러 메시지: "프로파일 이름을 입력해주세요."
5. 네트워크 오류 발생 시:
   - 에러 메시지: API 응답 메시지 또는 "프로파일 생성 중 오류가 발생했습니다."

---

## 🔍 기술적 세부사항

### 인증 및 보안
- FastAPI `require_auth` Dependency를 통한 JWT 인증 필요
- 생성자 정보(`created_by`) 자동 저장
- 프로파일 파일은 서버의 `data/output_profiles/` 디렉토리에 저장

### 파일 저장 구조
```
data/
└── output_profiles/
    ├── 550e8400-e29b-41d4-a716-446655440000.json
    ├── 6ba7b810-9dad-11d1-80b4-00c04fd430c8.json
    └── ...
```

### UUID 생성
- Python: `uuid.uuid4()` 사용
- 충돌 가능성 극히 낮음 (2^122개)

### 데이터 지속성
- 파일 기반 저장으로 서버 재시작 후에도 프로파일 유지
- 향후 데이터베이스 마이그레이션 가능 (PostgreSQL, MongoDB 등)

---

## 🐛 알려진 제한사항 및 향후 개선사항

### 현재 제한사항
1. **프로파일 삭제 기능 없음**: 삭제 API 미구현
2. **프로파일 수정 기능 제한**: 이름/설명 수정은 불가, 매핑만 수정 가능
3. **중복 이름 체크 없음**: 같은 이름의 프로파일 생성 가능
4. **권한 관리 없음**: 모든 인증된 사용자가 프로파일 생성 가능
5. **검색/필터 없음**: 프로파일이 많아지면 찾기 어려움

### 향후 개선 사항
- [ ] 프로파일 삭제 API 및 UI
- [ ] 프로파일 이름/설명 수정 기능
- [ ] 중복 이름 검증
- [ ] 프로파일 검색/필터 기능
- [ ] 프로파일 공유 및 권한 관리
- [ ] 프로파일 템플릿 기능
- [ ] 프로파일 Import/Export (JSON 파일)

---

## 📝 커밋 정보

**커밋 해시**: `1ad87e18`
**커밋 메시지**: `feat: Implement New Profile creation for output profiles`
**푸시 시간**: 2025-10-13
**브랜치**: `main`
**원격 저장소**: `https://github.com/FKSMME/Routing_ML.git`

---

## 🎉 완료 확인

모든 작업이 성공적으로 완료되었습니다:

✅ 백엔드 API 구현 완료
✅ 프론트엔드 API 클라이언트 완료
✅ UI 컴포넌트 구현 완료
✅ 빌드 성공
✅ Git 커밋 및 푸시 완료
✅ 문서 작성 완료

**사용자는 이제 "New Profile" 버튼을 클릭하여 새로운 출력 프로파일을 생성할 수 있습니다!**
