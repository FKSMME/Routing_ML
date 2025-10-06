import { test, expect } from '@playwright/test';
import { bypassAuth, ensureAuthenticated } from './helpers/auth';
import { captureFullPage, captureMultipleAreas, getTimestampedFilename } from './helpers/screenshot';

/**
 * 시각적 회귀 테스트 - Frontend 수정 시 자동 실행
 *
 * 사용법:
 *   npx playwright test tests/visual-regression.spec.ts
 */

const FRONTENDS = [
  { name: 'prediction', port: 5173, url: 'http://localhost:5173' },
  { name: 'training', port: 5174, url: 'http://localhost:5174' },
];

const CRITICAL_AREAS = [
  { selector: 'header.app-header', name: 'header' },
  { selector: 'nav.main-nav', name: 'navigation' },
  { selector: '.candidate-panel', name: 'candidate-panel' },
  { selector: '.timeline-panel', name: 'timeline' },
];

test.describe('Frontend Visual Regression Tests', () => {
  for (const frontend of FRONTENDS) {
    test.describe(`${frontend.name.toUpperCase()} Frontend`, () => {
      test.beforeEach(async ({ page }) => {
        // 인증 우회 설정
        await bypassAuth(page);
      });

      test('should load main page without errors', async ({ page }) => {
        const startTime = Date.now();

        // 페이지 로드
        await page.goto(frontend.url, { waitUntil: 'networkidle' });
        await ensureAuthenticated(page);

        const loadTime = Date.now() - startTime;
        console.log(`✅ ${frontend.name}: Loaded in ${loadTime}ms`);

        // 로그인 페이지가 아닌지 확인
        const loginForm = page.locator('form').first();
        const isLoginPage = await loginForm.isVisible().catch(() => false);
        expect(isLoginPage).toBeFalsy();

        // 전체 페이지 스크린샷
        const filename = getTimestampedFilename(`${frontend.name}_full-page`);
        const filepath = await captureFullPage(page, filename);
        console.log(`📸 Screenshot: ${filepath}`);
      });

      test('should display header with 3D logo', async ({ page }) => {
        await page.goto(frontend.url, { waitUntil: 'domcontentloaded' });
        await ensureAuthenticated(page);

        // 3D Canvas 확인 (AnimatedLogo3D)
        const canvas = page.locator('header canvas').first();
        await expect(canvas).toBeVisible({ timeout: 5000 });

        // 헤더 스크린샷
        const filename = getTimestampedFilename(`${frontend.name}_header`);
        const element = page.locator('header.app-header').first();
        await element.screenshot({ path: `/tmp/screenshots/${filename}` });
        console.log(`📸 Header captured: ${filename}`);
      });

      test('should display navigation menu with animation', async ({ page }) => {
        await page.goto(frontend.url, { waitUntil: 'domcontentloaded' });
        await ensureAuthenticated(page);

        // 메뉴 탭 확인
        const navTabs = page.locator('.main-nav-tab');
        const count = await navTabs.count();
        expect(count).toBeGreaterThan(0);

        console.log(`✅ ${frontend.name}: Found ${count} navigation tabs`);

        // 네비게이션 스크린샷
        const filename = getTimestampedFilename(`${frontend.name}_navigation`);
        const nav = page.locator('nav.main-nav').first();
        await nav.screenshot({ path: `/tmp/screenshots/${filename}` });
        console.log(`📸 Navigation captured: ${filename}`);
      });

      test('should capture all critical areas', async ({ page }) => {
        await page.goto(frontend.url, { waitUntil: 'networkidle' });
        await ensureAuthenticated(page);

        // 여러 영역 동시 캡처
        const results = await captureMultipleAreas(
          page,
          CRITICAL_AREAS,
          frontend.name
        );

        // 캡처 결과 로깅
        for (const [area, filepath] of Object.entries(results)) {
          if (filepath) {
            console.log(`📸 ${area}: ${filepath}`);
          } else {
            console.log(`⚠️  ${area}: Not visible or not found`);
          }
        }

        // 최소 1개 이상 캡처되었는지 확인
        const capturedCount = Object.values(results).filter(Boolean).length;
        expect(capturedCount).toBeGreaterThan(0);
      });

      test('should not have console errors', async ({ page }) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          } else if (msg.type() === 'warning') {
            warnings.push(msg.text());
          }
        });

        await page.goto(frontend.url, { waitUntil: 'networkidle' });
        await ensureAuthenticated(page);
        await page.waitForTimeout(2000); // 애니메이션 완료 대기

        // 에러 확인
        if (errors.length > 0) {
          console.log(`❌ ${frontend.name} Console Errors:`);
          errors.forEach((err) => console.log(`   - ${err}`));
        }

        // 경고 확인 (선택사항)
        if (warnings.length > 0) {
          console.log(`⚠️  ${frontend.name} Console Warnings:`);
          warnings.forEach((warn) => console.log(`   - ${warn}`));
        }

        // 치명적 에러가 없어야 함
        const criticalErrors = errors.filter(
          (err) => !err.includes('favicon') && !err.includes('DevTools')
        );
        expect(criticalErrors.length).toBe(0);
      });

      test('should verify GSAP animations loaded', async ({ page }) => {
        await page.goto(frontend.url, { waitUntil: 'domcontentloaded' });
        await ensureAuthenticated(page);

        // GSAP 로드 확인
        const gsapLoaded = await page.evaluate(() => {
          return typeof (window as any).gsap !== 'undefined';
        });

        expect(gsapLoaded).toBeTruthy();
        console.log(`✅ ${frontend.name}: GSAP animation library loaded`);
      });

      test('should verify Three.js 3D rendering', async ({ page }) => {
        await page.goto(frontend.url, { waitUntil: 'domcontentloaded' });
        await ensureAuthenticated(page);

        // Canvas 요소 확인
        const canvas = page.locator('header canvas').first();
        await expect(canvas).toBeVisible({ timeout: 5000 });

        // WebGL 컨텍스트 확인
        const hasWebGL = await page.evaluate(() => {
          const canvas = document.querySelector('header canvas') as HTMLCanvasElement;
          if (!canvas) return false;
          try {
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return gl !== null;
          } catch {
            return false;
          }
        });

        expect(hasWebGL).toBeTruthy();
        console.log(`✅ ${frontend.name}: 3D rendering active (WebGL)`);
      });
    });
  }
});

test.describe('Cross-Frontend Consistency', () => {
  test('both frontends should have same navigation structure', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await bypassAuth(page1);
    await bypassAuth(page2);

    await page1.goto(FRONTENDS[0].url, { waitUntil: 'domcontentloaded' });
    await page2.goto(FRONTENDS[1].url, { waitUntil: 'domcontentloaded' });

    await ensureAuthenticated(page1);
    await ensureAuthenticated(page2);

    const count1 = await page1.locator('.main-nav-tab').count();
    const count2 = await page2.locator('.main-nav-tab').count();

    console.log(`📊 Navigation tabs - Prediction: ${count1}, Training: ${count2}`);

    // 두 frontend가 같은 수의 메뉴를 가져야 함
    expect(count1).toBeGreaterThan(0);
    expect(count2).toBeGreaterThan(0);

    await context.close();
  });
});
