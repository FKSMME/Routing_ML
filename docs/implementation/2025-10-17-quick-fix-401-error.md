# 401 에러 빠른 해결 가이드

**상황**: 로그인한 상태인데도 401 Unauthorized 에러 발생

---

## 🚀 즉시 해결 (1분)

### 1단계: 브라우저에서 실행

**브라우저 개발자 도구 > Console**에서 다음 명령 실행:

```javascript
// 1. 현재 쿠키 확인
console.log(document.cookie);

// 2. 로컬 스토리지 및 세션 스토리지 초기화
localStorage.clear();
sessionStorage.clear();

// 3. 페이지 강제 새로고침
location.reload(true);
```

### 2단계: 재로그인

1. 로그인 페이지로 이동
2. 계정 정보 입력 후 로그인
3. "라우팅 생성" 클릭
4. 401 에러 사라짐 확인

---

## 🔍 근본 원인

### 원인 1: 세션 쿠키 만료

**증상**:
- 로그인 성공했지만 시간이 지나면 401 에러
- `/api/auth/me` 호출 시 401 반환

**확인 방법**:
```javascript
// 브라우저 Console에서
document.cookie
```

**예상 결과**:
```
"session_token=eyJ..." (쿠키 있음)
또는
"" (쿠키 없음 → 문제!)
```

**해결**:
- 재로그인
- 또는 백엔드에서 세션 TTL 연장

### 원인 2: CORS/쿠키 설정 문제

**증상**:
- 로그인 API는 성공하지만 쿠키가 설정되지 않음
- 이후 API 호출 시 401 에러

**확인 방법**:
```
브라우저 개발자 도구 > Application > Cookies
→ localhost:5173에 쿠키가 있는지 확인
```

**해결**:

**파일**: `backend/api/security.py` 확인

쿠키 설정이 올바른지 확인:
```python
# JWT 토큰을 HTTP-only 쿠키로 설정
response.set_cookie(
    key="session_token",
    value=access_token,
    httponly=True,
    secure=False,  # 개발 환경에서는 False
    samesite="lax",
    max_age=settings.jwt_access_token_ttl_seconds,
)
```

### 원인 3: 프록시 설정 문제

**증상**:
- API 요청이 잘못된 포트로 전송됨
- CORS 에러 또는 404 에러 함께 발생

**확인 방법**:
```
브라우저 개발자 도구 > Network 탭
→ /api/predict 요청의 URL 확인
→ localhost:5173/api/predict (정상)
→ localhost:8000/api/predict (프록시 안 됨)
```

**해결**:

**파일**: `frontend-prediction/vite.config.ts` 확인

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ''),  // 주석 처리!
      },
    },
  },
});
```

---

## 🧪 테스트

### 1. 쿠키 테스트

```javascript
// 브라우저 Console
// 1. 로그인 전
console.log('Before login:', document.cookie);

// 2. 로그인 실행 (UI에서)

// 3. 로그인 후
console.log('After login:', document.cookie);
// 예상: "session_token=..." 포함되어야 함
```

### 2. 인증 상태 테스트

```javascript
// 브라우저 Console
fetch('/api/auth/me', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => console.log('User:', data))
  .catch(err => console.error('Auth failed:', err));
```

**예상 결과**:
```json
{
  "username": "your_username",
  "display_name": "...",
  "is_admin": false,
  "status": "approved"
}
```

### 3. 예측 API 테스트

```javascript
// 브라우저 Console
fetch('/api/predict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    item_codes: ['TEST001'],
    top_k: 5,
    similarity_threshold: 0.7
  })
})
  .then(r => r.json())
  .then(data => console.log('Prediction:', data))
  .catch(err => console.error('Prediction failed:', err));
```

---

## 💊 임시 해결책 (개발용)

인증 없이 테스트하고 싶다면, 일시적으로 인증을 비활성화할 수 있습니다.

**⚠️ 주의**: 프로덕션에서는 절대 사용하지 마세요!

**파일**: `backend/api/routes/prediction.py`

```python
# Before
@router.post("/predict")
async def predict(
    request: PredictionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),  # 인증 필요
):
    ...

# After (임시)
@router.post("/predict")
async def predict(
    request: PredictionRequest,
    # current_user: AuthenticatedUser = Depends(get_current_user),  # 주석 처리
):
    ...
```

백엔드 재시작 후 테스트.

---

## 📋 체크리스트

### 브라우저
- [ ] 개발자 도구 > Console 에러 확인
- [ ] 개발자 도구 > Network 탭에서 401 요청 확인
- [ ] 개발자 도구 > Application > Cookies 확인
- [ ] localStorage/sessionStorage 초기화
- [ ] 강제 새로고침 (Ctrl+Shift+R)

### 백엔드
- [ ] 포트 8000 리스닝 확인 (`netstat -ano | findstr :8000`)
- [ ] Health API 응답 확인 (`http://localhost:8000/api/health`)
- [ ] Swagger UI 접속 (`http://localhost:8000/docs`)
- [ ] 로그인 API 테스트 (Swagger UI)

### 프론트엔드
- [ ] Vite dev server 실행 중 확인
- [ ] 프록시 설정 확인 (`vite.config.ts`)
- [ ] apiClient baseURL 확인 (`/api`)

### 인증
- [ ] 로그인 성공 확인 (200 OK)
- [ ] 쿠키 설정 확인 (브라우저 DevTools)
- [ ] `/api/auth/me` 호출 성공 (200 OK)
- [ ] 이후 API 호출에 쿠키 자동 포함됨

---

## 🔧 고급 디버깅

### 백엔드 로그 확인

백엔드 CMD 창에서:

```
INFO:     127.0.0.1:xxxxx - "POST /api/auth/login HTTP/1.1" 200 OK
INFO:     127.0.0.1:xxxxx - "GET /api/auth/me HTTP/1.1" 200 OK  ← 성공
INFO:     127.0.0.1:xxxxx - "GET /api/auth/me HTTP/1.1" 401 Unauthorized  ← 실패!
```

401 에러 발생 시 백엔드 로그에서:
```
WARNING:  JWT token missing or invalid
```

### 쿠키 상세 확인

```javascript
// 브라우저 Console
// 모든 쿠키 파싱
document.cookie.split(';').forEach(c => console.log(c.trim()));

// 특정 쿠키 찾기
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
};

console.log('Session token:', getCookie('session_token'));
```

### Network 요청 상세

```
개발자 도구 > Network 탭
→ /api/predict 요청 클릭
→ Headers 탭

Request Headers:
  Cookie: session_token=...  ← 이게 있어야 함!

Response Headers:
  401 Unauthorized
```

---

**작성**: 2025-10-17
**작성자**: Claude Code
