// Draws the installed-app icons in public/ from the favicon's design. Run it again after changing
// public/favicon.svg: `node scripts/app-icons.mjs` (needs `npx playwright install chromium` once).
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BG = '#0f2a3d';
// The favicon's mark, on a 32 × 32 grid.
const MARK =
  '<g fill="none" stroke="#5eead4" stroke-width="2.4" stroke-linecap="round"><path d="M7 11h6v10h6V11h6"/>' +
  '<circle cx="7" cy="11" r="2" fill="#5eead4"/><circle cx="25" cy="11" r="2" fill="#5eead4"/></g>';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`;
// Rounded like the favicon, for places that show the icon as it is.
const rounded = svg(`<rect width="32" height="32" rx="7" fill="${BG}"/>${MARK}`);
// Full-bleed squares for systems that cut their own shape: Android's maskable icons keep only the
// middle 80 % circle, so the mark is drawn smaller; iOS rounds the corners itself.
const maskable = svg(`<rect width="32" height="32" fill="${BG}"/><g transform="translate(16 16) scale(0.8) translate(-16 -16)">${MARK}</g>`);
const square = svg(`<rect width="32" height="32" fill="${BG}"/>${MARK}`);

const ICONS = [
  { file: 'icon-192.png', size: 192, art: rounded },
  { file: 'icon-512.png', size: 512, art: rounded },
  { file: 'icon-maskable-512.png', size: 512, art: maskable },
  { file: 'apple-touch-icon.png', size: 180, art: square },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, art } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`);
  writeFileSync(`public/${file}`, await page.screenshot({ omitBackground: true }));
  console.log(`public/${file}`);
}
await browser.close();
