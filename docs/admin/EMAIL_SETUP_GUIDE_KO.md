# 이메일 알림 설정 가이드

**작성일**: 2025-10-14
**대상**: 관리자

---

## 📋 개요

이 가이드는 MS365 Outlook 이메일 알림 시스템을 설정하는 방법을 설명합니다.

---

## 🔧 환경변수 설정 방법

### 방법 1: .env 파일 사용 (추천 ⭐)

1. **프로젝트 루트 디렉토리**에 `.env` 파일을 생성합니다
   ```bash
   cd C:\Users\syyun\Documents\GitHub\Routing_ML_251014
   ```

2. `.env` 파일을 열고 다음 내용을 추가합니다:
   ```bash
   # 이메일 알림 기능 사용
   EMAIL_ENABLED=true
   
   # MS365 Outlook SMTP 설정
   EMAIL_SMTP_SERVER=smtp.office365.com
   EMAIL_SMTP_PORT=587
   EMAIL_USE_TLS=true
   
   # 발신자 정보 (귀하의 MS365 이메일로 변경)
   EMAIL_SENDER=syyun@ksm.co.kr
   EMAIL_PASSWORD=여기에_비밀번호_입력
   
   # 관리자 이메일 (알림을 받을 주소)
   EMAIL_ADMIN=syyun@ksm.co.kr
   ```

3. **실제 값으로 변경**:
   - `EMAIL_SENDER`: 귀하의 MS365 이메일 주소
   - `EMAIL_PASSWORD`: 이메일 계정 비밀번호 (아래 보안 참조)
   - `EMAIL_ADMIN`: 회원가입 알림을 받을 이메일 주소

4. **저장 후 백엔드 재시작**:
   ```bash
   # 백엔드 서비스 재시작
   # (현재 실행 중인 백엔드를 중지하고 다시 시작)
   ```

### 방법 2: Windows 시스템 환경변수 (영구 설정)

1. **Win + R** 키를 누르고 `sysdm.cpl` 입력

2. **고급** 탭 → **환경 변수** 클릭

3. **시스템 변수** 섹션에서 **새로 만들기** 클릭

4. 다음 변수들을 하나씩 추가:
   ```
   변수 이름: EMAIL_ENABLED
   변수 값: true
   
   변수 이름: EMAIL_SMTP_SERVER
   변수 값: smtp.office365.com
   
   변수 이름: EMAIL_SMTP_PORT
   변수 값: 587
   
   변수 이름: EMAIL_USE_TLS
   변수 값: true
   
   변수 이름: EMAIL_SENDER
   변수 값: syyun@ksm.co.kr
   
   변수 이름: EMAIL_PASSWORD
   변수 값: [귀하의 비밀번호]
   
   변수 이름: EMAIL_ADMIN
   변수 값: syyun@ksm.co.kr
   ```

5. **확인** 클릭하여 저장

6. **컴퓨터 재시작** (또는 터미널 재시작)

### 방법 3: 배치 파일에서 임시 설정

백엔드 실행 배치 파일 상단에 추가:

```batch
@echo off
set EMAIL_ENABLED=true
set EMAIL_SMTP_SERVER=smtp.office365.com
set EMAIL_SMTP_PORT=587
set EMAIL_USE_TLS=true
set EMAIL_SENDER=syyun@ksm.co.kr
set EMAIL_PASSWORD=여기에_비밀번호_입력
set EMAIL_ADMIN=syyun@ksm.co.kr

REM 백엔드 실행
.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000
```

---

## 🔐 보안: MS365 앱 비밀번호 생성 (권장)

일반 비밀번호 대신 **앱 비밀번호**를 사용하는 것이 더 안전합니다.

### 앱 비밀번호 생성 방법:

1. **MS365 계정 보안 설정**으로 이동
   - https://account.microsoft.com/security

2. **고급 보안 옵션** 클릭

3. **앱 비밀번호** 섹션 찾기

4. **새 앱 비밀번호 만들기** 클릭

5. 생성된 비밀번호를 복사하여 `EMAIL_PASSWORD`에 사용

---

## ✅ 설정 확인

### 1. 환경변수가 제대로 로드되는지 확인:

```python
# Python에서 테스트
from backend.api.config import get_settings

settings = get_settings()
print(f"이메일 사용: {settings.email_enabled}")
print(f"발신자: {settings.email_sender}")
print(f"관리자: {settings.email_admin}")
```

### 2. 백엔드 로그 확인:

백엔드 시작 시 다음과 같은 로그가 나타나야 합니다:
```
INFO: Email notifications enabled
INFO: Email sender: syyun@ksm.co.kr
INFO: Email admin: syyun@ksm.co.kr
```

### 3. 테스트 회원가입:

1. 프론트엔드에서 새 계정으로 회원가입
2. **이메일 주소 입력** (중요!)
3. 관리자 이메일함 확인
4. 사이버펑크 테마의 가입 알림 이메일 수신 확인

---

## 🐛 문제 해결

### 문제: 이메일이 발송되지 않음

**확인 사항**:

1. **.env 파일이 프로젝트 루트에 있는지 확인**
   ```
   C:\Users\syyun\Documents\GitHub\Routing_ML_251014\.env
   ```

2. **EMAIL_ENABLED=true 인지 확인**

3. **SMTP 인증 정보 확인**:
   - EMAIL_SENDER가 유효한 MS365 이메일인지
   - EMAIL_PASSWORD가 올바른지 (또는 앱 비밀번호)

4. **방화벽 확인**:
   - 포트 587이 열려있는지 확인
   ```bash
   netsh advfirewall firewall show rule name=all | findstr "587"
   ```

5. **로그 확인**:
   ```bash
   # 백엔드 로그에서 이메일 관련 오류 찾기
   type logs\auth.service.*.log | findstr "이메일"
   ```

### 문제: "이메일 전송 실패" 로그

**가능한 원인**:

1. **SMTP 인증 실패**:
   - 비밀번호 오류
   - 2단계 인증 활성화 (앱 비밀번호 필요)

2. **네트워크 문제**:
   - 회사 방화벽이 SMTP 차단
   - smtp.office365.com 접근 불가

3. **MS365 설정 문제**:
   - SMTP 인증이 비활성화됨
   - Exchange Online 설정 확인 필요

### 문제: 이메일 수신했지만 스팸함에 있음

**해결책**:

1. 스팸함에서 "정크 아님" 표시
2. 발신자를 연락처에 추가
3. 받은 편지함 규칙 생성

---

## 📊 설정 예제

### 개발 환경 (.env):
```bash
EMAIL_ENABLED=true
EMAIL_SMTP_SERVER=smtp.office365.com
EMAIL_SMTP_PORT=587
EMAIL_USE_TLS=true
EMAIL_SENDER=dev@ksm.co.kr
EMAIL_PASSWORD=dev-app-password-123
EMAIL_ADMIN=syyun@ksm.co.kr
```

### 운영 환경 (시스템 환경변수):
```
EMAIL_ENABLED=true
EMAIL_SMTP_SERVER=smtp.office365.com
EMAIL_SMTP_PORT=587
EMAIL_USE_TLS=true
EMAIL_SENDER=noreply@ksm.co.kr
EMAIL_PASSWORD=[보안 관리되는 앱 비밀번호]
EMAIL_ADMIN=admin@ksm.co.kr
```

---

## 🔄 변경사항 적용

환경변수 변경 후:

1. **.env 파일 수정한 경우**: 백엔드 재시작만
2. **시스템 환경변수 수정한 경우**: 터미널 재시작 또는 컴퓨터 재시작
3. **배치 파일 수정한 경우**: 배치 파일 다시 실행

---

## 📞 지원

문제가 계속되면:
- Email: syyun@ksm.co.kr
- Tel: 010-9718-0580

---

**작성**: Development Team
**최종 업데이트**: 2025-10-14
