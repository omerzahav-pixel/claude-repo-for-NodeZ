import { defineConfig, devices } from "@playwright/test";

// NodeZ Playwright config.
// Goal: test the app under iPad emulation as our primary target.
// We use two engines: WebKit (models iPad Safari, the real device) and
// Chromium (models iPad Chrome, which also uses WebKit on iOS but this
// gives us a cross-check with a DOM we can inspect more easily).

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,

  use: {
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "ipad-safari",
      use: {
        ...devices["iPad Pro 11 landscape"],
      },
    },
    {
      name: "ipad-chrome",
      use: {
        ...devices["iPad Pro 11 landscape"],
        browserName: "chromium",
      },
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
