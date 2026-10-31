import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  globalTimeout: 10 * 60 * 1000,
  expect: { timeout: 12000 },
  globalSetup: './tests/browser/global-setup.ts',
  reporter: process.env.CI ? [['github'], ['line']] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    browserName: 'chromium',
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000
  },
  outputDir: 'test-results/browser'
});
