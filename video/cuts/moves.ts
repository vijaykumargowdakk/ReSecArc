// Reusable ReSecArc moves for the video scripts, using the same roles and labels as the app's browser tests.
import type { Locator } from 'playwright';
import type { Studio } from 'showpilot';

export const device = (s: Studio, label: string): Locator => s.page.locator('.react-flow__node-device', { hasText: label }).first();
export const paletteItem = (s: Studio, name: string): Locator => s.page.locator('.palette__item', { hasText: new RegExp(`^${name}`) }).first();
export const securityButton = (s: Studio): Locator => s.page.getByRole('button', { name: /^Security \d+ finding/ });
export const panel = (s: Studio): Locator => s.page.getByRole('tabpanel');

/** The right-hand properties panel, for the camera (app pixels at 1920×1080). */
export const PROPERTIES = { x: 1580, y: 60, width: 340, height: 640 };

/** Clicks empty canvas so nothing is selected. Lanes cover most of the pane, so the click is delivered to the pane. */
export async function clearSelection(s: Studio) {
  await s.moveTo({ x: 1350, y: 160 });
  await s.page.locator('.react-flow__pane').dispatchEvent('click');
  await s.wait(0.3);
}

/** Selects a device, then links it to another through the properties panel's "Link to…" search. */
export async function link(s: Studio, from: string, to: string) {
  await s.click(device(s, from), from);
  await s.click(s.page.getByRole('button', { name: 'Link to…' }));
  await s.type(s.page.getByRole('textbox', { name: new RegExp(`Link ${from} to`) }), to);
  await s.click(s.page.getByRole('list', { name: new RegExp(`Link ${from} to`) }).getByRole('button', { name: new RegExp(to) }).first());
}

/** The camera box around several devices. */
export async function around(s: Studio, labels: string[]) {
  const boxes = await Promise.all(labels.map((l) => s.box(device(s, l))));
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
}
