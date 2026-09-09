import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'mobile-chromium', testMatch: /critical-mobile\.spec\.ts/, use: { viewport: { width: 375, height: 812 } } },
    { name: 'tablet-chromium', testMatch: /responsive-layout\.spec\.ts/, use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-chromium', testMatch: /responsive-layout\.spec\.ts/, use: { viewport: { width: 1080, height: 800 } } },
  ],
})
