import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173/idera5s-energy-lab/';
const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined);

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }], ['html', { open: 'never' }]],
  use: {
    baseURL, browserName: 'chromium', channel, headless: true,
    screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure',
    actionTimeout: 15000,
    // Do not disable the GPU: local Edge exercises the real WebGL device.
  },
  projects: [
    { name: 'desktop', testMatch: /(?:ui|performance)\.spec\.ts/, use: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 } },
    { name: 'mobile-touch', testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
