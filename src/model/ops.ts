// Pure, immutable operations on a Project. The store wraps these; tests call them directly.
import { areaAt } from './areas';
import { DEVICE_CATALOG } from './catalog';
import { DEFAULT_SITE } from './migrate';
import { defaultPortFor, defaultSettings, getProtocol } from './protocols';
import { levelAtY } from './purdue';
import {
  SCHEMA_VERSION,
  type Asset,
  type Device,
  type DeviceType,
  type FirewallRule,
  type Flow,
  type Link,
  type Project,
  type RuleEndpoint,
  type Zone,
} from './schema';

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyProject(name = 'Untitled architecture'): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    sites: [{ ...DEFAULT_SITE }],
    devices: [],
    links: [],
    flows: [],
    zones: [],
    areas: [],
    notes: [],
    networks: [],
    fieldDefs: [],
    revisions: [],
  };
}

export function emptyAsset(): Asset {
  return { vendor: '', model: '', firmware: '', serial: '', ip: '', notes: '' };
}

export interface NewDeviceOptions {
  siteId: string;
  variant?: string;
  id?: string;
}

export function createDevice(type: DeviceType, position: { x: number; y: number }, opts: NewDeviceOptions): Device {
  const info = DEVICE_CATALOG[type];
  const variant = opts.variant ?? 'generic';
  const variantLabel = info.variants.find((v) => v.id === variant && v.id !== 'generic')?.label;
  const device: Device = {
    id: opts.id ?? newId(type),
    type,
    variant,
    label: variantLabel ?? info.label,
    purdueLevel: levelAtY(position.y),
    siteId: opts.siteId,
    zoneId: null,
    areaId: null,
    criticality: info.defaultCriticality,
    position,
    services: [],
    asset: emptyAsset(),
    tags: [],
    fields: {},
    locked: false,
  };
  if (type === 'firewall') device.firewall = { defaultAction: 'deny', rules: [] };
  return device;
}

/** A new flow with the protocol's default settings and port. Throws for an unknown protocol id. */
export function defaultFlow(protocol: string, source: string, target: string, id = newId('flow')): Flow {
  const def = getProtocol(protocol);
  if (!def) throw new Error(`Unknown protocol "${protocol}"`);
  const settings = defaultSettings(def);
  return { id, source, target, protocol, port: defaultPortFor(def, settings), settings, waypoints: [] };
}

/** Adds a device; it joins whichever area on its site it was placed in. */
export function addDevice(project: Project, device: Device): Project {
  const placed = { ...device, areaId: areaAt(project, device.siteId, device.position) };
  return { ...project, devices: [...project.devices, placed] };
}

export function updateDevice(project: Project, id: string, patch: Partial<Omit<Device, 'id' | 'type'>>): Project {
  return { ...project, devices: project.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) };
}

/** Moves a device and re-derives its Purdue level and area from where it was dropped. */
export function moveDevice(project: Project, id: string, position: { x: number; y: number }): Project {
  const device = project.devices.find((d) => d.id === id);
  if (!device || (device.position.x === position.x && device.position.y === position.y)) return project;
  return updateDevice(project, id, {
    position,
    purdueLevel: levelAtY(position.y),
    areaId: areaAt(project, device.siteId, position),
  });
}

function endpointRefersTo(endpoint: RuleEndpoint, kind: 'zone' | 'device', id: string): boolean {
  return endpoint.kind === kind && endpoint.id === id;
}

/** Drops firewall rules that reference a removed zone or device, so no rule silently changes meaning. */
function pruneRules(devices: Device[], kind: 'zone' | 'device', id: string): Device[] {
  return devices.map((d) =>
    d.firewall
      ? {
          ...d,
          firewall: {
            ...d.firewall,
            rules: d.firewall.rules.filter((r) => !endpointRefersTo(r.src, kind, id) && !endpointRefersTo(r.dst, kind, id)),
          },
        }
      : d,
  );
}

export function removeDevice(project: Project, id: string): Project {
  return {
    ...project,
    devices: pruneRules(
      project.devices.filter((d) => d.id !== id),
      'device',
      id,
    ),
    links: project.links.filter((l) => l.source !== id && l.target !== id),
    flows: project.flows.filter((f) => f.source !== id && f.target !== id),
  };
}

/** Counts firewall rules that reference a zone or device; shown before removal. */
export function countRuleReferences(project: Project, kind: 'zone' | 'device', id: string): number {
  return project.devices.reduce(
    (n, d) =>
      n + (d.firewall?.rules.filter((r) => endpointRefersTo(r.src, kind, id) || endpointRefersTo(r.dst, kind, id)).length ?? 0),
    0,
  );
}

function deviceExists(project: Project, id: string): boolean {
  return project.devices.some((d) => d.id === id);
}

/** Adds an undirected network link. Returns the project unchanged for self-links, unknown devices or duplicates. */
export function addLink(project: Project, source: string, target: string, id = newId('link')): Project {
  if (source === target || !deviceExists(project, source) || !deviceExists(project, target)) return project;
  const duplicate = project.links.some(
    (l) => (l.source === source && l.target === target) || (l.source === target && l.target === source),
  );
  if (duplicate) return project;
  const link: Link = { id, source, target, medium: 'ethernet', sourcePort: '', targetPort: '', vlans: [], networkId: null, waypoints: [] };
  return { ...project, links: [...project.links, link] };
}

export function updateLink(project: Project, id: string, patch: Partial<Omit<Link, 'id' | 'source' | 'target'>>): Project {
  return { ...project, links: project.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

export function removeLink(project: Project, id: string): Project {
  return { ...project, links: project.links.filter((l) => l.id !== id) };
}

/** Adds a directed protocol flow (client/master → server/outstation). Same guards as addLink, per protocol. */
export function addFlow(project: Project, flow: Flow): Project {
  if (flow.source === flow.target || !deviceExists(project, flow.source) || !deviceExists(project, flow.target)) {
    return project;
  }
  const duplicate = project.flows.some(
    (f) => f.source === flow.source && f.target === flow.target && f.protocol === flow.protocol,
  );
  if (duplicate) return project;
  return { ...project, flows: [...project.flows, flow] };
}

export function replaceFlow(project: Project, flow: Flow): Project {
  return { ...project, flows: project.flows.map((f) => (f.id === flow.id ? flow : f)) };
}

export function removeFlow(project: Project, id: string): Project {
  return { ...project, flows: project.flows.filter((f) => f.id !== id) };
}

export function addZone(project: Project, zone: Zone): Project {
  return { ...project, zones: [...project.zones, zone] };
}

export function updateZone(project: Project, id: string, patch: Partial<Omit<Zone, 'id'>>): Project {
  return { ...project, zones: project.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) };
}

/** Removes a zone, unassigns its devices and networks, and drops firewall rules that referenced it. */
export function removeZone(project: Project, id: string): Project {
  const devices = project.devices.map((d) => (d.zoneId === id ? { ...d, zoneId: null } : d));
  return {
    ...project,
    zones: project.zones.filter((z) => z.id !== id),
    devices: pruneRules(devices, 'zone', id),
    networks: project.networks.map((n) => (n.zoneId === id ? { ...n, zoneId: null } : n)),
  };
}

function updateFirewall(project: Project, firewallId: string, update: (rules: FirewallRule[]) => FirewallRule[]): Project {
  return {
    ...project,
    devices: project.devices.map((d) =>
      d.id === firewallId && d.firewall ? { ...d, firewall: { ...d.firewall, rules: update(d.firewall.rules) } } : d,
    ),
  };
}

export function newRule(id = newId('rule')): FirewallRule {
  return { id, src: { kind: 'any' }, dst: { kind: 'any' }, protocol: 'any', port: null, action: 'deny', note: '' };
}

export function addRule(project: Project, firewallId: string, rule: FirewallRule = newRule()): Project {
  return updateFirewall(project, firewallId, (rules) => [...rules, rule]);
}

export function updateRule(project: Project, firewallId: string, rule: FirewallRule): Project {
  return updateFirewall(project, firewallId, (rules) => rules.map((r) => (r.id === rule.id ? rule : r)));
}

export function removeRule(project: Project, firewallId: string, ruleId: string): Project {
  return updateFirewall(project, firewallId, (rules) => rules.filter((r) => r.id !== ruleId));
}

/** Moves a rule up (-1) or down (+1) in the evaluation order. */
export function moveRule(project: Project, firewallId: string, ruleId: string, delta: -1 | 1): Project {
  return updateFirewall(project, firewallId, (rules) => {
    const from = rules.findIndex((r) => r.id === ruleId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= rules.length) return rules;
    const next = [...rules];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
}

export function setDefaultAction(project: Project, firewallId: string, defaultAction: 'allow' | 'deny'): Project {
  return {
    ...project,
    devices: project.devices.map((d) =>
      d.id === firewallId && d.firewall ? { ...d, firewall: { ...d.firewall, defaultAction } } : d,
    ),
  };
}

/** Devices plus the links, flows and rules among them, detached from a project for copy/paste. */
export interface Fragment {
  devices: Device[];
  links: Link[];
  flows: Flow[];
}

export function extractFragment(project: Project, deviceIds: readonly string[]): Fragment {
  const ids = new Set(deviceIds);
  return {
    devices: project.devices.filter((d) => ids.has(d.id)),
    links: project.links.filter((l) => ids.has(l.source) && ids.has(l.target)),
    flows: project.flows.filter((f) => ids.has(f.source) && ids.has(f.target)),
  };
}

/**
 * Inserts a copy of `fragment` with fresh ids, shifted by `offset`, onto `siteId`.
 * Zone assignments and firewall rules are kept; rule endpoints that point at copied devices follow the copies.
 * Returns the new project and the ids of the inserted devices.
 */
export function pasteFragment(
  project: Project,
  fragment: Fragment,
  offset: { x: number; y: number },
  siteId: string,
): { project: Project; deviceIds: string[] } {
  const idMap = new Map(fragment.devices.map((d) => [d.id, newId(d.type)]));
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const deviceIds = new Set(project.devices.map((d) => d.id));
  const remap = (ep: RuleEndpoint): RuleEndpoint | null => {
    if (ep.kind === 'device') {
      const id = idMap.get(ep.id) ?? (deviceIds.has(ep.id) ? ep.id : null);
      return id ? { kind: 'device', id } : null;
    }
    if (ep.kind === 'zone') return zoneIds.has(ep.id) ? ep : null;
    return ep;
  };

  const devices = fragment.devices.map((d): Device => {
    const position = { x: d.position.x + offset.x, y: d.position.y + offset.y };
    const copy: Device = {
      ...d,
      id: idMap.get(d.id)!,
      siteId,
      zoneId: d.zoneId && zoneIds.has(d.zoneId) ? d.zoneId : null,
      areaId: areaAt(project, siteId, position),
      position,
      purdueLevel: levelAtY(position.y),
      services: d.services.map((s) => ({ ...s })),
      asset: { ...d.asset },
      tags: [...d.tags],
      fields: { ...d.fields },
    };
    if (d.firewall) {
      copy.firewall = {
        defaultAction: d.firewall.defaultAction,
        // A rule whose endpoint no longer exists is dropped rather than silently widened.
        rules: d.firewall.rules.flatMap((r) => {
          const src = remap(r.src);
          const dst = remap(r.dst);
          return src && dst ? [{ ...r, id: newId('rule'), src, dst }] : [];
        }),
      };
    }
    return copy;
  });
  const shift = (p: { x: number; y: number }) => ({ x: p.x + offset.x, y: p.y + offset.y });
  const links = fragment.links.map((l) => ({
    ...l,
    id: newId('link'),
    source: idMap.get(l.source)!,
    target: idMap.get(l.target)!,
    vlans: [...l.vlans],
    waypoints: l.waypoints.map(shift),
  }));
  const flows = fragment.flows.map((f) => ({
    ...f,
    id: newId('flow'),
    source: idMap.get(f.source)!,
    target: idMap.get(f.target)!,
    settings: { ...f.settings },
    waypoints: f.waypoints.map(shift),
  }));
  return {
    project: {
      ...project,
      devices: [...project.devices, ...devices],
      links: [...project.links, ...links],
      flows: [...project.flows, ...flows],
    },
    deviceIds: devices.map((d) => d.id),
  };
}

export function bulkUpdateDevices(
  project: Project,
  ids: readonly string[],
  patch: Partial<Pick<Device, 'zoneId' | 'criticality' | 'siteId' | 'areaId'>>,
): Project {
  const set = new Set(ids);
  return { ...project, devices: project.devices.map((d) => (set.has(d.id) ? { ...d, ...patch } : d)) };
}

export type AlignMode = 'left' | 'hcentre' | 'right' | 'top' | 'vcentre' | 'bottom';

/** Lines up devices by an edge or centre. Vertical moves re-derive each device's Purdue level. */
export function alignDevices(project: Project, ids: readonly string[], mode: AlignMode): Project {
  const set = new Set(ids);
  const targets = project.devices.filter((d) => set.has(d.id));
  if (targets.length < 2) return project;
  const xs = targets.map((d) => d.position.x);
  const ys = targets.map((d) => d.position.y);
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const value = {
    left: Math.min(...xs),
    hcentre: mean(xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    vcentre: mean(ys),
    bottom: Math.max(...ys),
  }[mode];
  const horizontal = mode === 'left' || mode === 'hcentre' || mode === 'right';
  return targets.reduce(
    (p, d) => moveDevice(p, d.id, horizontal ? { x: value, y: d.position.y } : { x: d.position.x, y: value }),
    project,
  );
}

/** Spaces three or more devices evenly between the outermost two along one axis. */
export function distributeDevices(project: Project, ids: readonly string[], axis: 'x' | 'y'): Project {
  const set = new Set(ids);
  const targets = project.devices.filter((d) => set.has(d.id)).sort((a, b) => a.position[axis] - b.position[axis]);
  if (targets.length < 3) return project;
  const first = targets[0].position[axis];
  const step = (targets[targets.length - 1].position[axis] - first) / (targets.length - 1);
  return targets.reduce((p, d, i) => moveDevice(p, d.id, { ...d.position, [axis]: first + i * step }), project);
}
