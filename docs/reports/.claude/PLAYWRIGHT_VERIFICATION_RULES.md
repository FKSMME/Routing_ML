# Playwright 자동 검증 규칙
**작성일:** 2025-10-07
**프로젝트:** Routing ML System

---

## 📜 규칙 요약

> **"모든 UI 변경사항은 Playwright로 직접 디버깅하고 보고한다"**

---

## 🎯 적용 대상

### ✅ 필수 검증 대상
1. **CSS/스타일 변경**
   - index.css 수정
   - 컴포넌트 스타일 변경
   - 레이아웃 조정

2. **UI 컴포넌트 변경**
   - 새 컴포넌트 추가
   - 기존 컴포넌트 수정
   - 삭제/이동

3. **반응형 디자인**
   - 미디어 쿼리 추가
   - 브레이크포인트 변경
   - 뷰포트별 스타일

4. **기능 추가/수정**
   - 버튼, 폼, 입력 요소
   - 네비게이션 변경
   - 인터랙션 로직

---

## 🔧 검증 절차

### 1단계: 변경 작업 수행
```bash
# 예: CSS 파일 수정
Edit /frontend-prediction/src/index.css
```

### 2단계: Playwright 스크립트 작성
```javascript
// /tmp/verify-[기능명].js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. 페이지 로드
  await page.goto('http://localhost:5173', { waitUntil: 'load' });

  // 2. 로그인 (필요시)
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 3. 변경사항 검증
  const element = await page.locator('.target-class');
  const style = await element.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      maxWidth: computed.maxWidth,
      margin: computed.margin,
      padding: computed.padding,
    };
  });

  console.log('검증 결과:', style);

  // 4. 스크린샷
  await page.screenshot({ path: '/tmp/verify-result.png' });
  console.log('스크린샷: /tmp/verify-result.png');

  await browser.close();
})();
```

### 3단계: Playwright 실행
```bash
NODE_PATH=/workspaces/Routing_ML_4/node_modules timeout 60s node /tmp/verify-[기능명].js
```

### 4단계: 결과 보고
```markdown
**Playwright 검증 결과:**
- ✅ 스타일 적용: maxWidth = "1400px"
- ✅ 레이아웃: margin = "0px auto"
- ✅ 여백: padding = "0px 24px"
- 📸 스크린샷: /tmp/verify-result.png
```

---

## 📋 필수 검증 항목

### CSS/스타일 변경 시
- [ ] `getComputedStyle()` 결과 확인
- [ ] 예상 값과 실제 값 비교
- [ ] 모든 뷰포트에서 테스트 (데스크탑, 태블릿, 모바일)
- [ ] 스크린샷 캡처

### 컴포넌트 변경 시
- [ ] 요소 존재 확인 (`locator().count() > 0`)
- [ ] `boundingBox()` 크기/위치 확인
- [ ] 인터랙션 테스트 (클릭, 입력 등)
- [ ] 스크린샷 캡처

### 반응형 디자인 시
- [ ] 1920px (데스크탑)
- [ ] 1366px (노트북)
- [ ] 768px (태블릿)
- [ ] 375px (모바일)
- [ ] 각 뷰포트별 스크린샷

---

## 🚀 빠른 시작 템플릿

### 기본 검증 스크립트
```bash
cat > /tmp/verify-quick.js << 'EOF'
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 20000 });
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 여기에 검증 로직 추가
  const element = await page.locator('.workspace-transition');
  const bbox = await element.boundingBox();
  console.log('Width:', bbox ? bbox.width : 'not found');

  await page.screenshot({ path: '/tmp/quick-verify.png' });
  await browser.close();
})();
EOF

NODE_PATH=/workspaces/Routing_ML_4/node_modules node /tmp/verify-quick.js
```

### 다중 뷰포트 테스트
```javascript
const viewports = [
  { name: '데스크탑', width: 1920, height: 1080 },
  { name: '노트북', width: 1366, height: 768 },
  { name: '태블릿', width: 768, height: 1024 },
  { name: '모바일', width: 375, height: 667 },
];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: vp });
  // 검증 로직...
  await page.screenshot({ path: `/tmp/${vp.name}.png` });
  await page.close();
}
```

---

## 📊 보고 형식

### 표준 보고 형식
```markdown
## Playwright 검증 보고서

**검증 일시:** 2025-10-07 14:50 UTC
**대상:** [변경 내용]
**포트:** 5173

### 검증 항목
1. ✅ 스타일 적용 확인
   - maxWidth: "1400px" (예상: 1400px)
   - margin: "0px auto" (예상: 0px auto)

2. ✅ 레이아웃 정렬
   - Workspace width: 1400px
   - Header width: 1400px
   - Difference: 0px ✓

3. ✅ 반응형 테스트
   - 데스크탑: ✓
   - 노트북: ✓
   - 태블릿: ✓
   - 모바일: ✓

### 스크린샷
- 📸 /tmp/desktop-1920.png
- 📸 /tmp/laptop-1366.png
- 📸 /tmp/tablet-768.png
- 📸 /tmp/mobile-375.png

### 결론
✅ 모든 검증 항목 통과
```

---

## 🛠️ 유틸리티 함수

### 스타일 검증 헬퍼
```javascript
async function verifyStyles(page, selector, expectedStyles) {
  const element = await page.locator(selector);
  const actual = await element.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return {
      maxWidth: cs.maxWidth,
      margin: cs.margin,
      padding: cs.padding,
      display: cs.display,
    };
  });

  console.log('Expected:', expectedStyles);
  console.log('Actual:', actual);

  return Object.keys(expectedStyles).every(
    key => actual[key] === expectedStyles[key]
  );
}
```

### 레이아웃 정렬 검증
```javascript
async function verifyAlignment(page, selector1, selector2) {
  const el1 = await page.locator(selector1).boundingBox();
  const el2 = await page.locator(selector2).boundingBox();

  if (!el1 || !el2) return false;

  const diff = Math.abs(el1.width - el2.width);
  console.log(`Width difference: ${diff}px`);

  return diff < 50; // 50px 이내 허용
}
```

---

## 📝 체크리스트

작업 완료 전 확인사항:

- [ ] Playwright 스크립트 작성 완료
- [ ] 모든 검증 항목 테스트 완료
- [ ] 스크린샷 캡처 완료
- [ ] 검증 결과를 작업 로그에 기록
- [ ] 예상 값과 실제 값 비교 완료
- [ ] 다중 뷰포트 테스트 완료 (UI 변경 시)

---

## 🔗 관련 리소스

- [Playwright 공식 문서](https://playwright.dev/)
- [프로젝트 작업 로그](../WORK_LOG_2025-10-07.md)
- [기존 검증 스크립트](../../tmp/)

---

## 💡 팁

1. **스크립트 재사용**
   ```bash
   # 자주 쓰는 스크립트는 저장
   cp /tmp/verify-layout.js /workspaces/Routing_ML_4/scripts/
   ```

2. **빠른 디버깅**
   ```javascript
   // headless: false 로 브라우저 볼 수 있음
   const browser = await chromium.launch({ headless: false });
   ```

3. **타임아웃 조정**
   ```javascript
   // 느린 페이지는 타임아웃 증가
   await page.goto(url, { waitUntil: 'load', timeout: 30000 });
   ```

---

**마지막 업데이트:** 2025-10-07 14:55 UTC
**작성자:** Claude Code Assistant
