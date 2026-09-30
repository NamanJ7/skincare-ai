import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["iPhone 13"],
    browserName: "chromium",
    baseURL: "http://127.0.0.1:8104",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-mobile-preview.mjs",
    url: "http://127.0.0.1:8104/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
