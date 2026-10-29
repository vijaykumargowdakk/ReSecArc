// Format 6: level tabs (each device's own place in its level's tab) and stacks in the overview,
// on the canvas, in the report and in draw.io.
import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { projectToDrawio } from '../export/drawio';
import { projectToHtmlReport } from '../export/report';
import { renderSiteSvg } from '../export/siteSvg';
import { NO_SELECTION } from '../store/useProject';
import { levelView, moveNode, stackView, tidy } from '../ui/canvas/levelView';
import { buildView } from '../ui/canvas/view';
import { parseProject, serializeProject } from './io';
import { addToLevel, freeSpotInLevel, LEVEL_COLUMNS, levelPositions, setLevelPosition, tidyLevel } from './levelLayout';
import { overlapping } from './layout';
import { mergeSites } from './merge';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, emptyProject, extractFragment, pasteFragment, updateDevice } from './ops';
import { laneTop } from './purdue';
import { designOf, diffDesigns } from './revisions';
import { SCHEMA_VERSION, type Project } from './schema';
import { isStacked, mergeEdges, setLevelStacked, stacksOf, tidyWithStacks } from './stacks';
import { addArea, createArea } from './structure';

const MAIN = 'site-main';
const ids = (n: number) => Array.from({ length: n }, (_, i) => `tt-${i + 1}`);

/** A switch and a PLC on L1, fifteen temperature sensors on L0, each linked to the switch and polled by the PLC. */
function plant(): Project {
  let p = emptyProject('Level test');
  p = addDevice(p, createDevice('switch', { x: 220, y: laneTop(1) + 43 }, { siteId: MAIN, id: 'sw' }));
  p = addDevice(p, createDevice('plc', { x: 500, y: laneTop(1) + 43 }, { siteId: MAIN, id: 'plc' }));
  p = addDevice(p, createDevice('scada', { x: 220, y: laneTop(3) + 43 }, { siteId: MAIN, id: 'scada' }));
  p = addLink(p, 'scada', 'plc', 'l-scada');
  ids(15).forEach((id, i) => {
    p = addDevice(p, createDevice('sensor', { x: 220 + i * 220, y: laneTop(0) + 43 }, { siteId: MAIN, id, variant: 'temperature' }));
    p = addLink(p, 'sw', id, `l-${id}`);
    p = addFlow(p, defaultFlow('modbus', 'plc', id, `f-${id}`));
  });
  return p;
}

const parse = (p: Project) => {
  const r = parseProject(serializeProject(p));
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.project;
};

describe('format 6', () => {
  it('opens a format-5 file unchanged apart from the version', () => {
    const v5 = { ...JSON.parse(serializeProject(loadTemplate('water-treatment'))), schemaVersion: 5 };
    const r = parseProject(JSON.stringify(v5));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(SCHEMA_VERSION).toBe(6);
    expect(r.project.schemaVersion).toBe(6);
    expect(r.project.devices.every((d) => d.levelPosition === undefined)).toBe(true);
    expect(r.project.sites.every((s) => s.stackedLevels === undefined)).toBe(true);
  });

  it('round-trips level positions and stacked levels', () => {
    const p = setLevelStacked(setLevelPosition(plant(), 'tt-3', { x: 400, y: 90 }), MAIN, 0, true);
    const again = parse(p);
    expect(again.devices.find((d) => d.id === 'tt-3')?.levelPosition).toEqual({ x: 400, y: 90 });
    expect(again.sites[0].stackedLevels).toEqual([0]);
  });

  it('rejects stacked levels that are not Purdue levels', () => {
    const raw = JSON.parse(serializeProject(plant()));
    raw.sites[0].stackedLevels = [7];
    expect(parseProject(JSON.stringify(raw)).ok).toBe(false);
  });

  it('lists a level-tab move as a move and stacking as a site change', () => {
    const before = plant();
    const after = setLevelStacked(setLevelPosition(before, 'tt-1', { x: 900, y: 300 }), MAIN, 0, true);
    const changes = diffDesigns(designOf(before), designOf(after));
    expect(changes.find((c) => c.id === 'tt-1')).toMatchObject({ moveOnly: true, details: ['moved in its level tab'] });
    expect(changes.find((c) => c.item === 'site')?.details).toEqual(['stacked levels: none → L0']);
  });

  it('drops level positions on paste and keeps stacked levels on merge', () => {
    const p = setLevelStacked(setLevelPosition(plant(), 'tt-1', { x: 900, y: 300 }), MAIN, 0, true);
    const pasted = pasteFragment(p, extractFragment(p, ['tt-1']), { x: 40, y: 40 }, MAIN);
    expect(pasted.project.devices.find((d) => d.id === pasted.deviceIds[0])?.levelPosition).toBeUndefined();
    const merged = mergeSites(emptyProject(), p, [MAIN]).project;
    expect(merged.sites[1].stackedLevels).toEqual([0]);
  });
});

describe('stacks', () => {
  it('stack devices of one type, variant, level, area and zone, but not locked ones', () => {
    let p = setLevelStacked(plant(), MAIN, 0, true);
    p = updateDevice(p, 'tt-15', { locked: true });
    p = updateDevice(p, 'tt-14', { zoneId: null, variant: 'pressure' });
    const { stacks, stackOf } = stacksOf(p, MAIN);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].members.map((m) => m.id)).toEqual(ids(13));
    expect(stacks[0].id).toBe('stack:tt-1');
    expect(stackOf.has('tt-15')).toBe(false);
    expect(stackOf.has('tt-14')).toBe(false);
  });

  it('only stacks on levels where it is switched on, and needs two devices', () => {
    expect(stacksOf(plant(), MAIN).stacks).toEqual([]);
    const one = setLevelStacked(plant(), MAIN, 1, true);
    expect(stacksOf(one, MAIN).stacks).toEqual([]);
    expect(isStacked(one.sites[0], 1)).toBe(true);
    expect(setLevelStacked(one, MAIN, 1, true)).toBe(one);
    expect(setLevelStacked(one, MAIN, 1, false).sites[0]).toEqual({ id: MAIN, name: 'Main site' });
  });

  it('merge links either way round and flows per protocol and direction', () => {
    const p = setLevelStacked(plant(), MAIN, 0, true);
    const { stackOf } = stacksOf(p, MAIN);
    const node = (id: string) => stackOf.get(id)?.id ?? id;
    const links = mergeEdges(p.links, node);
    expect(links.find((l) => l.target === 'stack:tt-1' || l.source === 'stack:tt-1')?.count).toBe(15);
    expect(links).toHaveLength(2);
    const flows = mergeEdges([...p.flows, defaultFlow('modbus', 'tt-1', 'plc', 'back')], node);
    expect(flows.map((f) => f.count).sort()).toEqual([1, 15]);
  });

  it('draws one card with merged edges, summed findings and member ids on the canvas', () => {
    const p = setLevelStacked(plant(), MAIN, 0, true);
    const findings = new Map(ids(15).map((id) => [id, [{ severity: 'medium' } as never]]));
    const args = [p, MAIN, NO_SELECTION, new Set<string>(), new Map(), undefined, null, findings, new Map()] as const;
    const view = stackView(buildView(...args), ...args);
    const stack = view.nodes.find((n) => n.id === 'stack:tt-1');
    expect(stack?.type === 'device' && stack.data.stack).toEqual(ids(15));
    expect(stack?.type === 'device' && stack.data.security).toEqual({ count: 15, severity: 'medium' });
    expect(stack?.ariaLabel).toMatch(/^Stack of 15 Temperature/);
    expect(view.nodes.filter((n) => n.type === 'device')).toHaveLength(4);
    const toStack = view.edges.filter((e) => e.source === 'stack:tt-1' || e.target === 'stack:tt-1');
    expect(toStack.map((e) => [e.type, e.data?.count, e.selectable])).toEqual([
      ['link', 15, false],
      ['flow', 15, false],
    ]);
    // The keyboard can only connect devices that are drawn on their own.
    expect(view.drawn?.map((d) => d.id).sort()).toEqual(['plc', 'scada', 'sw']);
  });

  it('shows a stack as selected only when all its members are', () => {
    const p = setLevelStacked(plant(), MAIN, 0, true);
    const view = (devices: string[]) => {
      const args = [p, MAIN, { ...NO_SELECTION, devices }, new Set<string>()] as const;
      return stackView(buildView(...args), ...args).nodes.find((n) => n.id === 'stack:tt-1')?.selected;
    };
    expect(view(['tt-2'])).toBe(false);
    expect(view(ids(15))).toBe(true);
  });

  it('moves every member when the card is dragged', () => {
    const p = setLevelStacked(plant(), MAIN, 0, true);
    const moved = moveNode(p, 'stack:tt-1', { x: 320, y: laneTop(0) + 43 }, null);
    expect(moved.devices.find((d) => d.id === 'tt-1')?.position.x).toBe(320);
    expect(moved.devices.find((d) => d.id === 'tt-15')?.position.x).toBe(220 + 14 * 220 + 100);
  });

  it('give a stack one slot when the overview is tidied', () => {
    const p = setLevelStacked(plant(), MAIN, 0, true);
    const tidied = tidyWithStacks(p, MAIN);
    const sensors = tidied.devices.filter((d) => d.type === 'sensor');
    expect(new Set(sensors.map((d) => `${d.position.x},${d.position.y}`)).size).toBe(1);
    expect(sensors.every((d) => d.purdueLevel === 0)).toBe(true);
    expect(tidy(p, MAIN, null)).toEqual(tidied);
    // Without stacks it is the ordinary tidy.
    expect(tidyWithStacks(plant(), MAIN).devices.filter((d) => d.type === 'sensor').map((d) => d.position.x)).toHaveLength(15);
  });

  it('show in the report diagram and caption, and in draw.io', () => {
    const p = setLevelStacked(plant(), MAIN, 0, true);
    const svg = renderSiteSvg(p, MAIN);
    expect(svg).toContain('×15');
    expect(svg.match(/Stack of 15 Temperature/g)).toHaveLength(1);
    expect(projectToHtmlReport(p)).toContain('A card marked ×N is a stack of similar devices, all listed in the tables below: L0: 15 × Temperature');
    const xml = projectToDrawio(p);
    expect(xml.match(/<UserObject id="x-tt-/g)).toHaveLength(1);
    expect(xml).toContain('count="15"');
    expect(xml).toMatch(/value="×15"/);
    expect(xml).toMatch(/value="[^"]*×15"/);
    // Every edge still ends on a cell of the page.
    const known = new Set([...xml.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    for (const [, s, t] of xml.matchAll(/source="([^"]+)" target="([^"]+)"/g)) {
      expect(known.has(s) && known.has(t)).toBe(true);
    }
  });
});

describe('level tabs', () => {
  it('lay a level out in wrapped rows when nothing is arranged yet', () => {
    const pos = levelPositions(plant(), MAIN, 0);
    expect(pos.size).toBe(15);
    const rows = new Set([...pos.values()].map((p) => p.y));
    expect(rows.size).toBe(Math.ceil(15 / LEVEL_COLUMNS));
    const all = [...pos.values()];
    expect(all.some((a, i) => all.some((b, j) => i !== j && overlapping(a, b)))).toBe(false);
  });

  it('group the grid by area', () => {
    let p = plant();
    p = addArea(p, createArea(MAIN, { x: 200, y: laneTop(0) + 10, width: 700, height: 130 }, 'Cell A', '#0ea5e9', 'area-a'));
    const pos = levelPositions(p, MAIN, 0);
    const inA = p.devices.filter((d) => d.areaId === 'area-a').map((d) => pos.get(d.id)!);
    const rest = p.devices.filter((d) => d.purdueLevel === 0 && d.areaId !== 'area-a').map((d) => pos.get(d.id)!);
    expect(inA).toHaveLength(3);
    // The area's group comes first, and its devices share a row of their own.
    expect(Math.max(...inA.map((q) => q.x))).toBeLessThan(Math.min(...rest.filter((q) => q.y === inA[0].y).map((q) => q.x), Infinity));
  });

  it('keep their own positions: arranging a level never moves the overview', () => {
    const p = plant();
    const moved = moveNode(p, 'tt-1', { x: 1000.4, y: 500 }, 0);
    const d = moved.devices.find((x) => x.id === 'tt-1')!;
    expect(d.levelPosition).toEqual({ x: 1000, y: 500 });
    expect(d.position).toEqual(p.devices.find((x) => x.id === 'tt-1')!.position);
    expect(d.purdueLevel).toBe(0);
    expect(levelPositions(moved, MAIN, 0).get('tt-1')).toEqual({ x: 1000, y: 500 });
  });

  it('tidy into the grid, leaving locked devices and the overview alone', () => {
    let p = moveNode(plant(), 'tt-1', { x: 3000, y: 900 }, 0);
    p = updateDevice(moveNode(p, 'tt-2', { x: 260, y: 104 }, 0), 'tt-2', { locked: true });
    const tidied = tidyLevel(p, MAIN, 0);
    const at = levelPositions(tidied, MAIN, 0);
    expect(at.get('tt-2')).toEqual({ x: 260, y: 104 });
    expect(at.get('tt-1')!.x).toBeLessThan(2000);
    const all = [...at.values()];
    expect(all.some((a, i) => all.some((b, j) => i !== j && overlapping(a, b)))).toBe(false);
    expect(tidied.devices.map((d) => d.position)).toEqual(p.devices.map((d) => d.position));
    expect(tidyLevel(tidied, MAIN, 0)).toBe(tidied);
  });

  it('add a device to the level, in the tab and at a free spot of its lane in the overview', () => {
    const p = plant();
    const added = addToLevel(p, createDevice('plc', { x: 0, y: 0 }, { siteId: MAIN, id: 'new' }), 0);
    const d = added.devices.find((x) => x.id === 'new')!;
    expect(d.purdueLevel).toBe(0);
    expect(d.position.y).toBe(laneTop(0) + 43);
    const others = [...levelPositions(p, MAIN, 0).values()];
    expect(others.some((o) => overlapping(o, d.levelPosition!))).toBe(false);
    expect(freeSpotInLevel(added, MAIN, 0)).not.toEqual(d.levelPosition);
  });

  it('draw only the level, with stubs above for higher levels and below for lower ones', () => {
    const p = plant();
    const view = levelView(1, p, MAIN, NO_SELECTION, new Set(), new Map());
    const devices = view.nodes.filter((n) => n.type === 'device').map((n) => n.id).sort();
    expect(devices).toEqual(['plc', 'sw']);
    const stubs = view.nodes.filter((n) => n.type === 'portal');
    const top = Math.min(...view.nodes.filter((n) => n.type === 'device').map((n) => n.position.y));
    const up = stubs.filter((s) => s.position.y < top);
    const down = stubs.filter((s) => s.position.y > top);
    expect(up.map((s) => s.id)).toEqual(['portal:scada']);
    expect(down).toHaveLength(15);
    expect(down[0].ariaLabel).toMatch(/on level L0\. Activate to open that level's tab\.$/);
    expect(down.every((s, i) => i === 0 || s.position.x >= down[i - 1].position.x + 180)).toBe(true);
    expect(view.edges.every((e) => view.nodes.some((n) => n.id === e.source) && view.nodes.some((n) => n.id === e.target))).toBe(true);
  });

  it('draw an empty level as nothing', () => {
    expect(levelView(5, plant(), MAIN, NO_SELECTION, new Set()).nodes).toEqual([]);
  });
});
