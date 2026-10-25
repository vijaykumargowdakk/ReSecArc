import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { parseProject, serializeProject } from './io';
import { addFlow, addLink, createDevice, defaultFlow, emptyProject, extractFragment, pasteFragment, updateDevice, updateLink, addDevice } from './ops';
import { designOf, diffDesigns, saveRevision } from './revisions';
import { SCHEMA_VERSION, type Project } from './schema';

function load(raw: unknown): Project {
  const result = parseProject(JSON.stringify(raw));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.project;
}

/** A minimal format-3 file with one link, one flow, a note, an area and a revision. */
function v3File() {
  const device = (id: string, y: number) => ({
    id, type: 'plc', variant: 'generic', label: id, purdueLevel: 1, siteId: 'site-main', zoneId: null, areaId: null,
    criticality: 'medium', position: { x: 300, y }, services: [], asset: { vendor: '', model: '', firmware: '', serial: '', ip: '', notes: '' },
  });
  const design = {
    name: 'Old file',
    sites: [{ id: 'site-main', name: 'Main site' }],
    devices: [device('a', 787), device('b', 787)],
    links: [{ id: 'l1', source: 'a', target: 'b', medium: 'ethernet' }],
    flows: [{ id: 'f1', source: 'a', target: 'b', protocol: 'modbus', port: 502, settings: { variant: 'tcp', access: 'read', authentication: false } }],
    zones: [],
    areas: [{ id: 'ar', siteId: 'site-main', name: 'Cell', color: '#0ea5e9', rect: { x: 0, y: 700, width: 900, height: 200 }, collapsed: false }],
    notes: [{ id: 'n', siteId: 'site-main', text: 'hi', position: { x: 0, y: 0 }, width: 260, color: '#64748b' }],
    networks: [],
  };
  return { schemaVersion: 3, ...design, revisions: [{ id: 'r1', name: 'Baseline', createdAt: '2026-01-01T00:00:00.000Z', design }] };
}

describe('v3 → v4 migration', () => {
  it('adds interface fields, bend points, locks, tags and custom fields, including inside revisions', () => {
    const p = load(v3File());
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.links[0]).toMatchObject({ sourcePort: '', targetPort: '', vlans: [], networkId: null, waypoints: [] });
    expect(p.flows[0].waypoints).toEqual([]);
    expect(p.devices[0]).toMatchObject({ tags: [], fields: {}, locked: false });
    expect(p.notes[0].locked).toBe(false);
    expect(p.areas[0].locked).toBe(false);
    expect(p.fieldDefs).toEqual([]);
    expect(p.revisions[0].design.links[0].vlans).toEqual([]);
    expect(p.revisions[0].design.fieldDefs).toEqual([]);
  });

  it('keeps every template valid and gives two of them ports and VLANs', () => {
    const line = loadTemplate('manufacturing');
    const trunk = line.links.find((l) => l.id === 'link-fw-core')!;
    expect(trunk.vlans).toEqual([20, 21, 22]);
    expect(line.links.find((l) => l.id === 'link-core-plc-a')).toMatchObject({ sourcePort: 'Gi1/0/12', networkId: 'net-cell-a' });
    expect(loadTemplate('substation').links.filter((l) => l.networkId === 'net-bay')).toHaveLength(3);
  });
});

describe('v4 reference checks and bounds', () => {
  const base = () => {
    let p = emptyProject();
    p = addDevice(p, createDevice('plc', { x: 0, y: 787 }, { siteId: 'site-main', id: 'a' }));
    p = addDevice(p, createDevice('hmi', { x: 300, y: 637 }, { siteId: 'site-main', id: 'b' }));
    return addLink(p, 'a', 'b', 'l');
  };

  it('rejects a link to an unknown network and a value for an unknown custom field', () => {
    const p = updateDevice(updateLink(base(), 'l', { networkId: 'ghost' }), 'a', { fields: { nope: 'x' } });
    const result = parseProject(serializeProject(p));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('Link "l" refers to unknown network "ghost"');
      expect(result.errors).toContain('Device "a" has a value for unknown custom field "nope"');
    }
  });

  it('accepts a select value that is no longer an option', () => {
    const p: Project = { ...updateDevice(base(), 'a', { fields: { owner: 'Retired team' } }), fieldDefs: [{ id: 'owner', label: 'Owner', kind: 'select', options: ['OT team'] }] };
    expect(parseProject(serializeProject(p)).ok).toBe(true);
  });

  it('rejects out-of-range VLANs and too many bend points', () => {
    const vlan = updateLink(base(), 'l', { vlans: [5000] });
    expect(parseProject(serializeProject(vlan)).ok).toBe(false);
    const bends = updateLink(base(), 'l', { waypoints: Array.from({ length: 101 }, (_, i) => ({ x: i, y: i })) });
    expect(parseProject(serializeProject(bends)).ok).toBe(false);
  });
});

describe('v4 in the change diff and copy/paste', () => {
  it('describes port, VLAN, network, tag and custom field changes; a re-route is a move', () => {
    let p: Project = { ...loadTemplate('manufacturing'), fieldDefs: [{ id: 'owner', label: 'Owner', kind: 'text', options: [] }] };
    p = saveRevision(p, 'Baseline', new Date('2026-01-01T00:00:00Z'), 'rev');
    p = updateLink(p, 'link-core-plc-a', { targetPort: 'X2 P1', vlans: [21, 30], networkId: 'net-cell-b' });
    p = updateLink(p, 'link-core-hist', { waypoints: [{ x: 10, y: 20 }] });
    p = updateDevice(p, 'plc-a', { tags: ['patch-pending'], fields: { owner: 'Line 3 team' } });
    const changes = diffDesigns(p.revisions[0].design, designOf(p));
    const link = changes.find((c) => c.id === 'link-core-plc-a')!;
    expect(link.details).toEqual(['port at Cell A PLC: X1 P1 → X2 P1', 'VLANs: 21 → 21, 30', 'network: Cell A → Cell B']);
    expect(changes.find((c) => c.id === 'link-core-hist')).toMatchObject({ moveOnly: true, details: ['re-routed on the canvas'] });
    expect(changes.find((c) => c.id === 'plc-a')!.details).toEqual(['tags: — → patch-pending', 'Owner: — → Line 3 team']);
  });

  it('copies tags, fields and bend points, shifting the bend points with the paste', () => {
    let p = addDevice(emptyProject(), { ...createDevice('plc', { x: 0, y: 787 }, { siteId: 'site-main', id: 'x' }), tags: ['t'] });
    p = addDevice(p, createDevice('hmi', { x: 300, y: 637 }, { siteId: 'site-main', id: 'y' }));
    p = addFlow(addLink(p, 'x', 'y', 'l'), defaultFlow('modbus', 'x', 'y', 'f'));
    p = updateLink(p, 'l', { waypoints: [{ x: 100, y: 700 }], vlans: [10] });
    const pasted = pasteFragment(p, extractFragment(p, ['x', 'y']), { x: 40, y: 40 }, 'site-main').project;
    const copy = pasted.links.find((l) => l.id !== 'l')!;
    expect(copy.waypoints).toEqual([{ x: 140, y: 740 }]);
    expect(copy.vlans).toEqual([10]);
    expect(pasted.devices.filter((d) => d.tags.includes('t'))).toHaveLength(2);
  });
});
