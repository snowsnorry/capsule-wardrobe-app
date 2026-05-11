import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = Number(process.env.E2E_PORT || 5310);
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
const AUTH_STATE = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `PORT=${E2E_PORT} CLIENT_ORIGIN=${E2E_BASE_URL} E2E_BASE_URL=${E2E_BASE_URL} npm --workspace server run dev:e2e`,
    url: `${E2E_BASE_URL}/health`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /unauthenticated/],
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STATE,
      },
    },
    {
      name: "chromium-unauthenticated",
      testMatch: /.*unauthenticated.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
