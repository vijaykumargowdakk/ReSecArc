// Evidence run only: the same as playwright.config.ts, but on port 4174 with a fresh server,
// because an older preview server was already holding port 4173 on the test machine.
// Run from the repository root: npx playwright test -c testresults/playwright.evidence.config.ts
import base from '../playwright.config';

const PORT = 4174;
export default {
  ...base,
  // Paths in a config resolve from the config's own folder.
  testDir: '../e2e',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: { ...base.webServer, command: `npm run build && npx vite preview --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, cwd: '..', reuseExistingServer: false },
};
