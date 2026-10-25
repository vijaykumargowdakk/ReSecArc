import { describe, expect, it } from 'vitest';
import { addressesToCsv, addressRows } from './csv';
import { projectToMarkdown } from './exportDoc';
import {
  addressReport,
  addressSortKey,
  cidrContains,
  createNetwork,
  formatIpv4,
  networkSummaries,
  parseCidr,
  parseIpv4,
  suggestCidr,
  usableHosts,
} from './ipam';
import { addDevice, addZone, createDevice, emptyProject, updateDevice } from './ops';
import { addSite } from './structure';
import type { Network, Project } from './schema';

describe('IPv4 parsing', () => {
  it('parses and formats addresses', () => {
    expect(parseIpv4('10.0.1.20')).toBe(10 * 2 ** 24 + 1 * 256 + 20);
    expect(formatIpv4(parseIpv4('192.168.255.1')!)).toBe('192.168.255.1');
    for (const bad of ['10.0.1', '10.0.1.256', '10.0.1.x', '', '1.2.3.4.5']) expect(parseIpv4(bad), bad).toBeNull();
  });

  it('parses CIDR blocks and rejects host bits', () => {
    const r = parseCidr('10.0.1.0/24');
    expect(r.ok && r.cidr.prefix).toBe(24);
    expect(parseCidr('10.0.1.5/24')).toEqual({ ok: false, error: 'host bits are set; did you mean 10.0.1.0/24?' });
    expect(parseCidr('10.0.1.0/33').ok).toBe(false);
    expect(parseCidr('10.0.1.0').ok).toBe(false);
  });

  it('checks containment and counts usable hosts', () => {
    const r = parseCidr('10.0.0.0/30');
    if (!r.ok) throw new Error();
    expect(cidrContains(r.cidr, parseIpv4('10.0.0.3')!)).toBe(true);
    expect(cidrContains(r.cidr, parseIpv4('10.0.0.4')!)).toBe(false);
    expect(usableHosts(r.cidr)).toBe(2);
    const p2p = parseCidr('10.0.0.0/31');
    expect(p2p.ok && usableHosts(p2p.cidr)).toBe(2);
  });

  it('sorts addresses numerically with invalid ones last', () => {
    const sorted = ['10.0.0.10', 'oops', '10.0.0.9', '9.255.255.255'].sort((a, b) => addressSortKey(a) - addressSortKey(b));
    expect(sorted).toEqual(['9.255.255.255', '10.0.0.9', '10.0.0.10', 'oops']);
  });
});

function plant(): Project {
  let p = emptyProject('Plant');
  p = addZone(p, { id: 'zc', name: 'Control', color: '#0ea5e9', trusted: true, targetSL: 2 });
  p = addZone(p, { id: 'zo', name: 'Operations', color: '#16a34a', trusted: true, targetSL: 2 });
  const net = (id: string, cidr: string, extra: Partial<Network> = {}): Network => ({ ...createNetwork(id, cidr, id), siteId: 'site-main', ...extra });
  p = { ...p, networks: [net('ctl', '10.50.2.0/24', { zoneId: 'zc', vlan: 50 }), net('ops', '10.40.1.0/24', { zoneId: 'zo', vlan: 40 })] };
  const add = (id: string, ip: string, zoneId: string | null) => {
    p = addDevice(p, { ...createDevice('plc', { x: 0, y: 700 }, { siteId: 'site-main', id }), label: id, zoneId });
    p = updateDevice(p, id, { asset: { ...p.devices.find((d) => d.id === id)!.asset, ip } });
  };
  add('plc1', '10.50.2.21', 'zc');
  add('plc2', '10.50.2.21', 'zc');
  add('plc3', '10.40.1.9', 'zc');
  add('plc4', '10.99.0.1', null);
  add('plc5', 'ten.dot', null);
  add('plc6', '10.50.2.255', 'zc');
  add('fw', '10.50.2.1, 10.40.1.1', null);
  return p;
}

describe('address report', () => {
  const report = addressReport(plant());
  const kinds = (id: string) => (report.issues.get(id) ?? []).map((i) => i.kind);

  it('finds the network for each address, including several addresses on one device', () => {
    expect(report.addresses.get('fw')!.map((a) => a.network?.id)).toEqual(['ctl', 'ops']);
    expect(kinds('fw')).toEqual([]);
  });

  it('reports duplicates, zone mismatches, unplanned, invalid and reserved addresses', () => {
    expect(kinds('plc1')).toEqual(['duplicate']);
    expect(report.issues.get('plc1')![0].message).toBe('10.50.2.21 is also used by plc2');
    expect(kinds('plc3')).toEqual(['zone']);
    expect(kinds('plc4')).toEqual(['unplanned']);
    expect(kinds('plc5')).toEqual(['invalid']);
    expect(kinds('plc6')).toEqual(['reserved']);
  });

  it('allows the same address on different sites unless the network spans every site', () => {
    let p = addSite(plant(), 'Remote', 'site-2');
    p = addDevice(p, { ...createDevice('plc', { x: 0, y: 700 }, { siteId: 'site-2', id: 'remote' }), label: 'remote' });
    p = updateDevice(p, 'remote', { asset: { ...p.devices.find((d) => d.id === 'remote')!.asset, ip: '10.40.1.9' } });
    expect(addressReport(p).issues.get('remote')).toBeUndefined();
    const wan = { ...p, networks: p.networks.map((n) => (n.id === 'ops' ? { ...n, siteId: null } : n)) };
    expect(addressReport(wan).issues.get('remote')?.map((i) => i.kind)).toEqual(['duplicate']);
  });

  it('stays quiet about unplanned addresses when no networks are defined', () => {
    expect(addressReport({ ...plant(), networks: [] }).issues.get('plc4')).toBeUndefined();
  });
});

describe('network summaries', () => {
  it('counts devices and flags bad CIDRs, overlaps and reused VLANs', () => {
    const p = plant();
    p.networks.push(
      { ...createNetwork('bad', '10.1.1.1/24', 'bad') },
      { ...createNetwork('wide', '10.50.0.0/16', 'wide'), vlan: 50 },
    );
    const byId = new Map(networkSummaries(p).map((s) => [s.network.id, s]));
    expect(byId.get('ctl')!.devices.map((d) => d.id).sort()).toEqual(['fw', 'plc1', 'plc2', 'plc6']);
    expect(byId.get('ctl')!.usable).toBe(254);
    expect(byId.get('bad')!.error).toMatch(/host bits/);
    expect(byId.get('ctl')!.overlaps.map((n) => n.id)).toEqual(['wide']);
    expect(byId.get('ctl')!.vlanClashes.map((n) => n.id)).toEqual(['wide']);
    expect(byId.get('ops')!.overlaps).toEqual([]);
  });

  it('suggests the next free /24', () => {
    expect(suggestCidr(plant())).toBe('10.50.3.0/24');
    expect(suggestCidr({ networks: [] })).toBe('10.0.1.0/24');
  });
});

describe('IP plan exports', () => {
  it('lists every address in numeric order with its network and warnings', () => {
    const rows = addressRows(plant());
    expect(rows.map((r) => r.address)).toEqual([
      '10.40.1.1',
      '10.40.1.9',
      '10.50.2.1',
      '10.50.2.21',
      '10.50.2.21',
      '10.50.2.255',
      '10.99.0.1',
      'ten.dot',
    ]);
    expect(rows[0]).toMatchObject({ device: 'fw', network: 'ops', subnet: '10.40.1.0/24', vlan: 40, warnings: [] });
    const csv = addressesToCsv(plant());
    expect(csv.split('\r\n')[0]).toBe('address,device,site,network,subnet,vlan,zone,warnings');
    expect(csv).toContain('10.99.0.1,plc4,Main site,,,,,10.99.0.1 is not in any network planned for this site');
  });

  it('adds a networks table to the Markdown record', () => {
    expect(projectToMarkdown(plant())).toContain('| ctl | 10.50.2.0/24 | 50 | Control | Main site |');
  });
});
