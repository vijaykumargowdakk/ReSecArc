import { describe, expect, it } from 'vitest';
import v1 from './__fixtures__/demo-v1.json';
import { DEVICE_CATALOG, kindLabel } from './catalog';
import { parseProject, referenceErrors } from './io';
import { migrate } from './migrate';
import { addDevice, addFlow, createDevice, defaultFlow, emptyProject } from './ops';
import { defaultPortFor, defaultSettings, flowLabel, getProtocol, PROTOCOLS, settingsErrors } from './protocols';
import type { Project } from './schema';

function load(raw: unknown): Project {
  const result = parseProject(JSON.stringify(raw));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.project;
}

describe('v1 → v2 migration', () => {
  it('opens a v1 file and fills the new fields', () => {
    const p = load(v1);
    expect(p.schemaVersion).toBe(2);
    expect(p.sites).toEqual([{ id: 'site-main', name: 'Main site' }]);
    expect(p.areas).toEqual([]);
    expect(p.devices).toHaveLength(v1.devices.length);
    for (const d of p.devices) {
      expect(d.variant).toBe('generic');
      expect(d.siteId).toBe('site-main');
      expect(d.areaId).toBeNull();
      expect(d.asset).toEqual({ vendor: '', model: '', firmware: '', serial: '', ip: '', notes: '' });
    }
  });

  it('moves v1 protocol fields into settings unchanged', () => {
    const p = load(v1);
    const dnp3 = p.flows.find((f) => f.id === 'flow-scada-rtu');
    expect(dnp3).toEqual({
      id: 'flow-scada-rtu',
      source: 'scada',
      target: 'rtu-pump',
      protocol: 'dnp3',
      port: 20000,
      settings: { transport: 'tcp', secureAuthentication: true, tls: false, controlCommands: true },
    });
    const modbus = p.flows.find((f) => f.id === 'flow-hmi-filter');
    expect(modbus?.settings).toEqual({ variant: 'tcp', access: 'read-write', authentication: false });
  });

  it('leaves current-version and non-object input alone', () => {
    const current = emptyProject();
    expect(migrate(current)).toBe(current);
    expect(migrate('text')).toBe('text');
  });
});

describe('device catalog', () => {
  it('lists generic first for every type, with unique variant ids', () => {
    for (const [type, info] of Object.entries(DEVICE_CATALOG)) {
      expect(info.variants[0].id, type).toBe('generic');
      const ids = info.variants.map((v) => v.id);
      expect(new Set(ids).size, type).toBe(ids.length);
    }
  });

  it('names devices by their kind', () => {
    expect(kindLabel('plc', 'generic')).toBe('PLC');
    expect(kindLabel('plc', 'compact')).toBe('Compact PLC');
    expect(createDevice('firewall', { x: 0, y: 0 }, { siteId: 'site-main', variant: 'diode' }).label).toBe('Data diode');
  });

  it('rejects unknown variants and sites', () => {
    let p = emptyProject();
    p = addDevice(p, { ...createDevice('plc', { x: 0, y: 0 }, { siteId: 'site-main', id: 'a' }), variant: 'quantum' });
    p = addDevice(p, createDevice('hmi', { x: 0, y: 0 }, { siteId: 'elsewhere', id: 'b' }));
    expect(referenceErrors(p)).toEqual([
      'Device "a" has unknown plc variant "quantum"',
      'Device "b" refers to unknown site "elsewhere"',
    ]);
  });
});

describe('protocol registry', () => {
  it('produces valid defaults for every protocol', () => {
    for (const def of PROTOCOLS) {
      expect(settingsErrors(def, defaultSettings(def)), def.id).toEqual([]);
    }
  });

  it('reports unknown, missing and mistyped settings', () => {
    const modbus = getProtocol('modbus')!;
    expect(settingsErrors(modbus, { variant: 'udp', access: 'read', extra: true })).toEqual([
      'unknown Modbus setting "extra"',
      'Modbus setting "variant" has unsupported value "udp"',
      'missing Modbus setting "authentication"',
    ]);
  });

  it('derives ports and labels from settings', () => {
    const modbus = getProtocol('modbus')!;
    expect(defaultPortFor(modbus, { ...defaultSettings(modbus), variant: 'tls' })).toBe(802);
    expect(flowLabel('modbus', { variant: 'tls', access: 'read-write', authentication: true })).toBe('Modbus TLS RW');
    expect(flowLabel('dnp3', { transport: 'tcp', secureAuthentication: true, tls: false, controlCommands: true })).toBe('DNP3 SA ctrl');
  });

  it('validates flows in a project', () => {
    let p = emptyProject();
    p = addDevice(p, createDevice('hmi', { x: 0, y: 0 }, { siteId: 'site-main', id: 'h' }));
    p = addDevice(p, createDevice('plc', { x: 0, y: 0 }, { siteId: 'site-main', id: 'c' }));
    p = addFlow(p, { ...defaultFlow('modbus', 'h', 'c', 'f1'), port: null });
    p = addFlow(p, { ...defaultFlow('dnp3', 'h', 'c', 'f2'), protocol: 'carrier-pigeon' });
    expect(referenceErrors(p)).toEqual(['Flow "f1": Modbus needs a port', 'Flow "f2" uses unknown protocol "carrier-pigeon"']);
  });
});

describe('extended protocols', () => {
  const port = (id: string, patch: Record<string, string | boolean>) => {
    const def = getProtocol(id)!;
    return defaultPortFor(def, { ...defaultSettings(def), ...patch });
  };

  it('picks ports from settings', () => {
    expect(port('enip', {})).toBe(44818);
    expect(port('enip', { messaging: 'implicit' })).toBe(2222);
    expect(port('iec104', { tls: true })).toBe(19998);
    expect(port('mms', { tls: true })).toBe(3782);
    expect(port('bacnet', { secureConnect: true })).toBe(443);
    expect(port('mqtt', { tls: true })).toBe(8883);
    expect(port('profinet', {})).toBeNull();
    expect(port('goose', {})).toBeNull();
  });

  it('labels flows from their settings', () => {
    const custom = getProtocol('custom')!;
    expect(flowLabel('custom', { ...defaultSettings(custom), name: 'Historian sync', encrypted: true })).toBe('Historian sync enc');
    expect(flowLabel('opcua', { securityMode: 'signandencrypt', userAuth: 'certificate' })).toBe('OPC UA Encrypt');
    expect(flowLabel('opcua', { securityMode: 'none', userAuth: 'anonymous' })).toBe('OPC UA anon');
  });

  it('lets custom flows have a port or none, and rejects ports on layer-2 protocols', () => {
    let p = emptyProject();
    p = addDevice(p, createDevice('hmi', { x: 0, y: 0 }, { siteId: 'site-main', id: 'h' }));
    p = addDevice(p, createDevice('plc', { x: 0, y: 0 }, { siteId: 'site-main', id: 'c' }));
    p = addFlow(p, defaultFlow('custom', 'h', 'c', 'f1'));
    p = addFlow(p, { ...defaultFlow('custom', 'c', 'h', 'f2'), port: 9000 });
    p = addFlow(p, { ...defaultFlow('profinet', 'h', 'c', 'f3'), port: 34964 });
    expect(referenceErrors(p)).toEqual(['Flow "f3": PROFINET is layer 2 and has no port']);
  });
});
