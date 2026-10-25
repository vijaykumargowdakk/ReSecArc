import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { COMMUNICATION_VIOLATION, firewallVerdict, findingsByItem, runChecks, type Finding } from './checks';
import { addPolicy, examplePolicy, newPolicy, setCheckEnabled } from './policies';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, emptyProject, newRule, updateDevice } from './ops';
import type { Device, DeviceType, FirewallRule, Project, PurdueLevel } from './schema';

const LEVEL_Y: Record<PurdueLevel, number> = { 5: 50, 4: 200, 3.5: 350, 3: 500, 2: 650, 1: 800, 0: 950 };

function place(p: Project, id: string, type: DeviceType, level: PurdueLevel, zoneId: string | null = null, patch: Partial<Device> = {}): Project {
  const d = createDevice(type, { x: 100, y: LEVEL_Y[level] }, { siteId: 'site-main', id });
  return addDevice(p, { ...d, purdueLevel: level, zoneId, ...patch });
}

function zoned(): Project {
  const p = emptyProject();
  const zone = (id: string) => ({ id, name: id, color: '#64748b', trusted: false, targetSL: 2 as const });
  return { ...p, zones: [zone('it'), zone('ops'), zone('ctrl'), zone('safety')] };
}

const ids = (fs: Finding[], check: string) => fs.filter((f) => f.checkId === check);
const water = () => loadTemplate('water-treatment');

describe('water-treatment template', () => {
  it('flags the office workstation linked straight to the pump station RTU', () => {
    const p = addLink(water(), 'office-ws', 'rtu-pump', 'link-bad');
    const [f] = ids(runChecks(p), 'it-ot-direct');
    expect(f).toMatchObject({
      headline: 'IEC 62443 communication violation',
      severity: 'high',
      message: 'Office workstation (L4) connects directly to Pump station RTU (L1)',
      items: { links: ['link-bad'] },
    });
    expect(f.reference).toContain('ZCR 3.2');
    // The more specific finding replaces the generic zone-boundary one for the same link.
    expect(runChecks(p).filter((x) => x.items.links.includes('link-bad'))).toHaveLength(1);
  });

  it('raises nothing for the same connection made through the firewall', () => {
    let p = addLink(water(), 'office-ws', 'fw-itot', 'l1');
    p = addLink(p, 'fw-itot', 'rtu-pump', 'l2');
    const touched = runChecks(p).filter((f) => f.items.links.some((l) => l === 'l1' || l === 'l2'));
    expect(touched).toEqual([]);
    expect(ids(runChecks(p), 'it-ot-direct')).toEqual([]);
  });

  it('reports the template’s own gaps: ops↔control switch, SIS link and plain Modbus across zones', () => {
    const found = runChecks(water()).map((f) => `${f.checkId}:${f.items.links[0] ?? f.items.flows[0]}`);
    expect(found).toContain('zone-boundary-unprotected:link-ops-switch-ctrl-switch');
    expect(found).toContain('sis-not-separated:link-plc-dosing-sis');
    expect(found).toContain('insecure-protocol-cross-zone:flow-scada-filter');
    // DNP3 with Secure Authentication counts as secured.
    expect(found).not.toContain('insecure-protocol-cross-zone:flow-scada-rtu');
  });
});

describe('built-in checks', () => {
  it('it-ot-direct: flows too, but not through a boundary device or between OT levels', () => {
    let p = place(zoned(), 'ws', 'workstation', 4, 'it');
    p = place(p, 'scada', 'scada', 3, 'ops');
    p = place(p, 'plc', 'plc', 1, 'ops');
    p = addFlow(p, defaultFlow('opcua', 'ws', 'scada', 'f1'));
    p = addFlow(p, defaultFlow('modbus', 'scada', 'plc', 'f2'));
    const fs = ids(runChecks(p), 'it-ot-direct');
    expect(fs.map((f) => f.items.flows)).toEqual([['f1']]);
    expect(fs[0].message).toBe('Corporate workstation (L4) sends OPC UA directly to SCADA server (L3)');
  });

  it('zone-boundary-unprotected: end devices or networks in different zones, not a device on a neighbouring switch', () => {
    let p = place(zoned(), 'sw-ops', 'switch', 3, 'ops');
    p = place(p, 'sw-ctrl', 'switch', 2, 'ctrl');
    p = place(p, 'plc', 'plc', 1, 'ctrl');
    p = place(p, 'hmi', 'hmi', 2, 'ops');
    p = addLink(p, 'sw-ops', 'sw-ctrl', 'backbone');
    p = addLink(p, 'sw-ops', 'plc', 'drop');
    p = addLink(p, 'hmi', 'plc', 'direct');
    expect(ids(runChecks(p), 'zone-boundary-unprotected').map((f) => f.items.links[0]).sort()).toEqual(['backbone', 'direct']);
  });

  it('firewall-default-allow and firewall-any-any', () => {
    const anyAny: FirewallRule = { ...newRule('r1'), action: 'allow' };
    let p = place(zoned(), 'fw', 'firewall', 3.5, null);
    p = updateDevice(p, 'fw', { firewall: { defaultAction: 'allow', rules: [{ ...newRule('r0'), protocol: 'modbus' }, anyAny] } });
    const fs = runChecks(p);
    expect(ids(fs, 'firewall-default-allow')).toHaveLength(1);
    expect(ids(fs, 'firewall-any-any')[0].message).toContain('rule 2');
  });

  it('insecure-protocol-cross-zone: only unsecured flows between two zones', () => {
    let p = place(zoned(), 'a', 'scada', 3, 'ops');
    p = place(p, 'b', 'plc', 1, 'ctrl');
    p = place(p, 'c', 'plc', 1, 'ops');
    p = addFlow(p, defaultFlow('modbus', 'a', 'b', 'plain'));
    p = addFlow(p, { ...defaultFlow('modbus', 'a', 'b', 'tls'), settings: { variant: 'tls', access: 'read', authentication: false } });
    p = addFlow(p, defaultFlow('modbus', 'a', 'c', 'same-zone'));
    expect(ids(runChecks(p), 'insecure-protocol-cross-zone').map((f) => f.items.flows[0])).toEqual(['plain']);
  });

  it('remote-access-control: remote services at L0–L2 only', () => {
    let p = place(zoned(), 'hmi', 'hmi', 2, 'ctrl', { services: [{ protocol: 'vnc', port: 5900 }] });
    p = place(p, 'scada', 'scada', 3, 'ops', { services: [{ protocol: 'rdp', port: 3389 }] });
    const fs = ids(runChecks(p), 'remote-access-control');
    expect(fs.map((f) => f.items.devices)).toEqual([['hmi']]);
    expect(fs[0].message).toContain('VNC');
  });

  it('sis-not-separated: shared zone, or a link to a non-safety device without a boundary device', () => {
    let p = place(zoned(), 'sis', 'sis', 1, 'ctrl');
    p = place(p, 'plc', 'plc', 1, 'ctrl');
    p = place(p, 'sensor', 'sensor', 0, 'ctrl');
    let fs = ids(runChecks(p), 'sis-not-separated');
    expect(fs).toHaveLength(1);
    expect(fs[0].items.devices).toEqual(['sis', 'plc']);

    p = updateDevice(p, 'sis', { zoneId: 'safety' });
    p = addLink(p, 'sis', 'plc', 'l1');
    p = addLink(p, 'sis', 'sensor', 'l2');
    fs = ids(runChecks(p), 'sis-not-separated');
    expect(fs.map((f) => f.items.links)).toEqual([['l1'], ['l2']]);
  });

  it('device-without-zone: OT devices only, low severity', () => {
    let p = place(emptyProject(), 'plc', 'plc', 1);
    p = place(p, 'ws', 'workstation', 4);
    p = place(p, 'fw', 'firewall', 3, null, { firewall: { defaultAction: 'deny', rules: [] } });
    const fs = ids(runChecks(p), 'device-without-zone');
    expect(fs.map((f) => [f.items.devices[0], f.severity])).toEqual([['plc', 'low']]);
  });

  it('skips checks switched off for the project', () => {
    const p = setCheckEnabled(addLink(water(), 'office-ws', 'rtu-pump'), 'it-ot-direct', false);
    expect(ids(runChecks(p), 'it-ot-direct')).toEqual([]);
    expect(setCheckEnabled(p, 'it-ot-direct', true).disabledChecks).toEqual([]);
  });

  it('sorts by severity and gives stable ids', () => {
    const p = addLink(water(), 'office-ws', 'rtu-pump', 'link-bad');
    const fs = runChecks(p);
    expect(fs.map((f) => f.severity)).toEqual([...fs.map((f) => f.severity)].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b)));
    expect(runChecks(p).map((f) => f.id)).toEqual(fs.map((f) => f.id));
    expect(new Set(fs.map((f) => f.id)).size).toBe(fs.length);
  });

  it('indexes findings by device, link and flow', () => {
    const p = addLink(water(), 'office-ws', 'rtu-pump', 'link-bad');
    const map = findingsByItem(p, runChecks(p));
    expect(map.get('link-bad')?.[0].checkId).toBe('it-ot-direct');
    expect(map.get('office-ws')?.some((f) => f.checkId === 'it-ot-direct')).toBe(true);
    expect(map.get('rtu-pump')?.some((f) => f.checkId === 'it-ot-direct')).toBe(true);
  });
});

describe('company policies', () => {
  const base = () => {
    let p = place(zoned(), 'ws', 'workstation', 4, 'it', { tags: ['Vendor'] });
    p = place(p, 'plc', 'plc', 1, 'ctrl');
    p = place(p, 'rtu', 'rtu', 1, 'ctrl');
    p = addLink(p, 'plc', 'ws', 'link');
    p = addFlow(p, defaultFlow('modbus', 'ws', 'plc', 'f-modbus'));
    p = addFlow(p, defaultFlow('dnp3', 'rtu', 'ws', 'f-dnp3'));
    return setCheckEnabled(p, 'it-ot-direct', false);
  };
  const policy = (p: Project) => runChecks(p).filter((f) => f.source === 'policy');

  it('the example rule flags links either way round and flows both ways', () => {
    const fs = policy(addPolicy(base(), examplePolicy('pol')));
    expect(fs.map((f) => f.id).sort()).toEqual(['pol:f-dnp3', 'pol:f-modbus', 'pol:link']);
    expect(fs[0].headline).toBe('Company policy violation: No direct IT → OT');
    expect(fs[0].severity).toBe('high');
  });

  it('respects direction for flows unless bothWays is set', () => {
    const one = { ...examplePolicy('pol'), bothWays: false, connection: 'flow' as const };
    expect(policy(addPolicy(base(), one)).map((f) => f.items.flows[0])).toEqual(['f-modbus']);
  });

  it('matches every selector kind', () => {
    const cases: [Partial<ReturnType<typeof newPolicy>>, string[]][] = [
      [{ from: { kind: 'zone', id: 'it' }, to: { kind: 'any' } }, ['f-modbus']],
      [{ from: { kind: 'type', types: ['rtu'] }, to: { kind: 'levels', levels: [4] } }, ['f-dnp3']],
      [{ from: { kind: 'tag', tag: 'vendor' }, to: { kind: 'type', types: ['plc'] } }, ['f-modbus']],
    ];
    for (const [patch, expected] of cases) {
      const rule = { ...newPolicy('pol'), connection: 'flow' as const, ...patch };
      expect(policy(addPolicy(base(), rule)).map((f) => f.items.flows[0])).toEqual(expected);
    }
  });

  it('limits to protocols, and a protocol filter never matches links', () => {
    const rule = { ...examplePolicy('pol'), protocols: ['dnp3'] };
    expect(policy(addPolicy(base(), rule)).map((f) => f.id)).toEqual(['pol:f-dnp3']);
  });

  it('ignores disabled rules', () => {
    expect(policy(addPolicy(base(), { ...examplePolicy('pol'), enabled: false }))).toEqual([]);
  });

  it('is reported alongside the IEC 62443 finding', () => {
    const p = addPolicy(addLink(water(), 'office-ws', 'rtu-pump', 'link-bad'), examplePolicy('pol'));
    const headlines = runChecks(p).filter((f) => f.items.links.includes('link-bad')).map((f) => f.headline);
    expect(headlines).toEqual([COMMUNICATION_VIOLATION, 'Company policy violation: No direct IT → OT']);
  });
});

describe('firewallVerdict', () => {
  const p = water();
  const dev = (id: string) => p.devices.find((d) => d.id === id)!;
  const fw = dev('fw-itot');

  it('applies the first matching rule, then the default action', () => {
    expect(firewallVerdict(fw, dev('office-ws'), dev('jump'), 'https', 443)).toBe('allow');
    expect(firewallVerdict(fw, dev('office-ws'), dev('jump'), 'rdp', 3389)).toBe('deny');
    expect(firewallVerdict(fw, dev('jump'), dev('scada'), 'rdp', 3389)).toBe('allow');
    expect(firewallVerdict(fw, dev('jump'), dev('scada'), 'rdp', 22)).toBe('deny');
  });

  it('rule order decides between overlapping rules', () => {
    const deny: FirewallRule = { ...newRule('d'), src: { kind: 'device', id: 'jump' }, action: 'deny' };
    const first = { ...fw, firewall: { ...fw.firewall!, rules: [deny, ...fw.firewall!.rules] } };
    const last = { ...fw, firewall: { ...fw.firewall!, rules: [...fw.firewall!.rules, deny] } };
    expect(firewallVerdict(first, dev('jump'), dev('scada'), 'rdp', 3389)).toBe('deny');
    expect(firewallVerdict(last, dev('jump'), dev('scada'), 'rdp', 3389)).toBe('allow');
  });

  it('an any-protocol query matches protocol-specific rules', () => {
    expect(firewallVerdict(fw, dev('jump'), dev('scada'), 'any', null)).toBe('allow');
    const open = { ...fw, firewall: { defaultAction: 'allow' as const, rules: [] } };
    expect(firewallVerdict(open, dev('office-ws'), dev('rtu-pump'), 'modbus', 502)).toBe('allow');
  });
});
