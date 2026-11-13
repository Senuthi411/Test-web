import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke tests. They run against the Vite dev server in fixture mode, so no
 * backend is required and every screen shows the "Demo data" indicator.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    env: { VITE_DATA_SOURCE: 'fixtures' },
  },
})
