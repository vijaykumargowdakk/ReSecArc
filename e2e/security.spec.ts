import { readFile } from 'node:fs/promises';
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

const securityButton = (page: Page) => page.getByRole('button', { name: /^Security \d+ finding/ });

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

test('attack paths: ATT&CK labels, canvas highlight and the Attack Flow export', async ({ page }) => {
  await securityButton(page).click();
  await page.getByRole('tab', { name: 'Attack paths (12)' }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('heading', { name: /MITRE ATT&CK® for ICS — possible attack paths/ })).toBeVisible();

  // The demo's path from the office runs through the jump host and SCADA, then commands the RTU.
  const path = panel.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Office workstation → Pump station RTU' }) });
  await expect(path.locator('.attack-chip__label')).toHaveText([
    'Initial Access · T0865',
    'Lateral Movement · T0886',
    'Lateral Movement · T0886',
    'Impair Process Control · T1692.001',
    'Impact · T0831',
  ]);
  await expect(path.getByRole('link', { name: 'T1692.001' })).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1692/001');

  // Choosing it numbers its steps on the canvas and keeps the panel open.
  await path.getByRole('button', { name: 'Office workstation → Pump station RTU' }).click();
  await expect(page.locator('.path-step-badge')).toHaveCount(4);
  await expect(deviceNode(page, 'Office workstation').locator('.path-step-badge')).toHaveText('1');
  await expect(deviceNode(page, 'Pump station RTU').locator('.path-step-badge')).toHaveText('4');
  await expect(page.locator('.react-flow__node.sec-path-step')).toHaveCount(4);
  await expect(page.locator('.link-edge.sec-path')).toHaveCount(7);
  await expect(page.locator('.flow-edge.sec-path')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: /^Attack paths/ })).toBeVisible();

  const download = page.waitForEvent('download');
  await path.getByRole('button', { name: 'Export this path (Attack Flow)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('riverbend-water-treatment-fictional-demo-attack-flow.json');
  const bundle = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(bundle.type).toBe('bundle');
  const actions = bundle.objects.filter((o: { type: string }) => o.type === 'attack-action');
  expect(actions.map((a: { technique_id: string }) => a.technique_id)).toEqual(['T0865', 'T0886', 'T0886', 'T1692.001', 'T0831']);

  // The header button exports every path shown.
  const all = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export', exact: true }).click();
  const allBundle = JSON.parse(await readFile(await (await all).path(), 'utf8'));
  expect(allBundle.objects.find((o: { type: string }) => o.type === 'attack-flow').start_refs).toHaveLength(12);

  // Choosing it again stops the highlight.
  await path.getByRole('button', { name: 'Office workstation → Pump station RTU' }).click();
  await expect(page.locator('.path-step-badge')).toHaveCount(0);
});

test('a direct office to RTU link gives a one-hop path, and entry points can be changed', async ({ page }) => {
  await linkOfficeToRtu(page);
  await securityButton(page).click();
  await page.getByRole('tab', { name: /^Attack paths/ }).click();
  const panel = page.getByRole('tabpanel');
  const path = panel.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Office workstation → Pump station RTU' }) });
  await expect(path).toContainText('1 hop');
  await expect(path.locator('.path__relies')).toContainText('Office workstation (L4) connects directly to Pump station RTU (L1) (it-ot-direct)');

  await page.locator('summary', { hasText: 'Where an attacker could start' }).click();
  await panel.getByRole('button', { name: 'Remove Office workstation from the entry points' }).click();
  await expect(panel.getByRole('button', { name: 'Office workstation → Pump station RTU' })).toHaveCount(0);
  await panel.getByRole('button', { name: /Go back to the default entry points|Defaults/ }).click();
  await expect(panel.getByRole('button', { name: 'Office workstation → Pump station RTU' })).toBeVisible();
});

test('the security layer can be hidden', async ({ page }) => {
  await expect(page.locator('.link-edge.sec-violation')).toHaveCount(2);
  await page.locator('summary', { hasText: 'View' }).click();
  await page.getByRole('checkbox', { name: 'Security findings' }).uncheck();
  await expect(page.locator('.link-edge.sec-violation')).toHaveCount(0);
  await expect(page.locator('.sec-badge')).toHaveCount(0);
});
