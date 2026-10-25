// Pure, immutable operations on a Project. The store wraps these; tests call them directly.
import { DEFAULT_PORTS, DEVICE_CATALOG } from './catalog';
import { levelAtY } from './purdue';
import {
  SCHEMA_VERSION,
  type Device,
  type DeviceType,
  type FirewallRule,
  type Flow,
  type FlowProtocol,
  type Link,
  type Project,
  type RuleEndpoint,
  type Zone,
} from './schema';

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyProject(name = 'Untitled architecture'): Project {
  return { schemaVersion: SCHEMA_VERSION, name, devices: [], links: [], flows: [], zones: [] };
}

export function createDevice(type: DeviceType, position: { x: number; y: number }, id = newId(type)): Device {
  const info = DEVICE_CATALOG[type];
  const device: Device = {
    id,
    type,
    label: info.label,
    purdueLevel: levelAtY(position.y),
    zoneId: null,
    criticality: info.defaultCriticality,
    position,
    services: [],
  };
  if (type === 'firewall') device.firewall = { defaultAction: 'deny', rules: [] };
  return device;
}

export function defaultFlow(protocol: FlowProtocol, source: string, target: string, id = newId('flow')): Flow {
  if (protocol === 'modbus') {
    return { id, source, target, protocol, variant: 'tcp', port: DEFAULT_PORTS.modbus.tcp, access: 'read', authentication: false };
  }
  return {
    id,
    source,
    target,
    protocol,
    transport: 'tcp',
    port: DEFAULT_PORTS.dnp3,
    secureAuthentication: false,
    tls: false,
    controlCommands: false,
  };
}

export function addDevice(project: Project, device: Device): Project {
  return { ...project, devices: [...project.devices, device] };
}

export function updateDevice(project: Project, id: string, patch: Partial<Omit<Device, 'id' | 'type'>>): Project {
  return { ...project, devices: project.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) };
}

/** Moves a device and re-derives its Purdue level from the lane it was dropped in. */
export function moveDevice(project: Project, id: string, position: { x: number; y: number }): Project {
  return updateDevice(project, id, { position, purdueLevel: levelAtY(position.y) });
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
  const link: Link = { id, source, target, medium: 'ethernet' };
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

/** Removes a zone, unassigns its devices and drops firewall rules that referenced it. */
export function removeZone(project: Project, id: string): Project {
  const devices = project.devices.map((d) => (d.zoneId === id ? { ...d, zoneId: null } : d));
  return { ...project, zones: project.zones.filter((z) => z.id !== id), devices: pruneRules(devices, 'zone', id) };
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
