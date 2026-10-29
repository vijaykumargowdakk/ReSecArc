import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { deviceCount, deviceNode, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

/** Holds a finger still on an element for longer than the long-press delay, then lifts it. */
async function longPress(page: Page, selector: string): Promise<void> {
  const box = (await page.locator(selector).first().boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('the tablet reports a coarse pointer', async ({ page }) => {
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
});

test('controls in the toolbar, canvas bar and side panels are at least 44 px tall (WCAG 2.5.5)', async ({ page }) => {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.toolbar :is(button, summary, select), .canvas-bar :is(button, summary), .palette button, .inspector :is(button, input, select)')]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
      // A checkbox or radio is tapped through its label, so the label is what is measured.
      .map((el) => (el.matches('[type=checkbox], [type=radio]') ? el.closest('label') ?? el : el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.height < 44 || (el.matches('.icon-only, .icon-button') && r.width < 44))
      .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.textContent?.trim()} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});

test('the toolbar and canvas bar wrap rather than run off the screen', async ({ page }) => {
  const offScreen = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.toolbar :is(button, summary, select), .canvas-bar :is(button, summary)')]
      .filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().right > window.innerWidth)
      .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim()),
  );
  expect(offScreen).toEqual([]);
});

test('tapping a palette item adds the device', async ({ page }) => {
  await page.locator('.palette__item', { hasText: /^PLC$/ }).tap();
  expect(await deviceCount(page)).toBe(20);
});

test('a long press on a device opens its menu, and the lifting finger chooses nothing', async ({ page }) => {
  await longPress(page, '.react-flow__node-device:has-text("Filtration PLC")');
  const menu = page.getByRole('menu', { name: 'Actions for Filtration PLC' });
  await expect(menu).toBeVisible();
  expect(await deviceCount(page)).toBe(19);
  await menu.getByRole('menuitem', { name: /Duplicate/ }).tap();
  await expect(menu).toBeHidden();
  expect(await deviceCount(page)).toBe(20);
});

test('tapping a device selects it for editing', async ({ page }) => {
  await deviceNode(page, 'Site historian').tap();
  await expect(page.getByRole('complementary', { name: 'Properties' }).getByRole('textbox', { name: 'Name' })).toHaveValue('Site historian');
});

test('lane buttons are 44 px targets, and tapping one opens the level tab', async ({ page }) => {
  const open = page.getByRole('button', { name: 'Open L3 in its own tab' });
  const box = (await open.boundingBox())!;
  // The canvas can be zoomed out, so the size is measured against the canvas zoom.
  const zoom = await page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(Math.round(box.width / zoom)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height / zoom)).toBeGreaterThanOrEqual(44);
  await open.tap();
  await expect(page.getByRole('navigation', { name: 'Levels' }).getByRole('button', { name: /L3 Site operations/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.react-flow__node-device')).toHaveCount(4);
});

test('the tablet layout has no accessibility violations', async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
});
