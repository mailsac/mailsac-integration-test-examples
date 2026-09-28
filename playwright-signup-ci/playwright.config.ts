import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.PORT || 3000);

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.APP_URL || `http://localhost:${PORT}` },
  // Starts the example app. In your project, point baseURL at your own app or staging URL
  // and remove webServer if the app is already running.
  webServer: process.env.APP_URL
    ? undefined
    : { command: 'node app/server.js', url: `http://localhost:${PORT}`, reuseExistingServer: !process.env.CI },
});
