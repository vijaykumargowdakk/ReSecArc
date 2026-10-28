import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { clearSelection, deviceCount, deviceNode, loadTemplate, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

test('saves a project file and opens it again', async ({ page }) => {
  await loadTemplate(page, /Discrete manufacturing/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const file = await (await download).path();
  const saved = JSON.parse(await readFile(file, 'utf8'));
  expect(saved.schemaVersion).toBeGreaterThanOrEqual(3);
  expect(saved.devices).toHaveLength(18);

  await loadTemplate(page, /Building automation/);
  await page.locator('input[type=file][accept*="json"]').setInputFiles(file);
  await expect(page.locator('.brand__project')).toHaveText(saved.name);
  await expect.poll(() => deviceCount(page)).toBe(18);
});

test('rejects a broken file and keeps the current design', async ({ page }) => {
  await page.locator('input[type=file][accept*="json"]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion": 3') });
  await expect(page.getByRole('alert')).toContainText('Could not open broken.json');
  expect(await deviceCount(page)).toBe(19);
});

test('restores unsaved work after a reload', async ({ page }) => {
  await deviceNode(page, 'Filtration PLC').click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Renamed PLC');
  await expect(page.locator('.autosave')).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(deviceNode(page, 'Renamed PLC')).toBeVisible();
});

test('shares a design as a link that opens in another tab', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loadTemplate(page, /Gas pipeline/);
  await page.locator('summary', { hasText: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Share as a link…' }).click();
  const input = page.getByLabel('Share link');
  await expect(input).toHaveValue(/#share=v1\./);
  const link = await input.inputValue();

  const other = await context.newPage();
  await openApp(other, { path: link.slice(link.indexOf('/#')) });
  await other.getByRole('button', { name: 'Open it' }).click();
  await expect(other.locator('.site-tab__button')).toHaveCount(3);
  expect(new URL(other.url()).hash).toBe('');
});

test('flags a duplicate IP address and lists it in the IP plan', async ({ page }) => {
  await deviceNode(page, 'Filtration PLC').click();
  await page.getByLabel('IP address', { exact: true }).fill('10.50.2.11');
  await expect(page.locator('.inspector .address-info .issues')).toContainText('10.50.2.11 is also used by Filtration HMI');
  await clearSelection(page);
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await page.getByRole('tab', { name: 'IP plan' }).click();
  const row = page.locator('.inventory__table tbody tr').filter({ has: page.getByRole('button', { name: 'Filtration PLC', exact: true }) });
  await expect(row).toContainText('also used by Filtration HMI');
});

test('compares the design with a saved revision', async ({ page }) => {
  await clearSelection(page);
  await page.getByLabel('Revision name').first().fill('Baseline');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await deviceNode(page, 'Filtration PLC').click();
  await page.getByLabel('Firmware').fill('V4.2');
  await clearSelection(page);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.change-summary')).toContainText('1 changed');
  await expect(page.locator('.change-list')).toContainText('firmware: — → V4.2');
  await expect(page.locator('.diff-badge')).toHaveText(['Changed']);
});

test('imports devices from CSV and reports the bad row', async ({ page }) => {
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const csv = 'name,type,variant,level,ip\nNew pump PLC,plc,compact,1,10.50.2.60\nMystery box,toaster,,,\n';
  await page.locator('.import-dialog input[type=file]').setInputFiles({ name: 'devices.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('status')).toContainText('1 device ready to import');
  await expect(page.locator('.import-errors')).toContainText('Line 3 (Mystery box): unknown type "toaster"');
  await page.getByRole('button', { name: 'Import 1 device' }).click();
  const names = () => page.getByRole('textbox', { name: 'Name', exact: true }).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  await expect.poll(names).toContain('New pump PLC');
});
