#!/usr/bin/env node
/**
 * 수동 콘솔 에러 수집 스크립트
 * Playwright가 실패하므로 puppeteer로 대체
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const pages = [
  { name: 'Prediction Home', url: 'http://localhost:5173/' },
  { name: 'Training Home', url: 'http://localhost:5174/' },
];

async function checkPage(page, pageInfo) {
  const errors = [];

  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      errors.push({
        page: pageInfo.name,
        type: type,
        message: msg.text(),
        timestamp: new Date().toISOString()
      });
      console.log(`[${pageInfo.name}][${type}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    errors.push({
      page: pageInfo.name,
      type: 'pageerror',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.log(`[${pageInfo.name}][pageerror] ${error.message}`);
  });

  page.on('requestfailed', request => {
    errors.push({
      page: pageInfo.name,
      type: 'network',
      url: request.url(),
      failure: request.failure()?.errorText,
      timestamp: new Date().toISOString()
    });
    console.log(`[${pageInfo.name}][network] Failed: ${request.url()}`);
  });

  try {
    console.log(`\n=== Checking ${pageInfo.name} ===`);
    await page.goto(pageInfo.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error(`Failed to load ${pageInfo.name}:`, error.message);
    errors.push({
      page: pageInfo.name,
      type: 'navigation-error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  return errors;
}

(async () => {
  const allErrors = [];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    for (const pageInfo of pages) {
      const page = await browser.newPage();
      const errors = await checkPage(page, pageInfo);
      allErrors.push(...errors);
      await page.close();
    }

    const report = {
      totalErrors: allErrors.length,
      timestamp: new Date().toISOString(),
      errors: allErrors
    };

    fs.writeFileSync(
      '/workspaces/Routing_ML_4/manual-console-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log(`\n\n========================================`);
    console.log(`TOTAL ERRORS: ${allErrors.length}`);
    console.log(`========================================\n`);

    const byPage = {};
    allErrors.forEach(err => {
      byPage[err.page] = (byPage[err.page] || 0) + 1;
    });

    console.log('Errors by page:');
    Object.entries(byPage).forEach(([page, count]) => {
      console.log(`  ${page}: ${count}`);
    });

  } finally {
    await browser.close();
  }
})();
