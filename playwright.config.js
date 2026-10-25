import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:5186',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { 
        ...devices['iPhone 12'],
        browserName: 'chromium',
        // Override to ensure we trigger touch device detection
        hasTouch: true,
      },
    },
  ],

  webServer: [
    { command: 'npx tsx tests/backend/server.ts', url: 'http://127.0.0.1:3186/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5186 --strictPort', url: 'http://127.0.0.1:5186',
      env: { BINGO_DEV_API_TARGET: 'http://127.0.0.1:3186' }, reuseExistingServer: false, timeout: 30000 }
  ],
});
