import { expect, test } from '@playwright/test';
import { clearSelection, deviceCount, deviceNode, loadTemplate, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

test('loads the demo plant with its sites, devices and legend', async ({ page }) => {
  await expect(page).toHaveTitle('ConduitOT');
  expect(await deviceCount(page)).toBe(19);
  await expect(page.locator('.site-tab', { hasText: 'Main site' })).toBeVisible();
  await expect(page.locator('.legend')).toContainText('Modbus');
});

test('adds a device from the palette and undoes it', async ({ page }) => {
  await page.locator('.palette__item', { hasText: /^PLC$/ }).click();
  expect(await deviceCount(page)).toBe(20);
  await expect(page.locator('[aria-live="polite"]').last()).toContainText('PLC added');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await deviceCount(page)).toBe(19);
  await page.getByRole('button', { name: 'Redo' }).click();
  expect(await deviceCount(page)).toBe(20);
});

test('connects two devices from the properties panel', async ({ page }) => {
  const links = () => page.locator('.react-flow__edge-link').count();
  const before = await links();
  await deviceNode(page, 'Site historian').click();
  await page.getByRole('button', { name: 'Link to…' }).click();
  await page.getByRole('textbox', { name: /Link Site historian to/ }).fill('Engineering');
  await page.getByRole('list', { name: /Link Site historian to/ }).getByRole('button', { name: /Engineering workstation/ }).click();
  expect(await links()).toBe(before + 1);
});

test('edits a device name and shows it on the canvas', async ({ page }) => {
  await deviceNode(page, 'Filtration PLC').click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Filter PLC A');
  await expect(deviceNode(page, 'Filter PLC A')).toBeVisible();
});

test('opens a multi-site template and switches sites', async ({ page }) => {
  await loadTemplate(page, /Gas pipeline/);
  const tabs = page.locator('.site-tab__button');
  await expect(tabs).toHaveCount(3);
  await tabs.nth(1).click();
  await expect(deviceNode(page, 'Station controller')).toBeVisible();
  // A stub for the control centre's SCADA server leads back to the first site.
  await page.locator('.react-flow__node-portal', { hasText: 'Pipeline SCADA server' }).click();
  await expect(deviceNode(page, 'Pipeline SCADA server')).toBeVisible();
});

test('finds a device with Ctrl+K', async ({ page }) => {
  await clearSelection(page);
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search devices').fill('10.50.2.40');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Pump station RTU');
});

test('adds, edits and deletes a text note', async ({ page }) => {
  await page.getByRole('button', { name: 'Text note' }).click();
  await expect(page.locator('.react-flow__node-note')).toHaveCount(2);
  await page.locator('.inspector textarea').first().fill('Check cabinet labels');
  await expect(page.locator('.react-flow__node-note', { hasText: 'Check cabinet labels' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete note' }).click();
  await expect(page.locator('.react-flow__node-note')).toHaveCount(1);
});

test('tidies the layout in one undo step', async ({ page }) => {
  const positions = () => page.locator('.react-flow__node-device').evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform));
  const before = await positions();
  await page.getByRole('button', { name: 'Tidy layout' }).click();
  await expect.poll(positions).not.toEqual(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(positions).toEqual(before);
});

test('a second click on Tidy puts the previous layout back', async ({ page }) => {
  const positions = () => page.locator('.react-flow__node-device').evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform));
  const before = await positions();
  await page.getByRole('button', { name: 'Tidy layout' }).click();
  await expect.poll(positions).not.toEqual(before);
  const tidied = await positions();
  await page.getByRole('button', { name: 'Undo tidy' }).click();
  await expect.poll(positions).toEqual(before);
  await expect(page.getByRole('button', { name: 'Tidy layout' })).toBeVisible();

  // An edit after tidying ends the offer, so the button tidies again instead of undoing that edit.
  await page.getByRole('button', { name: 'Tidy layout' }).click();
  await expect.poll(positions).toEqual(tidied);
  await page.getByRole('button', { name: 'Snap to grid' }).click(); // not an edit: the offer stays
  await expect(page.getByRole('button', { name: 'Undo tidy' })).toBeVisible();
  await page.getByRole('button', { name: 'Text note' }).click();
  await expect(page.getByRole('button', { name: 'Tidy layout' })).toBeVisible();
});
