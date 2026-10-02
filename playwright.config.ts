import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    browserName: 'chromium',
    launchOptions: { channel: 'chromium' },
    trace: 'retain-on-failure',
  },
  globalSetup: './tests/admin/global-setup.ts',
});
