import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clearSelection, deviceNode, openApp, type Theme } from './helpers';

/** Fails with a readable list of WCAG 2.1 A/AA violations on the current page. */
async function expectNoViolations(page: Page, where: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);
  expect(summary, `${where}\n${summary.join('\n')}`).toEqual([]);
}

const THEMES: Theme[] = ['light', 'dark', 'contrast'];

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    // Each test runs several full-page axe scans.
    test.describe.configure({ timeout: 90_000 });
    test.beforeEach(async ({ page }) => openApp(page, { theme }));

    test('diagram, properties and inventory have no violations', async ({ page }) => {
      await expectNoViolations(page, 'diagram with project panel');
      await deviceNode(page, 'Filtration PLC').click();
      await expectNoViolations(page, 'device properties');
      await clearSelection(page);
      await page.getByRole('tab', { name: 'Inventory' }).click();
      await expectNoViolations(page, 'inventory devices');
      await page.getByRole('tab', { name: 'IP plan' }).click();
      await expectNoViolations(page, 'inventory IP plan');
      await page.getByRole('tab', { name: /Links/ }).click();
      await expectNoViolations(page, 'inventory links');
      await page.getByRole('button', { name: 'Show link on diagram' }).first().click();
      await expectNoViolations(page, 'link properties');
      await page.locator('summary', { hasText: 'View' }).click();
      await expectNoViolations(page, 'view menu');
    });

    test('dialogs have no violations', async ({ page }) => {
      await page.getByRole('button', { name: 'New', exact: true }).click();
      await expectNoViolations(page, 'template gallery');
      await page.keyboard.press('Escape');
      await page.keyboard.press('?');
      await expectNoViolations(page, 'help dialog');
      await page.keyboard.press('Escape');
      await page.locator('summary', { hasText: 'Export' }).click();
      await page.getByRole('menuitem', { name: 'Share as a link…' }).click();
      await expect(page.getByLabel('Share link')).toHaveValue(/share=/);
      await expectNoViolations(page, 'share dialog');
    });

    test('outline and keyboard connections have no violations', async ({ page }) => {
      await page.getByRole('tab', { name: 'Outline' }).click();
      await page.getByRole('button', { name: 'Expand all' }).click();
      const plc = page.getByRole('treeitem', { name: /^Filtration PLC/ });
      await plc.click();
      await expectNoViolations(page, 'outline');
      await plc.focus();
      await page.keyboard.press('l');
      await expectNoViolations(page, 'outline device picker');
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Diagram' }).click();
      await deviceNode(page, 'Filtration PLC').focus();
      await page.keyboard.press('l');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.is-connect-target')).toHaveCount(1);
      await expectNoViolations(page, 'pending keyboard connection');
    });

    test('comparison view has no violations', async ({ page }) => {
      await clearSelection(page);
      await page.getByLabel('Revision name').first().fill('Baseline');
      await page.getByRole('button', { name: 'Save revision' }).click();
      await deviceNode(page, 'Filtration PLC').click();
      await page.getByLabel('Firmware').fill('V4.2');
      await clearSelection(page);
      await page.getByRole('button', { name: 'Compare', exact: true }).click();
      await expect(page.locator('.change-summary')).toBeVisible();
      await expectNoViolations(page, 'comparison');
    });
  });
}
