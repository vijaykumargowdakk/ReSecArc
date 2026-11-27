import { expect, test, type Page } from '@playwright/test';
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

/** The theme and text size live in the More menu since issue #16. */
async function openDisplay(page: Page) {
  const more = page.locator('.more-menu');
  if (!(await more.evaluate((el: HTMLDetailsElement) => el.open))) await more.locator('> summary').click();
  const display = page.locator('.display-menu');
  if (!(await display.evaluate((el: HTMLDetailsElement) => el.open))) await display.locator('summary').click();
}

test('the text size setting scales the interface, not the canvas, and is remembered', async ({ page }) => {
  await page.getByRole('group', { name: 'Edit' }).waitFor();
  await openDisplay(page);
  await page.getByRole('radio', { name: 'Larger (130%)' }).check();
  const zoom = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).zoom);
  await expect.poll(() => zoom('.toolbar')).toBe('1.3');
  expect(await zoom('.react-flow')).toBe('1');

  await page.reload();
  await expect.poll(() => zoom('.inspector')).toBe('1.3');
  await openDisplay(page);
  await expect(page.getByRole('radio', { name: 'Larger (130%)' })).toBeChecked();
  await page.getByRole('radio', { name: 'Default (100%)' }).check();
  await expect.poll(() => zoom('.toolbar')).toBe('1');
});

test('the theme is chosen from the Display menu', async ({ page }) => {
  await openDisplay(page);
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('at 1280 px the toolbar fits on one row with every label (issue #16)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const toolbar = page.getByRole('banner');
  for (const name of ['Find', 'Link', 'Flow', 'Security', 'New', 'Open', 'Save', 'Export', 'More']) {
    await expect(toolbar.getByText(name, { exact: true }).first(), name).toBeVisible();
  }
  await expect(toolbar.getByText('ReSecArc', { exact: true })).toBeVisible();
  const fit = await toolbar.evaluate((el) => {
    const name = el.querySelector('.brand__name')!;
    return { overflow: el.scrollWidth - el.clientWidth, height: el.getBoundingClientRect().height, nameCut: name.scrollWidth > name.clientWidth };
  });
  expect(fit).toEqual({ overflow: 0, height: expect.any(Number), nameCut: false });
  expect(fit.height).toBeLessThan(60);
  // The connection buttons keep their full names for screen readers.
  await expect(toolbar.getByRole('button', { name: 'Network link' })).toHaveAttribute('aria-pressed', 'true');

  // Snap to grid, the edit history and the display settings are in the More menu.
  await toolbar.locator('.more-menu > summary').click();
  const snap = toolbar.getByRole('button', { name: 'Snap to grid' });
  const pressed = await snap.getAttribute('aria-pressed');
  await snap.click();
  await expect(snap).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true');
  await toolbar.getByText('Edit history', { exact: true }).click();
  await expect(page.getByRole('list', { name: 'Edit history, newest first' })).toBeVisible();
  await toolbar.locator('.display-menu summary').click();
  await expect(page.getByRole('radio', { name: 'High contrast' })).toBeVisible();
});

test('the edit history command opens the More menu at the history (issue #16)', async ({ page }) => {
  await page.getByRole('button', { name: 'Command palette' }).click();
  await page.getByRole('combobox', { name: 'Command' }).fill('edit history');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('list', { name: 'Edit history, newest first' })).toBeVisible();
});

test('menus close on Escape, returning focus, and on a click outside (issue #69)', async ({ page }) => {
  const isOpen = (sel: string) => page.locator(sel).first().evaluate((el: HTMLDetailsElement) => el.open);
  for (const sel of ['.export-menu', '.more-menu', '.layers-menu']) {
    const summary = page.locator(sel).first().locator('> summary');
    await summary.click();
    expect(await isOpen(sel), sel).toBe(true);
    await page.keyboard.press('Escape');
    expect(await isOpen(sel), sel).toBe(false);
    await expect(summary).toBeFocused();
    await summary.click();
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 300 } });
    expect(await isOpen(sel), sel).toBe(false);
  }

  // Inside More, Escape closes the open section first, then More; clicks inside keep it open.
  await page.locator('.more-menu > summary').click();
  await page.locator('.history-menu summary').click();
  await page.getByRole('list', { name: 'Edit history, newest first' }).waitFor();
  expect(await isOpen('.more-menu')).toBe(true);
  await page.keyboard.press('Escape');
  expect(await isOpen('.history-menu')).toBe(false);
  expect(await isOpen('.more-menu')).toBe(true);
  await page.keyboard.press('Escape');
  expect(await isOpen('.more-menu')).toBe(false);

  // An Escape that closes a menu leaves the selection alone.
  await page.locator('.react-flow__node-device').first().click();
  await expect(page.locator('.react-flow__node-device.selected')).toHaveCount(1);
  await page.locator('.export-menu > summary').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.react-flow__node-device.selected')).toHaveCount(1);
});
