/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offline } from './scripts/offline-plugin';

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), offline()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
