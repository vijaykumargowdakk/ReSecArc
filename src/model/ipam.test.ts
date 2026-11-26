import { describe, expect, it } from 'vitest';
import { addressesToCsv, addressRows } from './csv';
import { projectToMarkdown } from './exportDoc';
import {
  addressReport,
  cidrContains,
  compareAddresses,
  createNetwork,
  formatIpv4,
  formatIpv6,
  networkSummaries,
  parseCidr,
  parseIp,
  parseIpv4,
  parseIpv6,
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
    expect(cidrContains(r.cidr, parseIp('10.0.0.3')!)).toBe(true);
    expect(cidrContains(r.cidr, parseIp('10.0.0.4')!)).toBe(false);
    expect(usableHosts(r.cidr)).toBe(2n);
    const p2p = parseCidr('10.0.0.0/31');
    expect(p2p.ok && usableHosts(p2p.cidr)).toBe(2n);
  });

  it('sorts addresses numerically, IPv4 before IPv6, with invalid ones last', () => {
    const sorted = ['10.0.0.10', 'oops', '2001:db8::1', '10.0.0.9', '::1', '9.255.255.255'].sort(compareAddresses);
    expect(sorted).toEqual(['9.255.255.255', '10.0.0.9', '10.0.0.10', '::1', '2001:db8::1', 'oops']);
  });
});

describe('IPv6 parsing (issue #20)', () => {
  it('reads full, compressed, mixed-case and IPv4-tailed forms', () => {
    expect(parseIpv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIpv6('2001:DB8::1')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIpv6('::')).toBe(0n);
    expect(parseIpv6('::1')).toBe(1n);
    expect(parseIpv6('fe80::')).toBe(0xfe80n << 112n);
    expect(parseIpv6('::ffff:10.0.0.1')).toBe(0xffff0a000001n);
    expect(parseIpv6('64:ff9b::192.0.2.33')).toBe((0x64ff9bn << 96n) + 0xc0000221n);
    expect(parseIpv6('1:2:3:4:5:6:10.0.0.1')).toBe(0x0001000200030004000500060a000001n);
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', '1:2:3', '1::2::3', '12345::', ':1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7::8', 'g::1', '::ffff:10.0.0.256', '2001:db8::1%eth0', '10.0.0.1'])
      expect(parseIpv6(bad), bad).toBeNull();
  });

  it('writes the canonical form of RFC 5952', () => {
    const canon = (t: string) => formatIpv6(parseIpv6(t)!);
    expect(canon('2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(canon('2001:db8:0:1:0:0:0:1')).toBe('2001:db8:0:1::1');
    expect(canon('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1');
    expect(canon('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2:3:4:5:6');
    expect(canon('2001:db8:0:1:2:3:4:5')).toBe('2001:db8:0:1:2:3:4:5');
    expect(canon('::')).toBe('::');
    expect(canon('0:0:0:0:0:0:0:1')).toBe('::1');
  });

  it('parses IPv6 subnets and counts their addresses exactly', () => {
    const r = parseCidr('2001:db8:1::/64');
    if (!r.ok) throw new Error();
    expect(r.cidr).toEqual({ family: 6, base: 0x20010db8000100000000000000000000n, prefix: 64 });
    expect(usableHosts(r.cidr)).toBe(2n ** 64n - 1n);
    expect(cidrContains(r.cidr, parseIp('2001:db8:1::ff')!)).toBe(true);
    expect(cidrContains(r.cidr, parseIp('2001:db8:2::1')!)).toBe(false);
    expect(cidrContains(r.cidr, parseIp('10.0.0.1')!)).toBe(false);
    expect(parseCidr('2001:db8:1::1/64')).toEqual({ ok: false, error: 'host bits are set; did you mean 2001:db8:1::/64?' });
    expect(parseCidr('2001:db8::/129')).toEqual({ ok: false, error: 'the prefix length must be 0 to 128' });
    expect(parseCidr('10.0.0.0/64')).toEqual({ ok: false, error: 'the prefix length must be 0 to 32' });
    const p2p = parseCidr('2001:db8::/127');
    expect(p2p.ok && usableHosts(p2p.cidr)).toBe(2n);
  });

  it('applies the IPv4 checks to IPv6 addresses', () => {
    let p = plant();
    p = { ...p, networks: [...p.networks, { ...createNetwork('v6', '2001:db8:50::/64', 'v6'), siteId: 'site-main', zoneId: 'zc' }] };
    const add = (id: string, ip: string, zoneId: string | null) => {
      p = addDevice(p, { ...createDevice('plc', { x: 0, y: 700 }, { siteId: 'site-main', id }), label: id, zoneId });
      p = updateDevice(p, id, { asset: { ...p.devices.find((d) => d.id === id)!.asset, ip } });
    };
    add('a', '2001:db8:50::10', 'zc');
    add('b', '2001:DB8:50:0::10', 'zc');
    add('c', '2001:db8:50::', 'zc');
    add('d', '2001:db8:99::1', 'zc');
    add('e', '2001:db8:50::20', 'zo');
    add('f', '2001:db8:::1', null);
    add('dual', '10.50.2.30, 2001:db8:50::30', 'zc');
    const report = addressReport(p);
    const kinds = (id: string) => (report.issues.get(id) ?? []).map((i) => i.kind);
    expect(kinds('a')).toEqual(['duplicate']);
    expect(report.issues.get('a')![0].message).toBe('2001:db8:50::10 is also used by b');
    expect(kinds('c')).toEqual(['reserved']);
    expect(report.issues.get('c')![0].message).toBe('2001:db8:50:: is the subnet-router anycast address of v6');
    expect(kinds('d')).toEqual(['unplanned']);
    expect(kinds('e')).toEqual(['zone']);
    expect(kinds('f')).toEqual(['invalid']);
    expect(report.issues.get('f')![0].message).toBe('"2001:db8:::1" is not a valid IPv4 or IPv6 address');
    expect(kinds('dual')).toEqual([]);
    expect(report.addresses.get('dual')!.map((a) => a.network?.id)).toEqual(['ctl', 'v6']);
    const v6 = networkSummaries(p).find((s) => s.network.id === 'v6')!;
    expect(v6.devices.map((d) => d.id)).toEqual(['a', 'b', 'c', 'e', 'dual']);
    expect(v6.overlaps).toEqual([]);
    expect(addressesToCsv(p)).toContain('2001:db8:50::30,dual,Main site,v6,2001:db8:50::/64,,Control,');
  });

  it('finds overlapping IPv6 subnets and still suggests an IPv4 /24', () => {
    const p = { ...plant(), networks: [...plant().networks, createNetwork('wide6', '2001:db8::/32', 'wide6'), createNetwork('narrow6', '2001:db8:7::/48', 'narrow6')] };
    const byId = new Map(networkSummaries(p).map((s) => [s.network.id, s]));
    expect(byId.get('wide6')!.overlaps.map((n) => n.id)).toEqual(['narrow6']);
    expect(byId.get('ctl')!.overlaps).toEqual([]);
    expect(suggestCidr(p)).toBe('10.50.3.0/24');
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
    expect(byId.get('ctl')!.usable).toBe(254n);
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
