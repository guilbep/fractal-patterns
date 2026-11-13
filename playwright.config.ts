import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:18494' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 18494 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:18494/',
    reuseExistingServer: false,
  },
});
