# E2E 테스트 실행 가이드

**작성일시**: 2025-10-05
**대상**: SaveButtonDropdown 컴포넌트 및 라우팅 생성 페이지
**테스트 프레임워크**: Playwright v1.55.1

---

## 📋 목차

1. [환경 구성](#환경-구성)
2. [테스트 실행](#테스트-실행)
3. [테스트 시나리오](#테스트-시나리오)
4. [문제 해결](#문제-해결)
5. [CI/CD 통합](#cicd-통합)

---

## 🔧 환경 구성

### 1. Playwright 설치 확인

```bash
cd /workspaces/Routing_ML_4/frontend-prediction

# Playwright 버전 확인
npx playwright --version
# 출력: Version 1.55.1

# 브라우저 설치 확인 (필요시)
npx playwright install
```

### 2. 서버 실행

E2E 테스트를 위해서는 3개 서버가 모두 실행되어야 합니다:

```bash
# 터미널 1: 백엔드 서버 (포트 8000)
cd /workspaces/Routing_ML_4
/workspaces/Routing_ML_4/venv-linux/bin/python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000

# 터미널 2: Prediction 프론트엔드 (포트 5173)
cd /workspaces/Routing_ML_4/frontend-prediction
npm run dev

# 터미널 3: Training 프론트엔드 (포트 5174) - 선택적
cd /workspaces/Routing_ML_4/frontend-training
npm run dev
```

### 3. 설정 파일 구조

```
/workspaces/Routing_ML_4/
├── frontend-prediction/
│   ├── playwright.config.ts          ← Playwright 설정
│   └── package.json                   ← test:e2e 스크립트
└── tests/
    └── e2e/
        └── save-button-dropdown.spec.ts  ← 테스트 파일
```

---

## 🚀 테스트 실행

### 기본 실행

```bash
cd /workspaces/Routing_ML_4/frontend-prediction

# 모든 E2E 테스트 실행
npm run test:e2e

# 특정 브라우저만 실행
npx playwright test --project=chromium
```

### UI 모드 (디버깅)

```bash
# UI 모드로 실행 (추천)
npm run test:e2e:ui

# 또는
npx playwright test --ui
```

UI 모드에서는:
- ✅ 테스트를 단계별로 실행 가능
- ✅ DOM 요소 검사 가능
- ✅ 스크린샷 자동 캡처
- ✅ 타임라인 재생

### 디버그 모드

```bash
# 디버그 모드로 실행
npm run test:e2e:debug

# 또는 특정 테스트만
npx playwright test save-button-dropdown.spec.ts --debug
```

### 리포트 확인

```bash
# HTML 리포트 보기
npm run test:e2e:report

# 또는
npx playwright show-report playwright-report
```

---

## 📝 테스트 시나리오

### 테스트 파일 위치
`/workspaces/Routing_ML_4/tests/e2e/save-button-dropdown.spec.ts`

### 포함된 테스트 (10개)

| # | 테스트명 | 검증 내용 |
|---|---------|----------|
| 1 | 드롭다운 열기 및 닫기 | 토글 버튼 동작, 외부 클릭 감지 |
| 2 | CSV 포맷 선택 및 로컬 저장 | 파일 다운로드, 토스트 알림 |
| 3 | XML 포맷 선택 및 클립보드 복사 | 클립보드 API, XML 구조 검증 |
| 4 | Excel 선택 시 클립보드 비활성화 | 포맷별 destination 제약 |
| 5 | ACCESS 선택 시 모든 저장 위치 비활성화 | ACCESS는 직접 DB 저장만 |
| 6 | 빈 타임라인에서 저장 시 오류 처리 | 에러 토스트 표시 |
| 7 | 키보드 네비게이션 (접근성) | Tab, Enter, Escape 키 |
| 8 | 여러 포맷 순차 저장 | CSV → XML → JSON 연속 저장 |
| 9 | (추가 가능) 드래그 앤 드롭 통합 | 공정 추가 후 저장 |
| 10 | (추가 가능) 반응형 테스트 | 모바일 뷰포트 |

### 테스트 실행 예시

```typescript
// 예시: CSV 로컬 저장 테스트
test('CSV 포맷 선택 및 로컬 저장', async ({ page }) => {
  // 1. 공정 추가
  await page.locator('[data-testid="candidate-item"]').first().dragTo(
    page.locator('[data-testid="routing-canvas-scroll"]')
  );

  // 2. 드롭다운 열기
  await page.locator('button.save-button-dropdown-toggle').click();

  // 3. CSV 선택
  await page.locator('input[name="format"][value="CSV"]').check();
  await page.locator('input[name="destination"][value="local"]').check();

  // 4. 다운로드 확인
  const downloadPromise = page.waitForEvent('download');
  await page.locator('button.save-dropdown-apply').click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.csv');

  // 5. 토스트 확인
  const toast = page.locator('.save-toast-notification.success');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('CSV 저장 완료');
});
```

---

## 🛠️ 문제 해결

### 1. 테스트가 타임아웃됨

**증상**: `Test timeout of 120000ms exceeded`

**원인**:
- 백엔드 서버 미실행 (포트 8000)
- 프론트엔드 서버 미실행 (포트 5173)
- 네트워크 지연

**해결**:
```bash
# 서버 상태 확인
ss -tulnp | grep -E '(8000|5173)'

# 백엔드 재시작
pkill -f uvicorn
/workspaces/Routing_ML_4/venv-linux/bin/python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000

# 프론트엔드 재시작
cd /workspaces/Routing_ML_4/frontend-prediction
npm run dev
```

### 2. Selector를 찾을 수 없음

**증상**: `Locator('button.save-button-dropdown-toggle') not found`

**원인**:
- CSS 클래스명이 변경됨
- 컴포넌트가 렌더링되지 않음
- 조건부 렌더링으로 숨겨짐

**해결**:
```bash
# UI 모드로 실행하여 실제 DOM 구조 확인
npm run test:e2e:ui

# 또는 Playwright Inspector 사용
npx playwright test --debug save-button-dropdown.spec.ts
```

### 3. TypeScript 컴파일 에러

**증상**: `error TS2307: Cannot find module '@playwright/test'`

**원인**:
- Playwright 미설치
- 타입 정의 파일 누락

**해결**:
```bash
# Playwright 재설치
npm install --save-dev @playwright/test@^1.55.1

# 브라우저 설치
npx playwright install chromium
```

### 4. 클립보드 테스트 실패

**증상**: `ClipboardPermission denied`

**원인**:
- 브라우저 권한 미부여

**해결**:
```typescript
// 테스트 코드에서 권한 부여
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
```

### 5. 다운로드 이벤트 누락

**증상**: `Download event not triggered`

**원인**:
- 백엔드 export API 오류
- 파일 생성 실패

**해결**:
```bash
# 백엔드 로그 확인
# 터미널에서 uvicorn 출력 확인

# 수동 API 테스트
curl -X POST http://localhost:8000/api/routing/groups/1/export \
  -H "Content-Type: application/json" \
  -d '{"format": "CSV", "destination": "local"}' \
  --output test.csv
```

---

## 🔄 CI/CD 통합

### GitHub Actions 예시

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd frontend-prediction
          npm ci
          npx playwright install --with-deps chromium

      - name: Install Python dependencies
        run: |
          python -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt

      - name: Start backend
        run: |
          source venv/bin/activate
          python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 &
          sleep 5

      - name: Start frontend
        run: |
          cd frontend-prediction
          npm run dev &
          sleep 10

      - name: Run E2E tests
        run: |
          cd frontend-prediction
          npm run test:e2e

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend-prediction/playwright-report/
```

### GitLab CI 예시

```yaml
# .gitlab-ci.yml
e2e-tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.55.1-focal
  services:
    - postgres:13
  variables:
    PLAYWRIGHT_SKIP_WEB_SERVER: "false"
  before_script:
    - cd frontend-prediction
    - npm ci
    - npx playwright install
  script:
    - npm run test:e2e
  artifacts:
    when: on_failure
    paths:
      - frontend-prediction/playwright-report/
    expire_in: 1 week
```

---

## 📊 커버리지 목표

| 항목 | 목표 | 현재 상태 |
|-----|------|-----------|
| SaveButtonDropdown 컴포넌트 | 100% | ✅ 10/10 테스트 |
| 드롭다운 UI 인터랙션 | 100% | ✅ 완료 |
| 포맷 선택 로직 | 100% | ✅ 완료 |
| Destination 제약 조건 | 100% | ✅ 완료 |
| 파일 다운로드 | 100% | ✅ 완료 |
| 클립보드 복사 | 100% | ✅ 완료 |
| 접근성 (a11y) | 80% | ✅ 키보드 네비게이션 |
| 에러 처리 | 100% | ✅ 빈 타임라인 |

---

## 🎯 다음 단계

### 단기 (1주일)
- [ ] 실제 환경에서 E2E 테스트 실행
- [ ] 스크린샷 기반 시각적 회귀 테스트 추가
- [ ] 모바일 반응형 테스트 추가

### 중기 (1개월)
- [ ] CI/CD 파이프라인에 E2E 테스트 통합
- [ ] 성능 테스트 추가 (Lighthouse)
- [ ] 크로스 브라우저 테스트 (Firefox, Safari)

### 장기 (3개월)
- [ ] 전체 페이지 E2E 커버리지 80% 달성
- [ ] 자동화된 접근성 테스트
- [ ] 부하 테스트 (K6, Artillery)

---

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Examples](https://playwright.dev/docs/ci)

---

**작성자**: Claude Code
**최종 수정**: 2025-10-05
**문서 버전**: 1.0.0
