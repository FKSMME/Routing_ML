# HTTPS 인증서 설치 가이드
## "주의 요함 사이트" 경고 해결 방법

---

## 📌 문제 원인

라우팅 ML 시스템(`https://rtml.ksm.co.kr`)은 **KSM 내부 인증 기관(CA)**에서 발급한 HTTPS 인증서를 사용합니다. 브라우저가 이 인증 기관을 신뢰하지 않으면 "연결이 비공개로 설정되지 않음" 또는 "주의 요함" 경고가 표시됩니다.

---

## 🎯 해결 방법 요약

| 방법 | 대상 | 난이도 | 효과 |
|------|------|--------|------|
| **방법 1** | 사내 직원 (Windows) | 쉬움 | 모든 KSM 사이트에서 경고 없음 |
| **방법 2** | IT 관리자 | 중간 | 회사 전체 자동 배포 |
| **방법 3** | 개발자/임시 사용 | 매우 쉬움 | 해당 사이트만 경고 무시 |

---

## ✅ 방법 1: Root CA 인증서 수동 설치 (권장)

### 대상
- **KSM 내부 네트워크 사용자**
- **Windows PC 사용자**

### 사전 준비
1. `KSM Root CA` 인증서 파일 준비
   - 파일명: `ksm-root.pem` 또는 `ksm-root.crt`
   - 위치: IT 부서에서 배포 또는 공유 폴더

### 설치 단계 (Windows)

#### 1단계: 인증서 파일 열기
1. `ksm-root.pem` 파일을 **더블클릭**
2. "인증서 정보" 창이 열림

#### 2단계: 인증서 설치
1. **[인증서 설치...]** 버튼 클릭
2. "인증서 가져오기 마법사" 시작

#### 3단계: 저장소 위치 선택
1. **현재 사용자** 또는 **로컬 컴퓨터** 선택
   - **현재 사용자**: 본인 계정만 적용 (권한 불필요)
   - **로컬 컴퓨터**: PC 전체 사용자에 적용 (관리자 권한 필요)
2. **[다음]** 클릭

#### 4단계: 인증서 저장소 지정 (중요!)
1. **"모든 인증서를 다음 저장소에 저장"** 선택
2. **[찾아보기...]** 클릭
3. **"신뢰할 수 있는 루트 인증 기관"** 선택
4. **[확인]** → **[다음]** 클릭

#### 5단계: 설치 완료
1. 설정 확인 후 **[마침]** 클릭
2. 보안 경고 창에서 **[예]** 클릭

#### 6단계: 브라우저 재시작
1. **모든 브라우저 창 닫기** (Chrome, Edge 등)
2. 브라우저 다시 실행
3. `https://rtml.ksm.co.kr` 접속 → **경고 없음 확인**

---

## 🔧 방법 2: 그룹 정책(GPO)으로 자동 배포 (IT 관리자용)

### 대상
- **회사 IT 관리자**
- **Active Directory 환경**

### 배포 절차

#### 1단계: GPO 생성
```powershell
# 그룹 정책 관리 콘솔(GPMC) 실행
gpmc.msc
```

#### 2단계: 인증서 배포 정책 설정
1. **새 GPO 생성**: "KSM Root CA Deployment"
2. **컴퓨터 구성** → **정책** → **Windows 설정** → **보안 설정** → **공개 키 정책**
3. **신뢰할 수 있는 루트 인증 기관** 우클릭 → **가져오기**
4. `ksm-root.pem` 파일 선택 → 가져오기

#### 3단계: GPO 적용
1. 대상 조직 구성 단위(OU)에 GPO 연결
2. 사용자 PC에서 정책 업데이트:
   ```cmd
   gpupdate /force
   ```

#### 4단계: 배포 확인
사용자 PC에서 확인:
```cmd
certutil -store Root | findstr "KSM"
```

---

## 🚀 방법 3: 브라우저에서 경고 무시 (임시)

### 대상
- **개발자/테스트 환경**
- **임시 접속 필요 시**

### Chrome/Edge
1. 경고 페이지에서 **"고급"** 클릭
2. **"안전하지 않음으로 이동"** 클릭
3. 사이트 접속 (세션 동안만 유효)

### Firefox
1. **"위험 요소 및 계속하기"** 클릭
2. **"위험을 감수하고 계속"** 클릭

---

## 📁 인증서 파일 확인

### 현재 프로젝트 내 인증서 위치
```
C:\Users\syyun\Documents\GitHub\Routing_ML_251014\certs\
├── rtml.ksm.co.kr.crt      # 서버 인증서
├── rtml.ksm.co.kr.key      # 서버 개인키
├── ksm-root.pem            # KSM Root CA (설치 필요!)
├── ksm-intermediate.pem    # 중간 CA
├── ca-bundle.pem           # 전체 체인
└── corp-chain.pem          # 회사 체인
```

### 배포용 인증서 추출
사용자에게 배포할 파일: **`ksm-root.pem`**

#### 파일 확인
```cmd
openssl x509 -in certs\ksm-root.pem -noout -subject -issuer
```

출력 예시:
```
subject=CN=KSM RootCA, DC=ksm, DC=co, DC=kr
issuer=CN=KSM RootCA, DC=ksm, DC=co, DC=kr
```

---

## 🛠️ 서버 측 인증서 체인 설정 확인

### Backend (uvicorn)
**파일**: `run_backend_main.bat`
```batch
.venv\Scripts\python.exe -m uvicorn backend.api.app:app ^
  --host 0.0.0.0 --port 8000 ^
  --ssl-keyfile=certs/rtml.ksm.co.kr.key ^
  --ssl-certfile=certs/rtml.ksm.co.kr.crt ^
  --reload
```

### 체인 인증서 포함 (선택 사항)
브라우저가 중간 CA를 찾지 못하는 경우:

```bash
# 체인 포함 인증서 생성
cat certs/rtml.ksm.co.kr.crt certs/ksm-intermediate.pem > certs/rtml-fullchain.crt

# 서버 시작 시 전체 체인 사용
--ssl-certfile=certs/rtml-fullchain.crt
```

---

## ✅ 설치 확인 방법

### Windows 인증서 저장소 확인
```cmd
# 관리자 권한 CMD
certutil -store Root | findstr "KSM"
```

### 브라우저 확인
1. `https://rtml.ksm.co.kr` 접속
2. 주소창 좌측 **자물쇠 아이콘** 클릭
3. **"인증서"** 또는 **"연결이 안전함"** 표시 확인

### 인증서 정보 확인
- **발급 대상**: `rtml.ksm.co.kr`
- **발급자**: `KSM RootCA` (또는 중간 CA)
- **신뢰 체인**: 녹색 체크 표시

---

## ❓ 자주 묻는 질문 (FAQ)

### Q1: 인증서를 설치했는데도 경고가 나옵니다
**A**: 다음을 확인하세요:
1. 브라우저를 완전히 종료 후 재시작했나요?
2. "신뢰할 수 있는 루트 인증 기관"에 설치했나요? (다른 저장소 X)
3. 올바른 Root CA 파일(`ksm-root.pem`)을 설치했나요?

### Q2: 다른 KSM 사이트도 경고가 사라지나요?
**A**: 네! Root CA를 설치하면 **동일한 CA가 발급한 모든 사이트**에서 경고가 사라집니다.
- `https://mcs.ksm.co.kr`
- `https://swg.ksm.co.kr`
- 기타 KSM 내부 도메인

### Q3: 회사 밖에서도 접속할 수 있나요?
**A**:
- **VPN 연결 시**: 가능 (내부 DNS 필요)
- **외부 인터넷**: `rtml.ksm.co.kr`가 외부 DNS에 등록되어 있어야 함

### Q4: 인증서 만료되면 어떻게 되나요?
**A**:
- KSM Root CA는 **2111년까지 유효** (100년)
- 서버 인증서(`rtml.ksm.co.kr.crt`)는 정기 갱신 필요
- 갱신 시 사용자는 재설치 불필요

### Q5: 모바일에서도 설치할 수 있나요?
**A**: 네!
- **Android**: 설정 → 보안 → 인증서 설치
- **iOS**: 프로필 설치 → 설정 → 일반 → 정보 → 인증서 신뢰 설정

---

## 📞 지원

문제 발생 시:
- **IT 부서**: 내선 XXX
- **라우팅 ML 팀**: routing-ml@ksm.co.kr
- **프로젝트 이슈 트래커**: GitHub Issues

---

## 📚 참고 자료

- [Microsoft: 신뢰할 수 있는 루트 인증서 설치](https://learn.microsoft.com/ko-kr/troubleshoot/windows-server/windows-security/add-root-certificates-to-trusted-root-certification-authorities-store)
- [Chrome HTTPS 경고 해결](https://support.google.com/chrome/answer/6098869)
- [OpenSSL 인증서 관리](https://www.openssl.org/docs/man1.1.1/man1/x509.html)
