// Stacks: on a level where stacking is switched on, devices that share type, variant, level, area
// and zone (and are not locked) are drawn as one card with a count, and their links and flows merge.
// The canvas, the report and draw.io all group devices with this module, so they always agree.
import { tidyLayout } from './layout';
import type { Device, Flow, Link, Project, PurdueLevel, Site } from './schema';
import { reassignAreas } from './structure';

export interface Stack {
  /** Node id of the stack; `stack:` followed by the first member's id. */
  id: string;
  level: PurdueLevel;
  /** At least two devices; the first (leftmost, then topmost) is where the stack is drawn. */
  members: Device[];
}

export const STACK_PREFIX = 'stack:';
export const isStackId = (id: string) => id.startsWith(STACK_PREFIX);

export function isStacked(site: Site | undefined, level: PurdueLevel): boolean {
  return site?.stackedLevels?.includes(level) === true;
}

export function setLevelStacked(project: Project, siteId: string, level: PurdueLevel, on: boolean): Project {
  const site = project.sites.find((s) => s.id === siteId);
  if (!site || isStacked(site, level) === on) return project;
  const rest = (site.stackedLevels ?? []).filter((l) => l !== level);
  const stackedLevels = on ? [...rest, level].sort((a, b) => b - a) : rest;
  const { stackedLevels: _, ...plain } = site;
  const next: Site = stackedLevels.length ? { ...plain, stackedLevels } : plain;
  return { ...project, sites: project.sites.map((s) => (s.id === siteId ? next : s)) };
}

export interface Stacks {
  stacks: Stack[];
  /** The stack each stacked device belongs to. */
  stackOf: Map<string, Stack>;
}

/**
 * The stacks on a site. The canvas leaves out devices in collapsed areas, which the area already
 * stands in for; the static renderers draw every area open, so they keep them.
 */
export function stacksOf(project: Project, siteId: string, opts: { skipCollapsed?: boolean } = {}): Stacks {
  const site = project.sites.find((s) => s.id === siteId);
  const stacks: Stack[] = [];
  const stackOf = new Map<string, Stack>();
  if (!site?.stackedLevels?.length) return { stacks, stackOf };
  const collapsed = new Set(opts.skipCollapsed ? project.areas.filter((a) => a.collapsed).map((a) => a.id) : []);
  const groups = new Map<string, Device[]>();
  for (const d of project.devices) {
    if (d.siteId !== siteId || d.locked || !isStacked(site, d.purdueLevel) || (d.areaId && collapsed.has(d.areaId))) continue;
    const key = [d.type, d.variant, d.purdueLevel, d.areaId ?? '', d.zoneId ?? ''].join('|');
    const list = groups.get(key);
    if (list) list.push(d);
    else groups.set(key, [d]);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y || a.id.localeCompare(b.id));
    const stack: Stack = { id: `${STACK_PREFIX}${members[0].id}`, level: members[0].purdueLevel, members };
    stacks.push(stack);
    for (const m of members) stackOf.set(m.id, stack);
  }
  return { stacks, stackOf };
}

/** Moves every member of a stack by the distance its drawn card moved. */
export function moveStack(project: Project, stack: Stack, to: { x: number; y: number }): Project {
  const from = stack.members[0].position;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return project;
  const ids = new Set(stack.members.map((m) => m.id));
  const moved = project.devices.map((d) => (ids.has(d.id) ? { ...d, position: { x: d.position.x + dx, y: d.position.y + dy } } : d));
  // A stack only holds devices of one level and area; a move that leaves them is re-derived as for a single device.
  return reassignAreas({ ...project, devices: moved }, stack.members[0].siteId);
}

export interface MergedEdge<E extends Link | Flow> {
  /** The first of the merged links or flows. */
  edge: E;
  source: string;
  target: string;
  /** How many links or flows this one edge stands for. */
  count: number;
}

/**
 * Re-points edges at the nodes that stand for their ends and merges those that then join the same
 * pair: links either way round, flows per protocol and direction. Edges inside one node are dropped.
 */
export function mergeEdges<E extends Link | Flow>(edges: readonly E[], nodeOf: (deviceId: string) => string): MergedEdge<E>[] {
  const merged = new Map<string, MergedEdge<E>>();
  for (const e of edges) {
    const source = nodeOf(e.source);
    const target = nodeOf(e.target);
    if (source === target) continue;
    const key = 'protocol' in e ? `${e.protocol}|${source}|${target}` : [source, target].sort().join('|');
    const seen = merged.get(key);
    if (seen) seen.count++;
    else merged.set(key, { edge: e, source, target, count: 1 });
  }
  return [...merged.values()];
}

/**
 * Tidy for a site with stacks: each stack takes one slot, like a single device, and all its members
 * move to that slot. Without stacks this is the ordinary tidy.
 */
export function tidyWithStacks(project: Project, siteId: string): Project {
  const { stacks, stackOf } = stacksOf(project, siteId);
  if (stacks.length === 0) return tidyLayout(project, siteId);
  const lead = (id: string) => stackOf.get(id)?.members[0].id ?? id;
  const hidden = new Set([...stackOf.keys()].filter((id) => lead(id) !== id));
  const proxy: Project = {
    ...project,
    devices: project.devices.filter((d) => !hidden.has(d.id)),
    links: project.links.map((l) => ({ ...l, source: lead(l.source), target: lead(l.target) })),
    flows: project.flows.map((f) => ({ ...f, source: lead(f.source), target: lead(f.target) })),
  };
  const tidied = tidyLayout(proxy, siteId);
  const at = new Map(tidied.devices.map((d) => [d.id, d]));
  const onSite = new Set(project.devices.filter((d) => d.siteId === siteId).map((d) => d.id));
  const touches = (e: Link | Flow) => onSite.has(e.source) || onSite.has(e.target);
  const next: Project = {
    ...project,
    areas: tidied.areas,
    devices: project.devices.map((d) => {
      const placed = at.get(lead(d.id));
      return d.siteId === siteId && placed ? { ...d, position: placed.position, purdueLevel: placed.purdueLevel } : d;
    }),
    links: project.links.map((l) => (touches(l) && l.waypoints.length ? { ...l, waypoints: [] } : l)),
    flows: project.flows.map((f) => (touches(f) && f.waypoints.length ? { ...f, waypoints: [] } : f)),
  };
  return reassignAreas(next, siteId);
}
