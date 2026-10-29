import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

const palette = (page: import('@playwright/test').Page) => page.getByRole('complementary', { name: 'Device palette' });
const properties = (page: import('@playwright/test').Page) => page.getByRole('complementary', { name: 'Properties' });

test('side panels fold to a strip, by button or shortcut, and stay folded after a reload', async ({ page }) => {
  const canvasWidth = () => page.locator('.canvas').evaluate((el) => el.getBoundingClientRect().width);
  const wide = await canvasWidth();

  await page.getByRole('button', { name: 'Hide device palette' }).click();
  await expect(palette(page).getByRole('button', { name: 'PLC', exact: true })).toBeHidden();
  await page.keyboard.press('Control+Alt+b');
  await expect(properties(page).getByRole('textbox', { name: 'Name', exact: true })).toBeHidden();
  expect(await canvasWidth()).toBeGreaterThan(wide + 400);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Show device palette' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show properties' })).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Control+b');
  await expect(palette(page).getByRole('button', { name: 'PLC', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show properties' }).click();
  await expect(properties(page).getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
});

test('opening the Security panel opens a folded properties panel', async ({ page }) => {
  await page.getByRole('button', { name: 'Hide properties' }).click();
  await page.getByRole('button', { name: /^Security \d+ finding/ }).click();
  await expect(page.getByRole('tab', { name: /^Findings/ })).toBeVisible();
});

test('sections fold and stay folded after a reload', async ({ page }) => {
  const zones = properties(page).getByRole('button', { name: 'Security zones' });
  await zones.click();
  await expect(zones).toHaveAttribute('aria-expanded', 'false');
  await expect(properties(page).getByRole('textbox', { name: 'Zone name' }).first()).toBeHidden();
  const field = palette(page).getByRole('button', { name: 'Field', exact: true });
  await field.click();
  await expect(palette(page).getByRole('button', { name: 'Sensor', exact: true })).toBeHidden();

  await page.reload();
  await expect(properties(page).getByRole('button', { name: 'Security zones' })).toHaveAttribute('aria-expanded', 'false');
  await expect(palette(page).getByRole('button', { name: 'Sensor', exact: true })).toBeHidden();
  await palette(page).getByRole('button', { name: 'Field', exact: true }).click();
  await expect(palette(page).getByRole('button', { name: 'Sensor', exact: true })).toBeVisible();
});

test('a panel edge resizes the panel by keyboard, remembers the width and resets with Enter', async ({ page }) => {
  const width = () => palette(page).evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const edge = page.getByRole('separator', { name: 'Resize device palette' });
  const start = await width();
  await edge.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(width).toBe(start + 50);
  await expect(edge).toHaveAttribute('aria-valuenow', String(start + 50));

  await page.reload();
  await expect.poll(width).toBe(start + 50);
  await page.getByRole('separator', { name: 'Resize device palette' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(width).toBe(start);
});

test('a panel edge resizes the panel by dragging', async ({ page }) => {
  const width = () => properties(page).evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const start = await width();
  const box = (await page.getByRole('separator', { name: 'Resize properties' }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + 200, { steps: 4 });
  await page.mouse.up();
  await expect.poll(width).toBe(start + 60);
});

test('the text size setting scales the interface, not the canvas, and is remembered', async ({ page }) => {
  await page.getByRole('group', { name: 'Edit' }).waitFor();
  await page.locator('.display-menu summary').click();
  await page.getByRole('radio', { name: 'Larger (130%)' }).check();
  const zoom = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).zoom);
  await expect.poll(() => zoom('.toolbar')).toBe('1.3');
  expect(await zoom('.react-flow')).toBe('1');

  await page.reload();
  await expect.poll(() => zoom('.inspector')).toBe('1.3');
  await page.locator('.display-menu summary').click();
  await expect(page.getByRole('radio', { name: 'Larger (130%)' })).toBeChecked();
  await page.getByRole('radio', { name: 'Default (100%)' }).check();
  await expect.poll(() => zoom('.toolbar')).toBe('1');
});

test('the theme is chosen from the Display menu', async ({ page }) => {
  await page.locator('.display-menu summary').click();
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
