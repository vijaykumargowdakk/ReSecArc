import { describe, expect, it } from 'vitest';
import { loadTemplate, TEMPLATES } from '../examples/templates';
import { NODE_HEIGHT, NODE_WIDTH } from '../model/purdue';
import { FLOW_OFFSET } from '../model/routing';
import { pageId, projectToDrawio } from './drawio';

/** The cells of each page, read with a pattern; the browser test parses the whole file as XML. */
function pages(xml: string) {
  return [...xml.matchAll(/<diagram id="([^"]+)" name="([^"]*)">([\s\S]*?)<\/diagram>/g)].map(([, id, name, body]) => ({
    id,
    name,
    cells: [...body.matchAll(/<(mxCell|UserObject)\b([^>]*?)\/?>/g)].map(([, tag, attrs]) => ({
      tag,
      attrs: Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
    })),
  }));
}

describe('projectToDrawio', () => {
  it('pins straight protocol flows beside their links, as the canvas draws them (issue #21)', () => {
    const p = loadTemplate('water-treatment');
    const [page] = pages(projectToDrawio(p));
    const styleOf = (c: { attrs: Record<string, string> }) =>
      Object.fromEntries(c.attrs.style.split(';').filter(Boolean).map((kv) => kv.split('=') as [string, string]));
    const card = new Map(p.devices.map((d) => [`x-${d.id}`, d.position]));
    const straight = p.flows.filter((f) => f.waypoints.length === 0);
    expect(straight.length).toBeGreaterThan(0);
    for (const f of straight) {
      const cell = page.cells.find((c) => c.attrs.id === `x-${f.id}`)!;
      const st = styleOf(cell);
      expect(st.exitPerimeter, f.id).toBe('0');
      expect(st.entryPerimeter, f.id).toBe('0');
      const a = card.get(cell.attrs.source)!;
      const b = card.get(cell.attrs.target)!;
      const from = { x: a.x + Number(st.exitX) * NODE_WIDTH, y: a.y + Number(st.exitY) * NODE_HEIGHT };
      const to = { x: b.x + Number(st.entryX) * NODE_WIDTH, y: b.y + Number(st.entryY) * NODE_HEIGHT };
      // Each end is on its card's edge…
      for (const [pt, at] of [[from, a], [to, b]] as const) {
        const onX = Math.abs(pt.x - at.x) < 0.01 || Math.abs(pt.x - at.x - NODE_WIDTH) < 0.01;
        const onY = Math.abs(pt.y - at.y) < 0.01 || Math.abs(pt.y - at.y - NODE_HEIGHT) < 0.01;
        expect(onX || onY, `${f.id} end on the card's edge`).toBe(true);
      }
      // …and both ends sit FLOW_OFFSET to the same side of the line between the cards' centres, where the link runs.
      const c1 = { x: a.x + NODE_WIDTH / 2, y: a.y + NODE_HEIGHT / 2 };
      const c2 = { x: b.x + NODE_WIDTH / 2, y: b.y + NODE_HEIGHT / 2 };
      const len = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      const side = (pt: { x: number; y: number }) => ((c2.x - c1.x) * (pt.y - c1.y) - (c2.y - c1.y) * (pt.x - c1.x)) / len;
      expect(side(from), f.id).toBeCloseTo(FLOW_OFFSET, 1);
      expect(side(to), f.id).toBeCloseTo(FLOW_OFFSET, 1);
    }
    // Links are left to draw.io: no pinned ends.
    for (const l of p.links) expect(page.cells.find((c) => c.attrs.id === `x-${l.id}`)!.attrs.style).not.toContain('exitX');
  });

  it('writes one page per site, every edge ending on a shape of that page', () => {
    for (const t of TEMPLATES) {
      const p = loadTemplate(t.id);
      const out = pages(projectToDrawio(p));
      expect(out.map((pg) => pg.name)).toEqual(p.sites.map((s) => s.name));
      for (const pg of out) {
        const ids = pg.cells.map((c) => c.attrs.id).filter(Boolean);
        expect(new Set(ids).size, `${t.id}/${pg.name}`).toBe(ids.length);
        const known = new Set(ids);
        for (const c of pg.cells.filter((c) => c.attrs.edge === '1')) {
          expect(known.has(c.attrs.source), `${t.id}: ${c.attrs.source}`).toBe(true);
          expect(known.has(c.attrs.target), `${t.id}: ${c.attrs.target}`).toBe(true);
        }
      }
    }
  });

  it('puts every device, link and flow on the page of its site', () => {
    const p = loadTemplate('pipeline');
    const out = pages(projectToDrawio(p));
    const devices = out.flatMap((pg) => pg.cells.filter((c) => c.tag === 'UserObject' && c.attrs.id.startsWith('x-')));
    expect(devices).toHaveLength(p.devices.length);
    // A link between two sites is drawn on both pages, ending on a stub on each.
    const edges = out.flatMap((pg) => pg.cells.filter((c) => c.attrs.edge === '1'));
    const site = new Map(p.devices.map((d) => [d.id, d.siteId]));
    const crossing = [...p.links, ...p.flows].filter((e) => site.get(e.source) !== site.get(e.target)).length;
    expect(edges).toHaveLength(p.links.length + p.flows.length + crossing);
  });

  it('links stubs to the page of the site they stand for', () => {
    const p = loadTemplate('pipeline');
    const xml = projectToDrawio(p);
    const stubs = pages(xml).flatMap((pg) => pg.cells.filter((c) => c.attrs.id?.startsWith('s-')));
    expect(stubs.length).toBeGreaterThan(0);
    for (const s of stubs) {
      const device = p.devices.find((d) => `s-${d.id}` === s.attrs.id)!;
      expect(s.attrs.link).toBe(`data:page/id,${pageId(p.sites.findIndex((x) => x.id === device.siteId))}`);
    }
  });

  it('locks the Purdue lanes layer and carries asset details as shape data', () => {
    const p = loadTemplate('water-treatment');
    const xml = projectToDrawio(p);
    expect(xml).toContain('<mxCell id="lanes" value="Purdue levels" style="locked=1;" parent="0"/>');
    const d = p.devices.find((x) => x.asset.ip)!;
    const cell = pages(xml)[0].cells.find((c) => c.attrs.id === `x-${d.id}`)!;
    expect(cell.attrs.ip).toBe(d.asset.ip);
    expect(cell.attrs.level).toMatch(/^L/);
  });

  it('embeds each icon as a base64 SVG in the form draw.io reads', () => {
    const p = loadTemplate('water-treatment');
    const styles = [...projectToDrawio(p).matchAll(/image=data:image\/svg\+xml,([A-Za-z0-9+/=]+);/g)].map((m) => m[1]);
    expect(styles).toHaveLength(p.devices.length);
    expect(atob(styles[0])).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('escapes names, keeps line breaks in notes and keeps style separators out of styles', () => {
    const p = loadTemplate('water-treatment');
    p.devices[0] = { ...p.devices[0], label: '"><script>x</script>' };
    p.areas.push({ id: 'a1', siteId: p.sites[0].id, name: 'A&B', color: '#123456', rect: { x: 0, y: 0, width: 300, height: 200 }, collapsed: false, locked: false });
    p.notes.push({ id: 'n1', siteId: p.sites[0].id, text: 'line one\nline two', position: { x: 0, y: 0 }, width: 200, color: '#123456', locked: false });
    p.sites[0] = { ...p.sites[0], name: 'Main <site>' };
    const xml = projectToDrawio(p);
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&quot;&gt;&lt;script&gt;');
    expect(xml).toContain('name="Main &lt;site&gt;"');
    expect(xml).toContain('value="line one&#xa;line two"');
    expect(xml).toContain('value="A&amp;B"');
  });
});
