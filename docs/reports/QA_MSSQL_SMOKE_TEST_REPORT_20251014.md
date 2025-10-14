# MSSQL 데이터베이스 연결 기능 QA 보고서

**작성일**: 2025-10-14
**버전**: v1.0
**작성자**: Claude Code Agent
**대상 커밋**: d7b932e0

---

## 📋 목차

1. [개요](#개요)
2. [검토 대상](#검토-대상)
3. [환경 및 의존성 확인](#환경-및-의존성-확인)
4. [코드 분석 결과](#코드-분석-결과)
5. [발견된 이슈](#발견된-이슈)
6. [스모크 테스트 가능 여부](#스모크-테스트-가능-여부)
7. [권장사항](#권장사항)
8. [결론](#결론)

---

## 개요

이 문서는 MSSQL 데이터베이스 연결 및 설정 기능에 대한 정적 분석(Static Analysis) 및 스모크 테스트 가능성을 평가한 QA 보고서입니다.

### 주요 기능
- MSSQL 데이터베이스 연결 설정 UI (Training & Prediction Frontend)
- 연결 테스트 기능
- 설정 저장 기능 (.env 파일)
- 연결 풀링 및 캐시 메커니즘

---

## 검토 대상

### 백엔드 파일
1. **backend/database.py** (1,525 lines)
   - MSSQL 연결 관리
   - 연결 풀링 (ConnectionPool)
   - 쿼리 실행 함수들
   - 캐시 메커니즘

2. **backend/api/routes/database_config.py** (187 lines)
   - `/api/database/config` - GET/POST 엔드포인트
   - `/api/database/test-connection` - POST 엔드포인트
   - `/api/database/info` - GET 엔드포인트

### 프론트엔드 파일
3. **frontend-training/src/components/DatabaseSettings.tsx** (403 lines)
   - 데이터베이스 설정 UI 컴포넌트
   - 연결 테스트 기능
   - 설정 저장 기능

4. **frontend-prediction/src/components/DatabaseSettings.tsx** (403 lines)
   - Training과 동일한 컴포넌트 (복사본)

### 환경 설정
5. **.env** 파일
   - MSSQL 연결 정보 저장
   - 비밀번호 포함

---

## 환경 및 의존성 확인

### ✅ Python 의존성
```
pyodbc==5.1.0         ✓ 설치됨
pandas==2.2.0         ✓ 설치됨
fastapi==0.103.2      ✓ 설치됨
pydantic==2.8.2       ✓ 설치됨
SQLAlchemy==2.0.25    ✓ 설치됨
```

### ✅ ODBC 드라이버
시스템에 다음 MSSQL 드라이버가 설치되어 있음:
- **ODBC Driver 17 for SQL Server** ✓
- ODBC Driver 11 for SQL Server ✓
- SQL Server Native Client 11.0 ✓

### ✅ 환경 변수 설정
```ini
DB_TYPE=MSSQL
MSSQL_SERVER=K3-DB.ksm.co.kr,1433
MSSQL_DATABASE=KsmErp
MSSQL_USER=FKSM_BI
MSSQL_PASSWORD=bimskc2025!!
MSSQL_ENCRYPT=True
MSSQL_TRUST_CERTIFICATE=True
```

---

## 코드 분석 결과

### 백엔드 (database.py)

#### ✅ 장점
1. **강력한 오류 처리**
   - 연결 재시도 메커니즘 (최대 3회)
   - pyodbc import 실패 시 graceful fallback
   - 드라이버 자동 감지 및 선택

2. **연결 풀링 구현**
   - `ConnectionPool` 클래스로 연결 재사용
   - 최대 5개 연결 유지
   - 연결 상태 자동 확인 및 재생성

3. **캐시 메커니즘**
   - `@lru_cache` 데코레이터 사용
   - 품목 마스터 및 라우팅 데이터 캐싱
   - 캐시 통계 추적 (히트율 등)

4. **보안**
   - SQL Injection 방지 (파라미터화된 쿼리)
   - 컬럼 화이트리스트 검증

#### ⚠️ 잠재적 이슈
1. **비밀번호 보안**
   - 환경변수에 평문 저장됨
   - .env 파일이 Git에 포함될 위험

2. **연결 타임아웃**
   - 기본 타임아웃 10초 (line 187)
   - 네트워크 지연 시 문제 가능

3. **리소스 정리**
   - `atexit.register(cleanup_connections)` 의존
   - 비정상 종료 시 연결 누수 가능성

### 백엔드 API (database_config.py)

#### ✅ 장점
1. **인증 보호**
   - 모든 엔드포인트에 `require_auth` 적용

2. **임시 환경변수 처리**
   - 연결 테스트 시 원본 환경변수 백업/복원
   - `importlib.reload`로 모듈 재로드

3. **로깅**
   - 모든 작업에 대한 상세 로그

#### ⚠️ 발견된 이슈

**🔴 심각: 모듈 리로드 문제**
```python
# Line 155: backend/api/routes/database_config.py
importlib.reload(db_module)
```
- **문제**: 프로덕션 환경에서 전역 모듈 리로드는 위험
- **영향**: 동시 요청 처리 시 다른 세션에 영향
- **해결책**: 연결 테스트용 별도 함수 생성 권장

**🟡 주의: .env 파일 동시 쓰기**
```python
# Line 109: backend/api/routes/database_config.py
with open(env_path, "w", encoding="utf-8") as handle:
    handle.writelines(filtered)
```
- **문제**: 파일 락 없이 쓰기
- **영향**: 동시 저장 시 데이터 손실 가능
- **해결책**: 파일 락 또는 원자적 쓰기 구현

### 프론트엔드 (DatabaseSettings.tsx)

#### ✅ 장점
1. **사용자 친화적 UI**
   - 현재 연결 상태 실시간 표시
   - 색상 코딩 (초록=연결, 빨강=끊김)
   - 입력 필드 검증

2. **비밀번호 처리**
   - UI에서 비밀번호 입력 받음
   - .env에는 저장하지 않는다고 안내

3. **에러 핸들링**
   - 연결 테스트 실패 시 상세 메시지
   - 저장 전 연결 테스트 확인

#### ⚠️ 발견된 이슈

**🟡 주의: 함수명 오타**
```typescript
// Line 68: frontend-training/src/components/DatabaseSettings.tsx
const handleTest Connection = async () => {
```
- **문제**: 함수명에 공백 포함 (JavaScript에서는 작동하지만 비표준)
- **영향**: 코드 가독성 및 유지보수성 저하
- **해결책**: `handleTestConnection`으로 수정 필요

**🟡 주의: alert/confirm 사용**
```typescript
// Lines 70, 115, 123: alert() 사용
alert('비밀번호를 입력해주세요');
confirm('연결 테스트가 실패했습니다...');
```
- **문제**: 브라우저 네이티브 다이얼로그 사용
- **영향**: UI 일관성 부족, 테스트 어려움
- **해결책**: 커스텀 모달 컴포넌트 사용 권장

**🟡 주의: 비동기 로직 문제**
```typescript
// Line 120: handleSaveConfig
await handleTestConnection();

if (testResult && !testResult.success) {  // ❌ testResult는 아직 null
```
- **문제**: `handleTestConnection`이 `testResult`를 비동기로 설정하지만, 바로 다음 줄에서 체크
- **영향**: 테스트 결과가 반영되기 전에 저장 진행
- **해결책**: 함수 구조 개선 필요

---

## 발견된 이슈

### 🔴 심각 이슈 (1건)
| ID | 파일 | 라인 | 설명 | 우선순위 |
|---|---|---|---|---|
| 1 | database_config.py | 155 | 프로덕션 환경에서 모듈 리로드 위험 | 높음 |

### 🟡 주의 이슈 (4건)
| ID | 파일 | 라인 | 설명 | 우선순위 |
|---|---|---|---|---|
| 2 | database_config.py | 109 | .env 파일 동시 쓰기 미보호 | 중간 |
| 3 | DatabaseSettings.tsx | 68 | 함수명 오타 (공백 포함) | 중간 |
| 4 | DatabaseSettings.tsx | 70, 115, 123 | alert/confirm 사용 | 낮음 |
| 5 | DatabaseSettings.tsx | 120-122 | 비동기 로직 문제 | 중간 |

### 🟢 정보성 이슈 (2건)
| ID | 파일 | 설명 |
|---|---|---|
| 6 | database.py | 연결 타임아웃 10초 - 네트워크 지연 시 조정 필요 |
| 7 | .env | 비밀번호 평문 저장 - 프로덕션에서는 시크릿 관리 도구 사용 권장 |

---

## 스모크 테스트 가능 여부

### ✅ **스모크 테스트 가능**

다음 조건이 충족되어 있어 기본적인 스모크 테스트가 가능합니다:

#### 1. 환경 준비 완료
- ✅ pyodbc 설치됨 (v5.1.0)
- ✅ ODBC Driver 17 for SQL Server 설치됨
- ✅ .env 파일에 연결 정보 설정됨
- ✅ 백엔드 API 엔드포인트 구현됨

#### 2. 테스트 가능한 시나리오

**시나리오 1: 백엔드 연결 테스트**
```bash
# 백엔드 서버 시작
./.venv/Scripts/python.exe -m uvicorn backend.api.app:app --reload

# API 테스트 (인증 필요)
curl -X GET http://localhost:8000/api/database/info
```

**시나리오 2: 프론트엔드 UI 테스트**
1. Training Frontend (포트 5174) 또는 Prediction Frontend (포트 5173) 실행
2. "Database Settings" 탭 또는 섹션 확인
3. 연결 테스트 버튼 클릭
4. 설정 저장 버튼 클릭

**시나리오 3: Python 스크립트 직접 테스트**
```python
# test_mssql_connection.py
from backend.database import test_connection, get_database_info

if test_connection():
    print("✓ 연결 성공")
    info = get_database_info()
    print(f"서버: {info['server']}")
    print(f"데이터베이스: {info['database']}")
else:
    print("✗ 연결 실패")
```

#### 3. 테스트 제약사항

⚠️ **네트워크 접근 필요**
- MSSQL 서버 (K3-DB.ksm.co.kr:1433)에 접근 가능해야 함
- 방화벽 포트 1433 개방 필요

⚠️ **인증 정보 필요**
- 유효한 사용자명/비밀번호 필요
- .env에 MSSQL_PASSWORD 설정 필요

⚠️ **타임아웃 고려**
- 네트워크 지연 시 10초 타임아웃
- VPN 사용 시 더 긴 타임아웃 필요할 수 있음

---

## 권장사항

### 🔥 즉시 조치 필요

1. **DatabaseSettings.tsx 함수명 수정**
   ```typescript
   // 수정 전
   const handleTest Connection = async () => {

   // 수정 후
   const handleTestConnection = async () => {
   ```

2. **비동기 로직 수정**
   ```typescript
   const handleSaveConfig = async () => {
     if (!password) {
       alert('비밀번호를 입력해주세요');
       return;
     }

     // 연결 테스트 먼저 실행
     setTesting(true);
     const testPayload = { ...config, password };
     const testResponse = await fetch('/api/database/test-connection', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(testPayload),
     });
     const testData = await testResponse.json();
     setTesting(false);

     // 테스트 실패 시 확인
     if (!testData.success) {
       if (!confirm('연결 테스트가 실패했습니다. 그래도 저장하시겠습니까?')) {
         return;
       }
     }

     // 저장 진행
     // ...
   };
   ```

### 📋 단기 개선사항

3. **모듈 리로드 제거**
   - `backend/api/routes/database_config.py`의 `importlib.reload` 제거
   - 연결 테스트용 독립 함수 생성

4. **파일 락 구현**
   - .env 파일 쓰기 시 `fcntl.flock` 또는 `portalocker` 사용

5. **UI 개선**
   - `alert()`/`confirm()` → 커스텀 모달 컴포넌트로 교체

### 🔮 장기 개선사항

6. **비밀번호 보안 강화**
   - Azure Key Vault 또는 AWS Secrets Manager 사용
   - 개발 환경에서는 .env, 프로덕션에서는 시크릿 관리 서비스

7. **모니터링 추가**
   - 연결 풀 상태 모니터링 엔드포인트
   - 캐시 히트율 메트릭 수집

8. **테스트 커버리지**
   - 단위 테스트 추가 (pytest)
   - E2E 테스트 추가 (Playwright)

---

## 결론

### 전체 평가: **⚠️ 조건부 통과**

#### ✅ 긍정적 측면
- 핵심 기능 구현 완료
- 강력한 오류 처리 및 재시도 메커니즘
- 연결 풀링 및 캐시로 성능 최적화
- 보안 인증 적용

#### ⚠️ 개선 필요 사항
- 프론트엔드 함수명 오타 수정 필요
- 비동기 로직 개선 필요
- 모듈 리로드 제거 권장

### 스모크 테스트 결론

**✅ 스모크 테스트 가능**
- 환경 설정 완료
- 기본 연결 테스트 가능
- UI 동작 확인 가능

**⚠️ 프로덕션 배포 전 필수 조치**
1. DatabaseSettings.tsx 함수명 수정 (심각도: 높음)
2. 비동기 로직 수정 (심각도: 중간)
3. 모듈 리로드 제거 (심각도: 높음)

### 다음 단계

1. **즉시**: 발견된 코드 오류 수정
2. **1일 이내**: 수정 후 실제 스모크 테스트 수행
3. **1주 이내**: 단기 개선사항 적용
4. **1개월 이내**: 장기 개선사항 검토 및 계획

---

## 부록: 스모크 테스트 체크리스트

### 백엔드 테스트
- [ ] `test_connection()` 함수 실행
- [ ] `get_database_info()` 함수 실행
- [ ] 연결 풀 동작 확인 (5개 연결)
- [ ] 캐시 메커니즘 확인
- [ ] API 엔드포인트 응답 확인

### 프론트엔드 테스트
- [ ] 현재 연결 상태 표시 확인
- [ ] 설정 폼 입력 가능 확인
- [ ] 연결 테스트 버튼 동작 확인
- [ ] 설정 저장 버튼 동작 확인
- [ ] 에러 메시지 표시 확인

### 통합 테스트
- [ ] 프론트엔드 → 백엔드 API 호출
- [ ] 설정 저장 후 .env 파일 확인
- [ ] 연결 테스트 결과 UI 반영 확인
- [ ] 재시작 후 설정 유지 확인

---

**보고서 종료**
