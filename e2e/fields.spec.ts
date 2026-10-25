import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { clearSelection, deviceNode, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

test('defines a custom field, fills it in, tags devices and filters by tag', async ({ page }) => {
  await clearSelection(page);
  await page.getByRole('button', { name: 'Add custom field' }).click();
  const name = page.getByRole('textbox', { name: 'Field name' });
  await name.fill('Owner');
  await name.press('Enter');
  await page.getByRole('combobox', { name: 'Kind' }).selectOption('select');
  const choices = page.getByLabel('Choices, separated by commas');
  await choices.fill('OT team, IT team');
  await choices.press('Enter');

  await deviceNode(page, 'Filtration PLC').click();
  await page.getByRole('combobox', { name: 'Owner' }).selectOption('OT team');
  const tagInput = page.getByRole('combobox', { name: 'Add a tag' });
  await tagInput.fill('patch-pending');
  await tagInput.press('Enter');
  await expect(page.getByRole('list', { name: 'Tags' })).toContainText('patch-pending');

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

  await page.locator('summary', { hasText: 'Tag' }).click();
  await page.getByRole('checkbox', { name: /patch-pending/ }).check();
  await expect(page.locator('.react-flow__node-device.is-dimmed')).toHaveCount(18);
});

test('tags several devices at once and exports tags and fields to CSV', async ({ page }) => {
  await deviceNode(page, 'Filtration PLC').click();
  await deviceNode(page, 'Chemical dosing PLC').click({ modifiers: ['Control'] });
  await page.getByRole('combobox', { name: 'Tag' }).fill('line-1');
  await page.getByRole('button', { name: 'Add to all' }).click();
  await expect(page.locator('.inspector')).toContainText('On the selection: line-1 (2)');

  await clearSelection(page);
  await page.getByRole('tab', { name: 'Inventory' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = await readFile(await (await download).path(), 'utf8');
  expect(csv.split(/\r?\n/)[0]).toMatch(/,tags$/);
  expect(csv).toContain('Filtration PLC,');
  expect(csv).toMatch(/Chemical dosing PLC.*,line-1\r?\n/);
});
