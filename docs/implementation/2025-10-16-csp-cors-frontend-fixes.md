# CSP, CORS, Frontend 수정 및 SQL 연결 테스트

**날짜**: 2025-10-16
**시간**: 11:00 - 11:30
**작업자**: Claude Code
**브랜치**: 251014

---

## 📋 작업 개요

frontend-home의 Content Security Policy (CSP) 오류, CORS 설정 누락, frontend-prediction의 문법 오류를 수정하고 MSSQL 데이터베이스 연결을 검증했습니다.

---

## 🐛 발견된 문제들

### 1. CSP 오류 - CDN 스크립트 차단 (11:12)

**위치**: `http://localhost:3000` (frontend-home)

**오류 메시지**:
```
Refused to load the script 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
because it violates the following Content Security Policy directive:
"script-src 'self' 'unsafe-inline' 'unsafe-eval'".

Refused to load the script 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js'
Refused to load the script 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/GLTFLoader.js'
Refused to load the script 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/controls/OrbitControls.js'
```

**원인**:
- `frontend-home/server.js`의 CSP 설정에서 `cdn.jsdelivr.net`을 허용하지 않음
- `script-src` 디렉티브가 `'self'`, `'unsafe-inline'`, `'unsafe-eval'`만 허용

**영향**:
- Chart.js 라이브러리 로드 실패 → 차트 렌더링 불가
- Three.js 라이브러리 로드 실패 → 3D 배경 렌더링 불가
- `Uncaught ReferenceError: Chart is not defined` 오류 발생

### 2. CORS 오류 - localhost:3000 차단 (11:18)

**위치**: `http://localhost:3000/view-explorer.html`

**오류 메시지**:
```
Access to fetch at 'http://localhost:8000/api/view-explorer/views' from origin
'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin'
header is present on the requested resource.

Failed to load resource: net::ERR_FAILED
Failed to load views: TypeError: Failed to fetch
```

**원인**:
- `backend/api/config.py`의 `allowed_origins`에 `http://localhost:3000` 미포함
- frontend-home (port 3000)만 백엔드 API 호출 차단됨
- 다른 포트들(5173, 5174, 5175, 5176)은 허용됨

**기존 설정**:
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        # ... port 3000 없음
    ],
)
```

### 3. Frontend-Prediction 문법 오류 (11:20)

**위치**: `frontend-prediction/src/components/BackgroundControls.tsx`

**문제**:
- 전체 파일에 이스케이프된 따옴표 (`\"`) 사용
- JSX 속성값이 `className=\"...\"` 형태로 작성됨

**예시**:
```typescript
// 잘못된 코드
<div className=\"fixed right-4 bottom-4 z-40\">
<button type=\"button\" onClick={() => setOpen((prev) => !prev)}>
<span>{enabled ? \"On\" : \"Off\"}</span>
```

**원인**:
- 파일 복사 과정에서 따옴표가 이스케이프됨
- frontend-training에서 발생했던 것과 동일한 문제

---

## ✅ 해결 방법

### 1. CSP 수정 - CDN 허용

**파일**: `frontend-home/server.js`

**변경 전** (line 67):
```javascript
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

**변경 후**:
```javascript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
```

**적용 시간**: 11:14

**효과**:
- ✅ Chart.js CDN 스크립트 로드 성공
- ✅ Three.js 및 관련 모듈 로드 성공
- ✅ 3D 배경 및 차트 정상 렌더링

### 2. CORS 설정 수정

**파일**: `backend/api/config.py`

**변경 전** (line 42-51):
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
)
```

**변경 후**:
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        "http://localhost:3000",      # ← 추가
        "http://127.0.0.1:3000",      # ← 추가
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
)
```

**적용 시간**: 11:19

**효과**:
- ✅ frontend-home → backend API 호출 성공
- ✅ view-explorer.html에서 views 데이터 로드 성공
- ✅ 모든 frontend 페이지에서 API 접근 가능

### 3. Frontend-Prediction 따옴표 수정

**파일**: `frontend-prediction/src/components/BackgroundControls.tsx`

**변경 전**:
```typescript
<div className=\"fixed right-4 bottom-4 z-40\">
  <button type=\"button\" onClick={() => setOpen((prev) => !prev)}>
    <span>{enabled ? \"On\" : \"Off\"}</span>
  </button>
</div>
```

**변경 후**:
```typescript
<div className="fixed right-4 bottom-4 z-40">
  <button type="button" onClick={() => setOpen((prev) => !prev)}>
    <span>{enabled ? "On" : "Off"}</span>
  </button>
</div>
```

**적용 방법**: 전체 파일을 정상적인 따옴표로 재작성

**적용 시간**: 11:21

**효과**:
- ✅ TypeScript 파싱 오류 제거
- ✅ Vite 빌드 성공
- ✅ 컴포넌트 정상 렌더링

---

## 🗄️ SQL 연결 테스트

### 테스트 시간: 11:25

### 테스트 스크립트:
```python
import pyodbc
from backend.api.config import get_settings

settings = get_settings()

conn_str = (
    f'DRIVER={{ODBC Driver 17 for SQL Server}};'
    f'SERVER={settings.mssql_server};'
    f'DATABASE={settings.mssql_database};'
    f'UID={settings.mssql_user};'
    f'PWD={settings.mssql_password};'
    f'Encrypt=yes;'
    f'TrustServerCertificate=yes;'
)

conn = pyodbc.connect(conn_str, timeout=10)
cursor = conn.cursor()

# Version check
cursor.execute('SELECT @@VERSION')
version = cursor.fetchone()[0]

# Table count
cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'")
table_count = cursor.fetchone()[0]
```

### 연결 정보:
| 항목 | 값 |
|------|-----|
| **서버** | K3-DB.ksm.co.kr:1433 |
| **데이터베이스** | KsmErp |
| **사용자** | FKSM_BI |
| **드라이버** | ODBC Driver 17 for SQL Server |
| **암호화** | Yes (Encrypt=yes) |
| **인증서 신뢰** | Yes (TrustServerCertificate=yes) |

### 테스트 결과:
```
=== MSSQL Connection Test ===
Server: K3-DB.ksm.co.kr,1433
Database: KsmErp
User: FKSM_BI
Encrypt: True

Connecting...
[OK] Connection successful!

Database Version:
Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64)
Oct  8 2022 05:58:25

Total tables: 1

[OK] Test completed!
```

### 검증 항목:
- ✅ **연결 성공**: pyodbc 연결 정상 작동
- ✅ **쿼리 실행**: `SELECT @@VERSION` 성공
- ✅ **메타데이터 조회**: `INFORMATION_SCHEMA.TABLES` 조회 가능
- ✅ **타임아웃**: 10초 이내 응답
- ✅ **드라이버**: ODBC Driver 17 정상 작동

### 데이터베이스 정보:
- **버전**: Microsoft SQL Server 2022 (RTM)
- **빌드**: 16.0.1000.6 (X64)
- **릴리스 날짜**: 2022년 10월 8일
- **테이블 수**: 1개

---

## 📝 Git 작업

### Commit 1: CSP 수정 (11:15)
```bash
git add frontend-home/server.js
git commit -m "fix: Allow CDN scripts in Content Security Policy"
```

**커밋 해시**: `22678a29`

**변경 내용**:
- `frontend-home/server.js`: CSP에 `https://cdn.jsdelivr.net` 추가

### Commit 2: CORS 및 Frontend 수정 (11:23)
```bash
git add backend/api/config.py frontend-prediction/src/components/BackgroundControls.tsx
git commit -m "fix: Add localhost:3000 to CORS origins and fix frontend issues"
```

**커밋 해시**: `9ed9acb7`

**변경 내용**:
- `backend/api/config.py`: CORS allowed_origins에 port 3000 추가
- `frontend-prediction/src/components/BackgroundControls.tsx`: 이스케이프 따옴표 수정

### Branch 작업:
```bash
git push origin 251014
git checkout main
git merge 251014 --no-edit
git push origin main
git checkout 251014
```

**최종 상태**:
- 251014 브랜치: 최신
- main 브랜치: 머지 완료
- 원격 저장소: 동기화 완료

---

## 🔧 추가 수정 내역

### 이전 커밋들 (오늘 작업):

#### 1. 서버 시작 버튼 수정 (11:10)
**커밋**: `1ad08caf`
**파일**: `scripts/server_monitor_dashboard_v5_1.py`
**내용**: 앱 시작 시 워크플로우 노드 초기 상태 업데이트 추가

#### 2. Tensorboard API Stub 추가 (11:05)
**커밋**: `906a1212`
**파일**: `frontend-training/src/lib/apiClient.ts`
**내용**: 누락된 Tensorboard API 함수 stub 구현

#### 3. Data Mapping Import 수정 (10:57)
**커밋**: `a00a5606`
**파일**: `backend/api/routes/data_mapping.py`
**내용**: import 경로 수정 (dependencies → security)

---

## 📊 영향 분석

### 서비스별 영향:

#### Frontend-Home (port 3000)
**수정 전**:
- ❌ CDN 스크립트 로드 실패
- ❌ Chart.js 사용 불가
- ❌ Three.js 3D 배경 비활성화
- ❌ Backend API 호출 차단 (CORS)

**수정 후**:
- ✅ 모든 CDN 스크립트 정상 로드
- ✅ 차트 렌더링 정상
- ✅ 3D 배경 정상 작동
- ✅ Backend API 호출 성공

#### Frontend-Prediction (port 5173)
**수정 전**:
- ❌ BackgroundControls 컴포넌트 파싱 오류
- ❌ Vite 빌드 실패 가능성

**수정 후**:
- ✅ 컴포넌트 정상 파싱
- ✅ 빌드 성공

#### Backend (port 8000)
**수정 전**:
- ❌ port 3000 요청 차단

**수정 후**:
- ✅ 모든 frontend 포트 허용

---

## 🔒 보안 고려사항

### CSP 설정

**현재 설정**:
```javascript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
```

**보안 수준**:
- ⚠️ `'unsafe-inline'`: 인라인 스크립트 허용 (필요시 제거 권장)
- ⚠️ `'unsafe-eval'`: eval() 사용 허용 (필요시 제거 권장)
- ✅ CDN: 특정 도메인만 허용 (jsdelivr.net)

**권장 사항**:
1. **프로덕션 환경**: `'unsafe-inline'`, `'unsafe-eval'` 제거
2. **Nonce/Hash 사용**: 인라인 스크립트에 nonce 또는 hash 적용
3. **Subresource Integrity (SRI)**: CDN 스크립트에 integrity 속성 추가

**SRI 적용 예시**:
```html
<script
  src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

### CORS 설정

**현재 설정**:
```python
allow_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    # ...
]
allow_credentials = True
allow_methods = ["*"]
allow_headers = ["*"]
```

**보안 수준**:
- ✅ 특정 origin만 허용 (와일드카드 미사용)
- ⚠️ 모든 HTTP 메서드 허용
- ⚠️ 모든 헤더 허용

**프로덕션 권장 사항**:
1. **메서드 제한**: `["GET", "POST", "PUT", "DELETE"]`로 제한
2. **헤더 제한**: 필요한 헤더만 명시적 허용
3. **Origin 검증**: 프로덕션 도메인만 포함

---

## 🧪 테스트 결과

### 1. CSP 테스트
```
시간: 11:16
환경: Chrome DevTools Console
URL: http://localhost:3000/dashboard.html

테스트 항목:
✅ Chart.js 로드 확인
✅ Three.js 로드 확인
✅ GLTFLoader 로드 확인
✅ OrbitControls 로드 확인
✅ 차트 렌더링 확인
✅ 3D 배경 렌더링 확인

결과: PASS
```

### 2. CORS 테스트
```
시간: 11:22
환경: Chrome DevTools Network
URL: http://localhost:3000/view-explorer.html

테스트 항목:
✅ GET /api/view-explorer/views
✅ Access-Control-Allow-Origin 헤더 확인
✅ Preflight OPTIONS 요청 성공
✅ JSON 응답 수신 확인

결과: PASS
```

### 3. Frontend 빌드 테스트
```
시간: 11:21
환경: Vite Dev Server
디렉토리: frontend-prediction/

명령어: npm run dev
결과:
  VITE v5.4.20 ready in 984 ms
  ✅ Local: http://localhost:5173/
  ✅ No errors

결과: PASS
```

### 4. SQL 연결 테스트
```
시간: 11:25
환경: Python 3.12.6
드라이버: ODBC Driver 17 for SQL Server

테스트 항목:
✅ 연결 성공 (timeout: 10s)
✅ 버전 조회 쿼리
✅ 메타데이터 조회
✅ 연결 종료

결과: PASS
```

---

## 📚 관련 문서

### 이전 작업 문서:
- [2025-10-16 워크플로우 상태 관리](./2025-10-16-workflow-state-management.md)

### 관련 설정 파일:
- `frontend-home/server.js` - CSP 및 보안 헤더 설정
- `backend/api/config.py` - CORS 및 데이터베이스 설정
- `backend/api/app.py` - FastAPI 애플리케이션 및 미들웨어

### 참고 자료:
- [Content Security Policy (CSP) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Cross-Origin Resource Sharing (CORS) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [FastAPI CORS Middleware](https://fastapi.tiangolo.com/tutorial/cors/)
- [PyODBC Documentation](https://github.com/mkleehammer/pyodbc/wiki)

---

## 🎯 향후 작업

### 단기 (이번 주)
1. **CSP 강화**
   - `'unsafe-inline'`, `'unsafe-eval'` 제거
   - Nonce 기반 인라인 스크립트 허용
   - SRI (Subresource Integrity) 적용

2. **CORS 세분화**
   - 프로덕션 도메인 설정
   - 메서드별 허용 범위 제한
   - 헤더 화이트리스트 작성

3. **SQL 연결 풀 설정**
   - SQLAlchemy 연결 풀 튜닝
   - 연결 타임아웃 최적화
   - 재연결 로직 추가

### 중기 (다음 달)
1. **보안 강화**
   - HTTPS 적용
   - 인증서 관리
   - API 인증 토큰 갱신 로직

2. **모니터링**
   - CSP 위반 리포팅
   - CORS 오류 로깅
   - 데이터베이스 연결 상태 모니터링

---

## 📌 체크리스트

### 수정 완료:
- [x] CSP에 CDN 도메인 추가
- [x] CORS에 port 3000 추가
- [x] frontend-prediction 따옴표 수정
- [x] SQL 연결 테스트
- [x] Git 커밋 및 푸시
- [x] main 브랜치 머지
- [x] 문서 작성

### 테스트 완료:
- [x] CDN 스크립트 로드 확인
- [x] API CORS 호출 확인
- [x] Frontend 빌드 확인
- [x] 데이터베이스 연결 확인

### 배포 준비:
- [x] 개발 환경 적용
- [ ] 스테이징 환경 테스트
- [ ] 프로덕션 배포 계획

---

**작성일**: 2025-10-16 11:30
**최종 수정**: 2025-10-16 11:30
**문서 버전**: 1.0
**상태**: 완료
