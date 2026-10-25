import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { largeProject } from './fixtures';
import { openApp } from './helpers';

// Budgets are generous so shared CI runners do not flake; they catch order-of-magnitude regressions.
const OPEN_MS = 6000;
const SWITCH_MS = 3000;
const EDIT_MS = 1500;

test('stays responsive with 1,000 devices on 5 sites', async ({ page }) => {
  await openApp(page);
  const timings: Record<string, number> = {};

  let start = Date.now();
  await page.locator('input[type=file][accept*="json"]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(largeProject()) });
  await expect(page.locator('.site-tab__button')).toHaveCount(5);
  await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
  timings.open = Date.now() - start;

  start = Date.now();
  await page.locator('.site-tab__button').nth(3).click();
  await expect(page.locator('.react-flow__node-device', { hasText: 'Device 1' }).first()).toBeVisible();
  timings.switchSite = Date.now() - start;

  start = Date.now();
  await page.locator('.react-flow__node-device').first().click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Renamed device');
  await expect(page.locator('.react-flow__node-device', { hasText: 'Renamed device' })).toBeVisible();
  timings.edit = Date.now() - start;

  // Only visible nodes are drawn on a site this size; an export must still contain all 200.
  const download = page.waitForEvent('download');
  await page.locator('summary', { hasText: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Diagram as SVG' }).click();
  const svg = await readFile(await (await download).path(), 'utf8');
  expect(svg.match(/react-flow__node-device /g)?.length).toBe(200);

  test.info().annotations.push({ type: 'timings (ms)', description: JSON.stringify(timings) });
  console.log('perf timings (ms)', timings);
  expect(timings.open).toBeLessThan(OPEN_MS);
  expect(timings.switchSite).toBeLessThan(SWITCH_MS);
  expect(timings.edit).toBeLessThan(EDIT_MS);
});
