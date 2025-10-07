import { test, expect } from '@playwright/test';

const FRONTENDS = [
  { name: 'Prediction', url: 'http://localhost:5173', port: 5173 },
  { name: 'Training', url: 'http://localhost:5174', port: 5174 }
];

test.describe('프론트엔드 시각적 검증', () => {
  for (const frontend of FRONTENDS) {
    test(`${frontend.name} - 전체 UI 확인`, async ({ page }) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotDir = `test-results/visual-check-${timestamp}`;

      console.log(`\n[${new Date().toISOString()}] ========================================`);
      console.log(`${frontend.name} Frontend 검증 시작 (${frontend.url})`);
      console.log(`========================================\n`);

      // 1. 로그인 페이지 확인
      await page.goto(frontend.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      console.log(`[${new Date().toISOString()}] 📸 로그인 페이지 스크린샷 캡처`);
      await page.screenshot({
        path: `${screenshotDir}/${frontend.name.toLowerCase()}-01-login.png`,
        fullPage: true
      });

      // 2. 테마 토글 버튼 확인
      const themeButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.map((btn, idx) => ({
          index: idx,
          text: btn.textContent?.trim(),
          className: btn.className,
          visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
          title: btn.title,
          ariaLabel: btn.getAttribute('aria-label')
        }));
      });

      console.log(`[${new Date().toISOString()}] 🔍 발견된 버튼 (${themeButtons.length}개):`);
      themeButtons.forEach((btn, idx) => {
        if (btn.title?.includes('모드') || btn.ariaLabel?.includes('모드')) {
          console.log(`  ✅ [${idx}] 테마 버튼: "${btn.text}" (visible: ${btn.visible})`);
        }
      });

      // 3. 로그인 (테스트 계정)
      console.log(`\n[${new Date().toISOString()}] 🔐 로그인 시도...`);

      const usernameInput = page.locator('input[type="text"], input[id="username"]').first();
      const passwordInput = page.locator('input[type="password"], input[id="password"]').first();
      const loginButton = page.locator('button[type="submit"], button:has-text("로그인")').first();

      const hasLoginForm = await usernameInput.count() > 0;

      if (hasLoginForm) {
        await usernameInput.fill('test');
        await passwordInput.fill('test');
        await loginButton.click();
        await page.waitForTimeout(3000);

        console.log(`[${new Date().toISOString()}] ✅ 로그인 완료 (또는 시도)`);
      } else {
        console.log(`[${new Date().toISOString()}] ⚠️  로그인 폼 없음 - 이미 인증된 상태`);
      }

      // 4. 메인 페이지 스크린샷
      console.log(`\n[${new Date().toISOString()}] 📸 메인 페이지 스크린샷 캡처`);
      await page.screenshot({
        path: `${screenshotDir}/${frontend.name.toLowerCase()}-02-main-light.png`,
        fullPage: true
      });

      // 5. "Routing Canvas" 텍스트 개수 확인
      const canvasCount = await page.evaluate(() => {
        const text = document.body.innerText;
        const matches = text.match(/Routing Canvas/gi);
        return matches ? matches.length : 0;
      });

      console.log(`\n[${new Date().toISOString()}] 📊 Routing Canvas 발견: ${canvasCount}개`);
      if (canvasCount > 1) {
        console.log(`  ❌ 경고: Routing Canvas가 ${canvasCount}개 발견됨 (중복 렌더링)`);
      } else {
        console.log(`  ✅ 정상: Routing Canvas 1개`);
      }

      // 6. DOM 구조 분석
      const domStructure = await page.evaluate(() => {
        const routingGrids = document.querySelectorAll('.routing-workspace-grid, .routing-workspace__grid');
        const canvasDivs = document.querySelectorAll('[class*="canvas"]');

        return {
          routingGrids: routingGrids.length,
          canvasDivs: canvasDivs.length,
          bodyChildren: document.body.children.length,
        };
      });

      console.log(`[${new Date().toISOString()}] 🔍 DOM 구조 분석:`);
      console.log(`  - .routing-workspace-grid: ${domStructure.routingGrids}개`);
      console.log(`  - canvas 요소: ${domStructure.canvasDivs}개`);

      // 7. 테마 토글 시도
      console.log(`\n[${new Date().toISOString()}] 🎨 다크모드 테스트 시작`);

      const themeToggle = page.locator('button.theme-toggle, button[title*="모드"], button[aria-label*="모드"]').first();
      const toggleExists = await themeToggle.count() > 0;

      if (toggleExists) {
        console.log(`[${new Date().toISOString()}] ✅ 테마 토글 버튼 발견`);

        // 초기 테마 확인
        const initialTheme = await page.evaluate(() => {
          return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        });
        console.log(`  - 초기 테마: ${initialTheme}`);

        // 초기 CSS 변수
        const initialBg = await page.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
        });
        console.log(`  - 초기 --background: ${initialBg}`);

        // 토글 클릭
        await themeToggle.click();
        await page.waitForTimeout(500);

        // 전환 후 테마 확인
        const afterTheme = await page.evaluate(() => {
          return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        });
        console.log(`  - 클릭 후 테마: ${afterTheme}`);

        // 전환 후 CSS 변수
        const afterBg = await page.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
        });
        console.log(`  - 클릭 후 --background: ${afterBg}`);

        // 다크모드 스크린샷
        await page.screenshot({
          path: `${screenshotDir}/${frontend.name.toLowerCase()}-03-main-dark.png`,
          fullPage: true
        });

        // 결과 판정
        if (initialTheme !== afterTheme) {
          console.log(`  ✅ 테마 토글 성공: ${initialTheme} → ${afterTheme}`);
        } else {
          console.log(`  ❌ 테마 토글 실패: ${initialTheme} (변화 없음)`);
        }

        if (initialBg !== afterBg) {
          console.log(`  ✅ 배경색 변경 성공`);
        } else {
          console.log(`  ❌ 배경색 변경 실패 (CSS 변수 미적용)`);
        }

        // 라이트모드로 복귀
        await themeToggle.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${screenshotDir}/${frontend.name.toLowerCase()}-04-main-light-return.png`,
          fullPage: true
        });

      } else {
        console.log(`[${new Date().toISOString()}] ❌ 테마 토글 버튼을 찾을 수 없음`);
      }

      console.log(`\n[${new Date().toISOString()}] 📁 스크린샷 저장 위치: ${screenshotDir}`);
      console.log(`[${new Date().toISOString()}] ========================================`);
      console.log(`${frontend.name} 검증 완료`);
      console.log(`========================================\n`);

      // 어설션
      expect(canvasCount).toBeLessThanOrEqual(1);
    });
  }
});
