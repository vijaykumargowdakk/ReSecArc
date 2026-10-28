import { describe, expect, it } from 'vitest';
import { loadTemplate, TEMPLATES } from '../../examples/templates';
import { runChecks } from '../checks';
import { addDevice, addFlow, addLink, addRule, createDevice, defaultFlow, emptyProject, newRule, updateDevice } from '../ops';
import type { Device, DeviceType, FirewallRule, Project, PurdueLevel } from '../schema';
import { ICS_TECHNIQUES } from './icsTechniques';
import { findAttackPaths, firewallPasses, MAX_PATHS, pathFindings, pathMarks, type AttackPath } from './paths';

const water = () => loadTemplate('water-treatment');
const find = (p: Project, id: string, overrides?: Parameters<typeof findAttackPaths>[1]) => findAttackPaths(p, overrides).paths.find((x) => x.id === id);
const chain = (path: AttackPath) => path.steps.map((s) => `${s.deviceId}:${s.technique}`);

/** Puts a rule first on the IT/OT firewall. */
function firstRule(p: Project, rule: Partial<FirewallRule>): Project {
  const fw = p.devices.find((d) => d.id === 'fw-itot')!;
  const r = { ...newRule(), ...rule };
  return updateDevice(p, fw.id, { firewall: { ...fw.firewall!, rules: [r, ...fw.firewall!.rules] } });
}

describe('water-treatment template', () => {
  it('finds the office workstation to pump station RTU path through the jump host', () => {
    const path = find(water(), 'office-ws>rtu-pump')!;
    expect(chain(path)).toEqual(['office-ws:T0865', 'jump:T0886', 'scada:T0886', 'rtu-pump:T1692.001']);
    expect(path.steps.map((s) => s.tactic)).toEqual(['initial-access', 'lateral-movement', 'lateral-movement', 'impair-process-control']);
    expect(path.impact).toEqual({ tactic: 'impact', technique: 'T0831' });
    // The firewall is crossed on the way to the jump host and again to SCADA.
    expect(path.steps[1].viaDeviceIds).toContain('fw-itot');
    expect(path.steps[2].viaDeviceIds).toEqual(['fw-itot', 'ops-switch']);
    expect(path.steps[3].viaFlowId).toBe('flow-scada-rtu');
  });

  it('with the direct link, goes straight from the office workstation to the RTU', () => {
    const p = addLink(water(), 'office-ws', 'rtu-pump', 'link-bad');
    const path = find(p, 'office-ws>rtu-pump')!;
    expect(chain(path)).toEqual(['office-ws:T0865', 'rtu-pump:T0866']);
    expect(path.steps[1].viaLinkIds).toEqual(['link-bad']);
    // The path lists the finding it relies on.
    expect(pathFindings(p, path, runChecks(p)).map((f) => f.checkId)).toEqual(['it-ot-direct']);
  });

  it('a deny rule on the firewall removes the paths through it, and an allow rule above it restores them', () => {
    const denied = firstRule(water(), { src: { kind: 'device', id: 'jump' }, dst: { kind: 'zone', id: 'zone-operations' }, protocol: 'any', port: null, action: 'deny' });
    expect(find(denied, 'office-ws>rtu-pump')).toBeUndefined();
    expect(findAttackPaths(denied).total).toBe(0);
    const allowed = firstRule(denied, { src: { kind: 'device', id: 'jump' }, dst: { kind: 'device', id: 'scada' }, protocol: 'rdp', port: 3389, action: 'allow' });
    expect(chain(find(allowed, 'office-ws>rtu-pump')!)).toEqual(['office-ws:T0865', 'jump:T0886', 'scada:T0886', 'rtu-pump:T1692.001']);
  });

  it('ranks safety system targets first and labels their impact as loss of safety', () => {
    const { paths } = findAttackPaths(water());
    expect(paths[0].targetId).toBe('sis');
    expect(paths[0].impact.technique).toBe('T0880');
    // The engineering workstation reaches controllers by program download.
    expect(paths[0].steps.at(-1)).toMatchObject({ technique: 'T0843', tactic: 'lateral-movement' });
    expect(paths[0].steps.at(-2)?.deviceId).toBe('ews');
  });

  it('honours entry and target overrides', () => {
    const none = findAttackPaths(water(), { entries: { vendor: false, 'office-ws': false, jump: false }, targets: {} });
    expect(none.entryIds).toEqual(['historian-dmz']);
    expect(none.total).toBe(0);
    const hmi = findAttackPaths(water(), { entries: {}, targets: { hmi: true } });
    expect(hmi.targetIds).toContain('hmi');
    expect(hmi.paths.some((p) => p.targetId === 'hmi')).toBe(true);
  });

  it('marks step devices with their number and everything crossed as via', () => {
    const marks = pathMarks(find(water(), 'jump>rtu-pump')!);
    expect([marks.get('jump'), marks.get('scada'), marks.get('rtu-pump')]).toEqual([1, 2, 3]);
    expect(marks.get('fw-itot')).toBe('via');
    expect(marks.get('flow-scada-rtu')).toBe('via');
    expect(marks.get('link-fw-itot-ops-switch')).toBe('via');
  });
});

describe('every template', () => {
  it('labels each step with a technique under its tactic', () => {
    for (const t of TEMPLATES) {
      for (const path of findAttackPaths(loadTemplate(t.id)).paths) {
        for (const s of [...path.steps, path.impact]) expect(ICS_TECHNIQUES[s.technique].tactics as readonly string[]).toContain(s.tactic);
        expect(path.steps[0].tactic).toBe('initial-access');
      }
    }
  });
});

describe('firewallPasses', () => {
  const dev = (id: string, zoneId: string | null = null): Device => ({ ...createDevice('workstation', { x: 0, y: 0 }, { siteId: 's', id }), zoneId });
  const fw = (rules: Partial<FirewallRule>[], defaultAction: 'allow' | 'deny' = 'deny'): Device => ({
    ...createDevice('firewall', { x: 0, y: 0 }, { siteId: 's', id: 'fw' }),
    firewall: { defaultAction, rules: rules.map((r) => ({ ...newRule(), ...r })) },
  });
  const a = dev('a', 'it');
  const b = dev('b', 'ot');

  it('uses the default action when no rule matches', () => {
    expect(firewallPasses(fw([]), a, b)).toBe(false);
    expect(firewallPasses(fw([], 'allow'), a, b)).toBe(true);
    expect(firewallPasses(fw([{ src: { kind: 'device', id: 'x' }, action: 'allow' }]), a, b)).toBe(false);
  });

  it('lets other protocols through after a narrower deny', () => {
    expect(firewallPasses(fw([{ protocol: 'modbus', port: 502, action: 'deny' }, { protocol: 'https', port: 443, action: 'allow' }]), a, b)).toBe(true);
    expect(firewallPasses(fw([{ protocol: 'https', port: 443, action: 'deny' }, { protocol: 'https', port: 443, action: 'allow' }]), a, b)).toBe(false);
  });

  it('stops at a deny of everything', () => {
    expect(firewallPasses(fw([{ action: 'deny' }, { protocol: 'https', port: 443, action: 'allow' }], 'allow'), a, b)).toBe(false);
    expect(firewallPasses(fw([{ src: { kind: 'zone', id: 'it' }, dst: { kind: 'zone', id: 'ot' }, action: 'allow' }]), a, b)).toBe(true);
  });
});

describe('flows', () => {
  const LEVEL_Y: Record<PurdueLevel, number> = { 5: 50, 4: 200, 3.5: 350, 3: 500, 2: 650, 1: 800, 0: 950 };
  const place = (p: Project, id: string, type: DeviceType, level: PurdueLevel) =>
    addDevice(p, { ...createDevice(type, { x: 0, y: LEVEL_Y[level] }, { siteId: 'site-main', id }), purdueLevel: level });

  it('reach a device without links, unless a firewall on the route denies them', () => {
    let p = place(place(emptyProject(), 'ws', 'workstation', 4), 'plc', 'plc', 1);
    expect(findAttackPaths(p).total).toBe(0);
    p = addFlow(p, defaultFlow('modbus', 'ws', 'plc', 'f1'));
    expect(chain(find(p, 'ws>plc')!)).toEqual(['ws:T0865', 'plc:T1692.001']);
    p = place(p, 'fw', 'firewall', 3.5);
    p = addLink(addLink(p, 'ws', 'fw'), 'fw', 'plc');
    expect(findAttackPaths(p).total).toBe(0);
    p = addRule(p, 'fw', { ...newRule(), protocol: 'modbus', port: 502, action: 'allow' });
    expect(find(p, 'ws>plc')?.steps[1].viaDeviceIds).toEqual(['fw']);
  });
});

describe('scale', () => {
  it('finds paths in a 1,000-device design quickly', () => {
    let p = emptyProject();
    const zone = (id: string) => ({ id, name: id, color: '#64748b', trusted: false, targetSL: 2 as const });
    p = { ...p, zones: [zone('it'), ...Array.from({ length: 20 }, (_, i) => zone(`cell-${i}`))] };
    const add = (id: string, type: DeviceType, level: PurdueLevel, zoneId: string | null) => {
      p = addDevice(p, { ...createDevice(type, { x: 0, y: 0 }, { siteId: 'site-main', id }), purdueLevel: level, zoneId });
    };
    add('it-switch', 'switch', 4, 'it');
    add('core', 'firewall', 3.5, null);
    add('ot-core', 'switch', 3, null);
    p = addLink(addLink(p, 'it-switch', 'core'), 'core', 'ot-core');
    for (let i = 0; i < 100; i++) {
      add(`ws-${i}`, 'workstation', 4, 'it');
      p = addLink(p, `ws-${i}`, 'it-switch');
    }
    p = addRule(p, 'core', { ...newRule(), src: { kind: 'zone', id: 'it' }, dst: { kind: 'zone', id: 'cell-0' }, protocol: 'https', port: 443, action: 'allow' });
    for (let c = 0; c < 20; c++) {
      add(`cell-fw-${c}`, 'firewall', 2, null);
      add(`cell-sw-${c}`, 'switch', 2, `cell-${c}`);
      p = addLink(addLink(p, 'ot-core', `cell-fw-${c}`), `cell-fw-${c}`, `cell-sw-${c}`);
      p = addRule(p, `cell-fw-${c}`, { ...newRule(), src: { kind: 'zone', id: 'it' }, action: 'allow' });
      for (let k = 0; k < 44; k++) {
        const id = `c${c}-${k}`;
        add(id, k < 10 ? 'plc' : k < 14 ? 'hmi' : 'sensor', k < 10 ? 1 : k < 14 ? 2 : 0, `cell-${c}`);
        p = addLink(p, id, `cell-sw-${c}`);
      }
    }
    expect(p.devices.length).toBeGreaterThanOrEqual(1000);
    const start = performance.now();
    const report = findAttackPaths(p);
    const ms = performance.now() - start;
    // Only cell 0 is reachable from IT: 100 workstations × 10 PLCs.
    expect(report.total).toBe(1000);
    expect(report.paths).toHaveLength(MAX_PATHS);
    expect(ms).toBeLessThan(1000);
  });
});
