// IPv4 address planning: parsing, subnet membership, and consistency warnings between device
// addresses, the project's networks and their zones. Warnings never block saving; they are hints.
import { newId } from './ops';
import type { Device, Network, Project } from './schema';

export interface Cidr {
  /** Network address as an unsigned 32-bit integer. */
  base: number;
  prefix: number;
}

const OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function parseIpv4(text: string): number | null {
  const parts = text.trim().split('.');
  if (parts.length !== 4 || !parts.every((p) => OCTET.test(p))) return null;
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
}

export function formatIpv4(n: number): string {
  return [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join('.');
}

const sizeOf = (prefix: number) => 2 ** (32 - prefix);

export type CidrResult = { ok: true; cidr: Cidr } | { ok: false; error: string };

/** Parses `a.b.c.d/n`. Host bits must be zero, so typos such as 10.0.0.5/24 are caught. */
export function parseCidr(text: string): CidrResult {
  const match = /^\s*([\d.]+)\s*\/\s*(\d{1,2})\s*$/.exec(text);
  if (!match) return { ok: false, error: 'use the form 10.0.1.0/24' };
  const ip = parseIpv4(match[1]);
  const prefix = Number(match[2]);
  if (ip === null) return { ok: false, error: `"${match[1]}" is not an IPv4 address` };
  if (prefix > 32) return { ok: false, error: 'the prefix length must be 0 to 32' };
  const base = ip - (ip % sizeOf(prefix));
  if (base !== ip) return { ok: false, error: `host bits are set; did you mean ${formatIpv4(base)}/${prefix}?` };
  return { ok: true, cidr: { base, prefix } };
}

export function cidrContains(cidr: Cidr, ip: number): boolean {
  return ip >= cidr.base && ip < cidr.base + sizeOf(cidr.prefix);
}

/** Addresses usable by hosts: everything but the network and broadcast address, except in /31 and /32. */
export function usableHosts(cidr: Cidr): number {
  return cidr.prefix >= 31 ? sizeOf(cidr.prefix) : sizeOf(cidr.prefix) - 2;
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
function networkFor(networks: ParsedNetwork[], siteId: string, ip: number): ParsedNetwork | null {
  let best: ParsedNetwork | null = null;
  for (const n of networks) {
    if (onSite(n.network, siteId) && cidrContains(n.cidr, ip) && (!best || n.cidr.prefix > best.cidr.prefix)) best = n;
  }
  return best;
}

export interface AddressInfo {
  address: string;
  /** null when the text is not a valid IPv4 address. */
  ip: number | null;
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
      const ip = parseIpv4(address);
      if (ip === null) {
        infos.push({ address, ip, network: null });
        warn(d.id, { kind: 'invalid', address, message: `"${address}" is not a valid IPv4 address` });
        continue;
      }
      const match = networkFor(networks, d.siteId, ip);
      infos.push({ address, ip, network: match?.network ?? null });
      if (match) {
        const { network, cidr } = match;
        const broadcast = cidr.base + sizeOf(cidr.prefix) - 1;
        if (cidr.prefix < 31 && (ip === cidr.base || ip === broadcast)) {
          warn(d.id, {
            kind: 'reserved',
            address,
            message: `${address} is the ${ip === cidr.base ? 'network' : 'broadcast'} address of ${network.name || network.cidr}`,
          });
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
      const key = `${scope}|${ip}`;
      owners.set(key, [...(owners.get(key) ?? []), d]);
    }
    addresses.set(d.id, infos);
  }

  for (const [key, devices] of owners) {
    const unique = [...new Set(devices)];
    if (unique.length < 2) continue;
    const address = formatIpv4(Number(key.split('|')[1]));
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
  usable: number;
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
          return c !== null && (cidrContains(cidr, c.base) || cidrContains(c, cidr.base));
        })
      : [];
    const vlanClashes = network.vlan === null ? [] : others.filter((o) => o.vlan === network.vlan && o.cidr.trim() !== network.cidr.trim());
    return {
      network,
      cidr,
      error: result.ok ? null : result.error,
      devices,
      usable: cidr ? usableHosts(cidr) : 0,
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

/** Sort key for addresses: numeric for valid IPv4, after all valid ones otherwise. */
export function addressSortKey(address: string): number {
  return parseIpv4(address) ?? Number.MAX_SAFE_INTEGER;
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

/** Suggests the next free /24 after the highest planned network, for the "add network" button. */
export function suggestCidr(project: Pick<Project, 'networks'>): string {
  const bases = parsedNetworks(project).map((n) => n.cidr.base + sizeOf(n.cidr.prefix));
  if (bases.length === 0) return '10.0.1.0/24';
  const next = Math.max(...bases);
  const aligned = Math.ceil(next / 256) * 256;
  return aligned < 2 ** 32 ? `${formatIpv4(aligned)}/24` : '10.0.1.0/24';
}
