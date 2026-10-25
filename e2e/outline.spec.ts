import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

const item = (page: Page, name: RegExp) => page.getByRole('treeitem', { name });
const linkCount = (page: Page) => page.locator('.react-flow__edge-link').count();
const announcement = (page: Page) => page.locator('.sr-only[aria-live]');

/** Opens the outline and puts keyboard focus on its first item, as Tab would. */
async function openOutline(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Outline' }).click();
  await item(page, /^Main site/).focus();
}

/**
 * From the first item, goes to Filtration PLC: F jumps to Filtration HMI, then down past the L1 heading,
 * Chemical dosing PLC and Dosing safety controller. (On a device, F starts a flow instead of jumping.)
 */
async function goToFiltrationPlc(page: Page): Promise<void> {
  await page.keyboard.press('f');
  await expect(item(page, /^Filtration HMI/)).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await expect(item(page, /^Filtration PLC/)).toBeFocused();
}

/** Presses Tab until a device on the canvas has focus, as a keyboard user would; returns its id. */
async function tabToDevice(page: Page): Promise<string> {
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement?.closest('.react-flow__node-device')?.getAttribute('data-id'));
    if (id) return id;
  }
  throw new Error('No device received focus');
}

/** Presses arrow keys until some device is highlighted as the target. */
async function chooseTarget(page: Page): Promise<void> {
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    await page.keyboard.press(key);
    if ((await page.locator('.is-connect-target').count()) === 1) return;
  }
  throw new Error('No target found in any direction');
}

test.beforeEach(async ({ page }) => openApp(page));

test('moves through the outline with the keyboard and opens an item’s properties', async ({ page }) => {
  await openOutline(page);
  await page.keyboard.press('ArrowDown');
  await expect(item(page, /^L5 Enterprise network/)).toBeFocused();
  // Typing a letter jumps to the next item starting with it.
  await page.keyboard.press('c');
  await expect(item(page, /^Corporate router/)).toBeFocused();
  await page.keyboard.press('Home');
  await goToFiltrationPlc(page);
  const plc = item(page, /^Filtration PLC/);
  await expect(plc).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(plc).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(item(page, /^Link to Control switch/)).toBeFocused();
  await expect(item(page, /^Modbus RW from Filtration HMI, port 502/)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(plc).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(plc).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowLeft');
  await expect(item(page, /^L1 Basic control/)).toBeFocused();
  await page.keyboard.press('End');
  await expect(item(page, /^Zones/)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(item(page, /^Main site/)).toBeFocused();
  // Only one item is in the tab order at a time.
  await expect(page.locator('[role=treeitem][tabindex="0"]')).toHaveCount(1);

  await goToFiltrationPlc(page);
  await page.keyboard.press('Enter');
  const name = page.locator('.inspector').getByRole('textbox', { name: 'Name' });
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('Filtration PLC');
  await expect(plc).toHaveAttribute('aria-selected', 'true');
});

test('links and adds a flow from the outline with L and F', async ({ page }) => {
  await openOutline(page);
  await goToFiltrationPlc(page);
  await page.keyboard.press('l');
  await page.getByRole('textbox', { name: 'Link Filtration PLC to' }).fill('Dosing pump');
  await page.keyboard.press('Enter');
  await expect(announcement(page)).toHaveText('Link added from Filtration PLC to Dosing pump');
  await expect(item(page, /^Filtration PLC/)).toBeFocused();
  await expect(item(page, /^Link to Dosing pump/)).toHaveCount(1);

  await page.keyboard.press('f');
  await page.getByRole('textbox', { name: 'Flow from Filtration PLC to' }).fill('Site historian');
  await page.keyboard.press('Enter');
  await expect(item(page, /^Modbus.* to Site historian/)).toHaveCount(1);

  // Escape closes the picker without connecting.
  await page.keyboard.press('l');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Link Filtration PLC to' })).toHaveCount(0);
  await expect(item(page, /^Filtration PLC/)).toBeFocused();

  await page.getByRole('tab', { name: 'Diagram' }).click();
  expect(await linkCount(page)).toBe(19);
});

test('deletes a device from the outline after confirming', async ({ page }) => {
  await openOutline(page);
  await page.keyboard.press('t');
  await expect(item(page, /^Turbidity sensor/)).toBeFocused();
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Delete "Turbidity sensor" and its connections?');
    void d.accept();
  });
  await page.keyboard.press('Delete');
  await expect(item(page, /^Turbidity sensor/)).toHaveCount(0);
  await expect(announcement(page)).toHaveText('Deleted Turbidity sensor');
  await expect(page.locator('[role=treeitem]:focus')).toHaveCount(1);
});

test('connects two devices on the canvas using only the keyboard', async ({ page }) => {
  const before = await linkCount(page);
  const source = await tabToDevice(page);
  await page.keyboard.press('l');
  await expect(page.locator(`.react-flow__node[data-id="${source}"]`)).toHaveClass(/is-connect-source/);
  await expect(announcement(page)).toContainText('Use arrow keys to choose a device');
  // While connecting, arrow keys pick a target rather than moving the focused device.
  const transform = await page.locator(`.react-flow__node[data-id="${source}"]`).evaluate((n) => (n as HTMLElement).style.transform);
  await chooseTarget(page);
  await expect(announcement(page)).toHaveText(/^Target: /);
  await page.keyboard.press('Enter');
  await expect(announcement(page)).toHaveText(/^Link added from /);
  expect(await linkCount(page)).toBe(before + 1);
  await expect(page.locator('.is-connect-source, .is-connect-target')).toHaveCount(0);
  expect(await page.locator(`.react-flow__node[data-id="${source}"]`).evaluate((n) => (n as HTMLElement).style.transform)).toBe(transform);
});

test('Escape cancels a keyboard connection', async ({ page }) => {
  const flows = await page.locator('.react-flow__edge-flow').count();
  await tabToDevice(page);
  await page.keyboard.press('f');
  await chooseTarget(page);
  await page.keyboard.press('Escape');
  await expect(announcement(page)).toHaveText('Connection cancelled');
  await expect(page.locator('.is-connect-source, .is-connect-target')).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect(await page.locator('.react-flow__edge-flow').count()).toBe(flows);
});
