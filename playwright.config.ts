import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: 'node tests/fixtures/server.mjs', url: 'http://127.0.0.1:54329/health', reuseExistingServer: false },
    {
      command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 120000,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-key', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100', NEXT_PUBLIC_USE_MOCK: 'false', NEXT_DIST_DIR: '.next-e2e', NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
