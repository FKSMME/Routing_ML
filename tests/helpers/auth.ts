import type { Page } from '@playwright/test';

/**
 * 인증 우회 - LocalStorage에 세션 정보 주입
 */
export async function bypassAuth(page: Page) {
  // 페이지로 이동하기 전에 LocalStorage 설정
  await page.addInitScript(() => {
    // authStore의 persist 상태 모방
    const authState = {
      state: {
        isAuthenticated: true,
        username: 'test',
        displayName: 'Test User',
        token: 'test-token-bypass',
      },
      version: 0,
    };

    localStorage.setItem('auth-storage', JSON.stringify(authState));
  });
}

/**
 * 로그인 페이지 체크 및 자동 우회
 */
export async function ensureAuthenticated(page: Page) {
  // 로그인 폼이 보이면 LocalStorage 주입 후 리로드
  const loginForm = page.locator('form').first();
  const isLoginPage = await loginForm.isVisible().catch(() => false);

  if (isLoginPage) {
    await bypassAuth(page);
    await page.reload();

    // 리로드 후에도 로그인 페이지면 수동 로그인 시도
    const stillLoginPage = await loginForm.isVisible().catch(() => false);
    if (stillLoginPage) {
      await page.fill('input[type="text"]', 'test');
      await page.fill('input[type="password"]', 'test');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * 세션 체크 - 인증 상태인지 확인
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const authStorage = await page.evaluate(() => {
    const auth = localStorage.getItem('auth-storage');
    if (!auth) return null;
    try {
      const parsed = JSON.parse(auth);
      return parsed.state?.isAuthenticated === true;
    } catch {
      return null;
    }
  });

  return authStorage === true;
}
