import { defineConfig, devices } from "./frontend/node_modules/@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

const webServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER
  ? undefined
  : {
      command: "npm run dev -- --host 0.0.0.0 --port 4173",
      cwd: "frontend",
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    };

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testMatch: ["frontend/**/*.spec.ts", "frontend/**/*.spec.tsx"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      testMatch: ["e2e/mobile/**/*.spec.ts"],
      use: {
        ...devices["Pixel 5"],
        hasTouch: true,
      },
    },
    {
      name: "mobile-safari",
      testMatch: ["e2e/mobile/**/*.spec.ts"],
      use: {
        ...devices["iPhone 12"],
        hasTouch: true,
      },
    },
  ],
  webServer,
});
