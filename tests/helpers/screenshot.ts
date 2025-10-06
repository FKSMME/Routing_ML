import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 스크린샷 저장 디렉토리 생성
 */
export function ensureScreenshotDir(baseDir = '/tmp/screenshots') {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * 타임스탬프가 포함된 파일명 생성
 */
export function getTimestampedFilename(prefix: string, extension = 'png'): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .slice(0, 19);
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * 페이지 전체 스크린샷 캡처
 */
export async function captureFullPage(
  page: Page,
  filename: string,
  dir = '/tmp/screenshots'
): Promise<string> {
  ensureScreenshotDir(dir);
  const filepath = path.join(dir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

/**
 * 특정 요소 스크린샷 캡처
 */
export async function captureElement(
  page: Page,
  selector: string,
  filename: string,
  dir = '/tmp/screenshots'
): Promise<string | null> {
  ensureScreenshotDir(dir);
  const element = page.locator(selector).first();
  const isVisible = await element.isVisible().catch(() => false);

  if (!isVisible) {
    console.log(`⚠️  Element not visible: ${selector}`);
    return null;
  }

  const filepath = path.join(dir, filename);
  await element.screenshot({ path: filepath });
  return filepath;
}

/**
 * 여러 영역을 캡처하는 헬퍼
 */
export async function captureMultipleAreas(
  page: Page,
  areas: Array<{ selector: string; name: string }>,
  prefix: string,
  dir = '/tmp/screenshots'
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  for (const area of areas) {
    const filename = getTimestampedFilename(`${prefix}_${area.name}`);
    results[area.name] = await captureElement(page, area.selector, filename, dir);
  }

  return results;
}

/**
 * 비교를 위한 Before/After 스크린샷 캡처
 */
export interface BeforeAfterResult {
  before: string;
  after: string;
  diff?: string;
}

export async function captureBeforeAfter(
  page: Page,
  action: () => Promise<void>,
  prefix: string,
  dir = '/tmp/screenshots'
): Promise<BeforeAfterResult> {
  ensureScreenshotDir(dir);

  const beforeFile = getTimestampedFilename(`${prefix}_before`);
  const afterFile = getTimestampedFilename(`${prefix}_after`);

  const before = await captureFullPage(page, beforeFile, dir);
  await action();
  await page.waitForTimeout(500); // 애니메이션 대기
  const after = await captureFullPage(page, afterFile, dir);

  return { before, after };
}
