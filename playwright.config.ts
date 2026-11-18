import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: 'node tests/fixtures/server.mjs', url: 'http://127.0.0.1:54329/health', reuseExistingServer: false },
    {
      command: 'node tests/fixtures/run-next.mjs',
      url: 'http://localhost:3100', reuseExistingServer: false, timeout: 240000,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-key', NEXT_PUBLIC_APP_URL: 'http://localhost:3100', NEXT_PUBLIC_USE_MOCK: 'false', NEXT_DIST_DIR: '.next-e2e', NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
