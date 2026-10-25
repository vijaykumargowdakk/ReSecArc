import { describe, expect, it } from 'vitest';
import { commit, COALESCE_MS, HISTORY_LIMIT, initHistory, redo, undo } from '../store/history';
import {
  addDevice,
  addFlow,
  addLink,
  addRule,
  addZone,
  alignDevices,
  createDevice,
  defaultFlow,
  distributeDevices,
  emptyProject,
  extractFragment,
  newRule,
  pasteFragment,
  updateDevice,
} from './ops';
import { laneTop, levelAtY } from './purdue';
import type { Project } from './schema';

const SITE = 'site-main';

function plant(): Project {
  let p = addZone(emptyProject(), { id: 'z', name: 'Control', color: '#16a34a', trusted: true, targetSL: 3 });
  p = addDevice(p, { ...createDevice('hmi', { x: 100, y: laneTop(2) + 37 }, { siteId: SITE, id: 'hmi' }), zoneId: 'z' });
  p = addDevice(p, createDevice('plc', { x: 300, y: laneTop(1) + 37 }, { siteId: SITE, id: 'plc' }));
  p = addDevice(p, createDevice('firewall', { x: 500, y: laneTop(3.5) + 37 }, { siteId: SITE, id: 'fw' }));
  p = addDevice(p, createDevice('scada', { x: 700, y: laneTop(3) + 37 }, { siteId: SITE, id: 'scada' }));
  p = addLink(p, 'hmi', 'plc', 'l1');
  p = addLink(p, 'plc', 'scada', 'l2');
  p = addFlow(p, defaultFlow('modbus', 'hmi', 'plc', 'f1'));
  p = addRule(p, 'fw', { ...newRule('r-in'), src: { kind: 'device', id: 'hmi' }, dst: { kind: 'device', id: 'plc' } });
  p = addRule(p, 'fw', { ...newRule('r-out'), src: { kind: 'device', id: 'scada' }, dst: { kind: 'zone', id: 'z' } });
  return p;
}

describe('undo history', () => {
  const a = emptyProject('a');
  const b = emptyProject('b');
  const c = emptyProject('c');

  it('undoes and redoes in order, and a new edit clears redo', () => {
    let h = commit(commit(initHistory(a), b), c);
    h = undo(h);
    expect(h.present).toBe(b);
    h = undo(h);
    expect(h.present).toBe(a);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe(b);
    h = commit(h, c);
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it('ignores no-op edits', () => {
    const h = initHistory(a);
    expect(commit(h, a)).toBe(h);
  });

  it('coalesces quick edits with the same key into one step', () => {
    let h = commit(initHistory(a), b, 'name', 1000);
    h = commit(h, c, 'name', 1000 + COALESCE_MS - 1);
    expect(h.past).toEqual([a]);
    h = commit(h, b, 'name', 1000 + 3 * COALESCE_MS);
    expect(h.past).toEqual([a, c]);
    h = commit(h, c, 'other', 1000 + 3 * COALESCE_MS + 1);
    expect(h.past).toEqual([a, c, b]);
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    let h = initHistory(a);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = commit(h, emptyProject(String(i)));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe('copy and paste', () => {
  it('copies devices with the links and flows between them', () => {
    const fragment = extractFragment(plant(), ['hmi', 'plc']);
    expect(fragment.devices.map((d) => d.id)).toEqual(['hmi', 'plc']);
    expect(fragment.links.map((l) => l.id)).toEqual(['l1']);
    expect(fragment.flows.map((f) => f.id)).toEqual(['f1']);
  });

  it('pastes with fresh ids, offset positions and remapped internal connections', () => {
    const p = plant();
    const { project, deviceIds } = pasteFragment(p, extractFragment(p, ['hmi', 'plc']), { x: 40, y: 0 }, SITE);
    expect(deviceIds).toHaveLength(2);
    expect(deviceIds.some((id) => id === 'hmi' || id === 'plc')).toBe(false);
    const [hmi2, plc2] = deviceIds.map((id) => project.devices.find((d) => d.id === id)!);
    expect(hmi2.position).toEqual({ x: 140, y: laneTop(2) + 37 });
    expect(hmi2.zoneId).toBe('z');
    expect(project.links.filter((l) => l.source === hmi2.id && l.target === plc2.id)).toHaveLength(1);
    expect(project.flows.filter((f) => f.source === hmi2.id && f.target === plc2.id)).toHaveLength(1);
    expect(project.devices).toHaveLength(p.devices.length + 2);
  });

  it('remaps rule endpoints to copied devices and keeps the rest', () => {
    const p = plant();
    const { project, deviceIds } = pasteFragment(p, extractFragment(p, ['fw', 'plc']), { x: 0, y: 0 }, SITE);
    const copyFw = project.devices.find((d) => deviceIds.includes(d.id) && d.type === 'firewall')!;
    const plc2 = project.devices.find((d) => deviceIds.includes(d.id) && d.type === 'plc')!;
    const rules = copyFw.firewall!.rules;
    expect(rules.map((r) => r.dst)).toEqual([
      { kind: 'device', id: plc2.id },
      { kind: 'zone', id: 'z' },
    ]);
    expect(rules[0].src).toEqual({ kind: 'device', id: 'hmi' });
    expect(rules.every((r) => r.id !== 'r-in' && r.id !== 'r-out')).toBe(true);
  });
});

describe('arranging devices', () => {
  it('aligns left edges and vertical centres', () => {
    const p = plant();
    const left = alignDevices(p, ['hmi', 'plc', 'scada'], 'left');
    expect(left.devices.filter((d) => d.id !== 'fw').map((d) => d.position.x)).toEqual([100, 100, 100]);
    const middle = alignDevices(p, ['hmi', 'plc'], 'vcentre');
    const ys = middle.devices.filter((d) => d.id === 'hmi' || d.id === 'plc').map((d) => d.position.y);
    expect(ys[0]).toBe(ys[1]);
    expect(middle.devices.find((d) => d.id === 'plc')!.purdueLevel).toBe(levelAtY(ys[0]));
  });

  it('distributes three or more devices evenly', () => {
    let p = plant();
    p = updateDevice(p, 'plc', { position: { x: 150, y: 0 } });
    const spread = distributeDevices(p, ['hmi', 'plc', 'scada'], 'x');
    expect(['hmi', 'plc', 'scada'].map((id) => spread.devices.find((d) => d.id === id)!.position.x)).toEqual([100, 400, 700]);
    expect(distributeDevices(p, ['hmi', 'plc'], 'x')).toBe(p);
  });
});
