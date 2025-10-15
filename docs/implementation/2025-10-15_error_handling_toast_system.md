# 에러 처리 및 Toast 알림 시스템 구현

**날짜**: 2025-10-15
**구현자**: Claude
**브랜치**: 251015

---

## 구현 요약

사용자 친화적인 에러 처리와 Toast 알림 시스템을 구현하여 API 에러를 자동으로 파싱하고 시각적 피드백을 제공합니다.

---

## 구현 내용

### 1. 공통 에러 처리 유틸리티

**파일**: [frontend-prediction/src/lib/errorHandler.ts](../../frontend-prediction/src/lib/errorHandler.ts)

#### 주요 기능

1. **API 에러 파싱** (`parseApiError`)
   - FastAPI 표준 에러 형식 지원
   - Pydantic 유효성 검증 에러 처리
   - JSON 및 텍스트 응답 모두 지원

2. **네트워크 에러 처리** (`handleNetworkError`)
   - Fetch 실패 감지
   - 사용자 친화적 메시지 변환

3. **HTTP 상태 코드 메시지** (`getStatusMessage`)
   - 400-504 상태 코드별 한국어 메시지
   - 명확한 에러 원인 설명

4. **래퍼 함수**
   - `fetchWithErrorHandling`: 에러를 자동으로 처리하는 fetch
   - `fetchWithRetry`: 재시도 로직 포함 (408, 429, 500+ 상태 코드)

#### 사용 예시

```typescript
import { fetchWithErrorHandling, parseApiError } from "@lib/errorHandler";

// 기본 사용
try {
  const response = await fetchWithErrorHandling("/api/routing-groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const result = await response.json();
} catch (error) {
  // 에러는 이미 처리되어 Toast로 표시됨
}

// 재시도 포함
import { fetchWithRetry } from "@lib/errorHandler";

const response = await fetchWithRetry(
  "/api/prediction",
  { method: "POST", body: JSON.stringify(payload) },
  3,  // 최대 3회 재시도
  1000  // 1초 간격
);
```

### 2. Toast 알림 시스템

**파일**: [frontend-prediction/src/components/common/Toast.tsx](../../frontend-prediction/src/components/common/Toast.tsx)

#### Toast 타입

- `success`: 성공 메시지 (초록색)
- `error`: 에러 메시지 (빨간색)
- `warning`: 경고 메시지 (주황색)
- `info`: 정보 메시지 (파란색)

#### 주요 특징

1. **자동 사라짐**: 기본 5초 후 자동 제거 (커스터마이징 가능)
2. **애니메이션**: 오른쪽에서 슬라이드 인/아웃
3. **수동 닫기**: X 버튼으로 즉시 제거
4. **아이콘**: 타입별 적절한 아이콘 표시
5. **스택 관리**: 여러 Toast 동시 표시 가능

#### 컴포넌트 구조

```typescript
export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  // Toast 목록 렌더링
}

function Toast({ toast, onClose }: ToastProps) {
  // 개별 Toast 렌더링 및 타이머 관리
}
```

### 3. useToast Hook

**파일**: [frontend-prediction/src/hooks/useToast.ts](../../frontend-prediction/src/hooks/useToast.ts)

React 컴포넌트에서 Toast를 쉽게 사용할 수 있는 커스텀 Hook입니다.

#### API

```typescript
const { toasts, success, error, warning, info, removeToast } = useToast();

// 사용 예시
success("라우팅 그룹이 생성되었습니다!");
error("API 요청에 실패했습니다.");
warning("일부 항목이 누락되었습니다.");
info("새로운 버전이 있습니다.");
```

#### 통합 예시

```typescript
import { useToast } from "@hooks/useToast";
import { ToastContainer } from "@components/common/Toast";

function App() {
  const { toasts, success, error, removeToast } = useToast();

  const handleSubmit = async () => {
    try {
      await api.createRoutingGroup(data);
      success("라우팅 그룹이 생성되었습니다!");
    } catch (err) {
      error("생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <>
      <YourComponents />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
```

---

## API 에러 형식 지원

### FastAPI 표준 에러

```json
{
  "detail": "Process group 'TEST-GROUP' already exists for this user"
}
```

파싱 결과:
```typescript
{
  message: "Process group 'TEST-GROUP' already exists for this user",
  status: 409
}
```

### Pydantic 유효성 검증 에러

```json
{
  "detail": [
    {
      "loc": ["body", "group_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

파싱 결과:
```typescript
{
  message: "유효성 검증 실패: body.group_name: field required",
  status: 422,
  details: [...]
}
```

---

## HTTP 상태 코드별 메시지

| 상태 코드 | 사용자 메시지 |
|----------|-------------|
| 400 | 요청이 올바르지 않습니다. |
| 401 | 인증이 필요합니다. 다시 로그인해주세요. |
| 403 | 이 작업을 수행할 권한이 없습니다. |
| 404 | 요청한 리소스를 찾을 수 없습니다. |
| 409 | 리소스 충돌이 발생했습니다. (중복되거나 버전이 맞지 않습니다) |
| 422 | 입력 데이터의 형식이 올바르지 않습니다. |
| 429 | 너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요. |
| 500 | 서버 내부 오류가 발생했습니다. |
| 502 | 게이트웨이 오류가 발생했습니다. |
| 503 | 서비스를 일시적으로 사용할 수 없습니다. |
| 504 | 게이트웨이 시간 초과가 발생했습니다. |

---

## 재시도 로직

`fetchWithRetry` 함수는 다음 상태 코드에서 자동으로 재시도합니다:

- **408** (Request Timeout)
- **429** (Too Many Requests)
- **500** (Internal Server Error)
- **502** (Bad Gateway)
- **503** (Service Unavailable)
- **504** (Gateway Timeout)

**재시도 전략**:
- 지수 백오프 (exponential backoff)
- 최대 3회 재시도 (기본값)
- 각 재시도 간격: `delayMs × (attempt + 1)`

예시:
```typescript
// 1차 실패 → 1초 대기
// 2차 실패 → 2초 대기
// 3차 실패 → 3초 대기
// 최종 실패
const response = await fetchWithRetry(url, options, 3, 1000);
```

---

## Toast 스타일링

### 타입별 색상

```typescript
const toastStyles: Record<ToastType, CSSProperties> = {
  success: {
    background: "#10b981",  // 초록색
    border: "1px solid #059669",
  },
  error: {
    background: "#ef4444",  // 빨간색
    border: "1px solid #dc2626",
  },
  warning: {
    background: "#f59e0b",  // 주황색
    border: "1px solid #d97706",
  },
  info: {
    background: "#3b82f6",  // 파란색
    border: "1px solid #2563eb",
  },
};
```

### 애니메이션

```css
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### 위치

- **위치**: 화면 오른쪽 상단 (fixed)
- **z-index**: 9999
- **간격**: 0.75rem

---

## 실제 사용 사례

### 사례 1: 프로세스 그룹 생성

```typescript
const handleCreateGroup = async () => {
  try {
    const response = await fetchWithErrorHandling("/api/process-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: groupName,
        type: "machining",
        default_columns: [],
        fixed_values: {},
      }),
    });

    const result = await response.json();
    success(`프로세스 그룹 '${result.name}'이 생성되었습니다!`);
  } catch (error) {
    // 에러는 자동으로 Toast로 표시됨
    console.error(error);
  }
};
```

### 사례 2: 감사 로그 조회 (재시도 포함)

```typescript
const fetchAuditLogs = async () => {
  try {
    const response = await fetchWithRetry(
      `/api/audit/ui/events?limit=100`,
      undefined,
      3,  // 최대 3회 재시도
      2000  // 2초 간격
    );

    const logs = await response.json();
    setLogs(logs);
    info(`${logs.length}개의 감사 로그를 불러왔습니다.`);
  } catch (error) {
    error("감사 로그를 불러오는데 실패했습니다.");
  }
};
```

### 사례 3: 인증 에러 처리

```typescript
// 401 에러 발생 시
{
  message: "인증이 필요합니다. 다시 로그인해주세요.",
  status: 401,
  code: "UNAUTHORIZED"
}

// Toast 자동 표시: 빨간색 에러 Toast
// "인증이 필요합니다. 다시 로그인해주세요."
```

---

## 향후 개선 사항

### Phase 1: 전역 상태 관리
- [ ] Zustand/Context API로 Toast 상태 전역 관리
- [ ] App 최상위에서 ToastContainer 한번만 렌더링
- [ ] 모든 컴포넌트에서 `useToast()` 사용 가능

### Phase 2: Toast 고급 기능
- [ ] Toast 위치 커스터마이징 (top-right, top-left, bottom-right 등)
- [ ] Toast 최대 개수 제한 (FIFO)
- [ ] Toast 일시정지 (마우스 호버 시)
- [ ] Toast 액션 버튼 (예: "다시 시도", "자세히 보기")

### Phase 3: 에러 추적
- [ ] Sentry 연동으로 에러 자동 리포팅
- [ ] 에러 발생 빈도 추적
- [ ] 사용자별 에러 패턴 분석

### Phase 4: 오프라인 지원
- [ ] 네트워크 끊김 감지
- [ ] 오프라인 큐에 요청 저장
- [ ] 네트워크 복구 시 자동 재시도

---

## 테스트 시나리오

### 수동 테스트 체크리스트

1. **Toast 표시**
   - [ ] success Toast 정상 표시
   - [ ] error Toast 정상 표시
   - [ ] warning Toast 정상 표시
   - [ ] info Toast 정상 표시

2. **Toast 동작**
   - [ ] 5초 후 자동 사라짐
   - [ ] X 버튼 클릭 시 즉시 제거
   - [ ] 여러 Toast 동시 표시 (스택)
   - [ ] 애니메이션 부드러움

3. **에러 파싱**
   - [ ] FastAPI 표준 에러 정상 파싱
   - [ ] Pydantic 유효성 에러 정상 파싱
   - [ ] 네트워크 에러 감지
   - [ ] HTTP 상태 코드 메시지 표시

4. **재시도 로직**
   - [ ] 503 에러 시 재시도 동작
   - [ ] 최대 재시도 횟수 준수
   - [ ] 지수 백오프 동작
   - [ ] 재시도 불가능한 에러(404)는 즉시 실패

---

## 구현 완료 파일 목록

### 프론트엔드

1. **에러 처리 유틸**: [frontend-prediction/src/lib/errorHandler.ts](../../frontend-prediction/src/lib/errorHandler.ts)
   - `parseApiError`, `handleNetworkError`, `getStatusMessage`
   - `fetchWithErrorHandling`, `fetchWithRetry`

2. **Toast 컴포넌트**: [frontend-prediction/src/components/common/Toast.tsx](../../frontend-prediction/src/components/common/Toast.tsx)
   - `Toast`, `ToastContainer`
   - 4가지 타입 지원 (success, error, warning, info)

3. **useToast Hook**: [frontend-prediction/src/hooks/useToast.ts](../../frontend-prediction/src/hooks/useToast.ts)
   - Toast 상태 관리
   - 편의 함수 (`success`, `error`, `warning`, `info`)

---

## 통합 가이드

### App.tsx에 Toast 추가

```typescript
import { useToast } from "@hooks/useToast";
import { ToastContainer } from "@components/common/Toast";

function App() {
  const { toasts, removeToast } = useToast();

  return (
    <>
      <YourMainContent />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
```

### API 클라이언트에 에러 처리 적용

```typescript
import { fetchWithErrorHandling } from "@lib/errorHandler";

export async function createRoutingGroup(data: RoutingGroupCreatePayload) {
  const response = await fetchWithErrorHandling("/api/routing-groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });

  return response.json();
}
```

---

## 결론

에러 처리 및 Toast 알림 시스템 구현이 완료되었습니다.

**구현된 기능**:
✅ API 에러 파싱 (FastAPI, Pydantic 지원)
✅ 네트워크 에러 처리
✅ HTTP 상태 코드별 메시지
✅ 재시도 로직 (지수 백오프)
✅ Toast 알림 시스템 (4가지 타입)
✅ useToast Hook
✅ 애니메이션 및 자동 제거

**다음 단계**:
- Toast를 전역 상태로 관리 (Context API 또는 Zustand)
- 기존 API 호출을 `fetchWithErrorHandling`으로 마이그레이션
- Sentry 연동으로 에러 추적

---

**작성일**: 2025-10-15
**작성자**: Claude
