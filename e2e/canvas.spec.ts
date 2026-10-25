import { expect, test, type Page } from '@playwright/test';
import { clearSelection, deviceNode, loadTemplate, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await loadTemplate(page, /Discrete manufacturing/);
});

const linkBetween = (page: Page, a: string, b: string) =>
  page.locator('.inventory__table tbody tr').filter({ hasText: a }).filter({ hasText: b });

test('shows port names on links and edits them from the link panel', async ({ page }) => {
  await expect(page.locator('.port-label', { hasText: 'Gi1/0/12' })).toBeVisible();
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await page.getByRole('tab', { name: /Links/ }).click();
  await linkBetween(page, 'Line switch', 'Cell A PLC').getByRole('button', { name: 'Show link on diagram' }).click();
  await page.getByLabel('Port at Cell A PLC').fill('X2 P2');
  await expect(page.locator('.port-label', { hasText: 'X2 P2' })).toBeVisible();
  await page.getByLabel(/^VLANs/).fill('22');
  await expect(page.locator('.inspector .issues')).toContainText('Cell A is on VLAN 21, which this link does not carry (22)');
});

test('adds a bend point by double-clicking a link and straightens it again', async ({ page }) => {
  const path = page.locator('.react-flow__edge-link path.react-flow__edge-interaction').first();
  const box = (await path.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.waypoint')).toHaveCount(1);
  await expect(page.locator('.inspector')).toContainText('1 bend point');
  await page.getByRole('button', { name: 'Straighten' }).click();
  await expect(page.locator('.waypoint')).toHaveCount(0);
});

test('hides protocol flows and remembers it after a reload', async ({ page }) => {
  await page.locator('summary', { hasText: 'View' }).click();
  await page.getByLabel('Protocol flows').uncheck();
  await expect(page.locator('.react-flow__edge-flow')).toHaveCount(0);
  // The layer choice is a browser preference, independent of which project is shown after the reload.
  await page.reload();
  await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
  await expect(page.locator('.react-flow__edge-flow')).toHaveCount(0);
  await page.locator('summary', { hasText: 'View' }).click();
  await page.getByRole('button', { name: 'Show everything' }).click();
  await expect(page.locator('.react-flow__edge-flow')).not.toHaveCount(0);
});

test('a locked device cannot be dragged', async ({ page }) => {
  const node = deviceNode(page, 'Line historian');
  await node.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Lock in place' }).click();
  await expect(node.locator('.lock-badge')).toBeVisible();
  const before = await node.evaluate((n) => (n as HTMLElement).style.transform);
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 80, { steps: 8 });
  await page.mouse.up();
  expect(await node.evaluate((n) => (n as HTMLElement).style.transform)).toBe(before);
});

test('imports links from CSV and reports a bad row', async ({ page }) => {
  await clearSelection(page);
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await page.getByRole('tab', { name: /Links/ }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const csv = 'source,source port,target,target port,medium,vlans,network\nControls engineer laptop,eth1,Cell B PLC,X1 P2,ethernet,22,Cell B\nLine switch,Gi1/0/40,Nowhere,,,,\n';
  await page.locator('.import-dialog input[type=file]').setInputFiles({ name: 'links.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('status')).toContainText('1 link ready to import');
  await expect(page.locator('.import-errors')).toContainText('no device named "Nowhere"');
  await page.getByRole('button', { name: 'Import 1 link' }).click();
  await expect(linkBetween(page, 'Controls engineer laptop', 'Cell B PLC')).toHaveCount(1);
});
