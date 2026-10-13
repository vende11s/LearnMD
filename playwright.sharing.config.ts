import { defineConfig, devices } from '@playwright/test';

// Exercise sharing with a dedicated local app. API responses are controlled by
// each test; the real Worker has separate storage, quota and expiration tests.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/sharing.spec.ts',
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5183',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'sharing-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'sharing-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SHARE_API_URL: 'http://127.0.0.1:8787',
      VITE_SHARE_DEV_BYPASS: 'true',
      VITE_TURNSTILE_SITE_KEY: '',
    },
  },
});
