// Draws one site as a standalone SVG from the project alone: Purdue lanes, area frames, devices,
// links, flows, notes and stubs for devices on other sites. Unlike the image export it needs no
// open canvas, so the report can include every site. Colours are fixed for printing. Levels with
// stacking on show each stack as one card with a count, as on the canvas.
import { kindLabel } from '../model/catalog';
import type { Finding, Severity } from '../model/checks';
import { flowLabel, getProtocol } from '../model/protocols';
import { LANE_HEIGHT, LANE_WIDTH, laneTop, levelLabel, NODE_HEIGHT, NODE_WIDTH, PURDUE_LANES } from '../model/purdue';
import { along, FLOW_OFFSET, midpoint, routeBetween, type Box, type Point } from '../model/routing';
import type { Device, Note, Project } from '../model/schema';
import { mergeEdges, stacksOf } from '../model/stacks';
import { escapeXml as x, iconAttrs, iconBody } from './markup';

export const DIAGRAM_COLORS = {
  background: '#ffffff',
  ink: '#0f1c2a',
  faint: '#5f6c79',
  line: '#b9c3cd',
  laneA: '#f7f9fb',
  laneB: '#edf1f5',
  dmz: '#f4f0fe',
  link: '#5b6b7b',
  danger: '#b42318',
  icon: { ink: '#1d3b4f', fill: '#cde7e3', badge: '#ffffff' },
  severity: { high: '#b42318', medium: '#b54708', low: '#667085' } satisfies Record<Severity, string>,
} as const;
const C = DIAGRAM_COLORS;

const PAD = 24;
const PORTAL = { width: 180, height: 40, gap: 80, row: 48 };
const NOTE_LINE = 18;
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'Cascadia Code', Consolas, monospace";

/** Rough text width, enough to size label backgrounds and shorten long names. */
const CHAR = { bold: 0.55, normal: 0.5 };
const textWidth = (s: string, size: number, bold = false) => s.length * size * (bold ? CHAR.bold : CHAR.normal);

/** Shortens `s` with an ellipsis so it fits in about `px` pixels. */
export function fit(s: string, px: number, size: number, bold = false): string {
  if (textWidth(s, size, bold) <= px) return s;
  const keep = Math.max(1, Math.floor(px / (size * (bold ? CHAR.bold : CHAR.normal))) - 1);
  return `${s.slice(0, keep).trimEnd()}…`;
}

/** Splits note text into lines of about `chars` characters, breaking at spaces where it can. */
export function wrap(text: string, chars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      for (let w = word; w; ) {
        const room = line ? chars - line.length - 1 : chars;
        if (w.length <= room) {
          line = line ? `${line} ${w}` : w;
          w = '';
        } else if (line) {
          lines.push(line);
          line = '';
        } else {
          lines.push(w.slice(0, chars));
          w = w.slice(chars);
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

const noteLines = (note: Note) => wrap(note.text.trim() || ' ', Math.max(8, Math.floor((note.width - 20) / 6.9)));
export const noteHeight = (note: Note) => Math.max(40, 16 + noteLines(note).length * NOTE_LINE);

const boxOf = (r: { x: number; y: number; width: number; height: number }): Box => ({
  cx: r.x + r.width / 2,
  cy: r.y + r.height / 2,
  hw: r.width / 2,
  hh: r.height / 2,
});
const pathOf = (points: readonly Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`).join(' ');
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Stub {
  device: Device;
  siteName: string;
  x: number;
  y: number;
}

/**
 * Stubs for devices on other sites, placed as on the canvas: in a column right of everything on
 * this site, level with the local end of the connection, stepping down so none overlap.
 */
export function siteStubs(project: Project, siteId: string): Map<string, Stub> {
  const device = new Map(project.devices.map((d) => [d.id, d]));
  const siteName = new Map(project.sites.map((s) => [s.id, s.name]));
  const local = project.devices.filter((d) => d.siteId === siteId);
  const right = Math.max(
    0,
    ...local.map((d) => d.position.x + NODE_WIDTH),
    ...project.areas.filter((a) => a.siteId === siteId).map((a) => a.rect.x + a.rect.width),
    ...project.notes.filter((n) => n.siteId === siteId).map((n) => n.position.x + n.width),
  );
  const stubs = new Map<string, Stub>();
  for (const e of [...project.links, ...project.flows]) {
    const a = device.get(e.source);
    const b = device.get(e.target);
    if (!a || !b || (a.siteId === siteId) === (b.siteId === siteId)) continue;
    const [here, there] = a.siteId === siteId ? [a, b] : [b, a];
    if (stubs.has(there.id)) continue;
    let y = here.position.y;
    for (let step = 0; step <= 2 * stubs.size && [...stubs.values()].some((s) => Math.abs(s.y - y) < PORTAL.row); step++) y += PORTAL.row;
    stubs.set(there.id, { device: there, siteName: siteName.get(there.siteId) ?? '', x: right + PORTAL.gap, y });
  }
  return stubs;
}

export interface SiteSvgOptions {
  /** Prefix for ids inside the SVG, so several diagrams can share one page. */
  idPrefix?: string;
  /** Findings per item id: links and flows with a high-severity finding are drawn red, devices show a count. */
  findings?: ReadonlyMap<string, readonly Finding[]>;
}

const worst = (list: readonly Finding[]): Severity =>
  list.some((f) => f.severity === 'high') ? 'high' : list.some((f) => f.severity === 'medium') ? 'medium' : 'low';

export function renderSiteSvg(project: Project, siteId: string, options: SiteSvgOptions = {}): string {
  const id = options.idPrefix ?? 'site';
  const findings = options.findings ?? new Map<string, readonly Finding[]>();
  const site = project.sites.find((s) => s.id === siteId);
  const zone = new Map(project.zones.map((z) => [z.id, z]));
  const devices = project.devices.filter((d) => d.siteId === siteId);
  const onSite = new Set(devices.map((d) => d.id));
  const areas = project.areas.filter((a) => a.siteId === siteId);
  const notes = project.notes.filter((n) => n.siteId === siteId);
  const stubs = siteStubs(project, siteId);
  const links = project.links.filter((l) => onSite.has(l.source) || onSite.has(l.target));
  const flows = project.flows.filter((f) => onSite.has(f.source) || onSite.has(f.target));
  // A stack is drawn where its first member is; its members' links and flows merge onto it.
  const { stackOf } = stacksOf(project, siteId);
  const lead = (deviceId: string) => stackOf.get(deviceId)?.members[0].id ?? deviceId;

  const rects = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const d of devices) rects.set(d.id, { ...(stackOf.get(d.id)?.members[0] ?? d).position, width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const s of stubs.values()) rects.set(s.device.id, { x: s.x, y: s.y, width: PORTAL.width, height: PORTAL.height });

  // Bounds cover the lanes and everything drawn, including bend points.
  const xs = [0, LANE_WIDTH];
  const ys = [0, PURDUE_LANES.length * LANE_HEIGHT];
  for (const r of [...rects.values(), ...areas.map((a) => a.rect), ...notes.map((n) => ({ ...n.position, width: n.width, height: noteHeight(n) }))]) {
    xs.push(r.x, r.x + r.width);
    ys.push(r.y, r.y + r.height);
  }
  for (const p of [...links, ...flows].flatMap((e) => e.waypoints)) {
    xs.push(p.x);
    ys.push(p.y);
  }
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) + PAD - minX;
  const height = Math.max(...ys) + PAD - minY;

  const out: string[] = [];
  const titleId = `${id}-title`;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(minX)} ${r1(minY)} ${r1(width)} ${r1(height)}" width="${Math.round(width)}" height="${Math.round(height)}" ` +
      `role="img" aria-labelledby="${titleId}" font-family="${x(FONT)}" style="background:${C.background}">`,
    `<title id="${titleId}">${x(`Diagram of site ${site?.name ?? siteId}: ${devices.length} devices, ${links.length} links, ${flows.length} protocol flows`)}</title>`,
  );

  // Arrowheads, one per flow colour in use.
  const colors = [...new Set(flows.map((f) => getProtocol(f.protocol)?.color ?? C.faint)), C.danger];
  const marker = (color: string) => `${id}-arrow-${colors.indexOf(color)}`;
  out.push(
    `<defs>${colors
      .map((c) => `<marker id="${marker(c)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${x(c)}"/></marker>`)
      .join('')}</defs>`,
  );
  out.push(`<rect x="${r1(minX)}" y="${r1(minY)}" width="${r1(width)}" height="${r1(height)}" fill="${C.background}"/>`);

  // Purdue lanes.
  PURDUE_LANES.forEach((lane, i) => {
    const top = laneTop(lane.level);
    const fill = lane.level === 3.5 ? C.dmz : i % 2 ? C.laneB : C.laneA;
    out.push(
      `<g aria-hidden="true"><rect x="${r1(minX)}" y="${top}" width="${r1(width)}" height="${LANE_HEIGHT}" fill="${fill}"/>`,
      `<path d="M${r1(minX)} ${top + LANE_HEIGHT}H${r1(minX + width)}" stroke="${C.line}" stroke-dasharray="4 4"/>`,
      `<text x="${r1(minX + 18)}" y="${top + LANE_HEIGHT / 2 - 4}" font-family="${x(MONO)}" font-size="22" font-weight="700" fill="${C.faint}">${levelLabel(lane.level)}</text>`,
      `<text font-size="11" letter-spacing="0.6" fill="${C.faint}">${wrap(lane.name.toUpperCase(), 24)
        .map((line, n) => `<tspan x="${r1(minX + 18)}" y="${top + LANE_HEIGHT / 2 + 16 + n * 14}">${x(line)}</tspan>`)
        .join('')}</text></g>`,
    );
  });

  // Area frames, always drawn open so every device shows.
  for (const a of areas) {
    const head = fit(a.name, a.rect.width - 20, 12, true);
    out.push(
      `<g><rect x="${a.rect.x}" y="${a.rect.y}" width="${a.rect.width}" height="${a.rect.height}" rx="12" fill="${a.color}" fill-opacity="0.06" stroke="${a.color}" stroke-width="2" stroke-dasharray="6 4"/>`,
      `<path d="M${a.rect.x} ${a.rect.y + 22}V${a.rect.y + 12}a12 12 0 0 1 12 -12H${r1(a.rect.x + textWidth(head, 12, true) + 20)}v12a10 10 0 0 1 -10 10z" fill="${a.color}"/>`,
      `<text x="${a.rect.x + 10}" y="${a.rect.y + 15}" font-size="12" font-weight="600" fill="#ffffff">${x(head)}</text></g>`,
    );
  }

  const ends = (source: string, target: string) => {
    const a = rects.get(source);
    const b = rects.get(target);
    return a && b ? ([boxOf(a), boxOf(b)] as const) : null;
  };
  const labels: string[] = [];

  /** A small "×N" label for a link that stands for several. */
  const countLabel = (at: Point, count: number) => {
    const text = `×${count}`;
    const w = textWidth(text, 10, true) + 10;
    return (
      `<g><rect x="${r1(at.x - w / 2)}" y="${r1(at.y - 8)}" width="${r1(w)}" height="16" rx="8" fill="${C.background}" stroke="${C.line}"/>` +
      `<text x="${r1(at.x)}" y="${r1(at.y + 3.5)}" font-size="10" font-weight="700" text-anchor="middle" fill="${C.ink}">${text}</text></g>`
    );
  };

  for (const { edge: l, source, target, count } of mergeEdges(links, lead)) {
    const e = ends(source, target);
    if (!e) continue;
    const points = routeBetween(e[0], e[1], 0, l.waypoints);
    const red = findings.get(l.id)?.some((f) => f.severity === 'high');
    const dash = l.medium === 'serial' ? ' stroke-dasharray="2 4"' : l.medium === 'wireless' ? ' stroke-dasharray="8 5"' : '';
    out.push(`<path d="${pathOf(points)}" fill="none" stroke="${red ? C.danger : C.link}" stroke-width="${red ? 3 : 2}"${dash}/>`);
    if (count > 1) {
      labels.push(countLabel(midpoint(points), count));
      continue;
    }
    for (const [name, at] of [
      [l.sourcePort, along(points[0], points[1], 30)],
      [l.targetPort, along(points[points.length - 1], points[points.length - 2], 30)],
    ] as const) {
      if (!name) continue;
      const w = textWidth(name, 10) + 8;
      labels.push(
        `<g><rect x="${r1(at.x - w / 2)}" y="${r1(at.y - 8)}" width="${r1(w)}" height="16" rx="3" fill="${C.background}" stroke="${C.line}"/>` +
          `<text x="${r1(at.x)}" y="${r1(at.y + 3.5)}" font-family="${x(MONO)}" font-size="10" text-anchor="middle" fill="${C.ink}">${x(name)}</text></g>`,
      );
    }
  }

  for (const { edge: f, source, target, count } of mergeEdges(flows, lead)) {
    const e = ends(source, target);
    if (!e) continue;
    const points = routeBetween(e[0], e[1], FLOW_OFFSET, f.waypoints);
    const def = getProtocol(f.protocol);
    const red = findings.get(f.id)?.some((g) => g.severity === 'high');
    const color = red ? C.danger : (def?.color ?? C.faint);
    out.push(
      `<path d="${pathOf(points)}" fill="none" stroke="${x(color)}" stroke-width="${red ? 3 : 2}" stroke-dasharray="${x(def?.dash ?? '6 4')}" marker-end="url(#${marker(color)})"/>`,
    );
    const text = `${flowLabel(f.protocol, f.settings)}${count > 1 ? ` ×${count}` : ''}`;
    const mid = midpoint(points);
    const w = textWidth(text, 10.5, true) + 14;
    labels.push(
      `<g><rect x="${r1(mid.x - w / 2)}" y="${r1(mid.y - 9)}" width="${r1(w)}" height="18" rx="9" fill="${C.background}" stroke="${x(color)}" stroke-width="1.5"/>` +
        `<text x="${r1(mid.x)}" y="${r1(mid.y + 4)}" font-size="10.5" font-weight="600" text-anchor="middle" fill="${C.ink}">${x(text)}</text></g>`,
    );
  }

  // Edge labels go under the devices, as on the canvas.
  out.push(...labels);

  devices.forEach((d, i) => {
    const stack = stackOf.get(d.id);
    if (stack && stack.members[0] !== d) return;
    const { x: dx, y: dy } = d.position;
    const clip = `${id}-text-${i}`;
    const z = d.zoneId ? zone.get(d.zoneId) : undefined;
    const kind = kindLabel(d.type, d.variant);
    const members = stack?.members ?? [d];
    const meta = `${stack ? `${members.length} devices` : kind} · ${levelLabel(d.purdueLevel)}${z ? ` · ${z.name}` : ''}`;
    const list = members.flatMap((m) => findings.get(m.id) ?? []);
    const crit = members.some((m) => m.criticality === 'high') ? 'high' : members.some((m) => m.criticality === 'medium') ? 'medium' : 'low';
    const name = stack ? kind : d.label || kind;
    out.push(
      `<g><title>${x(stack ? `Stack of ${members.length} ${kind}: ${members.map((m) => m.label).join(', ')}` : `${d.label || kind}: ${meta}, ${crit} criticality`)}</title>`,
      // Two cards peek out behind a stack, as on the canvas.
      ...(stack
        ? [10, 5].map((o) => `<rect x="${dx + o + 0.5}" y="${dy + o + 0.5}" width="${NODE_WIDTH - 1}" height="${NODE_HEIGHT - 1}" rx="8" fill="#ffffff" stroke="${C.line}"/>`)
        : []),
      // The zone colour shows as a thick left edge, as on the canvas.
      `<rect x="${dx}" y="${dy}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8" fill="${z?.color ?? C.line}"/>`,
      `<rect x="${dx + 5}" y="${dy + 1}" width="${NODE_WIDTH - 6}" height="${NODE_HEIGHT - 2}" rx="6" fill="#ffffff"/>`,
      `<rect x="${dx + 0.5}" y="${dy + 0.5}" width="${NODE_WIDTH - 1}" height="${NODE_HEIGHT - 1}" rx="8" fill="none" stroke="${C.line}"/>`,
      `<svg x="${dx + 13}" y="${dy + 15}" width="34" height="34" viewBox="0 0 32 32" ${iconAttrs(C.icon)}>${iconBody(d.type, d.variant, C.icon)}</svg>`,
      // Names are shortened by an estimate of their width and clipped to the box in case the font is wider.
      `<clipPath id="${clip}"><rect x="${dx + 50}" y="${dy}" width="${NODE_WIDTH - 54}" height="${NODE_HEIGHT}"/></clipPath>`,
      `<g clip-path="url(#${clip})"><text x="${dx + 54}" y="${dy + 29}" font-size="13" font-weight="600" fill="${C.ink}">${x(fit(name, NODE_WIDTH - 74, 13, true))}</text>`,
      `<text x="${dx + 54}" y="${dy + 45}" font-size="11" fill="${C.faint}">${x(fit(meta, NODE_WIDTH - 62, 11))}</text></g>`,
      `<circle cx="${dx + NODE_WIDTH - 11.5}" cy="${dy + 11.5}" r="7.5" fill="${C.severity[crit === 'high' ? 'high' : crit === 'medium' ? 'medium' : 'low']}"/>`,
      `<text x="${dx + NODE_WIDTH - 11.5}" y="${dy + 14.5}" font-size="9" font-weight="700" text-anchor="middle" fill="#ffffff">${crit[0].toUpperCase()}</text>`,
    );
    if (stack) {
      const label = `×${members.length}`;
      const w = 12 + label.length * 6;
      out.push(
        `<rect x="${dx + 6}" y="${dy + NODE_HEIGHT - 8}" width="${w}" height="16" rx="8" fill="${C.ink}"/>`,
        `<text x="${dx + 6 + w / 2}" y="${dy + NODE_HEIGHT + 3.5}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#ffffff">${label}</text>`,
      );
    }
    if (list.length) {
      const label = String(list.length);
      out.push(
        `<rect x="${dx + NODE_WIDTH - 46}" y="${dy + 4}" width="${14 + label.length * 6}" height="15" rx="7.5" fill="${C.severity[worst(list)]}"/>`,
        `<text x="${dx + NODE_WIDTH - 39 + label.length * 3}" y="${dy + 15}" font-size="9.5" font-weight="700" text-anchor="middle" fill="#ffffff">${label}</text>`,
      );
    }
    out.push('</g>');
  });

  for (const s of stubs.values()) {
    out.push(
      `<g><title>${x(`${s.device.label} on site ${s.siteName}`)}</title>`,
      `<rect x="${s.x + 0.5}" y="${s.y + 0.5}" width="${PORTAL.width - 1}" height="${PORTAL.height - 1}" rx="18" fill="${C.laneA}" stroke="${C.line}" stroke-dasharray="4 3"/>`,
      `<text x="${s.x + 16}" y="${s.y + 17}" font-size="12" font-weight="600" fill="${C.ink}">${x(fit(s.device.label, PORTAL.width - 30, 12, true))}</text>`,
      `<text x="${s.x + 16}" y="${s.y + 31}" font-size="10.5" fill="${C.faint}">${x(fit(`↗ site ${s.siteName}`, PORTAL.width - 30, 10.5))}</text></g>`,
    );
  }

  for (const n of notes) {
    const lines = noteLines(n);
    const h = noteHeight(n);
    out.push(
      `<g><rect x="${n.position.x + 0.5}" y="${n.position.y + 0.5}" width="${n.width - 1}" height="${h - 1}" rx="8" fill="${n.color}" fill-opacity="0.09" stroke="${C.line}"/>`,
      `<path d="M${n.position.x + 4} ${n.position.y + 2}H${n.position.x + n.width - 4}" stroke="${n.color}" stroke-width="4" stroke-linecap="round"/>`,
      `<text font-size="12.5" fill="${C.ink}">${lines
        .map((line, i) => `<tspan x="${n.position.x + 10}" y="${n.position.y + 24 + i * NOTE_LINE}">${x(line)}</tspan>`)
        .join('')}</text></g>`,
    );
  }

  out.push('</svg>');
  return out.join('\n');
}
