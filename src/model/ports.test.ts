import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { linksToCsv } from './csv';
import { importLinks, parseLinkCsv } from './csvImport';
import { linkIssues, parseVlans } from './ipam';
import { parseProject, serializeProject } from './io';
import { overlapping, tidyLayout } from './layout';
import { alignDevices, updateDevice, updateLink } from './ops';
import { insertWaypoint, midpoint, moveWaypoint, removeWaypoint } from './routing';
import type { Project } from './schema';

describe('bend points', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 400, y: 0 };

  it('inserts a point into the nearest segment and keeps route order', () => {
    let w = insertWaypoint([], from, to, { x: 200, y: 50 });
    expect(w).toEqual([{ x: 200, y: 50 }]);
    w = insertWaypoint(w, from, to, { x: 50, y: 20 });
    w = insertWaypoint(w, from, to, { x: 350, y: 20 });
    expect(w.map((p) => p.x)).toEqual([50, 200, 350]);
  });

  it('moves, removes and clamps points', () => {
    const w = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    expect(moveWaypoint(w, 1, { x: 5e9, y: -3.6 })).toEqual([{ x: 1, y: 1 }, { x: 1_000_000, y: -4 }]);
    expect(removeWaypoint(w, 0)).toEqual([{ x: 2, y: 2 }]);
  });

  it('finds the halfway point of a polyline', () => {
    expect(midpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])).toEqual({ x: 100, y: 0 });
  });
});

describe('VLAN lists', () => {
  it('parses lists and ranges, and rejects bad values', () => {
    expect(parseVlans('20, 10 30-32')).toEqual([10, 20, 30, 31, 32]);
    expect(parseVlans('')).toEqual([]);
    expect(parseVlans('0')).toBeNull();
    expect(parseVlans('4095')).toBeNull();
    expect(parseVlans('10-5')).toBeNull();
    expect(parseVlans('ten')).toBeNull();
    expect(parseVlans('1-4094')).toBeNull();
  });
});

describe('link and network consistency', () => {
  it('is quiet for the templates', () => {
    for (const id of ['substation', 'manufacturing']) expect([...linkIssues(loadTemplate(id)).values()].flat(), id).toEqual([]);
  });

  it('flags an end device outside the link network and a VLAN the link does not carry', () => {
    let p = loadTemplate('manufacturing');
    p = updateLink(p, 'link-core-plc-a', { networkId: 'net-cell-b', vlans: [21] });
    expect(linkIssues(p).get('link-core-plc-a')).toEqual([
      'Cell A PLC has no address in Cell B (10.22.0.0/24)',
      'Cell B is on VLAN 22, which this link does not carry (21)',
    ]);
  });
});

describe('links CSV', () => {
  it('re-imports exported links with ports, VLANs and networks', () => {
    const full = loadTemplate('substation');
    const empty: Project = { ...full, links: [] };
    const rows = parseLinkCsv(empty, linksToCsv(full));
    expect(rows.flatMap((r) => r.errors)).toEqual([]);
    const after = importLinks(empty, rows);
    const strip = (p: Project) => p.links.map(({ id: _id, ...rest }) => rest);
    expect(strip(after)).toEqual(strip(full));
    expect(parseProject(serializeProject(after)).ok).toBe(true);
  });

  it('reports bad rows', () => {
    const p = { ...loadTemplate('substation'), links: [] };
    const r = parseLinkCsv(p, 'source,target,medium,vlans,network\nWAN router,Nowhere,ethernet,,\nWAN router,Substation firewall,fibre,5000,Ghost net');
    expect(r[0].errors).toEqual(['no device named "Nowhere"']);
    expect(r[1].errors).toEqual([
      'medium must be ethernet, serial or wireless',
      'VLANs "5000" must be numbers from 1 to 4094, e.g. "10 20" or "30-32"',
      'no network named "Ghost net"',
    ]);
  });
});

describe('locking', () => {
  it('keeps locked devices in place during tidy and lays the others out around them', () => {
    const start = updateDevice(loadTemplate('water-treatment'), 'scada', { locked: true });
    const scada = start.devices.find((d) => d.id === 'scada')!;
    const after = tidyLayout(start, 'site-main');
    expect(after.devices.find((d) => d.id === 'scada')!.position).toEqual(scada.position);
    const lane = after.devices.filter((d) => d.purdueLevel === scada.purdueLevel);
    for (const d of lane) if (d.id !== 'scada') expect(overlapping(d.position, scada.position), d.label).toBe(false);
  });

  it('clears bend points on the tidied site', () => {
    const p = updateLink(loadTemplate('water-treatment'), 'link-ops-switch-scada', { waypoints: [{ x: 1, y: 2 }] });
    expect(tidyLayout(p, 'site-main').links.find((l) => l.id === 'link-ops-switch-scada')!.waypoints).toEqual([]);
  });

  it('leaves locked devices out of align', () => {
    let p = loadTemplate('water-treatment');
    p = updateDevice(p, 'hmi', { locked: true });
    const hmi = p.devices.find((d) => d.id === 'hmi')!.position;
    const after = alignDevices(p, ['hmi', 'plc-filter', 'plc-dosing'], 'left');
    expect(after.devices.find((d) => d.id === 'hmi')!.position).toEqual(hmi);
  });
});
