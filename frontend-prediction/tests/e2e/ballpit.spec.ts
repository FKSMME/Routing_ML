import { test, expect } from '@playwright/test';

/**
 * E2E Test: Ballpit 3D 배경 효과 렌더링 검증
 *
 * 목적:
 * - Ballpit 컴포넌트가 로그인 화면에 정상적으로 로드되는지 확인
 * - Canvas 요소가 존재하고 렌더링되는지 검증
 * - Lazy loading이 정상 작동하는지 확인
 */

test.describe('Ballpit 3D Background Effect', () => {
  test.beforeEach(async ({ page }) => {
    // 콘솔 에러 수집
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });
  });

  test('should load login page with Ballpit canvas', async ({ page }) => {
    // 로그인 페이지 접속
    await page.goto('http://localhost:5173', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // 로그인 폼 확인
    await expect(page.getByText('Routing ML Console')).toBeVisible();
    await expect(page.getByRole('button', { name: /로그인/i })).toBeVisible();

    // Ballpit Canvas가 lazy load될 때까지 대기
    await page.waitForTimeout(2000);

    // Canvas 요소 확인
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeAttached();

    // Canvas가 실제로 보이는지 확인
    const isVisible = await canvas.isVisible();
    expect(isVisible).toBe(true);

    // Canvas 크기가 설정되어 있는지 확인
    const bbox = await canvas.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox!.width).toBeGreaterThan(0);
    expect(bbox!.height).toBeGreaterThan(0);
  });

  test('should render Ballpit without console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`Page Error: ${err.message}`);
    });

    await page.goto('http://localhost:5173', {
      waitUntil: 'load',
      timeout: 10000,
    });

    await page.waitForTimeout(3000);

    // Three.js 관련 에러가 없어야 함
    const threeErrors = errors.filter((e) =>
      e.toLowerCase().includes('three') || e.toLowerCase().includes('webgl')
    );

    expect(threeErrors.length).toBe(0);
  });

  test('should lazy load Ballpit chunk separately', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.js') && !url.includes('node_modules')) {
        requests.push(url);
      }
    });

    await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    // Ballpit chunk가 별도로 로드되었는지 확인
    const ballpitChunk = requests.find((r) =>
      r.toLowerCase().includes('ballpit') || r.includes('three-vendor')
    );

    expect(ballpitChunk).toBeDefined();
    console.log(`✓ Lazy loaded chunk: ${ballpitChunk}`);
  });

  test('should take screenshot for visual regression', async ({ page }) => {
    await page.goto('http://localhost:5173', {
      waitUntil: 'load',
      timeout: 10000,
    });

    // Ballpit 애니메이션이 시작될 때까지 대기
    await page.waitForTimeout(3000);

    // 스크린샷 저장 (회귀 테스트용)
    await page.screenshot({
      path: 'tests/e2e/screenshots/ballpit-login.png',
      fullPage: false,
    });

    console.log('✓ Screenshot saved for visual regression testing');
  });
});
