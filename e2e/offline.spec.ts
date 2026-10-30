import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deviceCount, openApp } from './helpers';

// The other tests block service workers; these are about them. They run one after another, because
// one of them changes the service worker that the preview server sends.
test.use({ serviceWorkers: 'allow' });
test.describe.configure({ mode: 'default' });

const SW_FILE = fileURLToPath(new URL('../dist/sw.js', import.meta.url));

const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });

/** Opens the app and waits until its service worker has stored every file and controls the page. */
async function openStored(page: Page): Promise<void> {
  await openApp(page);
  await expect(toast(page, 'ReSecArc now works offline')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test('opens and edits with the network off', async ({ page, context }) => {
  await openStored(page);
  await context.setOffline(true);
  await expect(toast(page, 'You are offline')).toBeVisible();
  await expect(page.locator('[aria-live="polite"]').last()).toContainText('You are offline');

  const responses: { url: string; fromWorker: boolean }[] = [];
  page.on('response', (r) => responses.push({ url: r.url(), fromWorker: r.fromServiceWorker() }));
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(r.url()));

  await page.reload();
  await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
  await page.locator('.palette__item', { hasText: /^PLC$/ }).click();
  expect(await deviceCount(page)).toBe(20);

  // Views and dialogs that load on demand come from the stored copy too.
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await expect(page.getByRole('tab', { name: 'IP plan' })).toBeVisible();
  await page.getByRole('tab', { name: 'Outline' }).click();
  await expect(page.getByRole('tree')).toBeVisible();
  await page.getByRole('tab', { name: 'Diagram' }).click();
  await page.getByRole('button', { name: /^Security \d+ finding/ }).click();
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: /^IEC 62443 communication violation/ })).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(failed).toEqual([]);
  // Everything the page asked for was answered by the service worker from its cache, not the network.
  const appFiles = responses.filter((r) => new URL(r.url).origin === new URL(page.url()).origin);
  expect(appFiles.length).toBeGreaterThan(3);
  expect(appFiles.filter((r) => !r.fromWorker)).toEqual([]);
  const missing = await page.evaluate(
    async (urls) => (await Promise.all(urls.map(async (url) => ((await caches.match(url)) ? null : url)))).filter(Boolean),
    appFiles.map((r) => r.url.split('#')[0]),
  );
  expect(missing.filter((url) => !url?.endsWith('/'))).toEqual([]);

  // The edit is kept in this browser while offline.
  await expect(page.locator('.autosave')).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Restore' }).click();
  expect(await deviceCount(page)).toBe(20);
});

test('offers a new version and reopens the work after reloading', async ({ page }) => {
  await openStored(page);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await page.locator('.palette__item', { hasText: /^PLC$/ }).click();
  expect(await deviceCount(page)).toBe(20);
  // A second tab of the app, which the first will update.
  const other = await page.context().newPage();
  await other.goto('/');
  await other.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Stand in for a new deployment: the same files under a new version. The preview server reads
  // files on each request; Playwright's routing does not see the browser fetching a service worker.
  const original = readFileSync(SW_FILE, 'utf8');
  writeFileSync(SW_FILE, original.replace(/const VERSION = "(\w+)"/, 'const VERSION = "$1-next"'));
  try {
    await checkUpdate(page, other);
  } finally {
    writeFileSync(SW_FILE, original);
  }
});

async function checkUpdate(page: Page, other: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  const update = toast(page, 'A new version of ReSecArc is ready');
  await expect(update).toBeVisible();
  await expect(update).toContainText('Your work is kept.');
  const { violations } = await new AxeBuilder({ page }).include('.toasts').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await expect(toast(other, 'A new version of ReSecArc is ready')).toBeVisible();

  await Promise.all([page.waitForEvent('load'), update.getByRole('button', { name: 'Reload' }).click()]);
  // The other tab still runs the old code, so it offers the reload as well.
  await expect(toast(other, 'ReSecArc was updated in another tab')).toBeVisible();
  await expect(toast(other, 'A new version of ReSecArc is ready')).toHaveCount(0);
  await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
  // The work opens again without the restore question, under the new version.
  await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(0);
  expect(await deviceCount(page)).toBe(20);
  await expect(update).toHaveCount(0);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((name) => name.endsWith('-next'))).toBe(true);
}

test('meets the browser requirements for installing it as an app', async ({ page, context }) => {
  await openStored(page);
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  const manifest = await cdp.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
});

test('installs from the command palette when the browser offers it', async ({ page }) => {
  await openApp(page);
  // Browsers decide for themselves when to make the offer, so the test makes it.
  await page.evaluate(() => {
    const offer = Object.assign(new Event('beforeinstallprompt'), {
      prompt: () => {
        (window as unknown as { prompted: boolean }).prompted = true;
        return Promise.resolve();
      },
    });
    window.dispatchEvent(offer);
  });
  await page.keyboard.press('Control+Shift+P');
  await page.getByRole('combobox', { name: 'Command' }).fill('install');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
});
