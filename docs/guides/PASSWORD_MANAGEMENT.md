# 비밀번호 및 시크릿 관리 가이드

**문서 ID**: PM-2025-10-06
**버전**: 1.0.0
**작성일**: 2025-10-06

---

## 개요

Routing ML v4 프로젝트의 비밀번호 및 민감 정보 관리 방법입니다.

---

## 권장 방법 (보안 수준별)

### ⭐⭐⭐ Level 3: 최고 보안 (프로덕션 권장)

#### 1. 환경 변수 + 시크릿 관리 도구

**AWS Secrets Manager 사용**

```bash
# AWS CLI로 시크릿 저장
aws secretsmanager create-secret \
  --name routing-ml/mssql-password \
  --secret-string "your_actual_password"

# 코드에서 사용
import boto3

def get_mssql_password():
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId='routing-ml/mssql-password')
    return response['SecretString']
```

**Azure Key Vault 사용**

```bash
# Azure CLI로 시크릿 저장
az keyvault secret set \
  --vault-name routing-ml-vault \
  --name mssql-password \
  --value "your_actual_password"

# 코드에서 사용
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://routing-ml-vault.vault.azure.net", credential=credential)
password = client.get_secret("mssql-password").value
```

**HashiCorp Vault 사용**

```bash
# Vault에 시크릿 저장
vault kv put secret/routing-ml/mssql password="your_actual_password"

# 환경 변수로 가져오기
export MSSQL_PASSWORD=$(vault kv get -field=password secret/routing-ml/mssql)
```

---

### ⭐⭐ Level 2: 중간 보안 (개발/스테이징)

#### 2. .env 파일 + Git 제외

**.env 파일 생성** (프로젝트 루트)

```bash
cd /workspaces/Routing_ML_4

# .env 파일 생성
cat > .env << 'EOF'
# MSSQL Database Configuration
MSSQL_SERVER=K3-DB.ksm.co.kr,1433
MSSQL_DATABASE=KsmErp
MSSQL_USER=FKSM_BI
MSSQL_PASSWORD=your_actual_password_here

# JWT Secret (자동 생성)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# 기타 설정
LOG_LEVEL=INFO
ENABLE_ANOMALY_DETECTION=true
EOF

# 권한 설정 (소유자만 읽기/쓰기)
chmod 600 .env
```

**.gitignore 확인**

```bash
# .gitignore에 추가되어 있는지 확인
grep "\.env" .gitignore

# 없으면 추가
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore
```

**사용 방법**

```bash
# 환경 변수 로드
source .env

# 또는 Python에서 직접 로드
# backend/database.py에서 자동 로드됨
import os
from dotenv import load_dotenv

load_dotenv()
password = os.getenv("MSSQL_PASSWORD")
```

---

### ⭐ Level 1: 기본 보안 (로컬 개발)

#### 3. 로컬 파일 저장

**개인 디렉토리에 저장**

```bash
# 홈 디렉토리에 시크릿 파일 생성
mkdir -p ~/.routing-ml
cat > ~/.routing-ml/secrets << 'EOF'
MSSQL_PASSWORD=your_actual_password_here
JWT_SECRET_KEY=your_jwt_secret_here
EOF

# 권한 설정 (소유자만 읽기)
chmod 400 ~/.routing-ml/secrets

# 사용 시 로드
source ~/.routing-ml/secrets
echo $MSSQL_PASSWORD
```

**암호화된 파일 저장 (GPG)**

```bash
# GPG로 암호화
echo "your_actual_password" | gpg --symmetric --armor > ~/.routing-ml/mssql-password.gpg

# 복호화하여 사용
export MSSQL_PASSWORD=$(gpg --decrypt ~/.routing-ml/mssql-password.gpg)
```

---

## 프로젝트별 권장 방법

### 현재 프로젝트 (Routing ML v4)

#### 권장: .env 파일 방식 (Level 2)

**1단계: .env 파일 생성**

```bash
cd /workspaces/Routing_ML_4
cp .env.example .env
nano .env
```

**2단계: 비밀번호 입력**

```ini
# .env 파일 내용
MSSQL_PASSWORD=실제비밀번호입력

# 예시 (실제로는 회사에서 받은 비밀번호 입력)
MSSQL_PASSWORD=P@ssw0rd123!
```

**3단계: Git 확인**

```bash
# .env가 Git에 추가되지 않았는지 확인
git status

# .env가 표시되면 안됨 (표시되면 .gitignore 추가)
git check-ignore .env
# Output: .env (정상)
```

**4단계: 사용**

```bash
# Backend 시작 시 자동 로드
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000

# 또는 Docker
docker-compose up -d
```

---

## 저장 위치별 비교

| 방법 | 보안 | 편의성 | 비용 | 권장 환경 |
|------|------|--------|------|-----------|
| AWS Secrets Manager | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 💰💰 | 프로덕션 |
| Azure Key Vault | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 💰💰 | 프로덕션 |
| HashiCorp Vault | ⭐⭐⭐⭐⭐ | ⭐⭐ | 💰💰💰 | 엔터프라이즈 |
| .env 파일 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 무료 | 개발/스테이징 |
| 홈 디렉토리 파일 | ⭐⭐ | ⭐⭐⭐⭐ | 무료 | 로컬 개발 |
| GPG 암호화 | ⭐⭐⭐⭐ | ⭐⭐ | 무료 | 로컬 개발 |

---

## 실전 예시

### 시나리오 1: 로컬 개발 (현재 상황)

```bash
# 1. .env 파일 생성
cd /workspaces/Routing_ML_4
cp .env.example .env

# 2. nano 또는 vi로 편집
nano .env
# MSSQL_PASSWORD=실제비밀번호 입력

# 3. 저장 후 권한 설정
chmod 600 .env

# 4. 백엔드 시작
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000

# 5. 테스트
curl -X POST "http://localhost:8000/api/anomaly/train?contamination=0.1"
```

### 시나리오 2: Docker 배포

```bash
# 1. .env 파일 준비 (위와 동일)

# 2. docker-compose.yml은 자동으로 .env 로드
docker-compose up -d

# 3. 컨테이너 내부에서 확인
docker exec routing-ml-backend env | grep MSSQL_PASSWORD
# (출력 안됨 - 보안상 비표시)
```

### 시나리오 3: 프로덕션 서버

```bash
# 1. 서버 접속
ssh user@production-server

# 2. 시크릿 파일 생성 (root만 접근)
sudo mkdir -p /etc/routing-ml
sudo nano /etc/routing-ml/secrets

# 3. 내용 입력
MSSQL_PASSWORD=프로덕션비밀번호

# 4. 권한 설정 (root만 읽기)
sudo chmod 400 /etc/routing-ml/secrets
sudo chown root:root /etc/routing-ml/secrets

# 5. systemd 서비스에서 로드
sudo nano /etc/systemd/system/routing-ml-backend.service
```

```ini
[Service]
EnvironmentFile=/etc/routing-ml/secrets
ExecStart=/opt/routing-ml/venv/bin/uvicorn ...
```

---

## 절대 하지 말아야 할 것 ❌

### 1. Git에 비밀번호 커밋

```bash
# ❌ 절대 금지
git add .env
git commit -m "Add environment variables"

# ✅ 대신 이렇게
git add .env.example  # 예시 파일만 커밋
```

### 2. 코드에 하드코딩

```python
# ❌ 절대 금지
MSSQL_PASSWORD = "P@ssw0rd123!"

# ✅ 대신 이렇게
MSSQL_PASSWORD = os.getenv("MSSQL_PASSWORD")
```

### 3. 공개 채널에 공유

- ❌ Slack, Email, Wiki에 평문 비밀번호
- ❌ 스크린샷에 비밀번호 노출
- ❌ 로그에 비밀번호 출력

### 4. 약한 권한 설정

```bash
# ❌ 절대 금지
chmod 777 .env  # 모든 사용자가 읽기 가능

# ✅ 대신 이렇게
chmod 600 .env  # 소유자만 읽기/쓰기
```

---

## 비밀번호 변경 시

### 1. .env 파일 업데이트

```bash
# 1. 백업
cp .env .env.backup

# 2. 새 비밀번호 입력
nano .env
# MSSQL_PASSWORD=new_password

# 3. 서비스 재시작
docker-compose restart backend
# 또는
sudo systemctl restart routing-ml-backend
```

### 2. 시크릿 관리 도구 업데이트

```bash
# AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id routing-ml/mssql-password \
  --secret-string "new_password"

# HashiCorp Vault
vault kv put secret/routing-ml/mssql password="new_password"
```

---

## 보안 체크리스트

### 배포 전

- [ ] .env 파일이 .gitignore에 포함되어 있음
- [ ] .env 파일 권한이 600 또는 400
- [ ] 비밀번호가 코드에 하드코딩되지 않음
- [ ] .env.example에는 실제 비밀번호가 없음

### 배포 후

- [ ] 프로덕션 서버에 .env 파일 또는 시크릿 설정 완료
- [ ] 서비스가 환경 변수를 정상적으로 읽음
- [ ] 로그에 비밀번호가 출력되지 않음
- [ ] 백업 파일(.env.backup)도 보안 유지

### 정기 점검

- [ ] 비밀번호 정기 변경 (3-6개월)
- [ ] 사용하지 않는 계정 삭제
- [ ] 접근 로그 확인
- [ ] 시크릿 파일 권한 재확인

---

## 빠른 시작 (TL;DR)

```bash
# 1. .env 파일 생성
cd /workspaces/Routing_ML_4
cp .env.example .env

# 2. 비밀번호 입력
nano .env
# MSSQL_PASSWORD=실제비밀번호

# 3. 권한 설정
chmod 600 .env

# 4. 서비스 시작
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000

# 완료! 🎉
```

---

## 문의

비밀번호 관리 관련 문의:
- 보안팀: security@company.com
- 인프라팀: infra@company.com

---

**문서 종료**
