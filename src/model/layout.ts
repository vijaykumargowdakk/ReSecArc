// One-click tidy layout for a site. Devices stay on their Purdue level and in their area; only
// their order and spacing within each lane change. Connected devices are pulled into line with
// each other by a few barycentre sweeps (the usual layered-graph heuristic).
import type { Rect } from './areas';
import { LANE_HEIGHT, laneTop, NODE_HEIGHT, NODE_WIDTH, PURDUE_LANES } from './purdue';
import { reassignAreas } from './structure';
import type { Device, Project, PurdueLevel } from './schema';

/** Left edge of the first device in a lane, clear of the lane label. */
export const LAYOUT_LEFT = 220;
export const LAYOUT_GAP = 30;
const AREA_PADDING = 20;
const AREA_GAP = 40;
const SWEEPS = 2;

const STEP = NODE_WIDTH + LAYOUT_GAP;
const rowWidth = (n: number) => n * NODE_WIDTH + Math.max(0, n - 1) * LAYOUT_GAP;

type Point = { x: number; y: number };

/** The centre line of a device row for `level`, kept inside `rect` when the row belongs to an area. */
function rowY(level: PurdueLevel, rect?: Rect): number {
  const top = laneTop(level);
  if (!rect) return top + (LANE_HEIGHT - NODE_HEIGHT) / 2;
  const lo = Math.max(top, rect.y);
  const hi = Math.min(top + LANE_HEIGHT, rect.y + rect.height);
  return (lo + hi) / 2 - NODE_HEIGHT / 2;
}

const overlapsBand = (r: Rect, top: number, bottom: number) => r.y < bottom && r.y + r.height > top;

export function tidyLayout(project: Project, siteId: string): Project {
  const devices = project.devices.filter((d) => d.siteId === siteId);
  if (devices.length === 0) return project;

  // 1. Widen areas that cannot fit their longest row, then push overlapping areas apart.
  const rects = new Map<string, Rect>();
  const siteAreas = project.areas.filter((a) => a.siteId === siteId).sort((a, b) => a.rect.x - b.rect.x);
  for (const area of siteAreas) {
    const counts = new Map<PurdueLevel, number>();
    for (const d of devices) if (d.areaId === area.id) counts.set(d.purdueLevel, (counts.get(d.purdueLevel) ?? 0) + 1);
    const needed = rowWidth(Math.max(0, ...counts.values())) + 2 * AREA_PADDING;
    const rect = { ...area.rect, width: Math.max(area.rect.width, needed) };
    // Shifting right past one area can land on another, so repeat until nothing overlaps. Every pass
    // moves past at least one placed area, so the pass count is bounded by the number of areas.
    for (let moved = true, pass = 0; moved && pass <= rects.size; pass++) {
      moved = false;
      for (const placed of rects.values()) {
        const sharesRows = rect.y < placed.y + placed.height && rect.y + rect.height > placed.y;
        if (sharesRows && rect.x < placed.x + placed.width + AREA_GAP && rect.x + rect.width + AREA_GAP > placed.x) {
          rect.x = placed.x + placed.width + AREA_GAP;
          moved = true;
        }
      }
    }
    rects.set(area.id, rect);
  }

  // 2. Barycentre sweeps: order each row by the mean x of its neighbours, then space it out.
  const pos = new Map<string, Point>(devices.map((d) => [d.id, { ...d.position }]));
  const neighbours = new Map<string, string[]>(devices.map((d) => [d.id, []]));
  for (const e of [...project.links, ...project.flows]) {
    if (pos.has(e.source) && pos.has(e.target)) {
      neighbours.get(e.source)!.push(e.target);
      neighbours.get(e.target)!.push(e.source);
    }
  }
  const key = (d: Device) => {
    const xs = neighbours.get(d.id)!.map((n) => pos.get(n)!.x);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : pos.get(d.id)!.x;
  };
  const ordered = (row: Device[]) =>
    row
      .map((d) => ({ d, k: key(d), x: pos.get(d.id)!.x }))
      .sort((a, b) => a.k - b.k || a.x - b.x || a.d.id.localeCompare(b.d.id))
      .map((r) => r.d);

  const placeLevel = (level: PurdueLevel) => {
    const inLevel = devices.filter((d) => d.purdueLevel === level);
    for (const [areaId, rect] of rects) {
      const row = ordered(inLevel.filter((d) => d.areaId === areaId));
      const start = rect.x + (rect.width - rowWidth(row.length)) / 2;
      row.forEach((d, i) => pos.set(d.id, { x: Math.round(start + i * STEP), y: Math.round(rowY(level, rect)) }));
    }
    const top = laneTop(level);
    const blocked = [...rects.values()].filter((r) => overlapsBand(r, top, top + LANE_HEIGHT)).sort((a, b) => a.x - b.x);
    let x = LAYOUT_LEFT;
    for (const d of ordered(inLevel.filter((dev) => dev.areaId === null || !rects.has(dev.areaId)))) {
      for (const r of blocked) {
        if (x < r.x + r.width + LAYOUT_GAP && x + NODE_WIDTH + LAYOUT_GAP > r.x) x = r.x + r.width + LAYOUT_GAP;
      }
      pos.set(d.id, { x, y: Math.round(rowY(level)) });
      x += STEP;
    }
  };

  const levels = PURDUE_LANES.map((l) => l.level);
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (const level of levels) placeLevel(level);
    for (const level of [...levels].reverse()) placeLevel(level);
  }

  const next: Project = {
    ...project,
    areas: project.areas.map((a) => (rects.has(a.id) ? { ...a, rect: rects.get(a.id)! } : a)),
    devices: project.devices.map((d) => (pos.has(d.id) ? { ...d, position: pos.get(d.id)! } : d)),
  };
  return reassignAreas(next, siteId);
}

/** True when two device nodes on the same site would overlap; used by tests and as a sanity check. */
export function overlapping(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT;
}
