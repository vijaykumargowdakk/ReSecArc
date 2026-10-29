import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import pipeline from '../src/examples/templates/pipeline.json' with { type: 'json' };
import { deviceCount, loadTemplate, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

async function exportFile(page: Page, item: string): Promise<{ name: string; text: string }> {
  await page.locator('summary', { hasText: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: item }).click();
  const file = await download;
  return { name: file.suggestedFilename(), text: await readFile((await file.path())!, 'utf8') };
}

test('the full report includes every site and passes an accessibility scan', async ({ page, context }) => {
  await loadTemplate(page, /Gas pipeline/);
  const { name, text } = await exportFile(page, 'Full report (HTML)');
  expect(name).toMatch(/-report\.html$/);
  for (const site of pipeline.sites) expect(text).toContain(`Site: ${site.name}</h2>`);

  // The report opens on its own, draws a diagram per site and runs no script.
  const report = await context.newPage();
  const errors: string[] = [];
  report.on('pageerror', (e) => errors.push(e.message));
  await report.setContent(text);
  await expect(report.locator('figure > svg')).toHaveCount(pipeline.sites.length);
  await expect(report.getByRole('heading', { name: /Attack paths/ })).toBeVisible();
  const { violations } = await new AxeBuilder({ page: report }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(errors).toEqual([]);
});

test('printing the full report loads it into a frame without leaving the app', async ({ page }) => {
  await page.locator('summary', { hasText: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Print full report / save as PDF…' }).click();
  const frame = page.locator('#report-print-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-same-origin allow-modals');
  await expect(page.frameLocator('#report-print-frame').getByRole('heading', { level: 1 })).toHaveText(/Riverbend Water Treatment/);
  await expect(deviceCount(page)).resolves.toBe(19);
});

test('the draw.io export is well-formed XML with a page per site', async ({ page }) => {
  await loadTemplate(page, /Gas pipeline/);
  const { name, text } = await exportFile(page, 'All sites for draw.io');
  expect(name).toMatch(/\.drawio$/);
  const result = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      error: doc.querySelector('parsererror')?.textContent ?? null,
      pages: [...doc.querySelectorAll('diagram')].map((d) => d.getAttribute('name')),
      devices: doc.querySelectorAll('UserObject[kind]').length,
    };
  }, text);
  expect(result.error).toBeNull();
  expect(result.pages).toEqual(pipeline.sites.map((s) => s.name));
  expect(result.devices).toBe(pipeline.devices.length);
});

test('merges chosen sites from another project as one undo step', async ({ page }) => {
  await page.getByRole('button', { name: 'Merge sites from another project' }).click();
  const dialog = page.getByRole('dialog', { name: 'Merge sites from another project' });
  await expect(dialog.getByRole('button', { name: 'Merge 0 sites' })).toBeDisabled();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'pipeline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pipeline)) });
  await dialog.getByRole('checkbox', { name: /Block valve 7/ }).uncheck();
  await expect(dialog.getByRole('status')).toContainText('Adds 2 sites');
  await expect(dialog.getByRole('status')).toContainText('Left out:');
  const { violations } = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await dialog.getByRole('button', { name: 'Merge 2 sites' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.site-tab__button')).toHaveCount(3);
  await expect(page.locator('.site-tab.is-active')).toContainText('Control centre');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.site-tab__button')).toHaveCount(1);
});

test('a broken file is reported in the merge dialog', async ({ page }) => {
  await page.getByRole('button', { name: 'Merge sites from another project' }).click();
  const dialog = page.getByRole('dialog', { name: 'Merge sites from another project' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(dialog.getByRole('alert')).toContainText('Could not read broken.json');
});
