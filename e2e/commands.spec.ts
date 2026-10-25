import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { deviceCount, deviceNode, openApp } from './helpers';

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => openApp(page));

test('runs commands by name from the palette', async ({ page }) => {
  await page.keyboard.press('Control+Shift+P');
  const input = page.getByRole('combobox', { name: 'Command' });
  await expect(input).toBeFocused();
  await expectAccessible(page);
  await input.fill('theme dark');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.keyboard.press('Alt+p');
  await page.getByRole('combobox', { name: 'Command' }).fill('inventory');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'IP plan' })).toBeVisible();
});

test('jumps back several steps from the edit history', async ({ page }) => {
  await page.locator('.palette__item', { hasText: /^PLC$/ }).click();
  await page.locator('.palette__item', { hasText: /^HMI$/ }).click();
  await deviceNode(page, 'Filtration PLC').click();
  await page.getByLabel('Firmware').fill('V4.2');
  expect(await deviceCount(page)).toBe(21);

  await page.locator('.history-menu summary').click();
  const steps = page.getByRole('list', { name: 'Edit history, newest first' }).getByRole('button');
  await expect(steps.first()).toContainText('Filtration PLC: firmware: — → V4.2');
  await expect(steps.nth(1)).toContainText('Added device HMI');
  await steps.filter({ hasText: 'Start' }).click();
  expect(await deviceCount(page)).toBe(19);
  await page.getByRole('button', { name: 'Redo' }).click();
  expect(await deviceCount(page)).toBe(20);
});

test('shows the tour once on a first visit', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('conduitot:prefs'));
  await page.reload();
  const card = page.getByRole('dialog', { name: 'Add devices' });
  await expect(card).toBeVisible();
  await expectAccessible(page);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Save, export and share' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.reload();
  await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
  await expect(page.locator('.tour__card')).toHaveCount(0);
});

test('explains what to do on an empty site', async ({ page }) => {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /^Blank/ }).click();
  await expect(page.locator('.canvas-empty')).toContainText('This site is empty');
});
