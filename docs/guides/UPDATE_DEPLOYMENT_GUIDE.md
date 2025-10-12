# 업데이트 즉시 적용 가이드

**날짜**: 2025-10-10
**프로젝트**: Routing ML v4

---

## 📋 개요

코드 수정 후 변경사항이 브라우저에 즉시 반영되지 않는 문제의 원인과 해결 방법을 정리합니다.

---

## 🔍 업데이트가 즉시 적용 안 되는 이유

### 1. **브라우저 캐시** (가장 흔한 원인)
- 브라우저가 이전 버전의 HTML/CSS/JS 파일을 캐시에 저장
- 서버에서 새 파일을 받아오지 않음

**해결**: 강제 새로고침
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

---

### 2. **Vite HMR (Hot Module Replacement) 한계**

Vite는 개발 중 파일 변경을 감지해 자동으로 브라우저를 갱신하지만, **일부 파일 타입은 HMR이 불완전**합니다.

| 파일 타입 | HMR 동작 | 필요 조치 |
|----------|---------|---------|
| `.tsx`, `.ts`, `.jsx`, `.js` | ✅ 완벽 자동 | 없음 (즉시 반영) |
| `.css` | ⚠️ 불완전 | 브라우저 새로고침 |
| `vite.config.ts` | ❌ 지원 안 됨 | Vite 서버 재시작 |
| `package.json` | ❌ 지원 안 됨 | Vite 서버 재시작 |

**참고**: [vite.config.ts:47-51](../frontend-prediction/vite.config.ts#L47-L51)에 캐시 방지 헤더가 설정되어 있지만, Vite 내부 모듈 캐시와는 별개입니다.

---

### 3. **Vite 내부 모듈 캐시**

Vite는 의존성 그래프(dependency graph)를 메모리에 캐싱합니다:
- CSS 변경 시 가끔 그래프 갱신이 누락됨
- 특히 `@import` 체인이 깊은 경우 발생

**해결**: Vite 서버 재시작

---

### 4. **백엔드 Python 코드 변경**

FastAPI + Uvicorn은 **auto-reload 기능**이 있지만:
- 기본적으로 활성화되지 않음
- 현재 설정: `--reload` 플래그 없이 실행 중

**현재 백엔드 실행 명령**:
```bash
venv-linux/bin/python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000
```

**auto-reload 활성화하려면**:
```bash
venv-linux/bin/python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload
```

⚠️ **주의**: `--reload`는 개발 환경 전용입니다. 프로덕션에서는 사용하지 마세요.

---

## 🛠️ 재시작 필요 여부 (변경 사항별)

| 변경 사항 | 브라우저 새로고침 | Vite 재시작 | 백엔드 재시작 | 컨테이너 재시작 |
|---------|-----------------|-----------|------------|--------------|
| **CSS 파일 (`.css`)** | ✅ 충분 | 가끔 필요 | ❌ 불필요 | ❌ 불필요 |
| **React 컴포넌트 (`.tsx`)** | ✅ 충분 (HMR 자동) | ❌ 불필요 | ❌ 불필요 | ❌ 불필요 |
| **TypeScript (`.ts`)** | ✅ 충분 (HMR 자동) | ❌ 불필요 | ❌ 불필요 | ❌ 불필요 |
| **Python 백엔드 (`.py`)** | ❌ 불필요 | ❌ 불필요 | ✅ 필수 | ❌ 불필요 |
| **Vite 설정 (`vite.config.ts`)** | ⚠️ 권장 | ✅ 필수 | ❌ 불필요 | ❌ 불필요 |
| **패키지 설정 (`package.json`)** | ❌ 불필요 | ✅ 필수 | ❌ 불필요 | ❌ 불필요 |
| **환경 변수 (`.env`)** | ❌ 불필요 | ✅ 필수 | ✅ 필수 | ❌ 불필요 |
| **의존성 설치 후** | ❌ 불필요 | ✅ 필수 | ✅ 필수 | ❌ 불필요 |

**결론**: **컨테이너는 절대 재시작 불필요**

---

## 🚀 재시작 방법

### 1️⃣ 브라우저 강제 새로고침 (가장 빠름)

```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

또는 개발자 도구에서:
1. `F12` 눌러 개발자 도구 열기
2. Network 탭 클릭
3. "Disable cache" 체크
4. 새로고침

---

### 2️⃣ Vite 프론트엔드 서버만 재시작 (추천)

**방법 A: 특정 포트만 재시작**
```bash
# Prediction 프론트엔드만 재시작 (5174번 포트)
lsof -ti:5174 | xargs -r kill -9
cd /workspaces/Routing_ML_4/frontend-prediction
npm run dev
```

**방법 B: 모든 프론트엔드 재시작**
```bash
# 모든 Vite 프로세스 종료
lsof -ti:5173,5174 | xargs -r kill -9
sleep 1

# Prediction 시작
cd /workspaces/Routing_ML_4/frontend-prediction
nohup npm run dev > /tmp/frontend-prediction.log 2>&1 &

# Training 시작
cd /workspaces/Routing_ML_4/frontend-training
nohup npm run dev > /tmp/frontend-training.log 2>&1 &
```

**예상 시간**: 5-10초

---

### 3️⃣ 백엔드 서버만 재시작

**현재 실행 중인 백엔드 확인**:
```bash
ps aux | grep uvicorn | grep -v grep
```

**백엔드 재시작 (MSSQL 연결)**:
```bash
# 기존 프로세스 종료
lsof -ti:8000 | xargs -r kill -9
sleep 2

# 새로 시작
export JWT_SECRET_KEY="Py-ORjfYWxbfWhbEBzuR3ohhSVO8YOXX0wLngrCHwHhSS4zYDtT_EWnFbJ_MEjuBphCbhzjuYVKtbPg690GZZQ"
export DB_TYPE=MSSQL
export MSSQL_SERVER="K3-DB.ksm.co.kr,1433"
export MSSQL_DATABASE="KsmErp"
export MSSQL_USER="FKSM_BI"
export MSSQL_PASSWORD="bimskc2025!!"
export PYTHONPATH=/workspaces/Routing_ML_4:$PYTHONPATH

nohup venv-linux/bin/python -m uvicorn backend.api.app:app \
  --host 0.0.0.0 --port 8000 \
  > /tmp/backend-mssql.log 2>&1 &
```

**예상 시간**: 30-90초 (MSSQL 연결 시간 포함)

---

### 4️⃣ 전체 재시작 (마지막 수단)

```bash
# 1. 모든 서버 종료
lsof -ti:8000,5173,5174,3000 | xargs -r kill -9
sleep 2

# 2. 백엔드 시작
export JWT_SECRET_KEY="Py-ORjfYWxbfWhbEBzuR3ohhSVO8YOXX0wLngrCHwHhSS4zYDtT_EWnFbJ_MEjuBphCbhzjuYVKtbPg690GZZQ"
export DB_TYPE=MSSQL
export MSSQL_SERVER="K3-DB.ksm.co.kr,1433"
export MSSQL_DATABASE="KsmErp"
export MSSQL_USER="FKSM_BI"
export MSSQL_PASSWORD="bimskc2025!!"
export PYTHONPATH=/workspaces/Routing_ML_4:$PYTHONPATH

cd /workspaces/Routing_ML_4
nohup venv-linux/bin/python -m uvicorn backend.api.app:app \
  --host 0.0.0.0 --port 8000 \
  > /tmp/backend-mssql.log 2>&1 &

# 3. 프론트엔드 시작
cd /workspaces/Routing_ML_4/frontend-prediction
nohup npm run dev > /tmp/frontend-prediction.log 2>&1 &

cd /workspaces/Routing_ML_4/frontend-training
nohup npm run dev > /tmp/frontend-training.log 2>&1 &

cd /workspaces/Routing_ML_4/frontend-home
nohup node server.js > /tmp/frontend-home.log 2>&1 &

# 4. 서버 상태 확인 (10초 후)
sleep 10
curl -s http://localhost:8000/api/health
curl -s http://localhost:5173 | head -3
curl -s http://localhost:5174 | head -3
curl -s http://localhost:3000 | head -3
```

**예상 시간**: 1-2분

---

## 🐛 중복 서버 실행 문제

### 문제 증상
VSCode PORTS 탭에 동일한 포트가 2개 표시됨:
- `8000` (정상)
- `8000` (중복)

### 원인
1. **이전 프로세스가 완전히 종료 안 됨**
2. **백그라운드 작업이 중복 실행됨**

### 해결 방법

**1단계: 현재 실행 중인 프로세스 확인**
```bash
ps aux | grep uvicorn | grep -v grep
lsof -i:8000
```

**2단계: 모든 백엔드 프로세스 강제 종료**
```bash
# PID로 직접 종료
ps aux | grep uvicorn | grep -v grep | awk '{print $2}' | xargs -r kill -9

# 또는 포트 기준으로 종료
lsof -ti:8000 | xargs -r kill -9

# 확인
sleep 2
lsof -i:8000  # 아무것도 출력 안 되어야 함
```

**3단계: 백엔드 1개만 실행**
```bash
cd /workspaces/Routing_ML_4
export DB_TYPE=MSSQL
export MSSQL_SERVER="K3-DB.ksm.co.kr,1433"
export MSSQL_DATABASE="KsmErp"
export MSSQL_USER="FKSM_BI"
export MSSQL_PASSWORD="bimskc2025!!"
export PYTHONPATH=/workspaces/Routing_ML_4:$PYTHONPATH

nohup venv-linux/bin/python -m uvicorn backend.api.app:app \
  --host 0.0.0.0 --port 8000 \
  > /tmp/backend-mssql.log 2>&1 &
```

**4단계: 확인**
```bash
# 프로세스 개수 확인 (1개만 있어야 함)
ps aux | grep uvicorn | grep -v grep | wc -l

# 포트 확인 (1개만 있어야 함)
lsof -i:8000
```

---

## 🔧 pyodbc import 오류 수정

### 문제
`backend/api/routes/anomaly.py`에서 무조건 `import pyodbc`가 실행되어, SQLite 환경에서 서버가 시작 안 됨.

### 수정 내용
[backend/api/routes/anomaly.py:4-9](../backend/api/routes/anomaly.py#L4-L9)

**변경 전**:
```python
import pyodbc
```

**변경 후**:
```python
try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    pyodbc = None
    PYODBC_AVAILABLE = False
```

### 효과
- MSSQL 환경: pyodbc 정상 사용 ✅
- SQLite 환경: pyodbc 없어도 서버 시작 가능 ✅
- database.py와 동일한 패턴 적용

---

## 📊 현재 시스템 상태

### 실행 중인 서버
```
✅ Backend API:          http://localhost:8000  (MSSQL 연결)
✅ Frontend Training:    http://localhost:5173
✅ Frontend Prediction:  http://localhost:5174
✅ Frontend Home:        http://localhost:3000
```

### 로그 파일 위치
```
/tmp/backend-mssql.log           # 백엔드
/tmp/frontend-prediction.log     # Prediction 프론트엔드
/tmp/frontend-training.log       # Training 프론트엔드
/tmp/frontend-home.log           # Home 프론트엔드
```

**로그 확인 명령**:
```bash
tail -f /tmp/backend-mssql.log
tail -f /tmp/frontend-prediction.log
```

---

## ✅ 체크리스트

업데이트가 반영 안 될 때:

- [ ] 브라우저 강제 새로고침 (`Ctrl + Shift + R`)
- [ ] 개발자 도구에서 캐시 비활성화 확인
- [ ] Vite 서버 재시작 (CSS 변경 시)
- [ ] 백엔드 재시작 (Python 변경 시)
- [ ] 중복 프로세스 확인 (`ps aux | grep uvicorn`)
- [ ] 로그 파일 확인 (`tail -f /tmp/backend-mssql.log`)

---

## 📚 참고 자료

- **Vite HMR 공식 문서**: https://vitejs.dev/guide/features.html#hot-module-replacement
- **FastAPI Auto-reload**: https://fastapi.tiangolo.com/deployment/manually/#run-a-server-manually-uvicorn
- **프로젝트 작업 로그**: [WORK_LOG_2025-10-10.md](./WORK_LOG_2025-10-10.md)

---

**작성일**: 2025-10-10
**작성자**: Claude AI Assistant
