import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'node ../backend/integration/e2eRuntimeServer.cjs',
      url: 'http://127.0.0.1:8001/api/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        VITE_API_URL: 'http://127.0.0.1:8001/api',
        VITE_SOCKET_URL: 'http://127.0.0.1:8001',
      },
    },
  ],
})
