# Frontend Testing Guide

**Project**: Routing ML System
**Date**: 2025-10-09
**Status**: ✅ Testing Infrastructure Complete

---

## 📊 Testing Stack Overview

### Vitest (Unit & Component Tests)
- **Version**: 1.2.0
- **Test Runner**: Vitest (Vite-native, faster than Jest)
- **Testing Library**: @testing-library/react 14.2.1
- **Environment**: jsdom (browser simulation)
- **Coverage**: Enabled with lcov reporter

### Playwright (E2E Tests)
- **Version**: 1.56.0
- **Browser**: Chromium (Desktop Chrome simulation)
- **Viewport**: 1920x1080
- **Timeout**: 120s per test
- **Retry**: 2 retries in CI, 0 locally

---

## 🗂️ Test File Locations

### Frontend Prediction (Port 5173)

**Component Tests (Vitest)**:
```
frontend-prediction/src/components/__tests__/
├── MainNavigation.test.tsx                    # Navigation component
├── master-data/__tests__/MasterDataMatrix.test.tsx
├── routing/__tests__/ReferenceMatrixPanel.test.tsx
└── workspaces/__tests__/
    ├── DataOutputWorkspace.test.tsx
    └── OptionsWorkspace.test.tsx
```

**E2E Tests (Playwright)**:
```
frontend-prediction/tests/e2e/
├── ballpit.spec.ts                            # Visual effects validation
├── login-flow.spec.ts                         # Authentication flow
├── routing-groups.spec.ts                     # Routing management (25KB)
├── routing-offline-sync.spec.ts               # Offline mode
├── routingDragAndDrop.spec.ts                 # Drag-and-drop UI
└── trainingStatusWorkspace.spec.tsx           # Training workspace
```

**Evidence/Integration Tests**:
```
frontend-prediction/tests/evidence/
├── erp_interface_capture.spec.tsx             # ERP interface screenshots
├── erp_interface_off_capture.spec.tsx
└── indexeddb_autosave_capture.test.ts         # IndexedDB persistence
```

### Frontend Training (Port 5174)

**Test Directory**: `frontend-training/tests/`
- Similar structure to prediction
- Separate Vitest & Playwright configuration

---

## 🚀 Running Tests

### Vitest (Unit & Component Tests)

#### Frontend Prediction
```bash
cd frontend-prediction

# Run all tests (watch mode)
npm test

# Run once (CI mode)
npm test -- --run

# Run with coverage
npm test -- --run --coverage

# Run specific test file
npm test -- MainNavigation.test.tsx

# Update snapshots
npm test -- -u
```

#### Frontend Training
```bash
cd frontend-training

# Same commands as prediction
npm test
npm test -- --run
npm test -- --coverage
```

---

### Playwright (E2E Tests)

#### Prerequisites
```bash
# Install Playwright browsers (first time only)
cd frontend-prediction
npx playwright install chromium
```

#### Frontend Prediction
```bash
cd frontend-prediction

# Run all E2E tests (with dev server auto-start)
npm run test:e2e

# Skip dev server (if already running on 5173)
PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e

# Run specific test
npm run test:e2e -- login-flow.spec.ts

# Run with UI mode (interactive)
npm run test:e2e:ui

# Debug mode (step-by-step)
npm run test:e2e:debug

# View HTML report
npm run test:e2e:report
```

#### Frontend Training
```bash
cd frontend-training

# Run all E2E tests
npm run test:playwright

# With environment variable
PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:playwright
```

---

## 📝 Test Configuration Files

### Vitest Configuration

**File**: `frontend-prediction/vite.config.ts`
```typescript
export default defineConfig({
  // ... other vite config ...
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "../tests/frontend/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
```

**Setup File**: `frontend-prediction/tests/setup/vitest.setup.ts`
```typescript
import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

// Polyfills for Node environment
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as unknown as Crypto;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}
```

---

### Playwright Configuration

**File**: `frontend-prediction/playwright.config.ts`
```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
```

---

## 🧪 Writing New Tests

### Vitest Component Test Example

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyComponent } from "@components/MyComponent";

describe("MyComponent", () => {
  it("renders correctly with props", () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("handles user interactions", async () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("matches snapshot", () => {
    const { container } = render(<MyComponent title="Snapshot Test" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

### Playwright E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should perform user workflow', async ({ page }) => {
    // Navigate to page
    await page.goto('/');

    // Wait for element to be visible
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();

    // Interact with UI
    await page.click('button:has-text("로그인")');
    await page.fill('input[name="username"]', 'test-user');
    await page.fill('input[name="password"]', 'test-pass');
    await page.click('button[type="submit"]');

    // Verify result
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.welcome-message')).toContainText('환영합니다');

    // Take screenshot for evidence
    await page.screenshot({ path: 'evidence/login-success.png' });
  });
});
```

---

## 📦 Test Dependencies

### Package.json Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.2.1",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^24.0.0",
    "vitest": "^1.2.0"
  }
}
```

**Install all test dependencies**:
```bash
cd frontend-prediction
npm install

cd ../frontend-training
npm install
```

---

## 🔍 Troubleshooting

### Vitest Issues

**Problem**: Tests hang or timeout
```bash
# Kill all vite/vitest processes
pkill -f "vite|vitest"

# Clear vite cache
rm -rf node_modules/.vite

# Re-run tests
npm test -- --run
```

**Problem**: Module resolution errors
```bash
# Check tsconfig paths
cat tsconfig.json

# Ensure vite-tsconfig-paths plugin is installed
npm install -D vite-tsconfig-paths
```

**Problem**: jsdom errors
```bash
# Ensure jsdom is installed
npm install -D jsdom@24.0.0

# Check vitest.setup.ts for polyfills
cat tests/setup/vitest.setup.ts
```

---

### Playwright Issues

**Problem**: Browsers not installed
```bash
npx playwright install chromium
```

**Problem**: Dev server not starting
```bash
# Check if port 5173 is already in use
lsof -ti:5173 | xargs kill -9

# Or skip webServer in Playwright
PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e
```

**Problem**: Timeout errors
```bash
# Increase timeout in playwright.config.ts
timeout: 180_000  # 3 minutes

# Or run with debug mode
npm run test:e2e:debug
```

**Problem**: Authentication required
```bash
# Set backend URL
export BACKEND_URL=http://localhost:8000

# Or modify test to include login
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button[type="submit"]');
});
```

---

## 🎯 CI/CD Integration

### GitHub Actions Example

```yaml
name: Frontend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend-prediction
          npm ci

      - name: Run Vitest
        run: |
          cd frontend-prediction
          npm test -- --run --coverage

      - name: Install Playwright Browsers
        run: |
          cd frontend-prediction
          npx playwright install chromium

      - name: Run Playwright Tests
        run: |
          cd frontend-prediction
          npm run test:e2e
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            frontend-prediction/coverage/
            frontend-prediction/playwright-report/
```

---

## 📊 Test Coverage Goals

### Current Status

| Project | Unit Tests | E2E Tests | Status |
|---------|-----------|-----------|--------|
| frontend-prediction | 5 test files | 7 E2E specs | ✅ Configured |
| frontend-training | TBD | TBD | ✅ Configured |

### Coverage Targets

- **Unit Tests**: 70%+ statement coverage
- **Component Tests**: All major components tested
- **E2E Tests**: Critical user flows covered
- **Integration Tests**: API interactions validated

---

## 🔗 Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [React Testing Patterns](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## ✅ Test Checklist

### Before Committing Code

- [ ] Run `npm test -- --run` (Vitest)
- [ ] Run `npm run test:e2e` (Playwright) for critical changes
- [ ] Update snapshots if UI changed: `npm test -- -u`
- [ ] Check coverage: `npm test -- --coverage`
- [ ] Fix all failing tests
- [ ] Add new tests for new features

### Before Deploying

- [ ] All Vitest tests pass
- [ ] All Playwright E2E tests pass
- [ ] Coverage meets 70% threshold
- [ ] No console errors in test output
- [ ] Manual smoke test on staging environment

---

## 🎓 Best Practices

### Component Testing

1. **Test User Behavior, Not Implementation**
   - ✅ `expect(screen.getByText("Login")).toBeInTheDocument()`
   - ❌ `expect(component.state.isLoggedIn).toBe(false)`

2. **Use Accessible Queries**
   - ✅ `screen.getByRole("button", { name: "Submit" })`
   - ❌ `document.querySelector(".submit-btn")`

3. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` for common setup
   - Avoid global state

4. **Mock External Dependencies**
   ```typescript
   vi.mock('axios', () => ({
     default: {
       get: vi.fn(() => Promise.resolve({ data: mockData }))
     }
   }));
   ```

### E2E Testing

1. **Use Data-Testid for Stable Selectors**
   ```tsx
   <button data-testid="submit-btn">Submit</button>

   // Test
   await page.locator('[data-testid="submit-btn"]').click();
   ```

2. **Wait for Explicit Conditions**
   ```typescript
   await expect(page.locator('.result')).toBeVisible();
   await page.waitForURL('/dashboard');
   ```

3. **Take Screenshots for Evidence**
   ```typescript
   await page.screenshot({
     path: `evidence/${test.info().title}.png`,
     fullPage: true
   });
   ```

4. **Test Critical Paths Only**
   - Login/logout flow
   - Data creation/editing/deletion
   - Navigation between workspaces
   - Form validation
   - Error handling

---

**Status**: Phase 4.2 ✅ Complete, Phase 4.3 ✅ Complete
**Next Steps**: Run comprehensive test verification, then create work log
