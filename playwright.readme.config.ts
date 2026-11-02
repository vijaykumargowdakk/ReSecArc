import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Retakes the README screenshots (e2e/readme-images.ts) against the production build: npm run readme:images
export default defineConfig({
  ...base,
  testMatch: /readme-images\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'readme', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
});
