#!/usr/bin/env node
/**
 * Playwright 검증 템플릿
 *
 * 사용법:
 *   node scripts/playwright-verify-template.js
 *
 * 또는 복사해서 수정:
 *   cp scripts/playwright-verify-template.js /tmp/verify-custom.js
 *   # /tmp/verify-custom.js 수정 후
 *   NODE_PATH=/workspaces/Routing_ML_4/node_modules node /tmp/verify-custom.js
 */

const { chromium } = require('playwright');

// ============================================
// 설정
// ============================================
const CONFIG = {
  baseUrl: 'http://localhost:5173',
  username: 'admin',
  password: 'admin123',
  timeout: 20000,
  screenshotDir: '/tmp',
};

const VIEWPORTS = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 667 },
];

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 로그인 수행
 */
async function login(page) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'load', timeout: CONFIG.timeout });
  await page.fill('input[type="text"]', CONFIG.username);
  await page.fill('input[type="password"]', CONFIG.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

/**
 * 계산된 스타일 가져오기
 */
async function getComputedStyles(page, selector, properties = []) {
  const element = await page.locator(selector);
  const count = await element.count();

  if (count === 0) {
    return { error: 'Element not found', selector };
  }

  return await element.evaluate((el, props) => {
    const cs = window.getComputedStyle(el);
    const result = {};

    if (props.length === 0) {
      // 기본 속성들
      result.maxWidth = cs.maxWidth;
      result.margin = cs.margin;
      result.padding = cs.padding;
      result.display = cs.display;
      result.width = cs.width;
      result.height = cs.height;
    } else {
      props.forEach(prop => {
        result[prop] = cs[prop];
      });
    }

    return result;
  }, properties);
}

/**
 * 요소 크기/위치 확인
 */
async function getElementBounds(page, selector) {
  const element = await page.locator(selector);
  const count = await element.count();

  if (count === 0) {
    return { error: 'Element not found', selector };
  }

  const bbox = await element.boundingBox();
  return bbox || { error: 'Element not visible' };
}

/**
 * 두 요소의 너비 차이 계산
 */
async function compareWidths(page, selector1, selector2) {
  const bbox1 = await getElementBounds(page, selector1);
  const bbox2 = await getElementBounds(page, selector2);

  if (bbox1.error || bbox2.error) {
    return { error: 'Cannot compare', bbox1, bbox2 };
  }

  const diff = Math.abs(bbox1.width - bbox2.width);
  return {
    element1: { selector: selector1, width: Math.round(bbox1.width) },
    element2: { selector: selector2, width: Math.round(bbox2.width) },
    difference: Math.round(diff),
    aligned: diff < 50, // 50px 이내면 정렬됨
  };
}

/**
 * 스크린샷 저장
 */
async function takeScreenshot(page, filename) {
  const path = `${CONFIG.screenshotDir}/${filename}`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

// ============================================
// 메인 검증 로직 (여기를 수정하세요)
// ============================================

async function verifyChanges(page) {
  console.log('\n=== 검증 시작 ===\n');

  // 예제 1: 스타일 확인
  console.log('1. 스타일 검증:');
  const styles = await getComputedStyles(page, '.workspace-transition');
  console.log('   Selector: .workspace-transition');
  console.log('   Computed Styles:', styles);

  // 예제 2: 요소 크기 확인
  console.log('\n2. 레이아웃 검증:');
  const bounds = await getElementBounds(page, '.workspace-transition');
  console.log('   Workspace bounds:', bounds);

  // 예제 3: 정렬 확인
  console.log('\n3. 정렬 검증:');
  const alignment = await compareWidths(
    page,
    '.header-content',
    '.workspace-transition'
  );
  console.log('   Alignment check:', alignment);

  // 예제 4: 특정 메뉴 클릭 후 검증
  console.log('\n4. 메뉴 네비게이션 검증:');
  try {
    await page.click('text=라우팅 조합');
    await page.waitForTimeout(1000);

    const menuActive = await page.locator('.workspace-transition').count();
    console.log('   Menu navigation: ', menuActive > 0 ? '✓ Success' : '✗ Failed');
  } catch (error) {
    console.log('   Menu navigation: ✗ Error:', error.message);
  }

  // 스크린샷
  console.log('\n5. 스크린샷 저장:');
  const screenshotPath = await takeScreenshot(page, 'verification-result.png');
  console.log('   Screenshot:', screenshotPath);

  console.log('\n=== 검증 완료 ===\n');
}

// ============================================
// 단일 뷰포트 테스트
// ============================================

async function runSingleViewport() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await login(page);
    await verifyChanges(page);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

// ============================================
// 다중 뷰포트 테스트
// ============================================

async function runMultipleViewports() {
  const browser = await chromium.launch({ headless: true });

  for (const viewport of VIEWPORTS) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    console.log('='.repeat(50));

    const page = await browser.newPage({ viewport });

    try {
      await login(page);
      await verifyChanges(page);

      // 뷰포트별 스크린샷
      const filename = `verification-${viewport.name.toLowerCase()}.png`;
      await takeScreenshot(page, filename);

    } catch (error) {
      console.error(`Error on ${viewport.name}:`, error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\n✓ All viewports tested\n');
}

// ============================================
// 실행
// ============================================

(async () => {
  // 기본: 단일 뷰포트 (빠름)
  await runSingleViewport();

  // 반응형 테스트가 필요하면 주석 해제
  // await runMultipleViewports();
})();
