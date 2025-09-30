import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/frontend",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    cwd: "frontend",
    stdout: "pipe",
    stderr: "pipe",
  },
});
