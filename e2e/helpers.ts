import { expect, type Locator, type Page } from '@playwright/test';

export type Theme = 'light' | 'dark' | 'contrast';

/**
 * Opens the app with empty browser storage. Storage is cleared once per test (not on every reload),
 * so tests can check that autosave survives a reload.
 */
export async function openApp(page: Page, { theme = 'light', path = '/' }: { theme?: Theme; path?: string } = {}): Promise<void> {
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('e2e:init')) return;
    sessionStorage.setItem('e2e:init', '1');
    localStorage.clear();
    localStorage.setItem('conduitot:theme', t);
    // Tests start past the first-run tour; the tour has its own test.
    localStorage.setItem('conduitot:prefs', JSON.stringify({ tourSeen: true }));
  }, theme);
  await page.goto(path);
  await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
}

export const deviceNode = (page: Page, label: string): Locator => page.locator('.react-flow__node-device', { hasText: label }).first();

export const deviceCount = (page: Page): Promise<number> => page.locator('.react-flow__node-device').count();

/** Clears the selection by clicking empty canvas, so the properties panel shows the project overview. */
export async function clearSelection(page: Page): Promise<void> {
  // Lanes cover most of the pane, so a real click could land on one; dispatch on the pane itself.
  await page.locator('.react-flow__pane').dispatchEvent('click');
}

/** Loads a template from the New gallery; the demo starts unedited, so no confirmation appears. */
export async function loadTemplate(page: Page, title: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
