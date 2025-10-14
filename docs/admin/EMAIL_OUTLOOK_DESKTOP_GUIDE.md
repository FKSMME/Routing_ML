# Outlook Desktop 이메일 알림 가이드

**작성일**: 2025-10-14  
**업데이트**: Outlook Desktop 방식으로 변경  
**버전**: v2.0

---

## 🎯 개요

이메일 알림 시스템이 **Outlook Desktop**을 활용하는 방식으로 변경되었습니다.

### 변경 사항

**이전 (SMTP 방식)**:
- 백엔드에서 자동으로 이메일 발송
- MS365 비밀번호 필요
- 백그라운드 자동 전송

**현재 (Outlook Desktop 방식)**:
- Outlook Desktop 앱 사용
- 이메일 작성창 자동 열림
- **사용자가 내용 확인 후 직접 발송** ✅
- 더 안전하고 신뢰성 있음

---

## 🔧 사전 준비

### 1. Outlook Desktop 설치 및 로그인

1. **Microsoft Outlook** 앱이 설치되어 있어야 합니다
2. **MS365 계정으로 로그인**되어 있어야 합니다
3. 이메일 계정이 활성화되어 있어야 합니다

### 2. pywin32 패키지 설치

```bash
# 가상환경 활성화
.venv\Scripts\activate

# pywin32 설치
pip install pywin32==306
```

또는 requirements.txt로 설치:
```bash
pip install -r requirements.txt
```

---

## 📧 작동 방식

### 회원가입 시

1. 사용자가 회원가입
2. 백엔드가 Outlook Desktop 확인
3. **Outlook이 켜져 있으면**:
   - 이메일 작성창 자동 열림
   - 제목, 받는사람, 내용 자동 입력
   - 사용자가 내용 확인
   - 사용자가 **발송 버튼** 클릭 📤
4. **Outlook이 꺼져 있으면**:
   - 로그에 "Outlook이 실행되지 않아 이메일 알림을 건너뜁니다" 기록
   - 회원가입은 정상 처리
   - 이메일 없이 진행

### 승인/거절 시

- 동일한 방식으로 작동
- Outlook 실행 필요
- 사용자가 직접 발송

---

## ⚙️ 설정

### .env 파일

더 이상 SMTP 설정이 필요 없습니다!

```bash
# 이메일 알림 기능 사용
EMAIL_ENABLED=true

# 관리자 이메일 (알림 받을 주소)
EMAIL_ADMIN=syyun@ksm.co.kr

# 아래 설정들은 더 이상 필요 없음 (무시됨)
# EMAIL_SMTP_SERVER=...
# EMAIL_SMTP_PORT=...
# EMAIL_SENDER=...
# EMAIL_PASSWORD=...
# EMAIL_USE_TLS=...
```

**필수 설정**:
- `EMAIL_ENABLED=true`: 이메일 알림 활성화
- `EMAIL_ADMIN`: 관리자 이메일 주소

**불필요한 설정**:
- SMTP 관련 설정 전부 (무시됨)

---

## ✅ 사용 방법

### 1단계: Outlook 실행

**중요**: 백엔드 사용 전에 Outlook을 실행하세요!

```
시작 메뉴 → Microsoft Outlook
```

### 2단계: 백엔드 시작

```bash
# 백엔드 실행
.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000
```

### 3단계: 회원가입 테스트

1. 프론트엔드에서 회원가입
2. Outlook 이메일 작성창이 자동으로 열림
3. 내용 확인
4. **발송 버튼** 클릭

---

## 🎨 이메일 디자인

모든 이메일이 **사이버펑크 테마**로 디자인됩니다:

### 신규 회원가입 알림 (관리자용)
- 제목: `🚀 신규 사용자 등록 요청 - [사용자명]`
- 네온 사이안/핑크 색상
- 사용자 정보 표시
- Server Monitor 안내

### 승인 알림 (사용자용)
- 제목: `✅ 회원가입 승인 완료 - [사용자명]`
- 네온 그린 색상
- 로그인 정보 안내

### 거절 알림 (사용자용)
- 제목: `❌ 회원가입 거절 알림 - [사용자명]`
- 네온 레드 색상
- 거절 사유 표시 (있는 경우)

---

## 🐛 문제 해결

### "Outlook이 실행되지 않아 이메일 알림을 건너뜁니다"

**원인**: Outlook Desktop이 실행되지 않음

**해결**:
1. Microsoft Outlook 앱 실행
2. MS365 계정으로 로그인
3. 백엔드 재시도

**참고**: 이메일 없이도 회원가입/승인/거절은 정상 작동합니다!

### "Module 'win32com' not found"

**원인**: pywin32 패키지 미설치

**해결**:
```bash
pip install pywin32==306
```

### Outlook 작성창이 열리지만 내용이 비어있음

**원인**: Outlook 보안 설정 또는 버전 문제

**해결**:
1. Outlook을 관리자 권한으로 실행
2. 보안 설정에서 COM 액세스 허용
3. Outlook 재시작

### 이메일이 발송되지 않음

**원인**: 사용자가 발송 버튼을 누르지 않음

**해결**:
- 이메일 작성창에서 **발송 버튼** 클릭 필수
- 시스템이 자동으로 발송하지 않습니다 (사용자 확인 필요)

---

## 📊 장단점

### ✅ 장점

1. **사용자 확인 가능**
   - 이메일 내용을 사용자가 직접 확인
   - 필요시 수정 가능
   - 실수 방지

2. **보안 강화**
   - MS365 비밀번호 불필요
   - SMTP 설정 불필요
   - Outlook 계정 권한 활용

3. **신뢰성**
   - Outlook이 있으면 100% 작동
   - SMTP 인증 문제 없음
   - 방화벽 문제 없음

### ⚠️ 단점

1. **Outlook 실행 필요**
   - 백엔드 실행 전 Outlook 켜야 함
   - Outlook이 없으면 이메일 불가

2. **수동 발송**
   - 사용자가 발송 버튼 눌러야 함
   - 완전 자동화는 아님

3. **GUI 의존**
   - 서버 환경에서는 부적합
   - 개인 PC 환경에 최적화

---

## 🎯 권장 사용 환경

### ✅ 적합한 환경

- 개인 PC에서 개발/테스트
- Outlook이 항상 실행되는 환경
- 관리자가 직접 PC 사용
- 소규모 운영

### ❌ 부적합한 환경

- 서버 환경 (GUI 없음)
- 24/7 무인 운영
- 다수의 관리자
- 대규모 자동화 필요

---

## 📝 환경변수 예제

### 최소 설정 (.env)

```bash
# 이메일 알림 활성화
EMAIL_ENABLED=true

# 관리자 이메일 (필수)
EMAIL_ADMIN=syyun@ksm.co.kr
```

### 전체 설정 (기존 호환성)

```bash
# 이메일 알림 활성화
EMAIL_ENABLED=true

# 관리자 이메일 (필수)
EMAIL_ADMIN=syyun@ksm.co.kr

# 아래는 Outlook Desktop 방식에서 무시됨
EMAIL_SMTP_SERVER=smtp.office365.com
EMAIL_SMTP_PORT=587
EMAIL_USE_TLS=true
EMAIL_SENDER=syyun@ksm.co.kr
EMAIL_PASSWORD=your-password
```

---

## 🔄 이전 버전에서 업그레이드

### 1. 패키지 설치

```bash
pip install pywin32==306
```

### 2. Outlook 실행

Microsoft Outlook 앱 실행

### 3. .env 간소화 (선택사항)

SMTP 관련 설정 제거 가능:

```bash
# 필수만 남기기
EMAIL_ENABLED=true
EMAIL_ADMIN=syyun@ksm.co.kr
```

### 4. 테스트

회원가입 → Outlook 작성창 열림 → 발송

---

## 📞 지원

문의사항:
- Email: syyun@ksm.co.kr
- Tel: 010-9718-0580

---

**작성**: Development Team  
**최종 업데이트**: 2025-10-14 (Outlook Desktop 방식)
