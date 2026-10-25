import { describe, expect, it } from 'vitest';
import demo from '../examples/demo-water-treatment.json';
import { deriveConduits } from './conduits';
import { parseProject, referenceErrors, serializeProject } from './io';
import {
  addDevice,
  addFlow,
  addLink,
  addRule,
  addZone,
  countRuleReferences,
  createDevice,
  defaultFlow,
  emptyProject,
  moveDevice,
  moveRule,
  newRule,
  removeDevice,
  removeZone,
} from './ops';
import { LANE_HEIGHT, laneTop, levelAtY, PURDUE_LANES } from './purdue';
import type { Project } from './schema';

function twoDevices(): Project {
  let p = emptyProject();
  p = addDevice(p, createDevice('hmi', { x: 0, y: laneTop(2) + 37 }, 'hmi'));
  p = addDevice(p, createDevice('plc', { x: 0, y: laneTop(1) + 37 }, 'plc'));
  return p;
}

describe('purdue lanes', () => {
  it('maps a node placed in each lane to that lane level', () => {
    for (const lane of PURDUE_LANES) {
      expect(levelAtY(laneTop(lane.level) + 37)).toBe(lane.level);
    }
  });

  it('clamps positions above and below the lanes', () => {
    expect(levelAtY(-500)).toBe(5);
    expect(levelAtY(LANE_HEIGHT * 50)).toBe(0);
  });
});

describe('project operations', () => {
  it('derives a new device level from its position', () => {
    const p = twoDevices();
    expect(p.devices.find((d) => d.id === 'hmi')?.purdueLevel).toBe(2);
    const moved = moveDevice(p, 'hmi', { x: 10, y: laneTop(3.5) + 37 });
    expect(moved.devices.find((d) => d.id === 'hmi')?.purdueLevel).toBe(3.5);
  });

  it('gives firewalls a default-deny rule set', () => {
    const fw = createDevice('firewall', { x: 0, y: 0 });
    expect(fw.firewall).toEqual({ defaultAction: 'deny', rules: [] });
    expect(createDevice('plc', { x: 0, y: 0 }).firewall).toBeUndefined();
  });

  it('rejects self, duplicate and reversed duplicate links', () => {
    let p = addLink(twoDevices(), 'hmi', 'plc');
    expect(p.links).toHaveLength(1);
    expect(addLink(p, 'plc', 'hmi')).toBe(p);
    expect(addLink(p, 'hmi', 'hmi')).toBe(p);
    expect(addLink(p, 'hmi', 'missing')).toBe(p);
    p = addFlow(p, defaultFlow('modbus', 'hmi', 'plc'));
    expect(p.flows).toHaveLength(1);
    expect(addFlow(p, defaultFlow('modbus', 'hmi', 'plc')).flows).toHaveLength(1);
    expect(addFlow(p, defaultFlow('dnp3', 'hmi', 'plc')).flows).toHaveLength(2);
  });

  it('removes a device together with its links, flows and rule references', () => {
    let p = twoDevices();
    p = addDevice(p, createDevice('firewall', { x: 0, y: 0 }, 'fw'));
    p = addLink(p, 'hmi', 'plc');
    p = addFlow(p, defaultFlow('modbus', 'hmi', 'plc'));
    p = addRule(p, 'fw', { ...newRule('r1'), dst: { kind: 'device', id: 'plc' }, action: 'allow' });
    p = addRule(p, 'fw', newRule('r2'));
    expect(countRuleReferences(p, 'device', 'plc')).toBe(1);

    const after = removeDevice(p, 'plc');
    expect(after.devices.map((d) => d.id)).toEqual(['hmi', 'fw']);
    expect(after.links).toEqual([]);
    expect(after.flows).toEqual([]);
    expect(after.devices.find((d) => d.id === 'fw')?.firewall?.rules.map((r) => r.id)).toEqual(['r2']);
  });

  it('unassigns devices and drops rules when a zone is removed', () => {
    let p = addZone(twoDevices(), { id: 'z', name: 'Control', color: '#16a34a', trusted: true, targetSL: 3 });
    p = { ...p, devices: p.devices.map((d) => ({ ...d, zoneId: 'z' })) };
    p = addDevice(p, createDevice('firewall', { x: 0, y: 0 }, 'fw'));
    p = addRule(p, 'fw', { ...newRule('r1'), src: { kind: 'zone', id: 'z' } });
    const after = removeZone(p, 'z');
    expect(after.zones).toEqual([]);
    expect(after.devices.every((d) => d.zoneId === null)).toBe(true);
    expect(after.devices.find((d) => d.id === 'fw')?.firewall?.rules).toEqual([]);
  });

  it('reorders rules and ignores moves past either end', () => {
    let p = addDevice(emptyProject(), createDevice('firewall', { x: 0, y: 0 }, 'fw'));
    p = addRule(addRule(p, 'fw', newRule('a')), 'fw', newRule('b'));
    const ids = (q: Project) => q.devices[0].firewall?.rules.map((r) => r.id);
    expect(ids(moveRule(p, 'fw', 'b', -1))).toEqual(['b', 'a']);
    expect(ids(moveRule(p, 'fw', 'a', -1))).toEqual(['a', 'b']);
    expect(ids(moveRule(p, 'fw', 'b', 1))).toEqual(['a', 'b']);
  });
});

describe('project files', () => {
  it('loads the demo project without errors', () => {
    const result = parseProject(JSON.stringify(demo));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('round-trips through save and load', () => {
    const result = parseProject(JSON.stringify(demo));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const again = parseProject(serializeProject(result.project));
    expect(again).toEqual(result);
  });

  it('reports invalid JSON and schema errors', () => {
    expect(parseProject('{').ok).toBe(false);
    const bad = parseProject(JSON.stringify({ ...demo, schemaVersion: 99 }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/schemaVersion/);
  });

  it('reports dangling references and duplicate ids', () => {
    const p = twoDevices();
    const broken: Project = {
      ...p,
      devices: [...p.devices, { ...p.devices[0] }, { ...p.devices[1], id: 'x', zoneId: 'nowhere' }],
      links: [{ id: 'l', source: 'hmi', target: 'ghost', medium: 'ethernet' }],
    };
    const errors = referenceErrors(broken);
    expect(errors).toContain('Duplicate id "hmi"');
    expect(errors).toContain('Device "x" refers to unknown zone "nowhere"');
    expect(errors).toContain('"l" ends at unknown device "ghost"');
  });
});

describe('conduits', () => {
  it('lists each connected zone pair once', () => {
    const result = parseProject(JSON.stringify(demo));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const conduits = deriveConduits(result.project);
    const keys = conduits.map((c) => c.zones.join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('zone-control|zone-operations');
    const opsControl = conduits.find((c) => c.zones.join('|') === 'zone-control|zone-operations');
    expect(opsControl?.flowIds).toEqual(['flow-scada-filter', 'flow-scada-rtu']);
  });
});
