import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasSettled, deviceCount, deviceNode, laneButtons, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

/**
 * Holds a finger still on an element for longer than the long-press delay, then lifts it. The canvas
 * animates to frame the site after loading, so the press waits until the element has stopped moving.
 */
async function longPress(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  let box = (await target.boundingBox())!;
  await expect
    .poll(async () => {
      const before = box;
      await page.waitForTimeout(100);
      box = (await target.boundingBox())!;
      return before.x === box.x && before.y === box.y && before.width === box.width;
    })
    .toBe(true);
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

type Point = { x: number; y: number };

/** Moves one finger from `from` to `to` (through `via`, if given) in small steps, as a real drag does, then lifts it. */
async function fingerDrag(page: Page, from: Point, to: Point, via: Point[] = []): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  let at = from;
  for (const next of [...via, to]) {
    const start = at;
    for (let i = 1; i <= 16; i++) {
      at = { x: start.x + ((next.x - start.x) * i) / 16, y: start.y + ((next.y - start.y) * i) / 16 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

test('a palette item dragged with a finger lands on the level it is dropped on (issue #17)', async ({ page }) => {
  const plc = page.locator('.palette__item', { hasText: /^PLC$/ });
  const lane = page.locator('.react-flow__node-lane').filter({ has: page.locator('.lane__level', { hasText: /^L2$/ }) });
  // The canvas frames the plant with an animation after it opens; measured before it settles, the lane
  // can still move 60–150 px, and the finger then misses it or travels mostly downwards (a scroll).
  await canvasSettled(page);
  const laneBox = (await lane.boundingBox())!;
  const before = await page.locator('.react-flow__node-device').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')));
  // An empty spot in the L2 lane, right of its label.
  const target = { x: laneBox.x + Math.min(laneBox.width - 40, 260), y: laneBox.y + laneBox.height / 2 };
  await fingerDrag(page, centre((await plc.boundingBox())!), target);

  await expect.poll(() => deviceCount(page)).toBe(20);
  const ids = await page.locator('.react-flow__node-device').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')));
  const id = ids.find((x) => !before.includes(x))!;
  const box = (await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox())!;
  const c = centre(box);
  expect(c.y).toBeGreaterThan(laneBox.y);
  expect(c.y).toBeLessThan(laneBox.y + laneBox.height);
  // The finger was lifted where the device's centre now is.
  expect(Math.abs(c.x - target.x)).toBeLessThan(box.width / 2);
  // Only one device: the click that can follow the lifted finger adds nothing more.
  await page.waitForTimeout(500);
  expect(await deviceCount(page)).toBe(20);
});

test('below 900 px a finger drag from the palette drawer drops onto the canvas and closes the drawer (issue #51)', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  const toggle = page.getByRole('button', { name: 'Device palette' });
  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const plc = page.locator('.palette__item', { hasText: /^PLC$/ });
  await expect(plc).toBeVisible();
  // Let the drawer finish sliding in, then drag the PLC a little to the right, to a spot the open drawer
  // covers: the drawer slides away during the drag, so the canvas under it takes the drop.
  await page.waitForTimeout(400);
  const drawer = (await page.locator('.palette').boundingBox())!;
  const canvas = (await page.locator('.canvas').boundingBox())!;
  const spot = { x: Math.max(canvas.x, drawer.x) + 200, y: canvas.y + canvas.height * 0.5 };
  expect(spot.x).toBeLessThan(drawer.x + drawer.width);
  // A sideways slide starts the drag (an up-or-down one scrolls the palette), then the finger moves to the spot.
  const start = centre((await plc.boundingBox())!);
  await fingerDrag(page, start, spot, [{ x: start.x + 60, y: start.y }]);
  await expect.poll(() => deviceCount(page)).toBe(20);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(500);
  expect(await deviceCount(page)).toBe(20);
});

test('a vertical swipe on the palette scrolls it and adds nothing', async ({ page }) => {
  const plc = centre((await page.locator('.palette__item', { hasText: /^PLC$/ }).boundingBox())!);
  await fingerDrag(page, plc, { x: plc.x + 4, y: plc.y - 120 });
  await page.waitForTimeout(500);
  expect(await deviceCount(page)).toBe(19);
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

test('the canvas controls never cover a lane button, when the site is framed or after Fit (issue #18)', async ({ page }) => {
  const controls = page.locator('.react-flow__controls');
  const covered = async () => {
    await canvasSettled(page);
    const c = (await controls.boundingBox())!;
    return (await laneButtons(page))
      .filter((b) => b.x < c.x + c.width && c.x < b.x + b.width && b.y < c.y + c.height && c.y < b.y + b.height)
      .map((b) => b.label);
  };
  expect(await covered()).toEqual([]);
  await page.locator('.react-flow__controls-zoomin').tap();
  await page.locator('.react-flow__controls-fitview').tap();
  expect(await covered()).toEqual([]);
});

test('the tablet layout has no accessibility violations', async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
});
