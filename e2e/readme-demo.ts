// Records the animated demo at the top of README.md (docs/images/demo.gif) from the current build:
// npm run readme:demo. Needs ffmpeg on the PATH. Not a test (no .spec suffix, so the normal e2e run skips it).
//
// The scene, with the device palette folded: the demo plant, a direct link drawn from the office workstation to the pump station RTU, the IEC 62443
// finding it raises, and the attack path it opens, highlighted on the canvas. Captions and a pointer are drawn
// over the page, and the minimap is hidden, for the recording only; they are not part of the app.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { deviceNode, openApp } from './helpers';

const SIZE = { width: 1280, height: 720 };
const OUT = 'docs/images/demo.gif';
/** GIF width in pixels, and frames per second: small enough for a README, smooth enough to follow. */
const GIF_WIDTH = 960;
const GIF_FPS = 10;

test.use({ viewport: SIZE });

/** A pointer that follows the mouse, and a caption bar; the recording shows neither otherwise. */
async function addOverlay(page: Page) {
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
        #demo-pointer { position: fixed; z-index: 2147483647; width: 22px; height: 22px; margin: -3px 0 0 -3px;
          pointer-events: none; transition: transform 0.08s; left: -50px; top: -50px; }
        #demo-pointer.down { transform: scale(0.85); }
        /* The minimap would cover the pump station RTU, where the demo ends; hidden for the recording only. */
        .react-flow__minimap { display: none; }
        #demo-caption { position: fixed; z-index: 2147483646; left: 50%; top: 50px; transform: translateX(-50%);
          max-width: 80%; padding: 10px 18px; border-radius: 10px; background: rgba(15, 23, 42, 0.88); color: #fff;
          font: 600 17px/1.35 system-ui, sans-serif; text-align: center; pointer-events: none; opacity: 0;
          transition: opacity 0.2s; }
        #demo-caption.on { opacity: 1; }`;
      document.head.append(style);
      const pointer = document.createElement('div');
      pointer.id = 'demo-pointer';
      pointer.innerHTML =
        '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.5 L13.4 19.2 L10.4 12.6 L16.5 12.4 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      const caption = document.createElement('div');
      caption.id = 'demo-caption';
      document.body.append(pointer, caption);
      addEventListener('mousemove', (e) => {
        pointer.style.left = `${e.clientX}px`;
        pointer.style.top = `${e.clientY}px`;
      }, true);
      addEventListener('mousedown', () => pointer.classList.add('down'), true);
      addEventListener('mouseup', () => pointer.classList.remove('down'), true);
    });
  });
}

async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    const el = document.getElementById('demo-caption')!;
    el.textContent = t;
    el.classList.toggle('on', t !== '');
  }, text);
}

/** Where the pointer is, so each move glides from there. */
let at = { x: SIZE.width / 2, y: SIZE.height / 2 };

async function glideTo(page: Page, x: number, y: number) {
  const distance = Math.hypot(x - at.x, y - at.y);
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(distance / 14)) });
  at = { x, y };
}

async function centreOf(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function clickOn(page: Page, target: Locator) {
  const c = await centreOf(target);
  await glideTo(page, c.x, c.y);
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

test('demo: draw a risky link, see the IEC 62443 finding and the attack path it opens', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await addOverlay(page);
  await openApp(page);
  // Fold the device palette (its own shortcut) so the canvas has more room, then frame the plant again.
  await page.keyboard.press('Control+b');
  await page.locator('.react-flow__controls-fitview').click();
  await page.waitForTimeout(900);
  await page.mouse.move(at.x, at.y);

  // Chrome's screencast sends a frame each time the page changes, with its time; the frames become the GIF below.
  // (Playwright's own video needs a separate ffmpeg download, so it isn't used.)
  const frameDir = testInfo.outputPath('frames');
  mkdirSync(frameDir, { recursive: true });
  const frames: { file: string; time: number }[] = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(frameDir, `${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, time: metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: SIZE.width, maxHeight: SIZE.height });

  await caption(page, 'Model an OT plant on Purdue levels, with IEC 62443 zones, protocol flows and firewall rules');
  await page.waitForTimeout(2600);

  // Draw a link from the office workstation (L4) straight down to the pump station RTU (L1).
  await caption(page, 'Draw a link: office workstation (L4) straight to the pump station RTU (L1)');
  const from = deviceNode(page, 'Office workstation').locator('.react-flow__handle.source');
  const to = deviceNode(page, 'Pump station RTU').locator('.react-flow__handle.target');
  await deviceNode(page, 'Office workstation').hover();
  const start = await centreOf(from);
  await glideTo(page, start.x, start.y);
  await page.waitForTimeout(300);
  await page.mouse.down();
  const end = await centreOf(to);
  await glideTo(page, end.x, end.y);
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /^Security 4 findings/ })).toBeVisible();
  await page.waitForTimeout(1400);

  await caption(page, 'The new link breaks IEC 62443 zone separation: the Security count goes up');
  await clickOn(page, page.getByRole('button', { name: /^Security \d+ finding/ }));
  await expect(page.getByText('IEC 62443 communication violation').first()).toBeVisible();
  await page.waitForTimeout(2800);

  await caption(page, 'Possible attack paths, each step labelled with MITRE ATT&CK for ICS');
  await clickOn(page, page.getByRole('tab', { name: /^Attack paths/ }));
  await page.waitForTimeout(900);
  await clickOn(page, page.getByRole('tabpanel').getByRole('button', { name: 'Office workstation → Pump station RTU' }));
  await expect(page.locator('.path-step-badge').first()).toBeVisible();
  await glideTo(page, SIZE.width - 60, SIZE.height - 120);
  await page.waitForTimeout(3200);

  await caption(page, 'Open source, runs in your browser, works offline · resecarc.vijaykumarkk.in');
  await page.waitForTimeout(2600);

  const endTime = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');

  // Each frame is shown until the next one arrived; the last one until the end of the scene.
  const list = frames.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${((frames[i + 1]?.time ?? endTime) - f.time).toFixed(3)}`);
  const concat = testInfo.outputPath('frames.txt');
  writeFileSync(concat, `${list.join('\n')}\nfile '${frames.at(-1)!.file.replace(/\\/g, '/')}'\n`);

  // A palette made for this recording keeps the colours clean; the GIF loops forever.
  mkdirSync('docs/images', { recursive: true });
  const filters = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat,
    '-filter_complex', `${filters},split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', OUT,
  ]);
});
