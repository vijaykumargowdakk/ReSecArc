// The canvas for level tabs and stacks. It loads only once a level tab is opened or stacking is
// switched on for a level of the open site, so none of it is in the startup bundle.
import { kindLabel } from '../../model/catalog';
import type { Finding, Severity } from '../../model/checks';
import { boundsOf } from '../../model/areas';
import { addToLevel, levelDevices, levelGroups, levelPositions, setLevelPosition, tidyLevel } from '../../model/levelLayout';
import { moveDevice } from '../../model/ops';
import { LANE_HEIGHT, LANE_WIDTH, levelLabel, NODE_HEIGHT, NODE_WIDTH, PURDUE_LANES } from '../../model/purdue';
import type { Project, PurdueLevel } from '../../model/schema';
import { isStackId, moveStack, STACK_PREFIX, stacksOf, tidyWithStacks } from '../../model/stacks';
import { ALL_LAYERS } from '../../store/prefs';
import type { CanvasEdge } from './edges';
import type { CanvasNode } from './nodes';
import { buildView, type CanvasView } from './view';

export { addToLevel };

type ViewArgs = Parameters<typeof buildView>;
type Point = { x: number; y: number };

/** Pseudo site ids that stand for the site's other levels while a level tab is drawn. */
const LEVEL_SITE = 'level:';
const STUB_STEP = 200;
const STUB_GAP = 110;

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ') || undefined;
const laneOf = (level: PurdueLevel) => PURDUE_LANES.find((l) => l.level === level)!;
const levelName = (level: PurdueLevel) => `${levelLabel(level)} ${laneOf(level).name}`;

/**
 * One level of a site: its devices at their level-tab positions, area groups drawn around their
 * members, and stubs for connected devices on other levels, above for higher levels and below for lower.
 */
export function levelView(level: PurdueLevel, ...args: ViewArgs): CanvasView {
  const [project, siteId, selection, dimmed, marks, layers = ALL_LAYERS, connect, findings, path] = args;
  const pos = levelPositions(project, siteId, level);
  const pseudo: Project = {
    ...project,
    sites: [...project.sites, ...PURDUE_LANES.map((l) => ({ id: `${LEVEL_SITE}${l.level}`, name: levelName(l.level) }))],
    // Devices on other levels of this site become "elsewhere", so the usual stubs stand for them.
    devices: project.devices.map((d) => (d.siteId !== siteId ? d : pos.has(d.id) ? { ...d, position: pos.get(d.id)! } : { ...d, siteId: `${LEVEL_SITE}${d.purdueLevel}` })),
    areas: [],
    notes: [],
  };
  const view = buildView(pseudo, siteId, selection, dimmed, marks, { ...layers, areas: false, notes: false }, connect, findings, path);
  const drawn = pseudo.devices.filter((d) => d.siteId === siteId);
  if (drawn.length === 0) return { nodes: [], edges: [], drawn };

  const xs = drawn.map((d) => d.position.x);
  const ys = drawn.map((d) => d.position.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys) + NODE_HEIGHT;
  const right = Math.max(...xs) + NODE_WIDTH;

  // Stubs for the other levels: lined up with the device they connect to, stepping right so none overlap.
  const partner = new Map<string, number>();
  for (const e of [...project.links, ...project.flows]) {
    for (const [here, there] of [[e.source, e.target], [e.target, e.source]]) {
      if (pos.has(here) && !partner.has(there)) partner.set(there, pos.get(here)!.x);
    }
  }
  const rows = { up: [] as { node: CanvasNode; x: number }[], down: [] as { node: CanvasNode; x: number }[] };
  const nodes: CanvasNode[] = [];
  for (const n of view.nodes) {
    if (n.type !== 'portal' || !n.data.device.siteId.startsWith(LEVEL_SITE)) {
      nodes.push(n);
      continue;
    }
    const other = n.data.device.purdueLevel;
    const up = other > level;
    const stub: CanvasNode = {
      ...n,
      className: 'portal--level',
      data: { ...n.data, siteName: `${up ? '↑' : '↓'} ${levelName(other)}`, where: `level ${levelLabel(other)}` },
      ariaLabel: `${n.data.device.label} on level ${levelLabel(other)}. Activate to open that level's tab.`,
    };
    (up ? rows.up : rows.down).push({ node: stub, x: partner.get(n.data.device.id) ?? LANE_WIDTH });
  }
  for (const [row, y] of [[rows.up, top - STUB_GAP], [rows.down, bottom + STUB_GAP - 40]] as const) {
    let next = -Infinity;
    for (const stub of row.sort((a, b) => a.x - b.x)) {
      const x = Math.max(stub.x, next);
      nodes.push({ ...stub.node, position: { x, y } });
      next = x + STUB_STEP;
    }
  }

  // Area groups, drawn around wherever their members are now; they cannot be moved or resized here.
  const groups: CanvasNode[] = [];
  if (layers.areas) {
    for (const g of levelGroups(project, levelDevices(project, siteId, level))) {
      if (!g.area) continue;
      const members = drawn.filter((d) => d.areaId === g.area!.id);
      const rect = boundsOf(members.map((d) => d.position), 20);
      groups.push({
        id: `group:${g.area.id}`,
        type: 'area',
        position: { x: rect.x, y: rect.y },
        data: { area: { ...g.area, rect, collapsed: false, locked: false }, members },
        draggable: false,
        selectable: false,
        focusable: false,
        className: 'level-group',
        zIndex: -1,
        width: rect.width,
        height: rect.height,
      });
    }
  }

  const band: CanvasNode = {
    id: 'lane-level',
    type: 'lane',
    position: { x: 0, y: top - 60 },
    data: { lane: laneOf(level), tab: true },
    width: Math.max(LANE_WIDTH, right + 60),
    height: Math.max(LANE_HEIGHT, bottom - top + 120),
    draggable: false,
    selectable: false,
    deletable: false,
    focusable: false,
    connectable: false,
    zIndex: -2,
  };
  return { nodes: [band, ...groups, ...nodes], edges: view.edges, drawn };
}

const worst = (list: readonly Finding[]): Severity =>
  list.some((f) => f.severity === 'high') ? 'high' : list.some((f) => f.severity === 'medium') ? 'medium' : 'low';
const CRITICALITY = ['low', 'medium', 'high'] as const;

/**
 * The overview with stacks: each stack replaces its members with one card at the first member's
 * place, and links and flows that then join the same two nodes merge into one with a count.
 */
export function stackView(base: CanvasView, ...args: ViewArgs): CanvasView {
  const [project, siteId, selection, dimmed, marks = new Map(), , , findings = new Map(), path = new Map()] = args;
  const { stacks, stackOf } = stacksOf(project, siteId, { skipCollapsed: true });
  if (stacks.length === 0) return base;
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const selected = new Set(selection.devices);
  const nodes = base.nodes.filter((n) => !(n.type === 'device' && stackOf.has(n.id)));

  for (const s of stacks) {
    const lead = s.members[0];
    const ids = s.members.map((m) => m.id);
    const kind = kindLabel(lead.type, lead.variant);
    const zone = lead.zoneId ? (zoneById.get(lead.zoneId) ?? null) : null;
    const list = ids.flatMap((id) => findings.get(id) ?? []);
    const security = list.length ? { count: list.length, severity: worst(list) } : undefined;
    const allDimmed = ids.every((id) => dimmed.has(id));
    const diff = ids.some((id) => marks.has(id)) ? (ids.every((id) => marks.get(id) === 'added') ? 'added' : 'changed') : undefined;
    const criticality = CRITICALITY[Math.max(...s.members.map((m) => CRITICALITY.indexOf(m.criticality)))];
    const onPath = ids.some((id) => path.has(id));
    nodes.push({
      id: s.id,
      type: 'device',
      position: lead.position,
      data: { device: { ...lead, label: kind, criticality }, zone, dimmed: allDimmed, diff, security, stack: ids },
      // The card shows as selected only when the whole stack is, as after clicking it.
      selected: ids.every((id) => selected.has(id)),
      connectable: false,
      className: classes('is-stack', allDimmed && 'is-dimmed', diff && `diff-${diff}`, onPath && 'sec-path'),
      ariaLabel: [
        `Stack of ${ids.length} ${kind}`,
        `level ${levelLabel(s.level).slice(1)}`,
        zone ? `zone ${zone.name}` : 'no zone',
        ...(diff ? [`${diff} since the compared revision`] : []),
        ...(security ? [`${security.count} security finding${security.count === 1 ? '' : 's'}`] : []),
        'Click to select all of them; double-click to open the level in its own tab',
      ].join(', '),
    });
  }

  const nodeOf = (id: string) => stackOf.get(id)?.id ?? id;
  const merged = new Map<string, CanvasEdge[]>();
  const edges: CanvasEdge[] = [];
  for (const e of base.edges) {
    const source = nodeOf(e.source);
    const target = nodeOf(e.target);
    if (source === e.source && target === e.target) {
      edges.push(e);
      continue;
    }
    if (source === target) continue;
    const key = e.type === 'flow' ? `flow|${e.data!.flow.protocol}|${source}|${target}` : `link|${[source, target].sort().join('|')}`;
    const moved = { ...e, source, target } as CanvasEdge;
    const list = merged.get(key);
    if (list) list.push(moved);
    else merged.set(key, [moved]);
  }
  for (const list of merged.values()) {
    if (list.length === 1) {
      edges.push(list[0]);
      continue;
    }
    const [first] = list;
    const data = {
      ...first.data!,
      aggregated: true,
      count: list.length,
      diff: undefined,
      dimmed: list.every((e) => e.data!.dimmed),
      violation: list.some((e) => e.data!.violation),
      onPath: list.some((e) => e.data!.onPath),
    };
    edges.push({ ...first, id: `${STACK_PREFIX}${first.id}`, data, selected: false, selectable: false } as CanvasEdge);
  }

  const collapsed = new Set(project.areas.filter((a) => a.collapsed).map((a) => a.id));
  const drawn = project.devices.filter((d) => d.siteId === siteId && !stackOf.has(d.id) && !(d.areaId && collapsed.has(d.areaId)));
  return { nodes, edges, drawn };
}

/** A drag or arrow-key move: in a level tab it sets the level position; a stack moves all its members. */
export function moveNode(project: Project, id: string, to: Point, level: PurdueLevel | null): Project {
  if (level !== null) return setLevelPosition(project, id, to);
  if (!isStackId(id)) return moveDevice(project, id, to);
  const lead = project.devices.find((d) => d.id === id.slice(STACK_PREFIX.length));
  const stack = lead && stacksOf(project, lead.siteId).stacks.find((s) => s.id === id);
  return stack ? moveStack(project, stack, to) : project;
}

/** Tidy for a level tab (a grid grouped by area) or for an overview with stacks (a stack takes one slot). */
export function tidy(project: Project, siteId: string, level: PurdueLevel | null): Project {
  return level === null ? tidyWithStacks(project, siteId) : tidyLevel(project, siteId, level);
}

