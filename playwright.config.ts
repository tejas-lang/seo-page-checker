import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end test configuration.
 *
 * These tests drive a real browser against a real build, so they cover the
 * things unit tests cannot: that the form submits, that the streaming progress
 * arrives, that a report renders, and that the pages are keyboard-navigable.
 *
 * BEFORE THE FIRST RUN, install the browser binaries (about 100 MB, once):
 *
 *     npx playwright install chromium
 *
 * Then:
 *
 *     npm run test:e2e
 *
 * `webServer` builds and starts the app automatically, so there is no need to
 * have `npm run dev` running in another terminal.
 */

const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // A mobile viewport, because the audit report has to work at 375px.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    // The build runs here rather than being assumed, so the tests can never
    // pass against a stale .next directory. A cold production build takes a
    // few minutes on a modest machine, hence the generous timeout — it is a
    // budget, not a delay, and a warm build starts in seconds.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 420_000,
    stdout: "pipe",
    env: {
      NEXT_PUBLIC_APP_URL: baseURL,
      APP_URL: baseURL,
      // The suite runs more audits than a real person would in an hour, and
      // they all arrive from one address. Rate limiting itself is covered by
      // unit tests in tests/unit/rate-limit.test.ts; here it would only make
      // later tests fail for the wrong reason.
      RATE_LIMIT_MAX: "1000",
    },
  },
});
