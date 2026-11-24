import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { findingsByItem, runChecks } from '../model/checks';
import { toMarkup } from './markup';
import { estimateTextWidth, fit, renderSiteSvg, siteStubs, wrap, type TextMeasure } from './siteSvg';
import { ICONS } from '../ui/icons';

describe('toMarkup', () => {
  it('serialises every device icon, swapping theme variables for fixed colours', () => {
    for (const [name, icon] of Object.entries(ICONS)) {
      const svg = toMarkup(icon, { 'var(--icon-fill)': '#cde7e3', 'var(--icon-badge-bg, #fff)': '#ffffff' });
      expect(svg, name).not.toBe('');
      expect(svg, name).not.toContain('var(');
      expect(svg, name).not.toMatch(/stroke[A-Z]|className/);
    }
  });
});

describe('renderSiteSvg', () => {
  it('draws every device, link and flow of the site', () => {
    const p = loadTemplate('water-treatment');
    const svg = renderSiteSvg(p, p.sites[0].id);
    for (const d of p.devices) expect(svg).toContain(`<title>${d.label.replace(/&/g, '&amp;')}:`);
    expect(svg.match(/<path d="M[^"]*" fill="none" stroke="[^"]*" stroke-width="[23]"/g)?.length).toBe(p.links.length + p.flows.length);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('escapes names so a crafted label cannot add markup', () => {
    const p = loadTemplate('water-treatment');
    p.devices[0] = { ...p.devices[0], label: '<script>alert(1)</script>"&' };
    p.sites[0] = { ...p.sites[0], name: '</title><img src=x onerror=alert(1)>' };
    const svg = renderSiteSvg(p, p.sites[0].id);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('keeps ids apart when several diagrams share a page', () => {
    const p = loadTemplate('pipeline');
    const a = renderSiteSvg(p, p.sites[0].id, { idPrefix: 'a' });
    const b = renderSiteSvg(p, p.sites[1].id, { idPrefix: 'b' });
    const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(a).every((id) => id.startsWith('a-'))).toBe(true);
    expect(ids(b).every((id) => id.startsWith('b-'))).toBe(true);
    expect(new Set(ids(a)).size).toBe(ids(a).length);
  });

  it('shows devices on other sites as stubs', () => {
    const p = loadTemplate('pipeline');
    const cs1 = p.sites.find((s) => s.name === 'Compressor station 1')!;
    const stubs = siteStubs(p, cs1.id);
    expect(stubs.size).toBeGreaterThan(0);
    for (const s of stubs.values()) expect(s.device.siteId).not.toBe(cs1.id);
    const svg = renderSiteSvg(p, cs1.id);
    for (const s of stubs.values()) expect(svg).toContain(`site ${s.siteName}`);
  });

  it('draws links in high-severity findings red and counts findings on devices', () => {
    const p = loadTemplate('water-treatment');
    const findings = runChecks(p);
    const byItem = findingsByItem(p, findings);
    const plain = renderSiteSvg(p, p.sites[0].id);
    const marked = renderSiteSvg(p, p.sites[0].id, { findings: byItem });
    expect(findings.some((f) => f.severity === 'high')).toBe(true);
    expect(plain).not.toContain('stroke="#b42318" stroke-width="3"');
    expect(marked).toContain('stroke="#b42318" stroke-width="3"');
  });
});

describe('text helpers', () => {
  it('shortens long names with an ellipsis', () => {
    expect(fit('PLC', 100, 13)).toBe('PLC');
    expect(fit('A very long device name indeed', 60, 13)).toMatch(/…$/);
  });

  // A stand-in for a real font: narrow letters (i, l, I, 1, space) at 0.3 em, wide ones (W, M) at 0.95 em.
  const measured: TextMeasure = (s, size) => [...s].reduce((sum, c) => sum + size * (/[ilI1 .]/.test(c) ? 0.3 : /[WM]/.test(c) ? 0.95 : 0.55), 0);

  it('shortens by the measured width when given a measure (issue #40)', () => {
    // Narrow letters: the estimate would shorten this name, but measured it fits and is kept whole.
    const narrow = 'Illi lil 1111 illi lil';
    expect(fit(narrow, 116, 13, true)).toMatch(/…$/);
    expect(fit(narrow, 116, 13, true, measured)).toBe(narrow);
    // Wide letters: the estimate would keep this name, but measured it is too wide and is shortened.
    const wide = 'WWMM WMWM MW';
    expect(fit(wide, 116, 13, true)).toBe(wide);
    expect(fit(wide, 116, 13, true, measured)).toMatch(/…$/);
  });

  it('keeps as much of a name as fits, ellipsis included', () => {
    for (const name of ['Pump station RTU number 7 (north)', 'WWWWWWWWWWWWWW', 'Main IT/OT firewall', 'Illi lil 1111 illi lil illi']) {
      for (const measure of [estimateTextWidth, measured]) {
        const out = fit(name, 116, 13, true, measure);
        expect(measure(out, 13, true), `${name}: ${out}`).toBeLessThanOrEqual(116);
        if (out !== name) {
          // The same as trying every length and keeping the longest that fits.
          let best = 1;
          for (let k = 1; k < name.length; k++) if (measure(`${name.slice(0, k).trimEnd()}…`, 13, true) <= 116) best = k;
          expect(out).toBe(`${name.slice(0, best).trimEnd()}…`);
        }
      }
    }
  });

  it('the site diagram uses the measure it is given', () => {
    const p = loadTemplate('water-treatment');
    const long = { ...p, devices: p.devices.map((d) => (d.label === 'Filtration PLC' ? { ...d, label: 'Filtration PLC on the north train, line 1' } : d)) };
    const site = long.sites[0].id;
    // Everything fits when the measure says text is very narrow, and nothing does when it is very wide.
    expect(renderSiteSvg(long, site, { measure: () => 1 })).toContain('>Filtration PLC on the north train, line 1<');
    expect(renderSiteSvg(long, site, { measure: (s) => s.length * 50 })).not.toContain('>Filtration PLC on the north train, line 1<');
  });

  it('wraps at spaces and splits words longer than a line', () => {
    expect(wrap('one two three', 8)).toEqual(['one two', 'three']);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('a\n\nb', 10)).toEqual(['a', '', 'b']);
  });
});
