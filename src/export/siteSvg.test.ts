import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { findingsByItem, runChecks } from '../model/checks';
import { toMarkup } from './markup';
import { fit, renderSiteSvg, siteStubs, wrap } from './siteSvg';
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

  it('wraps at spaces and splits words longer than a line', () => {
    expect(wrap('one two three', 8)).toEqual(['one two', 'three']);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('a\n\nb', 10)).toEqual(['a', '', 'b']);
  });
});
