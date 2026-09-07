import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
const base =
  readFileSync('dist/browser/index.html', 'utf8').match(/<base href="([^"]+)"/)?.[1] || '/';
export default defineConfig({
  outputDir: 'test-results-pwa',
  testDir: './e2e-pwa',
  timeout: 60000,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4300' + base,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-production.mjs',
    url: 'http://127.0.0.1:4300' + base,
    reuseExistingServer: !process.env['CI'],
  },
});
