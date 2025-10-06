import { test } from '@playwright/test';
import * as fs from 'fs';

const allErrors: any[] = [];

async function collectErrors(page: any, pageName: string, url: string, action?: any) {
  const errors: any[] = [];

  page.on('console', (msg: any) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const error = {
        page: pageName,
        type: type,
        message: msg.text(),
        timestamp: new Date().toISOString()
      };
      errors.push(error);
      console.log(`[${pageName}][${type}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (error: Error) => {
    const err = {
      page: pageName,
      type: 'pageerror',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    errors.push(err);
    console.log(`[${pageName}][pageerror] ${error.message}`);
  });

  page.on('requestfailed', (request: any) => {
    const err = {
      page: pageName,
      type: 'network',
      message: `Failed: ${request.url()}`,
      failure: request.failure()?.errorText,
      timestamp: new Date().toISOString()
    };
    errors.push(err);
    console.log(`[${pageName}][network] Failed: ${request.url()}`);
  });

  try {
    console.log(`\n=== Navigating to ${pageName} ===`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    if (action) {
      await action(page);
      await page.waitForTimeout(2000);
    }
  } catch (error: any) {
    console.log(`[${pageName}][ERROR] Navigation failed: ${error.message}`);
    errors.push({
      page: pageName,
      type: 'test-error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  return errors;
}

test('Prediction - Home Page', async ({ page }) => {
  const errors = await collectErrors(page, 'Prediction Home', 'http://localhost:5173/');
  allErrors.push(...errors);
});

test('Prediction - Master Data', async ({ page }) => {
  const errors = await collectErrors(page, 'Prediction Master Data', 'http://localhost:5173/', async (p) => {
    const tab = p.locator('text=기준정보').first();
    if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab.click();
    }
  });
  allErrors.push(...errors);
});

test('Prediction - Routing', async ({ page }) => {
  const errors = await collectErrors(page, 'Prediction Routing', 'http://localhost:5173/', async (p) => {
    const tab = p.locator('text=라우팅').first();
    if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab.click();
    }
  });
  allErrors.push(...errors);
});

test('Training - Home Page', async ({ page }) => {
  const errors = await collectErrors(page, 'Training Home', 'http://localhost:5174/');
  allErrors.push(...errors);
});

test('Training - Algorithm', async ({ page }) => {
  const errors = await collectErrors(page, 'Training Algorithm', 'http://localhost:5174/', async (p) => {
    const tab = p.locator('text=알고리즘').first();
    if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab.click();
    }
  });
  allErrors.push(...errors);
});

test.afterAll(async () => {
  const report = {
    totalErrors: allErrors.length,
    timestamp: new Date().toISOString(),
    errors: allErrors
  };

  fs.writeFileSync('/workspaces/Routing_ML_4/console-errors-detailed.json', JSON.stringify(report, null, 2));

  console.log(`\n\n========================================`);
  console.log(`FINAL REPORT: ${allErrors.length} errors collected`);
  console.log(`========================================\n`);

  const byPage: any = {};
  allErrors.forEach(err => {
    byPage[err.page] = (byPage[err.page] || 0) + 1;
  });

  console.log('Errors by page:');
  Object.entries(byPage).forEach(([page, count]) => {
    console.log(`  ${page}: ${count}`);
  });
});
