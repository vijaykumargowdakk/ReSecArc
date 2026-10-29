import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { sensorLevelProject } from './fixtures';
import { openApp } from './helpers';

/** Opens the format-5 sensor project from a file, as a user would. */
async function openSensorProject(page: Page): Promise<void> {
  await page.locator('input[type=file][accept*="json"]').setInputFiles({ name: 'sensors.json', mimeType: 'application/json', buffer: Buffer.from(sensorLevelProject()) });
  await expect(page.locator('.brand__project')).toHaveText('Sensor level (fictional)');
  await expect(page.locator('.react-flow__node-device')).toHaveCount(18);
}

/** A node's position on the canvas, in diagram coordinates. */
const nodeAt = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`).evaluate((el) => (el as HTMLElement).style.transform);

const levelTabs = (page: Page) => page.getByRole('navigation', { name: 'Levels' });

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await openSensorProject(page);
});

test('a level with 15 sensors is edited in its own tab without moving the overview', async ({ page }) => {
  const overviewAt = await nodeAt(page, 'tt-1');
  await page.getByRole('button', { name: 'Open L0 in its own tab' }).click();
  await expect(levelTabs(page).getByRole('button', { name: /L0 Physical process/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.react-flow__node-device')).toHaveCount(15);
  // The switch and PLC on L1 are stubs above the level.
  await expect(page.locator('.react-flow__node-portal')).toHaveCount(2);
  await expect(page.getByText('This level of the site is empty.')).toBeHidden();

  // Drag a sensor in the tab, then check the overview.
  const tabAt = await nodeAt(page, 'tt-1');
  const box = (await page.locator('.react-flow__node[data-id="tt-1"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 160, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => nodeAt(page, 'tt-1')).not.toBe(tabAt);

  await levelTabs(page).getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('.react-flow__node-device')).toHaveCount(18);
  expect(await nodeAt(page, 'tt-1')).toBe(overviewAt);

  // Tidy in the tab lays the level out again, and a second click puts the drag back.
  await levelTabs(page).getByRole('button', { name: /L0 Physical process/ }).click();
  const dragged = await nodeAt(page, 'tt-1');
  await page.getByRole('button', { name: 'Tidy layout' }).click();
  await expect.poll(() => nodeAt(page, 'tt-1')).not.toBe(dragged);
  await page.getByRole('button', { name: 'Undo tidy' }).click();
  await expect.poll(() => nodeAt(page, 'tt-1')).toBe(dragged);

  // Clicking a stub goes to the other end, in its own level's tab.
  await page.locator('.react-flow__node-portal', { hasText: 'Field switch' }).click();
  await expect(levelTabs(page).getByRole('button', { name: /L1 Basic control/ })).toHaveAttribute('aria-current', 'page');
  await levelTabs(page).getByRole('button', { name: 'Close the L1 tab' }).click();
  await levelTabs(page).getByRole('button', { name: 'Close the L0 tab' }).click();
  await expect(levelTabs(page)).toBeHidden();
});

test('the overview shows one ×15 stack with merged links, kept after a reload', async ({ page }) => {
  const stackButton = page.getByRole('button', { name: 'Stack similar devices on L0' });
  await stackButton.click();
  await expect(stackButton).toHaveAttribute('aria-pressed', 'true');
  const stack = page.locator('.react-flow__node.is-stack');
  await expect(stack).toHaveCount(1);
  await expect(stack.locator('.stack-badge')).toHaveText('×15');
  await expect(page.locator('.react-flow__node-device')).toHaveCount(4);
  await expect(page.locator('.edge-count')).toHaveText(['×15']);
  await expect(page.locator('.flow-label', { hasText: '×15' })).toHaveCount(1);

  // Click selects every member; double-click opens the level tab.
  await stack.click();
  await expect(page.getByRole('complementary', { name: 'Properties' }).getByRole('button', { name: /15 devices selected/ })).toBeVisible();
  await stack.dblclick();
  await expect(levelTabs(page).getByRole('button', { name: /L0 Physical process/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.react-flow__node-device')).toHaveCount(15);

  // Stacking is saved with the project, so it survives the autosave round trip.
  await page.waitForTimeout(1300);
  await page.reload();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.react-flow__node.is-stack .stack-badge')).toHaveText('×15');
});

test('levels and stacks are in the command palette', async ({ page }) => {
  await page.keyboard.press('Alt+P');
  await page.getByRole('combobox', { name: 'Command' }).fill('stack similar L0');
  await page.keyboard.press('Enter');
  await expect(page.locator('.react-flow__node.is-stack')).toHaveCount(1);
  await page.keyboard.press('Alt+P');
  await page.getByRole('combobox', { name: 'Command' }).fill('open L0');
  await page.keyboard.press('Enter');
  await expect(levelTabs(page).getByRole('button', { name: /L0 Physical process/ })).toHaveAttribute('aria-current', 'page');
});

test('the report and draw.io export show the stack', async ({ page }) => {
  await page.getByRole('button', { name: 'Stack similar devices on L0' }).click();
  const exported = async (item: string) => {
    await page.locator('summary', { hasText: 'Export' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: item }).click();
    return readFile((await (await download).path())!, 'utf8');
  };
  const report = await exported('Full report (HTML)');
  expect(report).toContain('Stack of 15 Temperature');
  expect(report).toContain('L0: 15 × Temperature');
  // Every member is still listed in the device table.
  for (let i = 101; i <= 115; i++) expect(report).toContain(`<td>TT-${i}</td>`);
  const drawio = await exported('All sites for draw.io');
  expect(drawio).toContain('count="15"');
});
