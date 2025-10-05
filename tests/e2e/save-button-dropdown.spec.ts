import { test, expect } from '../../frontend-prediction/node_modules/@playwright/test';

/**
 * SaveButtonDropdown E2E 테스트
 *
 * 이 테스트는 SaveButtonDropdown 컴포넌트의 통합 동작을 검증합니다.
 *
 * 테스트 시나리오:
 * 1. 드롭다운 열기/닫기
 * 2. 포맷 선택
 * 3. 저장 위치 선택
 * 4. 저장 실행
 * 5. 토스트 알림 확인
 */

test.describe('SaveButtonDropdown 통합 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 및 라우팅 생성 페이지로 이동
    await page.goto('http://localhost:5173');

    // 세션 쿠키 설정 (테스트 환경)
    await page.context().addCookies([
      {
        name: 'session',
        value: 'test',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 라우팅 생성 페이지로 이동
    await page.goto('http://localhost:5173/routing');

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
  });

  test('드롭다운 열기 및 닫기', async ({ page }) => {
    // 드롭다운 토글 버튼 찾기
    const toggleButton = page.locator('button.save-button-dropdown-toggle');

    // 드롭다운이 초기에는 닫혀있어야 함
    const dropdown = page.locator('.save-dropdown-menu');
    await expect(dropdown).not.toBeVisible();

    // 드롭다운 열기
    await toggleButton.click();
    await expect(dropdown).toBeVisible();

    // 외부 클릭으로 닫기
    await page.click('body', { position: { x: 0, y: 0 } });
    await expect(dropdown).not.toBeVisible();
  });

  test('CSV 포맷 선택 및 로컬 저장', async ({ page }) => {
    // 타임라인에 공정 추가 (선행 조건)
    await page.locator('[data-testid="candidate-item"]').first().dragTo(
      page.locator('[data-testid="routing-canvas-scroll"]')
    );

    // 드롭다운 열기
    await page.locator('button.save-button-dropdown-toggle').click();

    // CSV 포맷 선택
    await page.locator('input[name="format"][value="CSV"]').check();
    await expect(page.locator('input[name="format"][value="CSV"]')).toBeChecked();

    // 로컬 저장 선택
    await page.locator('input[name="destination"][value="local"]').check();
    await expect(page.locator('input[name="destination"][value="local"]')).toBeChecked();

    // 다운로드 대기 설정
    const downloadPromise = page.waitForEvent('download');

    // 저장 버튼 클릭
    await page.locator('button.save-dropdown-apply').click();

    // 다운로드 확인
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // 성공 토스트 확인
    const toast = page.locator('.save-toast-notification.success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('CSV 저장 완료');

    // 토스트 자동 사라짐 확인 (3초 후)
    await page.waitForTimeout(3500);
    await expect(toast).not.toBeVisible();
  });

  test('XML 포맷 선택 및 클립보드 복사', async ({ page }) => {
    // 타임라인에 공정 추가
    await page.locator('[data-testid="candidate-item"]').first().dragTo(
      page.locator('[data-testid="routing-canvas-scroll"]')
    );

    // 드롭다운 열기
    await page.locator('button.save-button-dropdown-toggle').click();

    // XML 포맷 선택
    await page.locator('input[name="format"][value="XML"]').check();

    // 클립보드 저장 선택
    await page.locator('input[name="destination"][value="clipboard"]').check();

    // 클립보드 권한 부여 (Playwright)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // 저장 버튼 클릭
    await page.locator('button.save-dropdown-apply').click();

    // 성공 토스트 확인
    const toast = page.locator('.save-toast-notification.success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('XML 저장 완료');

    // 클립보드 내용 확인
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('<?xml');
    expect(clipboardText).toContain('<RoutingExport');
  });

  test('Excel 선택 시 클립보드 비활성화', async ({ page }) => {
    // 드롭다운 열기
    await page.locator('button.save-button-dropdown-toggle').click();

    // Excel 포맷 선택
    await page.locator('input[name="format"][value="Excel"]').check();

    // 클립보드 옵션이 비활성화되어야 함
    const clipboardRadio = page.locator('input[name="destination"][value="clipboard"]');
    await expect(clipboardRadio).toBeDisabled();

    // 로컬 저장은 활성화되어야 함
    const localRadio = page.locator('input[name="destination"][value="local"]');
    await expect(localRadio).toBeEnabled();
  });

  test('ACCESS 선택 시 모든 저장 위치 비활성화', async ({ page }) => {
    // 드롭다운 열기
    await page.locator('button.save-button-dropdown-toggle').click();

    // ACCESS 포맷 선택
    await page.locator('input[name="format"][value="ACCESS"]').check();

    // 모든 저장 위치가 비활성화되어야 함
    await expect(page.locator('input[name="destination"][value="local"]')).toBeDisabled();
    await expect(page.locator('input[name="destination"][value="clipboard"]')).toBeDisabled();
  });

  test('빈 타임라인에서 저장 시 오류 처리', async ({ page }) => {
    // 타임라인이 비어있는 상태에서 저장 시도

    // Primary 저장 버튼 클릭
    await page.locator('button.save-button-primary').click();

    // 오류 토스트 확인
    const toast = page.locator('.save-toast-notification.error');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('저장 실패');
  });

  test('키보드 네비게이션 (접근성)', async ({ page }) => {
    // Tab 키로 저장 버튼에 포커스
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // ... (포커스가 저장 버튼에 올 때까지 Tab)

    // Enter로 드롭다운 토글
    await page.keyboard.press('Enter');

    // 드롭다운이 열려야 함
    const dropdown = page.locator('.save-dropdown-menu');
    await expect(dropdown).toBeVisible();

    // Escape로 드롭다운 닫기 (구현 시)
    await page.keyboard.press('Escape');
    // await expect(dropdown).not.toBeVisible();
  });

  test('여러 포맷 순차 저장', async ({ page }) => {
    // 타임라인에 공정 추가
    await page.locator('[data-testid="candidate-item"]').first().dragTo(
      page.locator('[data-testid="routing-canvas-scroll"]')
    );

    const formats = ['CSV', 'XML', 'JSON'];

    for (const format of formats) {
      // 드롭다운 열기
      await page.locator('button.save-button-dropdown-toggle').click();

      // 포맷 선택
      await page.locator(`input[name="format"][value="${format}"]`).check();

      // 로컬 저장
      await page.locator('input[name="destination"][value="local"]').check();

      // 다운로드 대기
      const downloadPromise = page.waitForEvent('download');

      // 저장
      await page.locator('button.save-dropdown-apply').click();

      // 다운로드 확인
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      expect(filename).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));

      // 성공 토스트 대기 및 확인
      const toast = page.locator('.save-toast-notification.success');
      await expect(toast).toBeVisible();

      // 다음 저장 전에 토스트 사라질 때까지 대기
      await page.waitForTimeout(3500);
    }
  });
});

/**
 * 테스트 실행 방법:
 *
 * 1. Playwright 설치:
 *    npm install -D @playwright/test
 *
 * 2. 브라우저 설치:
 *    npx playwright install
 *
 * 3. 개발 서버 시작:
 *    npm run dev (백그라운드)
 *
 * 4. 테스트 실행:
 *    npx playwright test save-button-dropdown.spec.ts
 *
 * 5. UI 모드로 실행 (디버깅):
 *    npx playwright test --ui
 *
 * 6. 특정 브라우저만:
 *    npx playwright test --project=chromium
 */
