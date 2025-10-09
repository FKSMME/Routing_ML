import { test, expect } from '@playwright/test';
import { bypassAuth } from './helpers/auth';

const FRONTENDS = [
  { name: 'Prediction', url: 'http://localhost:5173' },
  { name: 'Training', url: 'http://localhost:5174' }
];

test.describe('다크모드/라이트모드 전환 테스트', () => {
  for (const frontend of FRONTENDS) {
    test(`${frontend.name} - 다크모드 토글 작동 확인`, async ({ page }) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] 테스트 시작: ${frontend.name} (${frontend.url})`);

      // 1. 인증 우회 및 페이지 로드
      await bypassAuth(page);
      await page.goto(frontend.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // 2. 초기 테마 상태 확인
      const initialHasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      const initialTheme = initialHasDarkClass ? 'dark' : 'light';
      console.log(`[${new Date().toISOString()}] 초기 테마: ${initialTheme}`);
      console.log(`[${new Date().toISOString()}] HTML 클래스: ${await page.evaluate(() => document.documentElement.className)}`);

      // 3. 초기 배경색 확인
      const initialBgColor = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      });
      console.log(`[${new Date().toISOString()}] 초기 배경색 (--background): ${initialBgColor}`);

      // 4. 스크린샷 저장 (초기 상태)
      await page.screenshot({
        path: `test-results/dark-mode-${frontend.name.toLowerCase()}-01-initial-${initialTheme}.png`,
        fullPage: true
      });

      // 5. 테마 토글 버튼 찾기
      const themeToggleButton = page.locator('button.theme-toggle, button[title*="모드"], button[aria-label*="모드"]').first();
      const buttonExists = await themeToggleButton.count() > 0;

      if (!buttonExists) {
        console.error(`[${new Date().toISOString()}] ❌ 테마 토글 버튼을 찾을 수 없음`);

        // 모든 버튼 출력하여 디버깅
        const allButtons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map((btn, idx) => ({
            index: idx,
            text: btn.textContent?.trim().substring(0, 30),
            className: btn.className,
            title: btn.getAttribute('title'),
            ariaLabel: btn.getAttribute('aria-label')
          }));
        });
        console.log(`[${new Date().toISOString()}] 페이지의 모든 버튼:`, JSON.stringify(allButtons, null, 2));

        throw new Error('테마 토글 버튼을 찾을 수 없습니다');
      }

      console.log(`[${new Date().toISOString()}] ✓ 테마 토글 버튼 발견`);

      // 6. 버튼 클릭 (첫 번째 전환)
      await themeToggleButton.click();
      await page.waitForTimeout(500);

      // 7. 전환 후 테마 확인
      const afterFirstClickDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      const themeAfterFirstClick = afterFirstClickDark ? 'dark' : 'light';
      console.log(`[${new Date().toISOString()}] 첫 번째 클릭 후 테마: ${themeAfterFirstClick}`);
      console.log(`[${new Date().toISOString()}] HTML 클래스: ${await page.evaluate(() => document.documentElement.className)}`);

      // 8. 전환 후 배경색 확인
      const bgAfterFirstClick = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      });
      console.log(`[${new Date().toISOString()}] 첫 번째 클릭 후 배경색: ${bgAfterFirstClick}`);

      // 9. 스크린샷 저장 (첫 번째 전환)
      await page.screenshot({
        path: `test-results/dark-mode-${frontend.name.toLowerCase()}-02-after-first-toggle-${themeAfterFirstClick}.png`,
        fullPage: true
      });

      // 10. 테마가 실제로 변경되었는지 검증
      expect(initialHasDarkClass).not.toBe(afterFirstClickDark);
      expect(initialBgColor).not.toBe(bgAfterFirstClick);
      console.log(`[${new Date().toISOString()}] ✅ 테마 전환 확인됨: ${initialTheme} → ${themeAfterFirstClick}`);

      // 11. 다시 클릭 (두 번째 전환)
      await themeToggleButton.click();
      await page.waitForTimeout(500);

      // 12. 두 번째 전환 후 확인
      const afterSecondClickDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      const themeAfterSecondClick = afterSecondClickDark ? 'dark' : 'light';
      console.log(`[${new Date().toISOString()}] 두 번째 클릭 후 테마: ${themeAfterSecondClick}`);

      // 13. 원래 상태로 돌아왔는지 확인
      expect(afterSecondClickDark).toBe(initialHasDarkClass);
      console.log(`[${new Date().toISOString()}] ✅ 두 번째 전환으로 원래 테마로 복귀 확인: ${themeAfterSecondClick}`);

      // 14. localStorage 확인
      const storedTheme = await page.evaluate(() => {
        return localStorage.getItem('routing-ml-theme') || localStorage.getItem('darkMode');
      });
      console.log(`[${new Date().toISOString()}] localStorage 저장된 테마: ${storedTheme}`);

      // 15. 스크린샷 저장 (두 번째 전환)
      await page.screenshot({
        path: `test-results/dark-mode-${frontend.name.toLowerCase()}-03-after-second-toggle-${themeAfterSecondClick}.png`,
        fullPage: true
      });

      console.log(`[${new Date().toISOString()}] ✅ ${frontend.name} 다크모드 테스트 완료`);
    });
  }
});
