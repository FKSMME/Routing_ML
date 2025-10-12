# Frontend 수정 시 자동 검증 규정 (Playwright Protocol)

## 📋 목적

모든 Frontend 코드 수정 시 **시각적 회귀(Visual Regression)** 방지 및 **기능 정상 작동** 보장을 위한 자동화 테스트 규정

---

## 🎯 적용 범위

### 필수 검증 대상
- ✅ `frontend-prediction/` 하위 모든 파일 수정
- ✅ `frontend-training/` 하위 모든 파일 수정
- ✅ CSS/스타일 변경
- ✅ 컴포넌트 추가/수정/삭제
- ✅ 라이브러리 설치/업데이트
- ✅ 레이아웃 구조 변경

### 선택 검증 대상
- 🔶 백엔드 API 연동 변경 (영향도 확인 필요 시)
- 🔶 환경 설정 파일 변경 (vite.config.ts, tailwind.config.js 등)

---

## 🚀 실행 방법

### 1. 기본 검증 (Headless)

```bash
./scripts/verify-frontends.sh
```

**실행 내용:**
- 두 Frontend 서버 상태 확인 (5173, 5174)
- Playwright 시각적 회귀 테스트 실행
- 스크린샷 자동 캡처 및 저장
- 콘솔 에러 감지

**예상 시간:** 약 30-60초

---

### 2. 브라우저 보기 모드 (Headed)

```bash
./scripts/verify-frontends.sh --headed
```

**용도:**
- 실제 브라우저에서 테스트 진행 과정 확인
- 애니메이션 동작 육안 검증
- 디버깅

---

### 3. 빠른 검증 (Quick Check)

```bash
./scripts/verify-frontends.sh --quick
```

**실행 내용:**
- 주요 테스트만 실행 (페이지 로드, 헤더 표시)
- 전체 테스트의 약 30% 시간 소요

**예상 시간:** 약 10-15초

---

## 📸 스크린샷 캡처 규칙

### 자동 캡처 영역

| 영역 | Selector | 파일명 예시 |
|------|----------|------------|
| **전체 페이지** | `body` | `prediction_full-page_2025-10-06T09-30-00.png` |
| **헤더** | `header.app-header` | `prediction_header_2025-10-06T09-30-01.png` |
| **네비게이션** | `nav.main-nav` | `prediction_navigation_2025-10-06T09-30-02.png` |
| **후보 패널** | `.candidate-panel` | `prediction_candidate-panel_2025-10-06T09-30-03.png` |
| **타임라인** | `.timeline-panel` | `training_timeline_2025-10-06T09-30-04.png` |

### 저장 위치

- **디렉토리:** `/tmp/screenshots/`
- **보관 기간:** 24시간 (자동 삭제)
- **파일 형식:** PNG (무손실)

### 파일명 규칙

```
{frontend}_{area}_{timestamp}.png
```

**예시:**
- `prediction_header_2025-10-06T09-30-15.png`
- `training_navigation_2025-10-06T09-30-16.png`

---

## 🔐 인증 우회 메커니즘

### 문제점
- 기본적으로 모든 페이지는 로그인 화면부터 시작
- 테스트마다 로그인하면 시간 낭비 및 불안정

### 해결책: LocalStorage 주입

**헬퍼 함수:** `tests/helpers/auth.ts`

```typescript
// 페이지 로드 전 인증 정보 주입
await bypassAuth(page);
await page.goto('http://localhost:5173');

// 또는 페이지 로드 후 자동 인증
await ensureAuthenticated(page);
```

**동작 원리:**
1. `addInitScript()`로 LocalStorage에 세션 정보 주입
2. Zustand persist 메커니즘이 자동으로 인증 상태 복원
3. 로그인 없이 메인 화면 진입

---

## ✅ 검증 항목 체크리스트

### 1. 페이지 로드 (필수)

- [ ] Frontend-prediction이 5초 내 로드되는가?
- [ ] Frontend-training이 5초 내 로드되는가?
- [ ] 로그인 화면이 아닌 메인 화면이 표시되는가?

### 2. 3D 효과 (Session 10 이후 필수)

- [ ] 헤더에 3D 로고(회전 큐브)가 표시되는가?
- [ ] Canvas 요소가 존재하는가?
- [ ] WebGL 컨텍스트가 활성화되어 있는가?

### 3. GSAP 애니메이션 (Session 10 이후 필수)

- [ ] GSAP 라이브러리가 로드되었는가?
- [ ] 메뉴 아이템이 순차적으로 나타나는가?
- [ ] 카드 등장 애니메이션이 동작하는가?

### 4. 네비게이션

- [ ] 5개 메뉴 탭이 모두 표시되는가?
- [ ] 메뉴 텍스트가 명확히 보이는가? (색상 대비)
- [ ] 메뉴 클릭 시 활성 상태가 변경되는가?

### 5. 콘솔 에러

- [ ] 치명적인 JavaScript 에러가 없는가?
- [ ] 404 에러(favicon 제외)가 없는가?
- [ ] CSS 파싱 에러가 없는가?

### 6. 크로스 Frontend 일관성

- [ ] 두 Frontend의 메뉴 개수가 동일한가?
- [ ] 두 Frontend의 헤더 구조가 유사한가?
- [ ] 두 Frontend 모두 3D 로고를 사용하는가?

---

## 🛠️ 테스트 파일 구조

```
/workspaces/Routing_ML_4/
├── tests/
│   ├── helpers/
│   │   ├── auth.ts              # 인증 우회 헬퍼
│   │   └── screenshot.ts        # 스크린샷 캡처 유틸
│   └── visual-regression.spec.ts # 메인 테스트 스위트
├── scripts/
│   └── verify-frontends.sh      # 자동 실행 스크립트
└── FRONTEND_VERIFICATION_PROTOCOL.md  # 이 문서
```

---

## 📝 테스트 작성 가이드

### 새 테스트 추가 예시

```typescript
// tests/visual-regression.spec.ts

test('should display new feature component', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await ensureAuthenticated(page);

  // 새 컴포넌트 확인
  const newComponent = page.locator('.my-new-component');
  await expect(newComponent).toBeVisible();

  // 스크린샷 캡처
  const filename = getTimestampedFilename('prediction_new-feature');
  await captureElement(page, '.my-new-component', filename);
});
```

### Before/After 비교 테스트

```typescript
import { captureBeforeAfter } from './helpers/screenshot';

test('should toggle dark mode', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await ensureAuthenticated(page);

  const result = await captureBeforeAfter(
    page,
    async () => {
      // 다크모드 토글 클릭
      await page.click('.theme-toggle');
    },
    'dark-mode-toggle'
  );

  console.log(`Before: ${result.before}`);
  console.log(`After: ${result.after}`);
});
```

---

## 🔄 워크플로우 (실제 사용 시나리오)

### 시나리오 1: CSS 스타일 수정

```bash
# 1. 스타일 수정
vim frontend-prediction/src/index.css

# 2. 서버 재시작 (HMR 동작 확인)
# (이미 실행 중이면 자동 반영)

# 3. 검증 실행
./scripts/verify-frontends.sh

# 4. 스크린샷 확인
ls -lh /tmp/screenshots/

# 5. 이상 없으면 커밋
git add frontend-prediction/src/index.css
git commit -m "Update menu text color for better contrast"
```

---

### 시나리오 2: 새 컴포넌트 추가

```bash
# 1. 컴포넌트 작성
vim frontend-prediction/src/components/NewFeature.tsx

# 2. 테스트 추가
vim tests/visual-regression.spec.ts

# 3. 검증 실행
./scripts/verify-frontends.sh

# 4. 브라우저에서 수동 확인 (필요 시)
./scripts/verify-frontends.sh --headed

# 5. 모든 테스트 통과 확인 후 커밋
git add .
git commit -m "Add NewFeature component with tests"
```

---

### 시나리오 3: 라이브러리 업데이트

```bash
# 1. 라이브러리 업데이트
cd frontend-prediction
npm update gsap

# 2. 빠른 검증 (빌드 에러 확인)
cd ..
./scripts/verify-frontends.sh --quick

# 3. 전체 검증
./scripts/verify-frontends.sh

# 4. 두 Frontend 모두 정상 동작 확인
# (prediction과 training 둘 다 테스트됨)

# 5. package-lock.json 포함하여 커밋
git add frontend-prediction/package*.json
git commit -m "Update GSAP to latest version"
```

---

## 🚨 에러 발생 시 대응

### 1. "No frontend servers are running"

**원인:** Dev 서버가 실행되지 않음

**해결:**
```bash
# Terminal 1
cd frontend-prediction && npm run dev

# Terminal 2
cd frontend-training && npm run dev
```

---

### 2. "Test failed: should load main page"

**원인:** 인증 우회 실패 또는 페이지 로드 타임아웃

**해결:**
1. 서버 로그 확인 (에러 메시지)
2. 수동으로 브라우저 열어 확인
3. LocalStorage 상태 확인:
   ```javascript
   localStorage.getItem('auth-storage')
   ```

---

### 3. "Console errors detected"

**원인:** JavaScript 런타임 에러

**해결:**
1. 브라우저 DevTools 열어 에러 확인
2. 스택 트레이스 분석
3. 최근 변경사항 롤백 고려

---

### 4. "WebGL context not available"

**원인:** Three.js 3D 렌더링 실패

**해결:**
1. 브라우저가 WebGL 지원하는지 확인
2. Canvas 요소가 DOM에 존재하는지 확인
3. AnimatedLogo3D 컴포넌트 import 확인

---

## 📊 성능 벤치마크

### 예상 실행 시간 (환경에 따라 다름)

| 테스트 모드 | 시간 | 스크린샷 수 |
|------------|------|-----------|
| **Quick** | 10-15초 | 4개 |
| **Normal** | 30-60초 | 12-20개 |
| **Headed** | 60-120초 | 12-20개 |

### 리소스 사용량

- **메모리:** 약 200-500MB (Chromium 브라우저)
- **CPU:** 피크 50-80% (애니메이션 렌더링 시)
- **디스크:** 스크린샷당 50-200KB

---

## 🎓 Best Practices

### DO ✅

1. **모든 Frontend 수정 후 검증 실행**
   ```bash
   ./scripts/verify-frontends.sh
   ```

2. **테스트 실패 시 원인 파악 후 수정**
   - 스크린샷 비교
   - 콘솔 로그 확인
   - 이전 커밋과 비교

3. **새 컴포넌트 추가 시 테스트 추가**
   ```typescript
   test('should display my component', async ({ page }) => {
     // ...
   });
   ```

4. **커밋 전 마지막 검증**
   ```bash
   ./scripts/verify-frontends.sh && git commit
   ```

### DON'T ❌

1. **테스트 없이 커밋하지 않기**
   - 시각적 회귀 위험

2. **실패한 테스트 무시하지 않기**
   - 반드시 원인 파악

3. **인증 우회 메커니즘 수정하지 않기**
   - 모든 테스트가 의존

4. **스크린샷 디렉토리를 Git에 추가하지 않기**
   - 임시 파일임

---

## 🔧 고급 설정

### Playwright Config 커스터마이징

**파일:** `playwright.config.ts`

```typescript
export default defineConfig({
  timeout: 30000, // 개별 테스트 타임아웃
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 스크린샷 비교 (추가 도구 필요)

```bash
# pixelmatch 설치
npm install --save-dev pixelmatch

# 비교 스크립트
node scripts/compare-screenshots.js before.png after.png diff.png
```

---

## 📅 유지보수

### 정기 점검 (월 1회)

- [ ] 오래된 스크린샷 삭제 확인
- [ ] Playwright 버전 업데이트
- [ ] 테스트 실행 시간 모니터링
- [ ] 실패율 통계 분석

### 문서 업데이트

- **담당자:** Frontend 수정한 개발자
- **주기:** 새 테스트 추가 시마다
- **위치:** 이 문서 (FRONTEND_VERIFICATION_PROTOCOL.md)

---

## 📞 문의 및 지원

### 문제 발생 시

1. **스크린샷 확인:** `/tmp/screenshots/` 확인
2. **로그 확인:** Playwright 출력 메시지
3. **수동 테스트:** `--headed` 모드로 실행

### 개선 제안

- 새 테스트 케이스 아이디어
- 성능 최적화 방안
- 추가 검증 항목

→ 이 문서에 추가하거나 별도 이슈 생성

---

## 📚 참고 자료

- **Playwright 공식 문서:** https://playwright.dev/
- **Visual Regression Testing:** https://playwright.dev/docs/test-snapshots
- **Three.js WebGL 테스트:** https://threejs.org/docs/
- **GSAP 애니메이션 디버깅:** https://greensock.com/docs/

---

**작성일:** 2025-10-06
**버전:** 1.0
**마지막 업데이트:** 2025-10-06 09:35 UTC
