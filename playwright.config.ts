import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

// End-to-end tests run against the production build, as served by `vite preview`.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Each test sees the files the server sends; e2e/offline.spec.ts turns the service worker on.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', testIgnore: /(tablet|perf)\.spec/, use: DESKTOP },
    // A landscape tablet with a touch screen, so the coarse-pointer styles and touch handling apply.
    { name: 'tablet', testMatch: /tablet\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true } },
    // The 1,000-device benchmark measures time, so it starts only once the other projects have
    // finished and has the CPU to itself; in parallel with them it can time out on a normal PC.
    { name: 'perf', testMatch: /perf\.spec/, dependencies: ['chromium', 'tablet'], use: DESKTOP },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
