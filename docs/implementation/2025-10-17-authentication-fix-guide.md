# 인증 토큰 401 에러 해결 가이드

**날짜**: 2025년 10월 17일
**문제**: `/api/predict` 및 `/api/auth/me` 엔드포인트에서 401 Unauthorized 에러 발생

---

## 🔍 문제 진단

### 스크린샷에서 확인된 에러
```
Server response delayed. Please try again in a moment.
인증 토큰이 필요합니다

Console Errors:
- :5173/api/predict:1 Failed to load resource: 401 (Unauthorized)
- :5173/api/auth/me:1 Failed to load resource: 401 (Unauthorized)
- 인증이 필요합니다. 로그인 페이지로 이동하지 않습니다.
```

### 근본 원인
1. **백엔드 서버가 실행되지 않음** - 가장 가능성 높음
2. 로그인하지 않은 상태에서 인증이 필요한 API 호출
3. 세션 쿠키 만료

---

## ✅ 해결 방법

### 1단계: 백엔드 서버 시작 (필수)

#### 방법 1: 배치 파일 사용
```bash
# CMD 창에서 실행
run_backend_main.bat
```

**확인 사항**:
```
Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

#### 방법 2: 서버 모니터 사용
```bash
dist\RoutingMLMonitor_v5.2.0.exe
```
→ "서버 일괄시작" 버튼 클릭

### 2단계: 백엔드 서버 실행 확인

#### PowerShell에서 테스트
```powershell
# Health check
Invoke-RestMethod http://localhost:8000/health

# 예상 결과
# {
#   "status": "ok",
#   "timestamp": "2025-10-17T..."
# }
```

#### 브라우저에서 확인
```
http://localhost:8000/docs
```
→ Swagger UI가 정상적으로 표시되면 OK

### 3단계: 프론트엔드 재시작 (권장)

백엔드를 시작한 후 프론트엔드도 재시작하는 것이 좋습니다.

```bash
# 기존 프론트엔드 종료 (Ctrl+C 또는)
taskkill /F /IM node.exe

# 재시작
run_frontend_prediction.bat
```

### 4단계: 로그인

1. `http://localhost:5173` 접속
2. 로그인 페이지가 표시되지 않으면 직접 이동:
   ```
   http://localhost:5173/login
   ```
3. 계정 정보 입력 후 로그인

---

## 🛠️ 상세 트러블슈팅

### 문제 1: 백엔드가 시작되지 않음

**증상**:
```bash
run_backend_main.bat
# ERROR: Virtual environment not found!
```

**해결**:
```bash
# Python 가상환경 확인
dir .venv\Scripts\python.exe

# 없으면 재생성
python -m venv .venv
.venv\Scripts\pip.exe install -r requirements.txt
```

### 문제 2: 포트 8000이 이미 사용 중

**증상**:
```
ERROR: [Errno 10048] Only one usage of each socket address
```

**해결**:
```powershell
# 포트 8000 사용 프로세스 확인
netstat -ano | findstr :8000

# PID 확인 후 종료 (예: PID가 12345인 경우)
taskkill /F /PID 12345
```

### 문제 3: 로그인 후에도 401 에러

**증상**:
- 로그인은 성공했는데 여전히 401 에러 발생

**해결**:
```javascript
// 브라우저 개발자 도구 > Console에서 실행
// 1. 쿠키 확인
document.cookie

// 2. 로컬 스토리지 확인
localStorage

// 3. 세션 스토리지 확인
sessionStorage

// 4. 모두 삭제 후 재로그인
localStorage.clear();
sessionStorage.clear();
```

그 후:
1. 브라우저 새로고침 (Ctrl+F5)
2. 재로그인

### 문제 4: CORS 에러

**증상**:
```
Access to XMLHttpRequest at 'http://localhost:8000/api/auth/me'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**해결**:

**파일**: `backend/api/config.py` 확인

```python
# 이미 수정되어 있어야 함
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://10.204.2.28:3000",
    "http://10.204.2.28:5173",
]
```

만약 설정이 잘못되어 있다면 백엔드 재시작 필요.

---

## 🧪 테스트 시나리오

### 시나리오 1: 백엔드 연결 테스트

```powershell
# 1. Health check
Invoke-RestMethod http://localhost:8000/health

# 2. Swagger UI 접속
start http://localhost:8000/docs
```

### 시나리오 2: 인증 플로우 테스트

1. **로그인 API 테스트** (Swagger UI 사용)
   - `http://localhost:8000/docs` 접속
   - `POST /api/auth/login` 선택
   - Try it out 클릭
   - 요청 Body:
     ```json
     {
       "username": "your_username",
       "password": "your_password"
     }
     ```
   - Execute 클릭
   - **예상 결과**: 200 OK, 세션 쿠키 설정됨

2. **현재 사용자 조회 테스트**
   - 로그인 후 동일한 Swagger UI에서
   - `GET /api/auth/me` 선택
   - Execute 클릭
   - **예상 결과**: 200 OK, 사용자 정보 반환

3. **예측 API 테스트**
   - `POST /api/predict` 선택
   - Try it out 클릭
   - 요청 Body:
     ```json
     {
       "item_codes": ["TEST001"],
       "top_k": 5,
       "similarity_threshold": 0.7
     }
     ```
   - Execute 클릭
   - **예상 결과**: 200 OK 또는 적절한 에러 메시지

### 시나리오 3: 프론트엔드 UI 테스트

1. `http://localhost:5173` 접속
2. 로그인
3. "라우팅 생성" 메뉴 클릭
4. "제어판" 탭 클릭
5. 품목 선택
6. "라우팅 추천 실행" 버튼 클릭

**성공 조건**:
- ✅ "Server response delayed" 에러 없음
- ✅ 401 Unauthorized 에러 없음
- ✅ 예측 결과가 정상적으로 표시됨

---

## 🔑 인증 시스템 동작 방식

### 로그인 플로우
```
1. 사용자가 로그인 폼 입력
   ↓
2. POST /api/auth/login
   ↓
3. 백엔드가 JWT 토큰 생성 후 HTTP-only 쿠키로 설정
   ↓
4. 프론트엔드가 쿠키를 자동으로 저장
   ↓
5. 이후 모든 API 요청에 쿠키가 자동으로 포함됨
```

### 인증 확인 플로우
```
1. 프론트엔드 페이지 로드
   ↓
2. GET /api/auth/me 호출 (쿠키 자동 포함)
   ↓
3. 백엔드가 쿠키의 JWT 검증
   ↓
4-a. 유효: 사용자 정보 반환 (200 OK)
4-b. 무효 또는 없음: 401 Unauthorized
   ↓
5-a. 프론트엔드: 인증됨 → 대시보드 표시
5-b. 프론트엔드: 미인증 → 로그인 페이지로 리다이렉트
```

### API 요청 플로우
```
1. 사용자가 "라우팅 추천 실행" 버튼 클릭
   ↓
2. POST /api/predict 호출 (쿠키 자동 포함)
   ↓
3. 백엔드가 쿠키의 JWT 검증
   ↓
4-a. 유효: 예측 실행 후 결과 반환 (200 OK)
4-b. 무효: 401 Unauthorized 반환
   ↓
5-a. 프론트엔드: 결과 표시
5-b. 프론트엔드: "인증이 필요합니다" 경고 표시
```

---

## 📝 체크리스트

### 백엔드
- [ ] Python 가상환경 존재 확인 (`.venv/Scripts/python.exe`)
- [ ] 백엔드 서버 실행 (`run_backend_main.bat`)
- [ ] Health check 성공 (`http://localhost:8000/health`)
- [ ] Swagger UI 접속 가능 (`http://localhost:8000/docs`)
- [ ] 포트 8000 리스닝 확인 (`netstat -ano | findstr :8000`)

### 프론트엔드
- [ ] Node.js 프로세스 실행 중 확인 (`tasklist | findstr node`)
- [ ] 프론트엔드 접속 가능 (`http://localhost:5173`)
- [ ] API baseURL 올바름 (개발자 도구 > Network 탭에서 `/api/*` 요청 확인)

### 인증
- [ ] 로그인 페이지 표시
- [ ] 로그인 성공 (`POST /api/auth/login` → 200 OK)
- [ ] 사용자 정보 조회 성공 (`GET /api/auth/me` → 200 OK)
- [ ] 쿠키 설정 확인 (개발자 도구 > Application > Cookies)

### 기능
- [ ] 라우팅 생성 페이지 로드
- [ ] 품목 선택 가능
- [ ] 예측 실행 가능 (`POST /api/predict` → 200 OK)
- [ ] 결과 표시 정상

---

## 🚀 빠른 해결 (5분 안에)

```bash
# 1. 모든 서버 종료
taskkill /F /IM python.exe 2>nul
taskkill /F /IM node.exe 2>nul

# 2. 백엔드 시작
start cmd /k "run_backend_main.bat"

# 3. 10초 대기
timeout /t 10

# 4. 프론트엔드 시작
start cmd /k "run_frontend_prediction.bat"

# 5. 브라우저에서 확인
start http://localhost:5173
```

로그인 후 "라우팅 생성" 클릭 → 401 에러가 사라져야 함

---

## 📞 추가 지원

여전히 문제가 해결되지 않으면:

1. **로그 확인**:
   - 백엔드 CMD 창의 전체 로그 복사
   - 브라우저 개발자 도구 > Console 탭의 에러 복사
   - 브라우저 개발자 도구 > Network 탭에서 실패한 요청 확인

2. **정보 수집**:
   ```powershell
   # 실행 중인 프로세스
   tasklist | findstr "python node"

   # 포트 사용 현황
   netstat -ano | findstr ":8000 :5173"

   # 쿠키 상태 (브라우저 Console에서)
   document.cookie
   ```

3. **문의**:
   - 이메일: syyun@ksm.co.kr
   - 전화: 010-9718-0580

---

**문서 작성**: 2025-10-17
**작성자**: Claude Code
**버전**: 1.0
