import { expect, test, type Page } from '@playwright/test';
import { clearSelection, deviceNode, openApp } from './helpers';

test.beforeEach(async ({ page }) => openApp(page));

/** Adds the collaborator's example to the demo: Office workstation (L4) linked straight to Pump station RTU (L1). */
async function linkOfficeToRtu(page: Page): Promise<void> {
  await clearSelection(page);
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await page.getByRole('tab', { name: /Links/ }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const csv = 'source,source port,target,target port,medium,vlans,network\nOffice workstation,,Pump station RTU,,ethernet,,\n';
  await page.locator('.import-dialog input[type=file]').setInputFiles({ name: 'links.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Import 1 link' }).click();
  await page.getByRole('tab', { name: 'Diagram' }).click();
}

const securityButton = (page: Page) => page.getByRole('button', { name: /^Security/ });

test('flags a direct IT to OT link, marks it on the canvas and leads to the devices', async ({ page }) => {
  await expect(securityButton(page)).toHaveAccessibleName('Security 3 findings');
  await expect(page.locator('.link-edge.sec-violation')).toHaveCount(2);
  await linkOfficeToRtu(page);
  await expect(page.locator('.link-edge.sec-violation')).toHaveCount(3);
  await expect(deviceNode(page, 'Office workstation').locator('.sec-badge')).toHaveText('1');

  await securityButton(page).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('heading', { name: /^IEC 62443 communication violation/ })).toBeVisible();
  const finding = panel.getByRole('button', { name: 'Office workstation (L4) connects directly to Pump station RTU (L1)' });
  await expect(finding).toBeVisible();
  await expect(panel).toContainText('IEC 62443-3-2 ZCR 3.2; IEC 62443-3-3 SR 5.1, SR 5.2');

  // Choosing the finding selects the link; its properties list the finding.
  await finding.click();
  await expect(page.getByRole('heading', { name: 'Network link' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Security findings (1)' })).toBeVisible();

  // With nothing selected the panel comes back, still open.
  await clearSelection(page);
  await expect(page.getByRole('tab', { name: /^Findings/ })).toBeVisible();
});

test('company policies and switching a built-in check off', async ({ page }) => {
  await linkOfficeToRtu(page);
  await securityButton(page).click();
  await page.getByRole('tab', { name: 'Rules' }).click();
  await page.getByRole('button', { name: 'Add example: no direct IT → OT' }).click();
  await expect(page.locator('.policy summary')).toContainText('L5, L4 ↔ L3, L2, L1, L0, links and flows');

  await page.getByRole('tab', { name: /^Findings/ }).click();
  await expect(page.getByRole('heading', { name: /^Company policy violation: No direct IT → OT/ })).toBeVisible();

  await page.getByRole('tab', { name: 'Rules' }).click();
  await page.getByRole('checkbox', { name: 'Direct connection between IT and OT' }).uncheck();
  await page.getByRole('tab', { name: /^Findings/ }).click();
  await expect(page.getByRole('button', { name: 'Office workstation (L4) connects directly to Pump station RTU (L1)' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Office workstation (L4) is linked to Pump station RTU (L1)' })).toBeVisible();

  // Both changes are ordinary edits.
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Office workstation (L4) connects directly to Pump station RTU (L1)' })).toBeVisible();
});

test('the security layer can be hidden', async ({ page }) => {
  await expect(page.locator('.link-edge.sec-violation')).toHaveCount(2);
  await page.locator('summary', { hasText: 'View' }).click();
  await page.getByRole('checkbox', { name: 'Security findings' }).uncheck();
  await expect(page.locator('.link-edge.sec-violation')).toHaveCount(0);
  await expect(page.locator('.sec-badge')).toHaveCount(0);
});
