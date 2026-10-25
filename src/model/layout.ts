// One-click tidy layout for a site. Devices stay on their Purdue level and in their area; only
// their order and spacing within each lane change. Connected devices are pulled into line with
// each other by a few barycentre sweeps (the usual layered-graph heuristic). Locked devices and
// areas stay where they are and the others are placed around them; bend points on the site are
// cleared, since they were drawn for the old positions.
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
  //    Locked areas are placed first and never move, so the others shift around them.
  const rects = new Map<string, Rect>();
  const siteAreas = project.areas.filter((a) => a.siteId === siteId).sort((a, b) => a.rect.x - b.rect.x);
  for (const area of siteAreas.filter((a) => a.locked)) rects.set(area.id, { ...area.rect });
  for (const area of siteAreas.filter((a) => !a.locked)) {
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

  type Span = { x: number; width: number };
  const byX = (a: Span, b: Span) => a.x - b.x;
  const lockedSpans = (list: Device[]): Span[] => list.filter((d) => d.locked).map((d) => ({ x: d.position.x, width: NODE_WIDTH }));
  /** Places `row` left to right from `x`, jumping over `blocked` spans (sorted by x). */
  const placeRow = (row: Device[], x: number, y: number, blocked: Span[]) => {
    for (const d of row) {
      for (const r of blocked) {
        if (x < r.x + r.width + LAYOUT_GAP && x + NODE_WIDTH + LAYOUT_GAP > r.x) x = r.x + r.width + LAYOUT_GAP;
      }
      pos.set(d.id, { x: Math.round(x), y: Math.round(y) });
      x += STEP;
    }
  };

  const placeLevel = (level: PurdueLevel) => {
    const inLevel = devices.filter((d) => d.purdueLevel === level);
    for (const [areaId, rect] of rects) {
      const members = inLevel.filter((d) => d.areaId === areaId);
      const row = ordered(members.filter((d) => !d.locked));
      const fixed = lockedSpans(members).sort(byX);
      // With nothing locked the row is centred; otherwise it fills from the left around the locked devices.
      const start = fixed.length ? rect.x + AREA_PADDING : rect.x + (rect.width - rowWidth(row.length)) / 2;
      placeRow(row, start, rowY(level, rect), fixed);
    }
    const top = laneTop(level);
    const free = inLevel.filter((dev) => dev.areaId === null || !rects.has(dev.areaId));
    const blocked = [...[...rects.values()].filter((r) => overlapsBand(r, top, top + LANE_HEIGHT)), ...lockedSpans(free)].sort(byX);
    placeRow(ordered(free.filter((d) => !d.locked)), LAYOUT_LEFT, rowY(level), blocked);
  };

  const levels = PURDUE_LANES.map((l) => l.level);
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (const level of levels) placeLevel(level);
    for (const level of [...levels].reverse()) placeLevel(level);
  }

  const onSite = new Set(devices.map((d) => d.id));
  const touches = (e: { source: string; target: string }) => onSite.has(e.source) || onSite.has(e.target);
  const next: Project = {
    ...project,
    areas: project.areas.map((a) => (rects.has(a.id) ? { ...a, rect: rects.get(a.id)! } : a)),
    devices: project.devices.map((d) => (pos.has(d.id) ? { ...d, position: pos.get(d.id)! } : d)),
    links: project.links.map((l) => (touches(l) && l.waypoints.length ? { ...l, waypoints: [] } : l)),
    flows: project.flows.map((f) => (touches(f) && f.waypoints.length ? { ...f, waypoints: [] } : f)),
  };
  return reassignAreas(next, siteId);
}

/**
 * The first spot in a lane, from the left, where a new device would not cover another device or note
 * on the site. Used when a device is added by clicking rather than dropped at a chosen point.
 */
export function freeSpotInLane(project: Project, siteId: string, level: PurdueLevel): Point {
  const y = Math.round(rowY(level));
  const taken = [
    ...project.devices.filter((d) => d.siteId === siteId).map((d) => ({ ...d.position, w: NODE_WIDTH, h: NODE_HEIGHT })),
    ...project.notes.filter((n) => n.siteId === siteId).map((n) => ({ ...n.position, w: n.width, h: NODE_HEIGHT })),
  ];
  for (let x = LAYOUT_LEFT; ; x += STEP) {
    const clash = taken.some((t) => x < t.x + t.w + LAYOUT_GAP / 2 && x + NODE_WIDTH + LAYOUT_GAP / 2 > t.x && y < t.y + t.h && y + NODE_HEIGHT > t.y);
    // Positions are bounded, so the scan always ends; past the bound the last spot is reused.
    if (!clash || x > 900_000) return { x, y };
  }
}

/** True when two device nodes on the same site would overlap; used by tests and as a sanity check. */
export function overlapping(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT;
}
