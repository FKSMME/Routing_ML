# Claude Code 프로젝트 설정

이 디렉토리는 Claude Code 관련 설정 및 가이드라인을 포함합니다.

## 📁 파일 구조

```
.claude/
├── settings.local.json              # 권한 설정
├── PLAYWRIGHT_VERIFICATION_RULES.md # Playwright 검증 규칙
└── README.md                         # 이 파일
```

## 🎯 핵심 규칙

### Playwright 자동 검증 규칙

> **"모든 UI 변경사항은 Playwright로 직접 디버깅하고 보고한다"**

자세한 내용은 [PLAYWRIGHT_VERIFICATION_RULES.md](./PLAYWRIGHT_VERIFICATION_RULES.md)를 참조하세요.

## 🚀 빠른 시작

### 1. 검증 템플릿 사용

```bash
# 템플릿 복사
cp /workspaces/Routing_ML_4/scripts/playwright-verify-template.js /tmp/verify-my-feature.js

# 수정 후 실행
NODE_PATH=/workspaces/Routing_ML_4/node_modules node /tmp/verify-my-feature.js
```

### 2. 빠른 검증 스크립트

```bash
node /workspaces/Routing_ML_4/scripts/playwright-verify-template.js
```

## 📚 관련 문서

- [Playwright 검증 규칙](./PLAYWRIGHT_VERIFICATION_RULES.md)
- [검증 템플릿 스크립트](../scripts/playwright-verify-template.js)
- [프로젝트 작업 로그](../WORK_LOG_2025-10-07.md)

## 🔧 설정 관리

### settings.local.json

권한 관리를 위한 파일입니다. Claude Code가 특정 명령을 실행할 때 권한을 제어합니다.

```json
{
  "permissions": {
    "allow": [
      "Bash(NODE_PATH=/workspaces/Routing_ML_4/node_modules timeout 90s node /tmp/*.js)"
    ],
    "deny": [],
    "ask": []
  }
}
```

---

**마지막 업데이트:** 2025-10-07
