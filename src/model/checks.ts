// Design-time security checks: built-in checks based on IEC 62443 zone and conduit principles,
// plus the project's own company policy rules. Findings are hints, like the IP-plan warnings;
// they never block saving. IEC 62443 is cited by clause number only, never quoted.
import { selectorMatches } from './policies';
import { getProtocol } from './protocols';
import { levelLabel } from './purdue';
import type { Device, FirewallRule, Flow, Link, Project, RuleEndpoint } from './schema';

export type Severity = 'high' | 'medium' | 'low';

export const COMMUNICATION_VIOLATION = 'IEC 62443 communication violation';
export const CONFIGURATION_ISSUE = 'IEC 62443 configuration issue';
export const policyHeadline = (name: string) => `Company policy violation: ${name}`;

export interface FindingItems {
  devices: string[];
  links: string[];
  flows: string[];
}

export interface Finding {
  /** Stable across recomputation: check or policy id plus the ids of the items involved. */
  id: string;
  source: 'iec62443' | 'policy';
  headline: string;
  /** Built-in check id or policy rule id. */
  checkId: string;
  severity: Severity;
  message: string;
  reference?: string;
  fix: string;
  items: FindingItems;
}

interface Context {
  project: Project;
  device: Map<string, Device>;
  /** Zone names by id. */
  zone: Map<string, string>;
}

type Hit = { message: string; items: Partial<FindingItems> };

export interface CheckDef {
  id: string;
  title: string;
  headline: string;
  reference: string;
  /** Why the check exists, in our own words. */
  rationale: string;
  fix: string;
  severity: Severity;
  run: (ctx: Context) => Hit[];
}

/** IT is L4 and L5, the DMZ is L3.5, OT is L0–L3. */
export const isIT = (d: Device) => d.purdueLevel >= 4;
export const isOT = (d: Device) => d.purdueLevel <= 3;
/** A firewall enforces the boundary between zones; the data diode is a firewall variant. */
export const isBoundary = (d: Device) => d.type === 'firewall';

const isNetwork = (d: Device) => d.type === 'switch' || d.type === 'router';
// Purdue levels and IEC 62443 zones are separate things: one level can hold several zones and one
// zone can span several levels. Each message names a device by what its check looks at, the level
// for level-based checks and the zone for zone-based ones, so neither is mistaken for the other.
const name = (d: Device) => `${d.label} (${levelLabel(d.purdueLevel)})`;
const zoneName = (ctx: Context, d: Device) => (d.zoneId === null ? 'no zone' : `zone ${ctx.zone.get(d.zoneId) || d.zoneId}`);
const zoned = (ctx: Context, d: Device) => `${d.label} (${zoneName(ctx, d)})`;
const protocolName = (f: Flow) => getProtocol(f.protocol)?.label ?? f.protocol;
const REMOTE = new Set(['rdp', 'vnc', 'ssh', 'https']);
/** Device types that may share a zone with a safety system: its own network and field devices. */
const SAFETY_ZONE_PEERS = new Set(['sis', 'switch', 'router', 'firewall', 'sensor', 'actuator']);

function ends(ctx: Context, e: Link | Flow): [Device, Device] | null {
  const a = ctx.device.get(e.source);
  const b = ctx.device.get(e.target);
  return a && b ? [a, b] : null;
}

const itOt = (a: Device, b: Device) => (isIT(a) && isOT(b)) || (isOT(a) && isIT(b));
const crossesZones = (a: Device, b: Device) => a.zoneId !== null && b.zoneId !== null && a.zoneId !== b.zoneId;

export const BUILTIN_CHECKS: readonly CheckDef[] = [
  {
    id: 'it-ot-direct',
    title: 'Direct connection between IT and OT',
    headline: COMMUNICATION_VIOLATION,
    reference: 'IEC 62443-3-2 ZCR 3.2; IEC 62443-3-3 SR 5.1, SR 5.2',
    rationale: 'Business systems (L4–L5) and control systems (L0–L3) belong in separate zones, joined only through a boundary device and the DMZ.',
    fix: 'Route the connection through the IT/OT firewall and terminate it in the DMZ (L3.5).',
    severity: 'high',
    run: (ctx) => {
      const hits: Hit[] = [];
      for (const l of ctx.project.links) {
        const pair = ends(ctx, l);
        if (!pair || !itOt(...pair) || pair.some(isBoundary)) continue;
        hits.push({ message: `${name(pair[0])} connects directly to ${name(pair[1])}`, items: { links: [l.id] } });
      }
      for (const f of ctx.project.flows) {
        const pair = ends(ctx, f);
        if (!pair || !itOt(...pair) || pair.some(isBoundary)) continue;
        hits.push({ message: `${name(pair[0])} sends ${protocolName(f)} directly to ${name(pair[1])}`, items: { flows: [f.id] } });
      }
      return hits;
    },
  },
  {
    id: 'zone-boundary-unprotected',
    title: 'Zone boundary without a boundary device',
    headline: COMMUNICATION_VIOLATION,
    reference: 'IEC 62443-3-3 SR 5.2',
    rationale: 'Where a link crosses from one zone to another, a boundary device should monitor and control what passes.',
    fix: 'Put a firewall on the conduit between the two zones, or move both devices into the same zone.',
    severity: 'high',
    run: (ctx) => {
      const hits: Hit[] = [];
      for (const l of ctx.project.links) {
        const pair = ends(ctx, l);
        if (!pair || !crossesZones(...pair) || pair.some(isBoundary)) continue;
        // Reported by the more specific checks instead, so one link does not raise two findings.
        if (itOt(...pair) || pair.some((d) => d.type === 'sis')) continue;
        // A device plugged into a switch drawn in a neighbouring zone is not a conduit by itself;
        // the conduit is where two zones' networks (or two end devices) meet.
        if (isNetwork(pair[0]) !== isNetwork(pair[1])) continue;
        hits.push({ message: `${zoned(ctx, pair[0])} and ${zoned(ctx, pair[1])} are linked with no boundary device between the zones`, items: { links: [l.id] } });
      }
      return hits;
    },
  },
  {
    id: 'firewall-default-allow',
    title: 'Firewall allows by default',
    headline: CONFIGURATION_ISSUE,
    reference: 'IEC 62443-3-3 SR 5.2',
    rationale: 'A zone boundary should deny traffic by default and allow it only by exception.',
    fix: 'Set the default action to deny and add allow rules for the traffic that is needed.',
    severity: 'high',
    run: (ctx) =>
      ctx.project.devices
        .filter((d) => d.firewall?.defaultAction === 'allow')
        .map((d) => ({ message: `${name(d)} allows any traffic that no rule matches`, items: { devices: [d.id] } })),
  },
  {
    id: 'firewall-any-any',
    title: 'Firewall rule allows anything',
    headline: CONFIGURATION_ISSUE,
    reference: 'IEC 62443-3-3 SR 5.2',
    rationale: 'An allow rule from any source to any destination for any protocol removes the boundary.',
    fix: 'Narrow the rule to the sources, destinations and protocols that need it.',
    severity: 'high',
    run: (ctx) =>
      ctx.project.devices.flatMap((d) =>
        (d.firewall?.rules ?? []).flatMap((r, i) =>
          r.action === 'allow' && r.src.kind === 'any' && r.dst.kind === 'any' && r.protocol === 'any'
            ? [{ message: `${name(d)} rule ${i + 1} allows any protocol from anywhere to anywhere`, items: { devices: [d.id] } }]
            : [],
        ),
      ),
  },
  {
    id: 'insecure-protocol-cross-zone',
    title: 'Unsecured protocol between zones',
    headline: COMMUNICATION_VIOLATION,
    reference: 'IEC 62443-3-3 SR 3.1, SR 4.1',
    rationale: 'Traffic that crosses a conduit should be protected against tampering and, where needed, eavesdropping.',
    fix: 'Turn on the protocol’s security option (TLS, secure authentication or its secure variant), or keep the flow inside one zone.',
    severity: 'medium',
    run: (ctx) => {
      const hits: Hit[] = [];
      for (const f of ctx.project.flows) {
        const pair = ends(ctx, f);
        const def = getProtocol(f.protocol);
        if (!pair || !def || !crossesZones(...pair) || def.isSecured(f.settings)) continue;
        hits.push({ message: `${protocolName(f)} from ${zoned(ctx, pair[0])} to ${zoned(ctx, pair[1])} crosses zones without authentication or encryption`, items: { flows: [f.id] } });
      }
      return hits;
    },
  },
  {
    id: 'remote-access-control',
    title: 'Remote access at the control levels',
    headline: CONFIGURATION_ISSUE,
    reference: 'IEC 62443-3-3 SR 1.13, SR 2.6',
    rationale: 'Remote sessions should be brokered and controlled above the control levels, not offered by devices at L0–L2.',
    fix: 'Remove the service, or reach the device through a jump host in the DMZ.',
    severity: 'medium',
    run: (ctx) =>
      ctx.project.devices
        .filter((d) => d.purdueLevel <= 2 && d.services.some((s) => REMOTE.has(s.protocol)))
        .map((d) => ({
          message: `${name(d)} offers ${d.services.filter((s) => REMOTE.has(s.protocol)).map((s) => s.protocol.toUpperCase()).join(', ')}`,
          items: { devices: [d.id] },
        })),
  },
  {
    id: 'sis-not-separated',
    title: 'Safety system not separated',
    headline: CONFIGURATION_ISSUE,
    reference: 'IEC 62443-3-2 ZCR 3.3',
    rationale: 'Safety systems belong in their own zone, apart from the basic process control system.',
    fix: 'Give the safety system its own zone and put a boundary device between it and other systems.',
    severity: 'high',
    run: (ctx) => {
      const hits: Hit[] = [];
      for (const sis of ctx.project.devices.filter((d) => d.type === 'sis')) {
        const shared = sis.zoneId === null ? [] : ctx.project.devices.filter((d) => d.zoneId === sis.zoneId && !SAFETY_ZONE_PEERS.has(d.type));
        if (shared.length) {
          hits.push({
            message: `${sis.label} shares ${zoneName(ctx, sis)} with ${shared.map((d) => d.label).join(', ')}`,
            items: { devices: [sis.id, ...shared.map((d) => d.id)] },
          });
        }
        for (const l of ctx.project.links) {
          if (l.source !== sis.id && l.target !== sis.id) continue;
          const other = ctx.device.get(l.source === sis.id ? l.target : l.source);
          if (!other || isBoundary(other) || other.type === 'sis') continue;
          if (sis.zoneId !== null && other.zoneId === sis.zoneId) continue;
          hits.push({ message: `${zoned(ctx, sis)} is linked to ${zoned(ctx, other)} without a boundary device`, items: { links: [l.id] } });
        }
      }
      return hits;
    },
  },
  {
    id: 'device-without-zone',
    title: 'OT device without a zone',
    headline: CONFIGURATION_ISSUE,
    reference: 'IEC 62443-3-2 ZCR 3.1',
    rationale: 'Every control system asset should belong to a zone so its security requirements are defined.',
    fix: 'Assign the device to a zone.',
    severity: 'low',
    run: (ctx) =>
      ctx.project.devices
        .filter((d) => isOT(d) && d.zoneId === null && !isBoundary(d))
        .map((d) => ({ message: `${name(d)} is not in any zone`, items: { devices: [d.id] } })),
  },
];

export const checkById = (id: string) => BUILTIN_CHECKS.find((c) => c.id === id);

function policyFindings(ctx: Context): Finding[] {
  const out: Finding[] = [];
  for (const rule of ctx.project.policies) {
    if (!rule.enabled) continue;
    const forbidden = (a: Device, b: Device, either: boolean) =>
      (selectorMatches(rule.from, a) && selectorMatches(rule.to, b)) ||
      ((either || rule.bothWays) && selectorMatches(rule.from, b) && selectorMatches(rule.to, a));
    const finding = (message: string, items: Partial<FindingItems>, itemId: string): Finding => ({
      id: `${rule.id}:${itemId}`,
      source: 'policy',
      headline: policyHeadline(rule.name || 'Unnamed rule'),
      checkId: rule.id,
      severity: rule.severity,
      message,
      fix: 'Remove the connection, route it through a boundary device, or change the policy rule.',
      items: { devices: [], links: [], flows: [], ...items },
    });
    // A protocol filter only makes sense for flows; links carry no protocol.
    if (rule.connection !== 'flow' && rule.protocols.length === 0) {
      for (const l of ctx.project.links) {
        const pair = ends(ctx, l);
        // Links have no direction, so they match either way round.
        if (pair && forbidden(...pair, true)) out.push(finding(`${name(pair[0])} is linked to ${name(pair[1])}`, { links: [l.id] }, l.id));
      }
    }
    if (rule.connection !== 'link') {
      for (const f of ctx.project.flows) {
        const pair = ends(ctx, f);
        if (!pair || (rule.protocols.length && !rule.protocols.includes(f.protocol))) continue;
        if (forbidden(...pair, false)) out.push(finding(`${name(pair[0])} sends ${protocolName(f)} to ${name(pair[1])}`, { flows: [f.id] }, f.id));
      }
    }
  }
  return out;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Every finding for the project, most severe first. */
export function runChecks(project: Project): Finding[] {
  const ctx: Context = { project, device: new Map(project.devices.map((d) => [d.id, d])), zone: new Map(project.zones.map((z) => [z.id, z.name])) };
  const disabled = new Set(project.disabledChecks);
  const findings: Finding[] = [];
  for (const check of BUILTIN_CHECKS) {
    if (disabled.has(check.id)) continue;
    for (const hit of check.run(ctx)) {
      const items = { devices: [], links: [], flows: [], ...hit.items };
      findings.push({
        id: `${check.id}:${[...items.devices, ...items.links, ...items.flows].join('+')}`,
        source: 'iec62443',
        headline: check.headline,
        checkId: check.id,
        severity: check.severity,
        message: hit.message,
        reference: check.reference,
        fix: check.fix,
        items,
      });
    }
  }
  findings.push(...policyFindings(ctx));
  return findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Devices a finding concerns, including both ends of its links and flows. */
export function findingDevices(project: Project, f: Finding): string[] {
  const ids = new Set(f.items.devices);
  for (const e of [...project.links.filter((l) => f.items.links.includes(l.id)), ...project.flows.filter((x) => f.items.flows.includes(x.id))]) {
    ids.add(e.source);
    ids.add(e.target);
  }
  return [...ids];
}

/** Findings per device, link and flow id, for badges, edge marks and inspectors. */
export function findingsByItem(project: Project, findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  const add = (id: string, f: Finding) => {
    const list = map.get(id);
    if (list) list.push(f);
    else map.set(id, [f]);
  };
  for (const f of findings) {
    for (const id of new Set([...findingDevices(project, f), ...f.items.links, ...f.items.flows])) add(id, f);
  }
  return map;
}

const endpointMatches = (ep: RuleEndpoint, d: Device) => ep.kind === 'any' || (ep.kind === 'zone' ? d.zoneId === ep.id : d.id === ep.id);
/** Whether a firewall rule's source and destination match traffic from `src` to `dst`. */
export const ruleMatches = (r: FirewallRule, src: Device, dst: Device) => endpointMatches(r.src, src) && endpointMatches(r.dst, dst);

/**
 * What a firewall does with traffic from `src` to `dst`: rules are evaluated top to bottom and the
 * first match applies, otherwise the default action. `'any'` or a `null` port in the query matches
 * every rule protocol or port.
 */
export function firewallVerdict(fw: Device, src: Device, dst: Device, protocol: string, port: number | null): 'allow' | 'deny' {
  const config = fw.firewall;
  if (!config) return 'allow';
  for (const r of config.rules) {
    if (!ruleMatches(r, src, dst)) continue;
    if (r.protocol !== 'any' && protocol !== 'any' && r.protocol !== protocol) continue;
    if (r.port !== null && port !== null && r.port !== port) continue;
    return r.action;
  }
  return config.defaultAction;
}
