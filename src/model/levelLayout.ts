// Positions in a level's own tab. A level tab shows one Purdue level of a site with its devices in
// wrapped rows, grouped by area. Each device keeps its own `levelPosition` there, so arranging a level
// tab never moves anything in the overview; devices not yet arranged are laid out as a grid.
import { LAYOUT_GAP, LAYOUT_LEFT, freeSpotInLane, overlapping } from './layout';
import { NODE_HEIGHT, NODE_WIDTH } from './purdue';
import { addDevice, updateDevice } from './ops';
import type { Area, Device, Project, PurdueLevel } from './schema';

type Point = { x: number; y: number };

/** At most this many devices side by side in one area's group before the row wraps. */
export const LEVEL_COLUMNS = 6;
export const LEVEL_TOP = 60;
const CELL_X = NODE_WIDTH + LAYOUT_GAP;
const CELL_Y = NODE_HEIGHT + 40;
const PAD = 20;
/** Room above a group's first row for the area name. */
const HEAD = 34;
const GROUP_GAP = 40;
/** Groups share a row while they fit in the width of one full group. */
const SHELF_WIDTH = LEVEL_COLUMNS * CELL_X - LAYOUT_GAP + 2 * PAD;

export const levelDevices = (project: Project, siteId: string, level: PurdueLevel) =>
  project.devices.filter((d) => d.siteId === siteId && d.purdueLevel === level);

/** The level's devices in groups: one per area (in overview order, left to right), then those in no area. */
export function levelGroups(project: Project, devices: Device[]): { area: Area | null; devices: Device[] }[] {
  const order = (a: Device, b: Device) => a.position.x - b.position.x || a.position.y - b.position.y || a.id.localeCompare(b.id);
  const areas = project.areas.filter((a) => devices.some((d) => d.areaId === a.id)).sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);
  const known = new Set(areas.map((a) => a.id));
  const groups: { area: Area | null; devices: Device[] }[] = areas.map((area) => ({ area, devices: devices.filter((d) => d.areaId === area.id).sort(order) }));
  const loose = devices.filter((d) => !d.areaId || !known.has(d.areaId)).sort(order);
  if (loose.length) groups.push({ area: null, devices: loose });
  return groups;
}

/**
 * Lays groups out left to right, wrapping to a new row of groups when the next one does not fit, and
 * each group's devices in rows of up to LEVEL_COLUMNS. Cells that would cover a `blocked` device are
 * skipped, so locked devices keep their place.
 */
function grid(project: Project, devices: Device[], top: number, blocked: Point[] = []): Map<string, Point> {
  const out = new Map<string, Point>();
  let x = LAYOUT_LEFT;
  let y = top;
  let shelfBottom = top;
  for (const group of levelGroups(project, devices)) {
    const cols = Math.min(LEVEL_COLUMNS, group.devices.length);
    const width = cols * CELL_X - LAYOUT_GAP + 2 * PAD;
    if (x > LAYOUT_LEFT && x - LAYOUT_LEFT + width > SHELF_WIDTH) {
      x = LAYOUT_LEFT;
      y = shelfBottom + GROUP_GAP;
    }
    // Each device takes the next cell that is clear of locked devices; every skip passes one cell, and
    // a locked device can block only a few cells, so the scan always ends.
    let cell = 0;
    let rows = 0;
    for (const d of group.devices) {
      for (let tries = 0; tries <= 4 * blocked.length; tries++, cell++) {
        const at = { x: x + PAD + (cell % cols) * CELL_X, y: y + HEAD + Math.floor(cell / cols) * CELL_Y };
        if (!blocked.some((b) => overlapping(b, at))) break;
      }
      out.set(d.id, { x: x + PAD + (cell % cols) * CELL_X, y: y + HEAD + Math.floor(cell / cols) * CELL_Y });
      rows = Math.floor(cell / cols) + 1;
      cell++;
    }
    shelfBottom = Math.max(shelfBottom, y + HEAD + rows * CELL_Y - (CELL_Y - NODE_HEIGHT) + PAD);
    x += width + GROUP_GAP;
  }
  return out;
}

/** Where each device of the level is drawn in its tab: its own level position, or a grid place below those. */
export function levelPositions(project: Project, siteId: string, level: PurdueLevel): Map<string, Point> {
  const devices = levelDevices(project, siteId, level);
  const placed = devices.filter((d) => d.levelPosition);
  const out = new Map<string, Point>(placed.map((d) => [d.id, d.levelPosition!]));
  const rest = devices.filter((d) => !d.levelPosition);
  if (rest.length === 0) return out;
  const top = placed.length ? Math.max(...placed.map((d) => d.levelPosition!.y)) + NODE_HEIGHT + GROUP_GAP : LEVEL_TOP;
  for (const [id, p] of grid(project, rest, top)) out.set(id, p);
  return out;
}

export function setLevelPosition(project: Project, id: string, at: Point): Project {
  const d = project.devices.find((x) => x.id === id);
  if (!d || (d.levelPosition?.x === at.x && d.levelPosition?.y === at.y)) return project;
  return updateDevice(project, id, { levelPosition: { x: Math.round(at.x), y: Math.round(at.y) } });
}

/** Tidy in a level tab: the grid grouped by area. Locked devices stay where they are drawn now. */
export function tidyLevel(project: Project, siteId: string, level: PurdueLevel): Project {
  const now = levelPositions(project, siteId, level);
  const devices = levelDevices(project, siteId, level);
  const locked = devices.filter((d) => d.locked);
  const next = new Map([...locked.map((d) => [d.id, now.get(d.id)!] as const), ...grid(project, devices.filter((d) => !d.locked), LEVEL_TOP, locked.map((d) => now.get(d.id)!))]);
  return devices.reduce((p, d) => setLevelPosition(p, d.id, next.get(d.id)!), project);
}

/** The first grid cell in a level tab, row by row, where a new device covers no other. */
export function freeSpotInLevel(project: Project, siteId: string, level: PurdueLevel): Point {
  const taken = [...levelPositions(project, siteId, level).values()];
  // Each taken device blocks at most a few cells, so a clear one is found within this many.
  for (let cell = 0; ; cell++) {
    const at = { x: LAYOUT_LEFT + PAD + (cell % LEVEL_COLUMNS) * CELL_X, y: LEVEL_TOP + HEAD + Math.floor(cell / LEVEL_COLUMNS) * CELL_Y };
    if (!taken.some((t) => overlapping(t, at)) || cell > 4 * taken.length) return at;
  }
}

/**
 * Adds a device from a level tab: it goes on that level, at `at` in the tab (or the first free cell),
 * and in the overview at the first free spot of the level's lane.
 */
export function addToLevel(project: Project, device: Device, level: PurdueLevel, at?: Point): Project {
  const levelPosition = at ? { x: Math.round(at.x), y: Math.round(at.y) } : freeSpotInLevel(project, device.siteId, level);
  return addDevice(project, { ...device, purdueLevel: level, position: freeSpotInLane(project, device.siteId, level), levelPosition });
}
