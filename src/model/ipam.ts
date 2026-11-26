// IPv4 and IPv6 address planning: parsing, subnet membership, and consistency warnings between device
// addresses, the project's networks and their zones. Warnings never block saving; they are hints.
import { newId } from './ops';
import type { Device, Network, Project } from './schema';

export type IpFamily = 4 | 6;

/** An IPv4 or IPv6 address as an unsigned integer (32 or 128 bits). */
export interface IpAddress {
  family: IpFamily;
  value: bigint;
}

export interface Cidr {
  family: IpFamily;
  /** Network address as an unsigned integer. */
  base: bigint;
  prefix: number;
}

const BITS: Record<IpFamily, number> = { 4: 32, 6: 128 };
const OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;

export function parseIpv4(text: string): number | null {
  const parts = text.trim().split('.');
  if (parts.length !== 4 || !parts.every((p) => OCTET.test(p))) return null;
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
}

export function formatIpv4(n: number): string {
  return [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join('.');
}

/** Parses an IPv6 address: `::` compression, any letter case, and an IPv4 tail (`::ffff:10.0.0.1`). */
export function parseIpv6(text: string): bigint | null {
  let t = text.trim();
  if (!t.includes(':') || /[^0-9a-f:.]/i.test(t)) return null;
  // An IPv4 tail stands for the last two groups.
  let tail: number[] = [];
  const lastColon = t.lastIndexOf(':');
  if (t.slice(lastColon + 1).includes('.')) {
    const v4 = parseIpv4(t.slice(lastColon + 1));
    if (v4 === null) return null;
    tail = [Math.floor(v4 / 65536), v4 % 65536];
    // Keep a `::` just before the tail; drop a single separating colon.
    t = t.slice(0, lastColon + 1);
    if (!t.endsWith('::')) t = t.slice(0, -1);
  }
  const halves = t.split('::');
  if (halves.length > 2) return null;
  const groups = (h: string) => (h === '' ? [] : h.split(':'));
  const head = groups(halves[0]);
  const rest = halves.length === 2 ? groups(halves[1]) : [];
  if (![...head, ...rest].every((g) => HEXTET.test(g))) return null;
  const given = head.length + rest.length + tail.length;
  if (halves.length === 1 ? given !== 8 : given > 7) return null;
  const words = [...head.map((g) => parseInt(g, 16)), ...Array(8 - given).fill(0), ...rest.map((g) => parseInt(g, 16)), ...tail];
  return words.reduce((n: bigint, w: number) => (n << 16n) | BigInt(w), 0n);
}

/** Formats an IPv6 address in the canonical form of RFC 5952: lower case, longest zero run as `::`. */
export function formatIpv6(value: bigint): string {
  const words = Array.from({ length: 8 }, (_, i) => Number((value >> BigInt(112 - 16 * i)) & 0xffffn));
  let best = { at: -1, len: 1 };
  for (let i = 0; i < 8; ) {
    if (words[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && words[j] === 0) j++;
    if (j - i > best.len) best = { at: i, len: j - i };
    i = j;
  }
  const hex = (ws: number[]) => ws.map((w) => w.toString(16)).join(':');
  return best.at < 0 ? hex(words) : `${hex(words.slice(0, best.at))}::${hex(words.slice(best.at + best.len))}`;
}

/** Parses an IPv4 or IPv6 address; null when it is neither. */
export function parseIp(text: string): IpAddress | null {
  const v4 = parseIpv4(text);
  if (v4 !== null) return { family: 4, value: BigInt(v4) };
  const v6 = parseIpv6(text);
  return v6 === null ? null : { family: 6, value: v6 };
}

export function formatIp(ip: IpAddress): string {
  return ip.family === 4 ? formatIpv4(Number(ip.value)) : formatIpv6(ip.value);
}

const sizeOf = (family: IpFamily, prefix: number) => 1n << BigInt(BITS[family] - prefix);

export type CidrResult = { ok: true; cidr: Cidr } | { ok: false; error: string };

/** Parses `a.b.c.d/n` or `2001:db8::/n`. Host bits must be zero, so typos such as 10.0.0.5/24 are caught. */
export function parseCidr(text: string): CidrResult {
  const match = /^\s*([0-9a-f.:]+)\s*\/\s*(\d{1,3})\s*$/i.exec(text);
  if (!match) return { ok: false, error: 'use the form 10.0.1.0/24 or 2001:db8:1::/64' };
  const ip = parseIp(match[1]);
  const prefix = Number(match[2]);
  if (ip === null) return { ok: false, error: `"${match[1]}" is not an IPv4 or IPv6 address` };
  const bits = BITS[ip.family];
  if (prefix > bits) return { ok: false, error: `the prefix length must be 0 to ${bits}` };
  const base = ip.value - (ip.value % sizeOf(ip.family, prefix));
  if (base !== ip.value) return { ok: false, error: `host bits are set; did you mean ${formatIp({ family: ip.family, value: base })}/${prefix}?` };
  return { ok: true, cidr: { family: ip.family, base, prefix } };
}

export function cidrContains(cidr: Cidr, ip: IpAddress): boolean {
  return ip.family === cidr.family && ip.value >= cidr.base && ip.value < cidr.base + sizeOf(cidr.family, cidr.prefix);
}

/** The prefix length from which a subnet has no reserved address: /31 for IPv4 (RFC 3021), /127 for IPv6 (RFC 6164). */
const noReserved = (c: Cidr) => c.prefix >= BITS[c.family] - 1;

/**
 * Addresses usable by hosts. IPv4 leaves out the network and broadcast address, IPv6 the
 * subnet-router anycast address (all host bits zero), except in the smallest subnets.
 */
export function usableHosts(cidr: Cidr): bigint {
  const size = sizeOf(cidr.family, cidr.prefix);
  if (noReserved(cidr)) return size;
  return cidr.family === 4 ? size - 2n : size - 1n;
}

/** A device may list several addresses (one per interface), separated by commas, semicolons or spaces. */
export function deviceAddresses(device: Device): string[] {
  return device.asset.ip.split(/[\s,;]+/).filter(Boolean);
}

/** Whether a network applies on a site: its own site, or every site when it has none. */
const onSite = (n: Network, siteId: string) => n.siteId === null || n.siteId === siteId;

interface ParsedNetwork {
  network: Network;
  cidr: Cidr;
}

function parsedNetworks(project: Pick<Project, 'networks'>): ParsedNetwork[] {
  return project.networks.flatMap((network) => {
    const r = parseCidr(network.cidr);
    return r.ok ? [{ network, cidr: r.cidr }] : [];
  });
}

/** The most specific network on the device's site that contains `ip`. */
function networkFor(networks: ParsedNetwork[], siteId: string, ip: IpAddress): ParsedNetwork | null {
  let best: ParsedNetwork | null = null;
  for (const n of networks) {
    if (onSite(n.network, siteId) && cidrContains(n.cidr, ip) && (!best || n.cidr.prefix > best.cidr.prefix)) best = n;
  }
  return best;
}

export interface AddressInfo {
  address: string;
  /** null when the text is not a valid IPv4 or IPv6 address. */
  ip: IpAddress | null;
  network: Network | null;
}

export type IssueKind = 'invalid' | 'duplicate' | 'reserved' | 'unplanned' | 'zone';

export interface AddressIssue {
  kind: IssueKind;
  address: string;
  message: string;
}

export interface AddressReport {
  /** Every address of every device, with the network it falls in. */
  addresses: Map<string, AddressInfo[]>;
  /** Warnings per device id; devices without warnings are absent. */
  issues: Map<string, AddressIssue[]>;
}

/**
 * Checks every device address. Two devices clash when they share an address on the same site, or
 * inside a network that spans every site. "Not in any network" is only reported once the project
 * defines networks for that site, so projects that do not plan addresses see no warnings for it.
 */
export function addressReport(project: Project): AddressReport {
  const networks = parsedNetworks(project);
  const zoneName = new Map(project.zones.map((z) => [z.id, z.name]));
  const addresses = new Map<string, AddressInfo[]>();
  const issues = new Map<string, AddressIssue[]>();
  const warn = (deviceId: string, issue: AddressIssue) => issues.set(deviceId, [...(issues.get(deviceId) ?? []), issue]);
  const owners = new Map<string, Device[]>();

  for (const d of project.devices) {
    const infos: AddressInfo[] = [];
    for (const address of deviceAddresses(d)) {
      const ip = parseIp(address);
      if (ip === null) {
        infos.push({ address, ip, network: null });
        warn(d.id, { kind: 'invalid', address, message: `"${address}" is not a valid IPv4 or IPv6 address` });
        continue;
      }
      const match = networkFor(networks, d.siteId, ip);
      infos.push({ address, ip, network: match?.network ?? null });
      if (match) {
        const { network, cidr } = match;
        const broadcast = cidr.family === 4 ? cidr.base + sizeOf(4, cidr.prefix) - 1n : null;
        if (!noReserved(cidr) && (ip.value === cidr.base || ip.value === broadcast)) {
          const what = ip.value !== cidr.base ? 'broadcast' : cidr.family === 4 ? 'network' : 'subnet-router anycast';
          warn(d.id, { kind: 'reserved', address, message: `${address} is the ${what} address of ${network.name || network.cidr}` });
        }
        if (network.zoneId && d.zoneId && network.zoneId !== d.zoneId) {
          warn(d.id, {
            kind: 'zone',
            address,
            message: `${address} is in ${network.name || network.cidr}, which belongs to zone ${zoneName.get(network.zoneId)}, but the device is in zone ${zoneName.get(d.zoneId)}`,
          });
        }
      } else if (networks.some((n) => onSite(n.network, d.siteId))) {
        warn(d.id, { kind: 'unplanned', address, message: `${address} is not in any network planned for this site` });
      }
      const scope = match && match.network.siteId === null ? `net:${match.network.id}` : `site:${d.siteId}`;
      const key = `${scope}|${formatIp(ip)}`;
      owners.set(key, [...(owners.get(key) ?? []), d]);
    }
    addresses.set(d.id, infos);
  }

  for (const [key, devices] of owners) {
    const unique = [...new Set(devices)];
    if (unique.length < 2) continue;
    const address = key.slice(key.indexOf('|') + 1);
    for (const d of unique) {
      const others = unique.filter((o) => o !== d).map((o) => o.label);
      warn(d.id, { kind: 'duplicate', address, message: `${address} is also used by ${others.join(', ')}` });
    }
  }
  return { addresses, issues };
}

export interface NetworkSummary {
  network: Network;
  cidr: Cidr | null;
  error: string | null;
  /** Devices with at least one address in this network. */
  devices: Device[];
  usable: bigint;
  /** Other networks on an overlapping site whose ranges overlap this one. */
  overlaps: Network[];
  /** Other networks on an overlapping site with the same VLAN id but a different subnet. */
  vlanClashes: Network[];
}

const sitesOverlap = (a: Network, b: Network) => a.siteId === null || b.siteId === null || a.siteId === b.siteId;

export function networkSummaries(project: Project, report: AddressReport = addressReport(project)): NetworkSummary[] {
  const parsed = new Map(project.networks.map((n) => [n.id, parseCidr(n.cidr)]));
  const range = (id: string) => {
    const r = parsed.get(id);
    return r?.ok ? r.cidr : null;
  };
  return project.networks.map((network) => {
    const result = parsed.get(network.id)!;
    const cidr = result.ok ? result.cidr : null;
    const devices = project.devices.filter((d) => report.addresses.get(d.id)?.some((a) => a.network?.id === network.id));
    const others = project.networks.filter((o) => o.id !== network.id && sitesOverlap(network, o));
    const overlaps = cidr
      ? others.filter((o) => {
          const c = range(o.id);
          return c !== null && (cidrContains(cidr, { family: c.family, value: c.base }) || cidrContains(c, { family: cidr.family, value: cidr.base }));
        })
      : [];
    const vlanClashes = network.vlan === null ? [] : others.filter((o) => o.vlan === network.vlan && o.cidr.trim() !== network.cidr.trim());
    return {
      network,
      cidr,
      error: result.ok ? null : result.error,
      devices,
      usable: cidr ? usableHosts(cidr) : 0n,
      overlaps,
      vlanClashes,
    };
  });
}

/**
 * Warnings for links tied to a planned network: an end device that has addresses but none in that
 * network, or VLANs on the link that do not include the network's VLAN. Devices without any address
 * (unmanaged switches, field devices) are not flagged.
 */
export function linkIssues(project: Project, report: AddressReport = addressReport(project)): Map<string, string[]> {
  const issues = new Map<string, string[]>();
  const network = new Map(project.networks.map((n) => [n.id, n]));
  const device = new Map(project.devices.map((d) => [d.id, d]));
  for (const link of project.links) {
    const net = link.networkId ? network.get(link.networkId) : undefined;
    if (!net) continue;
    const name = net.name || net.cidr;
    const found: string[] = [];
    for (const end of [link.source, link.target]) {
      const addresses = report.addresses.get(end) ?? [];
      if (addresses.length > 0 && !addresses.some((a) => a.network?.id === net.id)) {
        found.push(`${device.get(end)?.label ?? end} has no address in ${name} (${net.cidr})`);
      }
    }
    if (net.vlan !== null && link.vlans.length > 0 && !link.vlans.includes(net.vlan)) {
      found.push(`${name} is on VLAN ${net.vlan}, which this link does not carry (${link.vlans.join(', ')})`);
    }
    if (found.length) issues.set(link.id, found);
  }
  return issues;
}

/** Parses "10, 20 30-32" into sorted, distinct VLAN ids; returns null if any part is invalid. */
export function parseVlans(text: string): number[] | null {
  const out = new Set<number>();
  for (const part of text.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    const [lo, hi] = range ? [Number(range[1]), Number(range[2])] : [Number(part), Number(part)];
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi > 4094 || lo > hi || hi - lo > 4093) return null;
    for (let v = lo; v <= hi; v++) out.add(v);
  }
  return out.size > 200 ? null : [...out].sort((a, b) => a - b);
}

/** Sort key for addresses: IPv4 in numeric order, then IPv6, then anything that is not an address. */
export function addressSortKey(address: string): bigint {
  const ip = parseIp(address);
  if (!ip) return 1n << 129n;
  return ip.family === 4 ? ip.value : (1n << 32n) + ip.value;
}

/** Compares two addresses in the order of addressSortKey. */
export function compareAddresses(a: string, b: string): number {
  const x = addressSortKey(a);
  const y = addressSortKey(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function createNetwork(name: string, cidr: string, id = newId('net')): Network {
  return { id, name, cidr, vlan: null, zoneId: null, siteId: null };
}

export function addNetwork(project: Project, network: Network): Project {
  return { ...project, networks: [...project.networks, network] };
}

export function updateNetwork(project: Project, id: string, patch: Partial<Omit<Network, 'id'>>): Project {
  return { ...project, networks: project.networks.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function removeNetwork(project: Project, id: string): Project {
  return { ...project, networks: project.networks.filter((n) => n.id !== id) };
}

/** Suggests the next free IPv4 /24 after the highest planned IPv4 network, for the "add network" button. */
export function suggestCidr(project: Pick<Project, 'networks'>): string {
  const ends = parsedNetworks(project)
    .filter((n) => n.cidr.family === 4)
    .map((n) => Number(n.cidr.base + sizeOf(4, n.cidr.prefix)));
  if (ends.length === 0) return '10.0.1.0/24';
  const aligned = Math.ceil(Math.max(...ends) / 256) * 256;
  return aligned < 2 ** 32 ? `${formatIpv4(aligned)}/24` : '10.0.1.0/24';
}
