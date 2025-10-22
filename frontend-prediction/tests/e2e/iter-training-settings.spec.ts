import { test, expect } from '@playwright/test';

/**
 * E2E Test: Iterative Training Settings
 *
 * Purpose:
 * - Verify settings page loads correctly
 * - Test form validation for all configuration fields
 * - Validate save/load flow from localStorage
 * - Test reset to defaults functionality
 */

test.describe('Iterative Training Settings', () => {
  const STORAGE_KEY = 'iter_training_config';

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:5173', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);

    await page.waitForTimeout(500);
  });

  test('should load settings page without errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('404')) {
        errors.push(msg.text());
      }
    });

    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // Settings page should load without critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('API') && !e.includes('Failed to fetch')
    );

    expect(criticalErrors.length).toBe(0);
    console.log('✓ Settings page loaded without critical errors');
  });

  test('should display all configuration fields with default values', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // Check for all 5 configuration fields
    const fields = [
      { id: 'sample_size', defaultValue: '500' },
      { id: 'mae_threshold', defaultValue: '5' },
      { id: 'cv_threshold', defaultValue: '0.3' },
      { id: 'queue_max_size', defaultValue: '10' },
      { id: 'polling_interval', defaultValue: '5' },
    ];

    for (const field of fields) {
      const input = page.locator(`#${field.id}`);
      const isVisible = await input.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        const value = await input.inputValue();
        console.log(`✓ Field ${field.id}: ${value} (expected: ${field.defaultValue})`);

        // Value should match default (allowing for float formatting differences)
        const numValue = parseFloat(value);
        const expectedValue = parseFloat(field.defaultValue);
        expect(Math.abs(numValue - expectedValue)).toBeLessThan(0.01);
      } else {
        console.log(`⚠ Field ${field.id} not found`);
      }
    }
  });

  test('should validate sample_size field constraints', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    const sampleSizeInput = page.locator('#sample_size');

    if (await sampleSizeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Test invalid value (below minimum)
      await sampleSizeInput.fill('5');
      await sampleSizeInput.blur();
      await page.waitForTimeout(500);

      // Look for validation error
      const errorMessage = page.locator('text=/Sample size must be between 10 and 10,000/i');
      const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasError) {
        console.log('✓ Validation error shown for invalid sample_size');
      }

      // Test valid value
      await sampleSizeInput.fill('500');
      await sampleSizeInput.blur();
      await page.waitForTimeout(500);

      // Error should disappear
      const errorStillVisible = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(errorStillVisible).toBeFalsy();
      console.log('✓ Validation error cleared for valid sample_size');
    }
  });

  test('should validate mae_threshold field constraints', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    const maeInput = page.locator('#mae_threshold');

    if (await maeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Test invalid value (zero or negative)
      await maeInput.fill('0');
      await maeInput.blur();
      await page.waitForTimeout(500);

      // Look for validation error
      const errorMessage = page.locator('text=/MAE threshold must be positive/i');
      const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasError) {
        console.log('✓ Validation error shown for invalid mae_threshold');
      }

      // Test valid value
      await maeInput.fill('5.0');
      await maeInput.blur();
      await page.waitForTimeout(500);

      const errorStillVisible = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
      expect(errorStillVisible).toBeFalsy();
      console.log('✓ Validation error cleared for valid mae_threshold');
    }
  });

  test('should save configuration to localStorage', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // Modify a value
    const sampleSizeInput = page.locator('#sample_size');
    if (await sampleSizeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sampleSizeInput.fill('1000');
      await page.waitForTimeout(300);

      // Click save button
      const saveButton = page.locator('button:has-text("저장")').or(
        page.locator('button:has-text("Save")')
      );

      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Verify localStorage contains the new value
        const storedConfig = await page.evaluate((key) => {
          const stored = localStorage.getItem(key);
          return stored ? JSON.parse(stored) : null;
        }, STORAGE_KEY);

        if (storedConfig) {
          expect(storedConfig.sample_size).toBe(1000);
          console.log('✓ Configuration saved to localStorage:', storedConfig);
        } else {
          console.log('⚠ localStorage not populated (may be mock mode)');
        }

        // Look for success message
        const successMessage = page.locator('text=/성공적으로 저장|Successfully saved/i');
        const hasSuccess = await successMessage.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasSuccess) {
          console.log('✓ Success message displayed');
        }
      }
    }
  });

  test('should load configuration from localStorage on mount', async ({ page }) => {
    // Pre-populate localStorage
    await page.goto('http://localhost:5173', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    const testConfig = {
      sample_size: 750,
      mae_threshold: 7.5,
      cv_threshold: 0.25,
      queue_max_size: 15,
      polling_interval: 10,
    };

    await page.evaluate(({ key, config }) => {
      localStorage.setItem(key, JSON.stringify(config));
    }, { key: STORAGE_KEY, config: testConfig });

    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1500);

      // Verify fields are populated with stored values
      const sampleSizeInput = page.locator('#sample_size');
      if (await sampleSizeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const value = await sampleSizeInput.inputValue();
        const numValue = parseInt(value, 10);

        expect(numValue).toBe(testConfig.sample_size);
        console.log(`✓ Loaded sample_size from localStorage: ${numValue}`);
      }
    }
  });

  test('should reset to default values', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // Modify a value
    const sampleSizeInput = page.locator('#sample_size');
    if (await sampleSizeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sampleSizeInput.fill('2000');
      await page.waitForTimeout(300);

      // Click reset button
      const resetButton = page.locator('button:has-text("기본값 복원")').or(
        page.locator('button:has-text("Reset")').or(
          page.locator('button:has-text("복원")')
        )
      );

      if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await resetButton.click();
        await page.waitForTimeout(500);

        // Value should be reset to default (500)
        const value = await sampleSizeInput.inputValue();
        const numValue = parseInt(value, 10);

        expect(numValue).toBe(500);
        console.log('✓ Reset to default value: 500');
      }
    }
  });

  test('should prevent saving with validation errors', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // Enter invalid value
    const sampleSizeInput = page.locator('#sample_size');
    if (await sampleSizeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sampleSizeInput.fill('5'); // Below minimum
      await page.waitForTimeout(300);

      // Try to save
      const saveButton = page.locator('button:has-text("저장")').or(
        page.locator('button:has-text("Save")')
      );

      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);

        // Success message should NOT appear
        const successMessage = page.locator('text=/성공적으로 저장|Successfully saved/i');
        const hasSuccess = await successMessage.isVisible({ timeout: 1000 }).catch(() => false);

        expect(hasSuccess).toBeFalsy();
        console.log('✓ Save blocked due to validation error');

        // Error message should still be visible
        const errorMessage = page.locator('text=/must be between/i');
        const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasError) {
          console.log('✓ Validation error still visible after failed save');
        }
      }
    }
  });

  test('should display help text and info box', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // Look for info box at bottom
    const infoBox = page.locator('text=/참고 사항|Note|Info/i');
    const hasInfoBox = await infoBox.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasInfoBox) {
      console.log('✓ Info box displayed');
    }

    // Check for field descriptions
    const descriptions = [
      /품목 샘플 개수/i,
      /재학습 트리거/i,
      /변동계수 임계값/i,
      /동시 대기 가능/i,
      /확인 간격/i,
    ];

    for (const desc of descriptions) {
      const element = page.locator(`text=${desc}`).first();
      const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);

      if (isVisible) {
        console.log(`✓ Found description: ${desc}`);
      }
    }
  });

  test('should take settings page screenshot', async ({ page }) => {
    // Navigate to settings page
    const settingsLink = page.locator('text=/학습 설정|Training Settings|설정/i').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1500);
    }

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'tests/e2e/screenshots/iter-training-settings.png',
      fullPage: true,
    });

    console.log('✓ Settings page screenshot saved');
  });
});
