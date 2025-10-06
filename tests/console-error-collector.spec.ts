import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface ConsoleError {
  page: string;
  type: string;
  message: string;
  url?: string;
  timestamp: string;
}

const errors: ConsoleError[] = [];

// Prediction Frontend 페이지들
const predictionPages = [
  { name: 'Home/Login', url: 'http://localhost:5173/' },
  { name: 'Master Data', url: 'http://localhost:5173/', action: async (page) => {
    await page.waitForTimeout(2000);
    const masterDataTab = page.locator('text=기준정보 확인').first();
    if (await masterDataTab.isVisible()) {
      await masterDataTab.click();
      await page.waitForTimeout(2000);
    }
  }},
  { name: 'Routing', url: 'http://localhost:5173/', action: async (page) => {
    await page.waitForTimeout(2000);
    const routingTab = page.locator('text=라우팅 생성').first();
    if (await routingTab.isVisible()) {
      await routingTab.click();
      await page.waitForTimeout(2000);
    }
  }},
  { name: 'Routing Matrix', url: 'http://localhost:5173/', action: async (page) => {
    await page.waitForTimeout(2000);
    const matrixTab = page.locator('text=라우팅 조합 관리').first();
    if (await matrixTab.isVisible()) {
      await matrixTab.click();
      await page.waitForTimeout(2000);
    }
  }},
  { name: 'Process Groups', url: 'http://localhost:5173/', action: async (page) => {
    await page.waitForTimeout(2000);
    const groupsTab = page.locator('text=공정 그룹 관리').first();
    if (await groupsTab.isVisible()) {
      await groupsTab.click();
      await page.waitForTimeout(2000);
    }
  }},
  { name: 'Data Output', url: 'http://localhost:5173/', action: async (page) => {
    await page.waitForTimeout(2000);
    const outputTab = page.locator('text=데이터 출력 설정').first();
    if (await outputTab.isVisible()) {
      await outputTab.click();
      await page.waitForTimeout(2000);
    }
  }},
];

// Training Frontend 페이지들
const trainingPages = [
  { name: 'Training Home', url: 'http://localhost:5174/' },
  { name: 'Algorithm', url: 'http://localhost:5174/', action: async (page) => {
    await page.waitForTimeout(2000);
    const algoTab = page.locator('text=알고리즘').first();
    if (await algoTab.isVisible()) {
      await algoTab.click();
      await page.waitForTimeout(2000);
    }
  }},
  { name: 'Training Status', url: 'http://localhost:5174/', action: async (page) => {
    await page.waitForTimeout(2000);
    const statusTab = page.locator('text=학습 데이터 현황').first();
    if (await statusTab.isVisible()) {
      await statusTab.click();
      await page.waitForTimeout(2000);
    }
  }},
  { name: 'Options', url: 'http://localhost:5174/', action: async (page) => {
    await page.waitForTimeout(2000);
    const optionsTab = page.locator('text=시스템 옵션').first();
    if (await optionsTab.isVisible()) {
      await optionsTab.click();
      await page.waitForTimeout(2000);
    }
  }},
];

test.describe('Console Error Collection - Prediction Frontend', () => {
  for (const pageInfo of predictionPages) {
    test(`Collect errors from: ${pageInfo.name}`, async ({ page }) => {
      const pageErrors: ConsoleError[] = [];

      // Console 메시지 수집
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          pageErrors.push({
            page: `Prediction - ${pageInfo.name}`,
            type: msg.type(),
            message: msg.text(),
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Page 에러 수집
      page.on('pageerror', error => {
        pageErrors.push({
          page: `Prediction - ${pageInfo.name}`,
          type: 'pageerror',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      });

      // Network 실패 수집
      page.on('requestfailed', request => {
        pageErrors.push({
          page: `Prediction - ${pageInfo.name}`,
          type: 'network',
          message: `Failed to load: ${request.url()} - ${request.failure()?.errorText}`,
          url: request.url(),
          timestamp: new Date().toISOString(),
        });
      });

      try {
        await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 30000 });

        if (pageInfo.action) {
          await pageInfo.action(page);
        }

        await page.waitForTimeout(3000);
      } catch (error) {
        pageErrors.push({
          page: `Prediction - ${pageInfo.name}`,
          type: 'navigation-error',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }

      errors.push(...pageErrors);

      if (pageErrors.length > 0) {
        console.log(`\n=== ${pageInfo.name} - Found ${pageErrors.length} errors ===`);
        pageErrors.forEach(err => {
          console.log(`[${err.type}] ${err.message}`);
        });
      }
    });
  }
});

test.describe('Console Error Collection - Training Frontend', () => {
  for (const pageInfo of trainingPages) {
    test(`Collect errors from: ${pageInfo.name}`, async ({ page }) => {
      const pageErrors: ConsoleError[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          pageErrors.push({
            page: `Training - ${pageInfo.name}`,
            type: msg.type(),
            message: msg.text(),
            timestamp: new Date().toISOString(),
          });
        }
      });

      page.on('pageerror', error => {
        pageErrors.push({
          page: `Training - ${pageInfo.name}`,
          type: 'pageerror',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      });

      page.on('requestfailed', request => {
        pageErrors.push({
          page: `Training - ${pageInfo.name}`,
          type: 'network',
          message: `Failed to load: ${request.url()} - ${request.failure()?.errorText}`,
          url: request.url(),
          timestamp: new Date().toISOString(),
        });
      });

      try {
        await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 30000 });

        if (pageInfo.action) {
          await pageInfo.action(page);
        }

        await page.waitForTimeout(3000);
      } catch (error) {
        pageErrors.push({
          page: `Training - ${pageInfo.name}`,
          type: 'navigation-error',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }

      errors.push(...pageErrors);

      if (pageErrors.length > 0) {
        console.log(`\n=== ${pageInfo.name} - Found ${pageErrors.length} errors ===`);
        pageErrors.forEach(err => {
          console.log(`[${err.type}] ${err.message}`);
        });
      }
    });
  }
});

test.afterAll(async () => {
  // 에러 보고서 저장
  const reportPath = path.join(__dirname, '..', 'console-errors-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(errors, null, 2));

  console.log(`\n\n=== TOTAL ERRORS COLLECTED: ${errors.length} ===`);
  console.log(`Report saved to: ${reportPath}`);

  // 에러 요약 출력
  const errorsByPage = errors.reduce((acc, err) => {
    acc[err.page] = (acc[err.page] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n=== Error Summary by Page ===');
  Object.entries(errorsByPage).forEach(([page, count]) => {
    console.log(`${page}: ${count} errors`);
  });
});
