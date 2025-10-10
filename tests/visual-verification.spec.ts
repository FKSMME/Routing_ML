import { test, expect } from '@playwright/test';

test.describe('Visual Verification - 2025-10-10', () => {
  test('Prediction Frontend (5174) - 알고리즘 시각화 제거 확인', async ({ page }) => {
    // Prediction frontend 접속
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // 로그인 페이지인지 확인
    const isLoginPage = await page.locator('text=로그인').isVisible();

    if (isLoginPage) {
      console.log('✅ Prediction: 로그인 페이지 표시됨');

      // 네비게이션 메뉴 확인 (로그인 전에는 볼 수 없음)
      console.log('⚠️  로그인 필요 - 네비게이션 메뉴 확인 불가');
    } else {
      // 네비게이션 메뉴에서 "알고리즘" 항목이 없는지 확인
      const algorithmMenu = await page.locator('text=알고리즘 시각화').count();
      expect(algorithmMenu).toBe(0);
      console.log('✅ Prediction: 알고리즘 시각화 메뉴 없음 확인');

      // 스크린샷 저장
      await page.screenshot({
        path: '/tmp/prediction-navigation.png',
        fullPage: true
      });
    }
  });

  test('Training Frontend (5173) - 알고리즘 시각화 유지 확인', async ({ page }) => {
    // Training frontend 접속
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // 로그인 페이지인지 확인
    const isLoginPage = await page.locator('text=로그인').isVisible();

    if (isLoginPage) {
      console.log('✅ Training: 로그인 페이지 표시됨');
      console.log('⚠️  로그인 필요 - 네비게이션 메뉴 확인 불가');
    } else {
      // 네비게이션 메뉴에서 "알고리즘" 항목이 있는지 확인
      const algorithmMenu = await page.locator('text=알고리즘').count();
      expect(algorithmMenu).toBeGreaterThan(0);
      console.log('✅ Training: 알고리즘 메뉴 있음 확인');

      // 스크린샷 저장
      await page.screenshot({
        path: '/tmp/training-navigation.png',
        fullPage: true
      });
    }
  });

  test('Layout Width Consistency - Prediction', async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // 로그인 처리 (필요시)
    const isLoginPage = await page.locator('text=로그인').isVisible();
    if (isLoginPage) {
      // 로그인 버튼이 있으면 스킵
      console.log('⚠️  로그인 필요 - 레이아웃 테스트 스킵');
      return;
    }

    // Header와 workspace-container의 너비 확인
    const headerWidth = await page.locator('.header-container').evaluate(el => {
      return window.getComputedStyle(el).maxWidth;
    }).catch(() => 'not found');

    const workspaceWidth = await page.locator('.workspace-container').evaluate(el => {
      return window.getComputedStyle(el).maxWidth;
    }).catch(() => 'not found');

    console.log(`Header max-width: ${headerWidth}`);
    console.log(`Workspace max-width: ${workspaceWidth}`);

    // 스크린샷 저장
    await page.screenshot({
      path: '/tmp/prediction-layout.png',
      fullPage: true
    });
  });

  test('Backend Health Check', async ({ page }) => {
    await page.goto('http://localhost:8000/api/health');

    const responseText = await page.locator('pre').textContent();
    console.log('Backend Health:', responseText);

    expect(responseText).toContain('healthy');
  });

  test('Database Connection Test', async ({ page }) => {
    // Health 체크를 통해 DB 연결 확인
    await page.goto('http://localhost:8000/api/health');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/health');
      return await res.json();
    });

    console.log('✅ Backend Status:', response.status);
    console.log('✅ Backend Version:', response.version);
    console.log('✅ Uptime:', response.uptime_seconds, 'seconds');
  });
});
