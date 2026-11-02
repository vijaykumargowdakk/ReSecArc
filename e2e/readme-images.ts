// Retakes the screenshots in docs/images/ from the current build: npm run readme:images
// Not a test (no .spec suffix, so the normal e2e run skips it). Each image keeps its file name, size and scene,
// as described by its alt text in README.md.
import { expect, test, type Page } from '@playwright/test';
import { sensorLevelProject } from './fixtures';
import { clearSelection, deviceNode, loadTemplate, openApp, type Theme } from './helpers';

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/images/${name}.png` });

/** The canvas animates for about 250 ms when it frames a site; wait for it and any fades to finish. */
const settle = (page: Page) => page.waitForTimeout(700);

async function start(page: Page, size: { width: number; height: number }, theme: Theme = 'light') {
  await page.setViewportSize(size);
  await openApp(page, { theme });
  await settle(page);
}

/** Frames the whole site, as the canvas's own fit-view control does. */
async function fit(page: Page) {
  await page.locator('.react-flow__controls-fitview').click();
  await settle(page);
}

const STANDARD = { width: 1440, height: 860 };
const TALL = { width: 1440, height: 900 };

test('diagram: the demo plant on Purdue levels', async ({ page }) => {
  await start(page, STANDARD);
  await shot(page, 'diagram');
});

test('device-panel: a selected PLC and the network its address belongs to', async ({ page }) => {
  await start(page, STANDARD);
  await deviceNode(page, 'Filtration PLC').click();
  await settle(page);
  await shot(page, 'device-panel');
});

test('templates: the template gallery', async ({ page }) => {
  await start(page, STANDARD);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await settle(page);
  await shot(page, 'templates');
});

test('inventory and ip-plan: the device table and the IP plan', async ({ page }) => {
  await start(page, STANDARD);
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await settle(page);
  await shot(page, 'inventory');
  await page.getByRole('tab', { name: 'IP plan' }).click();
  await settle(page);
  await shot(page, 'ip-plan');
});

test('compare: one device changed, one added, one removed', async ({ page }) => {
  await start(page, STANDARD);
  await clearSelection(page);
  await page.getByLabel('Revision name').first().fill('Baseline');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await deviceNode(page, 'Filtration PLC').click();
  await page.getByLabel('Firmware').fill('V4.2');
  await page.locator('.palette__item', { hasText: /^HMI$/ }).click();
  await deviceNode(page, 'Dosing pump').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await clearSelection(page);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.change-summary')).toBeVisible();
  await settle(page);
  await shot(page, 'compare');
});

test('security: a direct office-to-RTU link breaks IEC 62443 and a company policy', async ({ page }) => {
  await start(page, TALL);
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await page.getByRole('tab', { name: /Links/ }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const csv = 'source,source port,target,target port,medium,vlans,network\nOffice workstation,,Pump station RTU,,ethernet,,\n';
  await page.locator('.import-dialog input[type=file]').setInputFiles({ name: 'links.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Import 1 link' }).click();
  await page.getByRole('tab', { name: 'Diagram' }).click();
  await page.getByRole('button', { name: /^Security \d+ finding/ }).click();
  await page.getByRole('tab', { name: 'Rules' }).click();
  await page.getByRole('button', { name: 'Add example: no direct IT → OT' }).click();
  await page.getByRole('tab', { name: /^Findings/ }).click();
  await settle(page);
  await shot(page, 'security');
});

test('attack-paths: office workstation to pump station RTU, highlighted with numbered steps', async ({ page }) => {
  await start(page, { width: 1600, height: 950 });
  await page.getByRole('button', { name: /^Security \d+ finding/ }).click();
  await page.getByRole('tab', { name: /^Attack paths/ }).click();
  await page.getByRole('tabpanel').getByRole('button', { name: 'Office workstation → Pump station RTU' }).click();
  await expect(page.locator('.path-step-badge')).toHaveCount(4);
  await settle(page);
  await shot(page, 'attack-paths');
});

test('dark-multisite: the pipeline template in the dark theme, with stubs to the control centre', async ({ page }) => {
  await start(page, STANDARD, 'dark');
  await loadTemplate(page, /Gas pipeline/);
  await page.locator('.site-tab__button').nth(1).click();
  await expect(deviceNode(page, 'Station controller')).toBeVisible();
  await settle(page);
  await shot(page, 'dark-multisite');
});

test('stacks and level-tab: fifteen sensors as one stack, then the L0 tab', async ({ page }) => {
  await start(page, TALL);
  await page.locator('#project-file-input').setInputFiles({ name: 'sensors.json', mimeType: 'application/json', buffer: Buffer.from(sensorLevelProject()) });
  await page.getByRole('button', { name: 'Stack similar devices on L0' }).click();
  await expect(page.locator('.react-flow__node.is-stack .stack-badge')).toHaveText('×15');
  await fit(page);
  await shot(page, 'stacks');
  await page.locator('.react-flow__node.is-stack').dblclick();
  await expect(page.locator('.react-flow__node-device')).toHaveCount(15);
  await clearSelection(page);
  await fit(page);
  await shot(page, 'level-tab');
});
