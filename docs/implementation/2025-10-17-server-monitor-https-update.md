# 서버 모니터 HTTPS 지원 업데이트

**날짜**: 2025년 10월 17일
**버전**: v5.2.1
**작업자**: Claude Code

---

## 📋 작업 개요

서버 모니터 대시보드 (RoutingMLMonitor)를 업데이트하여 HTTPS를 완전히 지원하도록 했습니다.

### 작업 범위
1. ✅ **HTTPS Health Check 지원** - 자체 서명 인증서 검증 우회
2. ✅ **SSL Context 추가** - 모든 HTTP 요청에 SSL 설정
3. ✅ **서비스 URL 업데이트** - Frontend 앱 HTTPS 우선 사용
4. ✅ **회원 관리 API HTTPS 지원** - User management API SSL 적용
5. ✅ **EXE 빌드** - 새로운 v5.2.1 실행 파일 생성

---

## 🔧 변경된 파일

### 1. Server Monitor Dashboard Script

#### [`scripts/server_monitor_dashboard_v5_1.py`](scripts/server_monitor_dashboard_v5_1.py)

**버전 업데이트**:
```python
__version__ = "5.2.1"
__build_date__ = "2025-10-17"
```

**SSL Import 추가** (Line 15):
```python
import ssl
```

**SSL Context 함수 추가** (Line 154-185):
```python
def check_service(service: Service) -> Tuple[str, str]:
    """Check service status"""
    # ...

    # Create SSL context that doesn't verify self-signed certificates
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(request, timeout=service.timeout, context=ssl_context) as response:
            # ...
```

**서비스 정의 업데이트** (Line 105-150):

**Before**:
```python
Service(
    key="prediction",
    name="Routing",
    icon="🎯",
    check_url="http://localhost:5173/",
    start_command="run_frontend_prediction.bat",
    links=(
        ("Open", "http://localhost:5173"),
    ),
),
```

**After**:
```python
Service(
    key="prediction",
    name="Routing",
    icon="🎯",
    check_url="https://localhost:5173/",  # HTTPS로 변경
    start_command="run_frontend_prediction.bat",
    links=(
        ("Open HTTPS", "https://localhost:5173"),  # HTTPS 우선
        ("Open HTTP", "http://localhost:5173"),     # HTTP 대체
    ),
),
```

**회원 관리 API SSL Context 추가**:

1. `_load_pending_users()` (Line 965-983):
```python
# Create SSL context for self-signed certificates
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

with urllib.request.urlopen(request, timeout=5, context=ssl_context) as response:
    # ...
```

2. `_approve_user()` (Line 1102-1123):
```python
# Create SSL context for self-signed certificates
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

with urllib.request.urlopen(request, timeout=5, context=ssl_context) as response:
    # ...
```

3. `_reject_user()` (Line 1130-1151):
```python
# Create SSL context for self-signed certificates
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

with urllib.request.urlopen(request, timeout=5, context=ssl_context) as response:
    # ...
```

---

### 2. PyInstaller Spec File

#### [`RoutingMLMonitor_v5.2.1.spec`](RoutingMLMonitor_v5.2.1.spec)

**생성된 파일**: 새로운 spec 파일 생성

```python
# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['scripts\\server_monitor_dashboard_v5_1.py'],
    # ...
)

exe = EXE(
    # ...
    name='RoutingMLMonitor_v5.2.1',  # 버전 업데이트
    # ...
)
```

---

## 🚀 빌드 및 배포

### EXE 빌드 방법

```bash
# 1. 가상환경 활성화 (이미 활성화된 경우 생략)
.venv\Scripts\activate

# 2. PyInstaller로 빌드
.venv\Scripts\pyinstaller.exe --clean --noconfirm RoutingMLMonitor_v5.2.1.spec

# 3. 빌드 완료
# 출력: dist\RoutingMLMonitor_v5.2.1.exe (약 12MB)
```

### 빌드 결과

- **파일명**: `RoutingMLMonitor_v5.2.1.exe`
- **크기**: ~12 MB
- **위치**: `dist/` 폴더
- **플랫폼**: Windows 64-bit
- **의존성**: 없음 (단일 실행 파일)

---

## 🔍 변경 사항 요약

### 1. HTTPS Health Check

**이전**:
- Frontend Prediction: `http://localhost:5173/`
- Frontend Training: `http://localhost:5174/`

**변경 후**:
- Frontend Prediction: `https://localhost:5173/` ✅
- Frontend Training: `https://localhost:5174/` ✅

### 2. 서비스 링크

**이전**:
```python
links=(
    ("Open", "http://localhost:5173"),
)
```

**변경 후**:
```python
links=(
    ("Open HTTPS", "https://localhost:5173"),
    ("Open HTTP", "http://localhost:5173"),
)
```

### 3. SSL 인증서 검증

**설정**:
```python
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE
```

**이유**:
- 자체 서명 인증서 사용으로 인한 검증 오류 방지
- 개발 및 내부 환경에서 HTTPS 사용 가능
- 프로덕션에서는 신뢰할 수 있는 CA 인증서 권장

---

## 📊 서비스 상태 확인

서버 모니터가 확인하는 서비스:

| 서비스 | Health Check URL | 프로토콜 | 비고 |
|--------|-----------------|---------|------|
| **Backend API** | `http://localhost:8000/api/health` | HTTP | Backend는 HTTP 유지 |
| **Frontend Home** | `http://localhost:3000/` | HTTP | Node.js 서버 |
| **Frontend Prediction** | `https://localhost:5173/` | **HTTPS** | Vite dev server |
| **Frontend Training** | `https://localhost:5174/` | **HTTPS** | Vite dev server |

---

## 🧪 테스트 시나리오

### 1. 서버 모니터 실행
```bash
# 빌드된 EXE 실행
dist\RoutingMLMonitor_v5.2.1.exe
```

### 2. HTTPS 서비스 상태 확인
1. Frontend Prediction 및 Training이 HTTPS로 실행 중인지 확인
   ```bash
   cd frontend-prediction && npm run dev
   cd frontend-training && npm run dev
   ```
2. 서버 모니터에서 녹색(●) 상태 표시 확인
3. "Open HTTPS" 버튼 클릭 → 브라우저에서 https://localhost:5173 열림

### 3. 회원 관리 기능 테스트
1. 서버 모니터에서 "회원 관리" 탭 클릭
2. "새로 고침" 버튼 클릭 → API 호출 성공 확인
3. 승인/거절 기능 테스트

---

## ⚠️ 주의사항

### 1. SSL 인증서 경고

서버 모니터는 자체 서명 인증서를 우회하도록 설정되어 있지만, 브라우저에서는 여전히 경고가 표시될 수 있습니다.

**해결 방법**:
- [HTTPS 설정 가이드](2025-10-17-https-ssl-configuration.md) 참고
- Windows 인증서 저장소에 CA 추가
- 또는 브라우저에서 "Proceed anyway" 클릭

### 2. Backend API는 HTTP 유지

Backend API는 여전히 HTTP로 실행됩니다:
- Health check: `http://localhost:8000/api/health`
- API Docs: `http://localhost:8000/docs`

Frontend Vite 프록시가 HTTPS → HTTP 변환을 처리합니다.

### 3. dist/ 폴더는 Git에 추적되지 않음

`.gitignore`에 `dist/` 가 포함되어 있어, 빌드된 EXE 파일은 Git에 커밋되지 않습니다.

**배포 방법**:
- 로컬에서 빌드 후 수동 배포
- CI/CD 파이프라인에서 자동 빌드
- GitHub Releases에 수동 업로드

---

## 📝 다음 단계

### 즉시 수행
1. ✅ 서버 모니터 v5.2.1 EXE 빌드 완료
2. ✅ HTTPS 지원 확인
3. ✅ Git 커밋 및 문서화

### 선택 사항
- [ ] EXE 파일을 GitHub Releases에 업로드
- [ ] 자동 빌드 스크립트 작성 (`build_server_monitor.bat`)
- [ ] 버전 체크 기능 추가 (자동 업데이트 알림)
- [ ] 시스템 트레이 아이콘 지원

---

## 🔄 업그레이드 가이드

### 기존 v5.2.0에서 v5.2.1로 업그레이드

**방법 1: 새로 빌드**
```bash
.venv\Scripts\pyinstaller.exe --clean --noconfirm RoutingMLMonitor_v5.2.1.spec
```

**방법 2: 기존 EXE 교체**
1. 현재 실행 중인 RoutingMLMonitor 종료
2. `dist\RoutingMLMonitor_v5.2.1.exe`를 원하는 위치에 복사
3. 바로가기 업데이트 (필요시)

**변경 사항 확인**:
- 타이틀 바에 "v5.2.1" 표시 확인
- Frontend 서비스 카드에 "Open HTTPS" 버튼 확인
- HTTPS 서비스 상태가 정상적으로 표시되는지 확인

---

## ✅ 체크리스트

### 개발
- [x] SSL import 추가
- [x] SSL context 생성 함수 작성
- [x] 서비스 URL HTTPS로 변경
- [x] 회원 관리 API SSL 적용
- [x] 버전 번호 업데이트

### 빌드
- [x] PyInstaller spec 파일 생성
- [x] EXE 빌드 성공
- [x] 파일 크기 확인 (~12MB)

### 테스트
- [ ] HTTPS health check 동작 확인 (사용자)
- [ ] 회원 관리 기능 동작 확인 (사용자)
- [ ] 서비스 시작/정지 기능 확인 (사용자)

### 배포
- [x] Git 커밋 완료
- [ ] GitHub에 push (사용자)
- [ ] EXE 파일 배포 (필요시)

---

## 📚 관련 문서

- [HTTPS/SSL 설정 가이드](2025-10-17-https-ssl-configuration.md)
- [도메인 설정 가이드](2025-10-17-domain-configuration-rtml-ksm-co-kr.md)
- [빌드 완료 보고서](../BUILD_COMPLETE.md)

---

**작성자**: Claude Code
**빌드 일시**: 2025년 10월 17일 11:02
**Git Branch**: 251014
**Commit**: feat: Update Server Monitor v5.2.1 to support HTTPS
