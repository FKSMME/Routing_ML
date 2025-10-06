# Docker 보안 스캔 가이드

## 개요

Trivy를 사용한 자동화된 Docker 이미지 보안 스캔 시스템입니다. 주간 자동 스캔 및 CI/CD 통합으로 취약점을 조기에 발견합니다.

## 기능

- ✅ **Trivy 스캔**: 업계 표준 보안 스캐너
- ✅ **주간 자동 스캔**: 매주 월요일 09:00 UTC
- ✅ **CI/CD 통합**: PR/Push 시 자동 검증
- ✅ **Critical 0개 기준**: Critical 취약점 0개 필수
- ✅ **GitHub Security 탭**: 취약점 자동 업로드
- ✅ **HTML/JSON 리포트**: 상세 스캔 결과
- ✅ **Slack 알림**: 취약점 발견 시 즉시 통보

## 파일 구조

```
.
├── scripts/
│   └── security_scan.sh              # 로컬 보안 스캔 스크립트
├── .github/workflows/
│   └── security-scan.yml             # GitHub Actions 워크플로우
└── security-reports/                 # 스캔 리포트 저장 (생성됨)
    ├── trivy_scan_YYYYMMDD_HHMMSS.json
    └── trivy_scan_YYYYMMDD_HHMMSS.html
```

## 사용 방법

### 1. 로컬 스캔 (수동)

#### 단순 실행

```bash
# 스크립트 실행
bash scripts/security_scan.sh

# 출력 예시:
# ==========================================
# Docker Security Scan (Trivy)
# ==========================================
# Step 1: Updating Trivy database...
# Step 2: Scanning Docker images...
#   - Scanning: Dockerfile
# ==========================================
# Scan Summary
# ==========================================
# Total Vulnerabilities:
#   🔴 CRITICAL: 0
#   🟠 HIGH: 3
#   🟡 MEDIUM: 15
#   🟢 LOW: 42
# ✅ No CRITICAL vulnerabilities found
```

#### Slack 알림 포함

```bash
# Slack Webhook URL 설정
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 스캔 실행 (알림 포함)
bash scripts/security_scan.sh
```

#### Cron Job 설정

```bash
# crontab -e
# 매주 월요일 09:00 실행
0 9 * * 1 /workspaces/Routing_ML_4/scripts/security_scan.sh >> /workspaces/Routing_ML_4/logs/security-scan.log 2>&1
```

### 2. GitHub Actions (자동)

GitHub Actions는 다음 이벤트에서 자동 실행됩니다:

#### 스케줄

- **매주 월요일 09:00 UTC** 자동 스캔

#### Push/PR 이벤트

- `Dockerfile` 수정 시
- `docker/**` 디렉토리 수정 시
- `.github/workflows/security-scan.yml` 수정 시

#### 수동 실행

GitHub 웹사이트에서:
```
Actions → Docker Security Scan → Run workflow
```

### 3. 스캔 결과 확인

#### GitHub Security 탭

```
Repository → Security → Vulnerability alerts → Code scanning
```

모든 발견된 취약점이 자동으로 업로드됩니다.

#### 로컬 리포트

```bash
# 최신 JSON 리포트 확인
cat security-reports/trivy_scan_*.json | tail -1 | jq

# 최신 HTML 리포트 열기
open security-reports/trivy_scan_*.html
```

#### GitHub Actions Summary

PR 또는 Actions 탭에서 요약 확인:
```
Actions → 워크플로우 실행 → Summary
```

## Trivy 설치

### Ubuntu/Debian

```bash
# Official repository
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list

sudo apt-get update
sudo apt-get install trivy
```

### macOS

```bash
brew install trivy
```

### Docker

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image routing-ml:latest
```

## 취약점 심각도

### CRITICAL 🔴
- **즉시 수정 필수**
- CI/CD 빌드 실패
- 배포 차단

**예시**:
- CVE-2021-44228 (Log4Shell)
- Remote Code Execution (RCE)
- Privilege Escalation

### HIGH 🟠
- **1주일 이내 수정**
- 경고 발생
- 배포 가능 (승인 필요)

**예시**:
- SQL Injection
- Cross-Site Scripting (XSS)
- Authentication Bypass

### MEDIUM 🟡
- **1개월 이내 수정**
- 모니터링 필요

**예시**:
- Information Disclosure
- Denial of Service (DoS)

### LOW 🟢
- **분기별 검토**
- 참고용

## 취약점 수정 방법

### 1. 베이스 이미지 업데이트

```dockerfile
# Before
FROM python:3.11

# After (최신 보안 패치 적용)
FROM python:3.11-slim
# 또는 특정 버전
FROM python:3.11.8-slim
```

### 2. 패키지 버전 업그레이드

```bash
# requirements.txt 업데이트
pip install --upgrade <vulnerable-package>
pip freeze > requirements.txt
```

### 3. 불필요한 패키지 제거

```dockerfile
# Multi-stage build로 최종 이미지 경량화
FROM python:3.11 AS builder
RUN pip install -r requirements.txt

FROM python:3.11-slim
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
```

### 4. 보안 패치 적용

```dockerfile
# Dockerfile에 보안 업데이트 추가
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        security-updates && \
    rm -rf /var/lib/apt/lists/*
```

## 워크플로우 설정

### security-scan.yml 주요 설정

```yaml
# 스케줄 변경 (매일 실행)
on:
  schedule:
    - cron: '0 9 * * *'  # 매일 09:00 UTC

# Critical만 체크 (HIGH 무시)
- name: Scan Docker image with Trivy
  with:
    severity: 'CRITICAL'
    exit-code: '1'

# 특정 Dockerfile 스캔
- name: Scan backend Dockerfile
  with:
    scan-ref: 'docker/Dockerfile.backend'
```

### 알림 설정

#### Slack

```yaml
# .github/workflows/security-scan.yml 마지막에 추가
- name: Send Slack notification
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚨 Security vulnerabilities detected in ${{ github.repository }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

GitHub Secrets에 `SLACK_WEBHOOK_URL` 추가:
```
Settings → Secrets → Actions → New repository secret
Name: SLACK_WEBHOOK_URL
Value: https://hooks.slack.com/services/...
```

#### Email

```yaml
- name: Send email notification
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.MAIL_USERNAME }}
    password: ${{ secrets.MAIL_PASSWORD }}
    subject: Security Vulnerabilities Detected
    to: security-team@company.com
    from: GitHub Actions
    body: Critical vulnerabilities found in ${{ github.repository }}
```

## 리포트 분석

### JSON 리포트 구조

```json
{
  "Results": [
    {
      "Target": "python:3.11 (debian 12)",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-2024-1234",
          "PkgName": "openssl",
          "InstalledVersion": "3.0.0",
          "FixedVersion": "3.0.1",
          "Severity": "CRITICAL",
          "Description": "...",
          "References": ["https://cve.mitre.org/..."]
        }
      ]
    }
  ]
}
```

### jq로 리포트 필터링

```bash
# CRITICAL만 추출
jq '.Results[].Vulnerabilities[] | select(.Severity=="CRITICAL")' trivy_scan.json

# 패키지별 취약점 수
jq '.Results[].Vulnerabilities[] | .PkgName' trivy_scan.json | sort | uniq -c

# 수정 가능한 취약점만
jq '.Results[].Vulnerabilities[] | select(.FixedVersion != "")' trivy_scan.json

# CSV 변환
jq -r '.Results[].Vulnerabilities[] | [.VulnerabilityID, .Severity, .PkgName, .InstalledVersion, .FixedVersion] | @csv' trivy_scan.json > vulnerabilities.csv
```

## 트러블슈팅

### 문제 1: Trivy database 업데이트 실패

```bash
# 수동 업데이트
trivy image --download-db-only --reset

# 캐시 삭제
rm -rf ~/.cache/trivy
```

### 문제 2: Docker 이미지 빌드 실패

```bash
# Dockerfile 문법 체크
docker build --dry-run -f Dockerfile .

# 빌드 로그 확인
docker build --no-cache -t test:latest . 2>&1 | tee build.log
```

### 문제 3: False Positive (오탐)

Trivy ignore 파일 생성:

```bash
# .trivyignore
CVE-2024-1234  # False positive: 패키지 미사용
CVE-2024-5678  # Won't fix: vendor에서 패치 안 함
```

### 문제 4: GitHub Actions 권한 에러

```yaml
# security-scan.yml에 권한 추가
permissions:
  contents: read
  security-events: write
  actions: read
```

## 모범 사례

### 1. 최소 권한 원칙

```dockerfile
# Non-root 사용자로 실행
RUN adduser --disabled-password --gecos '' appuser
USER appuser
```

### 2. Multi-stage Build

```dockerfile
# Builder stage
FROM python:3.11 AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Runtime stage (작고 안전한 이미지)
FROM python:3.11-slim
COPY --from=builder /root/.local /root/.local
COPY app.py .
USER nobody
CMD ["python", "app.py"]
```

### 3. 정기적인 베이스 이미지 업데이트

```bash
# Dependabot 설정 (.github/dependabot.yml)
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Secrets 스캔

```bash
# .git에서 secrets 검색
trivy fs --scanners secret .
```

## 메트릭 & 대시보드

### Prometheus 메트릭 (향후 구현)

```python
# backend/api/routes/health.py에 추가
from prometheus_client import Gauge

security_vulnerabilities = Gauge(
    'routing_ml_security_vulnerabilities',
    'Number of security vulnerabilities',
    ['severity']
)

security_vulnerabilities.labels(severity='critical').set(0)
security_vulnerabilities.labels(severity='high').set(3)
```

### Grafana 대시보드

```promql
# Critical 취약점 추이
routing_ml_security_vulnerabilities{severity="critical"}

# 전체 취약점 수
sum(routing_ml_security_vulnerabilities)
```

## 참고 자료

- [Trivy 공식 문서](https://aquasecurity.github.io/trivy/)
- [GitHub Code Scanning](https://docs.github.com/en/code-security/code-scanning)
- [CVE Database](https://cve.mitre.org/)
- [NIST NVD](https://nvd.nist.gov/)

## Changelog

- **2025-10-06**: 초기 구축 (Trivy + GitHub Actions)
- **Future**: Secrets 스캔, License 스캔, SBOM 생성
