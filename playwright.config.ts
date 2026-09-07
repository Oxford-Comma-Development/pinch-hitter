import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 2,
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4200/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'phone-portrait',
      use: {
        hasTouch: true,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'phone-landscape',
      use: {
        hasTouch: true,
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        hasTouch: true,
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'tablet-landscape',
      use: { viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4200/',
    reuseExistingServer: !process.env['CI'],
    timeout: 120 * 1000,
  },
});
