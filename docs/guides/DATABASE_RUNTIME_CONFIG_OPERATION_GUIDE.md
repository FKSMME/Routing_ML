# Database Runtime Configuration - 운영 가이드

**문서 ID:** OPS-DB-CONFIG-2025-10-15
**버전:** 1.0.0
**작성일:** 2025-10-15 09:52:00
**작성자:** Claude (AI Assistant)
**대상 독자:** 시스템 관리자, 운영 담당자

---

## 목차
1. [개요](#1-개요)
2. [사전 준비](#2-사전-준비)
3. [마이그레이션 절차](#3-마이그레이션-절차)
4. [설정 변경 절차](#4-설정-변경-절차)
5. [연결 테스트](#5-연결-테스트)
6. [트러블슈팅](#6-트러블슈팅)
7. [비상 복원 절차](#7-비상-복원-절차)
8. [보안 고려사항](#8-보안-고려사항)

---

## 1. 개요

### 1.1 변경 사항
- MSSQL 데이터베이스 연결 설정을 **런타임에서 UI를 통해 변경** 가능
- 기존 `.env` 파일 방식에서 `workflow_settings.json` (config_store) 기반으로 전환
- 설정 변경 후 **애플리케이션 재시작 불필요** (즉시 반영)

### 1.2 영향 범위
- **백엔드:** `backend/database.py`, `backend/api/routes/database_config.py`
- **프런트엔드:** Database Settings UI (신규/수정)
- **설정 파일:** `config/workflow_settings.json`
- **환경 변수:** PowerShell 환경변수 또는 `.env` 파일 (하위 호환성 유지)

### 1.3 주요 이점
- ✅ 운영 중 DB 설정 즉시 변경 (재시작 불필요)
- ✅ 뷰 이름 동적 변경 (테스트/운영 환경 분리 용이)
- ✅ UI를 통한 직관적인 설정 관리
- ✅ 설정 백업 및 복원 기능

---

## 2. 사전 준비

### 2.1 시스템 요구사항
- Python 3.8 이상
- PowerShell (Windows) 또는 Bash (Linux/macOS)
- 기존 MSSQL 연결 정보 확인

### 2.2 백업 생성
**⚠️ 중요:** 마이그레이션 전 필수 백업!

```bash
# 1. workflow_settings.json 백업
cp config/workflow_settings.json config/workflow_settings.backup_$(date +%Y%m%d_%H%M%S).json

# 2. .env 파일 백업 (존재하는 경우)
cp .env .env.backup_$(date +%Y%m%d_%H%M%S)
```

### 2.3 현재 설정 확인

#### PowerShell 환경변수 확인 (Windows)
```powershell
# MSSQL 관련 환경변수 조회
Get-ChildItem Env: | Where-Object { $_.Name -like "*MSSQL*" } | Format-Table Name, Value
```

#### .env 파일 확인
```bash
cat .env | grep MSSQL
```

**예상 출력:**
```
MSSQL_SERVER=K3-DB.ksm.co.kr,1433
MSSQL_DATABASE=KsmErp
MSSQL_USER=FKSM_BI
MSSQL_PASSWORD=****
MSSQL_ENCRYPT=False
MSSQL_TRUST_CERTIFICATE=True
```

---

## 3. 마이그레이션 절차

### 3.1 마이그레이션 스크립트 실행

```bash
# 1. 스크립트 실행 (Dry Run 먼저 수행)
python scripts/migrate_database_config.py
```

**스크립트 동작:**
1. `.env` 파일 또는 PowerShell 환경변수 읽기
2. `workflow_settings.json` 백업 생성
3. MSSQL 설정을 `data_source` 섹션에 병합
4. 사용자 확인 후 저장

**출력 예시:**
```
====================================================================
📦 MSSQL 데이터베이스 설정 마이그레이션
====================================================================
시작 시간: 2025-10-15 09:52:30

1️⃣  .env 파일 로드 중...
   ✅ 10개 환경변수 로드

2️⃣  MSSQL 설정 추출 중...
   ✅ MSSQL 설정 추출 완료
      - Server: K3-DB.ksm.co.kr,1433
      - Database: KsmErp
      - User: FKSM_BI
      - Password: ****

3️⃣  workflow_settings.json 백업 생성 중...
   ✅ 백업 생성: config/workflow_settings.backup_20251015_095230.json

4️⃣  마이그레이션 미리보기 (Dry Run)...
============================================================
📝 병합된 data_source 설정:
============================================================
{
  "offline_dataset_path": null,
  "default_table": "dbo.BI_ITEM_INFO_VIEW",
  "mssql_server": "K3-DB.ksm.co.kr,1433",
  "mssql_database": "KsmErp",
  "mssql_user": "FKSM_BI",
  "mssql_password": "your_password_here",
  "mssql_encrypt": false,
  "mssql_trust_certificate": true,
  "item_view": "dbo.BI_ITEM_INFO_VIEW",
  "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
  "work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
  "purchase_order_view": "dbo.BI_PUR_PO_VIEW",
  ...
}
============================================================

위 설정으로 진행하시겠습니까? (y/N)
> y

5️⃣  실제 마이그레이션 실행 중...
✅ 설정 저장 완료: config/workflow_settings.json

====================================================================
✅ 마이그레이션 완료!
====================================================================
완료 시간: 2025-10-15 09:52:45

📌 다음 단계:
   1. 애플리케이션을 재시작하세요.
   2. Database Settings UI에서 설정을 확인하세요.
   3. 연결 테스트를 수행하세요.

🗂️  백업 파일: config/workflow_settings.backup_20251015_095230.json
```

### 3.2 애플리케이션 재시작

```bash
# 백엔드 재시작
cd backend
source ../.venv/bin/activate  # Linux/macOS
# 또는
.venv\Scripts\activate  # Windows

uvicorn backend.api.app:app --reload --port 8000
```

### 3.3 마이그레이션 검증

```bash
# 1. API를 통해 설정 조회
curl http://localhost:8000/api/database/config

# 예상 응답:
# {
#   "server": "K3-DB.ksm.co.kr,1433",
#   "database": "KsmErp",
#   "user": "FKSM_BI",
#   "encrypt": false,
#   "trust_certificate": true,
#   "item_view": "dbo.BI_ITEM_INFO_VIEW",
#   "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
#   ...
# }
```

---

## 4. 설정 변경 절차

### 4.1 UI를 통한 설정 변경

#### 단계 1: Database Settings 화면 접속
1. 웹 브라우저에서 애플리케이션 접속
2. **Settings** → **Database Settings** 메뉴 클릭

#### 단계 2: 설정 입력
**필수 필드:**
- Server: `K3-DB.ksm.co.kr,1433`
- Database: `KsmErp`
- User: `FKSM_BI`
- Password: `••••••••` (마스킹 처리)

**선택 필드:**
- Encrypt: ☐ (기본: 체크 해제)
- Trust Certificate: ☑ (기본: 체크)

**뷰 설정:**
- Item View: `dbo.BI_ITEM_INFO_VIEW`
- Routing View: `dbo.BI_ROUTING_HIS_VIEW`
- Work Result View: `dbo.BI_WORK_ORDER_RESULTS`
- Purchase Order View: `dbo.BI_PUR_PO_VIEW`

#### 단계 3: 연결 테스트
1. **Test Connection** 버튼 클릭
2. 연결 성공 메시지 확인:
   ```
   ✅ 데이터베이스 연결 성공
   - Server: K3-DB.ksm.co.kr
   - Database: KsmErp
   - View Accessible: ✅ dbo.BI_ITEM_INFO_VIEW
   ```

#### 단계 4: 설정 저장
1. **Save** 버튼 클릭
2. 성공 메시지 확인: "설정이 저장되었습니다."
3. **캐시 무효화 자동 실행** (재시작 불필요)

### 4.2 API를 통한 설정 변경

```bash
# POST /api/database/config
curl -X POST http://localhost:8000/api/database/config \
  -H "Content-Type: application/json" \
  -d '{
    "server": "K3-DB.ksm.co.kr,1433",
    "database": "KsmErp",
    "user": "FKSM_BI",
    "password": "your_password_here",
    "encrypt": false,
    "trust_certificate": true,
    "item_view": "dbo.BI_ITEM_INFO_VIEW",
    "routing_view": "dbo.BI_ROUTING_HIS_VIEW",
    "work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
    "purchase_order_view": "dbo.BI_PUR_PO_VIEW"
  }'
```

---

## 5. 연결 테스트

### 5.1 UI를 통한 테스트
1. Database Settings 화면
2. **Test Connection** 버튼 클릭
3. 결과 확인:
   - ✅ 연결 성공: "데이터베이스 연결 성공"
   - ❌ 연결 실패: 에러 메시지 확인 (하단 트러블슈팅 참조)

### 5.2 API를 통한 테스트

```bash
# POST /api/database/test-connection
curl -X POST http://localhost:8000/api/database/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "server": "K3-DB.ksm.co.kr,1433",
    "database": "KsmErp",
    "user": "FKSM_BI",
    "password": "your_password_here",
    "encrypt": false,
    "trust_certificate": true
  }'
```

**성공 응답:**
```json
{
  "success": true,
  "message": "데이터베이스 연결 성공",
  "details": {
    "connection_status": "정상",
    "server": "K3-DB.ksm.co.kr",
    "database": "KsmErp",
    "view_accessible": true
  }
}
```

**실패 응답:**
```json
{
  "success": false,
  "message": "데이터베이스 연결 실패: Login failed for user 'FKSM_BI'",
  "details": {
    "connection_status": "오류: Login failed",
    "server": "K3-DB.ksm.co.kr,1433",
    "database": "KsmErp"
  }
}
```

---

## 6. 트러블슈팅

### 6.1 연결 실패

#### 증상 1: "Login failed for user"
**원인:** 비밀번호 오류 또는 사용자 권한 부족
**해결:**
1. 비밀번호 확인 (PowerShell 환경변수 또는 `.env` 확인)
   ```powershell
   $Env:MSSQL_PASSWORD  # Windows
   ```
2. MSSQL 서버에서 사용자 권한 확인
   ```sql
   -- SSMS에서 실행
   USE KsmErp;
   SELECT * FROM sys.database_principals WHERE name = 'FKSM_BI';
   ```

#### 증상 2: "No suitable ODBC driver found"
**원인:** ODBC 드라이버 미설치
**해결:**
1. 드라이버 설치 확인
   ```bash
   python scripts/check_odbc.py
   ```
2. ODBC Driver 17 for SQL Server 설치
   - Windows: [Microsoft 다운로드](https://learn.microsoft.com/ko-kr/sql/connect/odbc/download-odbc-driver-for-sql-server)
   - Linux: `sudo apt-get install msodbcsql17`

#### 증상 3: "View not accessible"
**원인:** 뷰 이름 오류 또는 권한 부족
**해결:**
1. 뷰 이름 확인
   ```sql
   -- SSMS에서 실행
   SELECT TABLE_SCHEMA, TABLE_NAME
   FROM INFORMATION_SCHEMA.VIEWS
   WHERE TABLE_NAME LIKE '%ITEM%';
   ```
2. 사용자 권한 부여
   ```sql
   GRANT SELECT ON dbo.BI_ITEM_INFO_VIEW TO FKSM_BI;
   ```

### 6.2 설정 저장 실패

#### 증상: "설정 파일 쓰기 권한이 없습니다"
**원인:** `config/workflow_settings.json` 파일 권한 부족
**해결:**
```bash
# Linux/macOS
chmod 600 config/workflow_settings.json

# Windows (PowerShell 관리자 권한)
icacls config\workflow_settings.json /grant:r "Users:(M)"
```

### 6.3 캐시 무효화 실패

#### 증상: 설정 변경 후에도 이전 데이터 조회
**원인:** 캐시 무효화 미실행
**해결:**
1. API를 통한 수동 캐시 무효화
   ```bash
   curl -X POST http://localhost:8000/api/database/invalidate-cache
   ```
2. 애플리케이션 재시작 (최후 수단)

---

## 7. 비상 복원 절차

### 7.1 workflow_settings.json 복원

```bash
# 1. 최신 백업 파일 확인
ls -lht config/workflow_settings.backup_*.json | head -1

# 2. 백업 복원
cp config/workflow_settings.backup_20251015_095230.json config/workflow_settings.json

# 3. 애플리케이션 재시작
# (프로세스 관리 도구에 따라 다름)
```

### 7.2 .env 파일 복원 (레거시)

```bash
# 1. .env 백업 복원
cp .env.backup_20251015_095230 .env

# 2. config_store에서 MSSQL 설정 제거 (선택)
# workflow_settings.json 파일에서 mssql_* 필드 삭제

# 3. 애플리케이션 재시작
```

### 7.3 긴급 대응 절차

**문제:** 데이터베이스 연결 완전 실패, 복원도 불가능

**조치:**
1. **읽기 전용 모드 활성화** (선택)
   ```bash
   export READ_ONLY_MODE=true
   ```
2. **데모 모드 활성화** (임시 조치)
   ```bash
   export DEMO_MODE=true
   ```
3. **기술 지원 연락**
   - 담당자: [이름]
   - 연락처: [전화번호]
   - 이메일: [이메일]

---

## 8. 보안 고려사항

### 8.1 비밀번호 관리

#### ⚠️ 주의사항
- `workflow_settings.json`에 비밀번호가 **평문으로 저장**됩니다.
- 파일 권한 제어를 통해 보안 유지 필수

#### 권장 조치
1. **파일 권한 최소화**
   ```bash
   # Linux/macOS
   chmod 600 config/workflow_settings.json
   chown root:root config/workflow_settings.json

   # Windows (PowerShell 관리자 권한)
   icacls config\workflow_settings.json /inheritance:r
   icacls config\workflow_settings.json /grant:r "Administrators:(F)"
   ```

2. **Git에서 제외**
   ```bash
   # .gitignore에 추가
   echo "config/workflow_settings.json" >> .gitignore
   ```

3. **로그 마스킹 확인**
   - 애플리케이션 로그에 비밀번호가 `****`로 표시되는지 확인
   ```bash
   tail -f logs/backend.log | grep -i password
   # 출력 예: "연결 정보: Server=K3-DB, User=FKSM_BI, Password=****"
   ```

### 8.2 접근 제어

#### 운영 서버
- Database Settings UI는 **관리자 권한 사용자만** 접근 가능
- `/api/database/config` API는 **인증 필수** (JWT 토큰)

#### 개발/테스트 환경
- 별도 DB 계정 사용 (읽기 전용 권장)
- 운영 DB 비밀번호와 분리

---

## 9. 체크리스트

### 마이그레이션 전
- [ ] `workflow_settings.json` 백업 생성
- [ ] `.env` 파일 백업 생성 (존재하는 경우)
- [ ] 현재 MSSQL 설정 확인 (PowerShell 또는 .env)
- [ ] 마이그레이션 스크립트 실행 (Dry Run)

### 마이그레이션 후
- [ ] 애플리케이션 재시작
- [ ] API를 통한 설정 조회 확인
- [ ] 연결 테스트 성공 확인
- [ ] 품목 조회 API 정상 작동 확인
- [ ] UI를 통한 설정 변경 테스트

### 보안
- [ ] `workflow_settings.json` 파일 권한 설정 (600)
- [ ] 로그 마스킹 확인 (비밀번호 `****` 표시)
- [ ] `.gitignore`에 설정 파일 추가
- [ ] 관리자 권한 접근 제어 확인

---

## 10. 참고 자료

### 관련 문서
- [DATABASE_RUNTIME_CONFIG_DESIGN.md](../Design/DATABASE_RUNTIME_CONFIG_DESIGN.md) - 설계 문서
- [PYODBC_REFACTORING_GUIDE.md](./PYODBC_REFACTORING_GUIDE.md) - PyODBC 리팩토링 가이드

### API 엔드포인트
- `GET /api/database/config` - 현재 설정 조회
- `POST /api/database/config` - 설정 변경
- `POST /api/database/test-connection` - 연결 테스트
- `GET /api/database/info` - 데이터베이스 정보

### 유틸리티 스크립트
- `scripts/migrate_database_config.py` - 마이그레이션 스크립트
- `scripts/check_odbc.py` - ODBC 드라이버 확인

---

**문서 버전:** 1.0.0
**최종 업데이트:** 2025-10-15 09:52:00
**다음 검토 예정:** 2025-11-15
