// Possible attack paths through the design, from entry points to critical OT devices, honouring
// firewall rules. Each step is labelled with a MITRE ATT&CK for ICS tactic and technique from the
// generated table. These are possible paths based on the design, not predictions.
import { firewallVerdict, isBoundary, ruleMatches, type Finding } from '../checks';
import type { Device, Flow, Link, Project } from '../schema';
import type { IcsTacticName, IcsTechniqueId } from './icsTechniques';

/** At most this many paths are kept, best ranked first. */
export const MAX_PATHS = 50;

export interface PathStep {
  deviceId: string;
  /** Links crossed to get here from the previous step, in order; empty for the entry. */
  viaLinkIds: string[];
  /** Switches, routers and firewalls crossed on the way. */
  viaDeviceIds: string[];
  /** The protocol flow from the previous step to this device, if the design has one. */
  viaFlowId?: string;
  tactic: IcsTacticName;
  technique: IcsTechniqueId;
}

export interface AttackPath {
  /** `entryId>targetId`, stable while both devices exist. */
  id: string;
  entryId: string;
  targetId: string;
  steps: PathStep[];
  /** What the adversary could do at the target. */
  impact: { tactic: 'impact'; technique: IcsTechniqueId };
}

/** Devices added to (`true`) or removed from (`false`) the default entry points or targets. */
export interface PathOverrides {
  entries: Readonly<Record<string, boolean>>;
  targets: Readonly<Record<string, boolean>>;
}

export const NO_OVERRIDES: PathOverrides = { entries: {}, targets: {} };

export interface PathReport {
  paths: AttackPath[];
  /** Every entry–target pair with a path, including those beyond MAX_PATHS. */
  total: number;
  entryIds: string[];
  targetIds: string[];
}

const TRANSIT = new Set(['switch', 'router']);
/** Steps and endpoints are hosts; switches, routers and firewalls are crossed on the way. */
export const isHost = (d: Device) => !TRANSIT.has(d.type) && !isBoundary(d);
const CONTROLLERS = new Set(['plc', 'rtu', 'sis', 'machine']);
const INTERACTIVE = new Set(['rdp', 'vnc', 'ssh']);
const offersRemote = (d: Device) => d.services.length > 0;

/**
 * Default entry points: internet connections, wireless access points, jump hosts, every business
 * (L4–L5) host, and hosts at L3.5 or above that offer a remote service. Remote services inside OT
 * are not entries: they are reached through the jump host, so the path shows that instead.
 */
export function isDefaultEntry(d: Device): boolean {
  if (!isHost(d)) return false;
  return d.type === 'internet' || d.type === 'wap' || d.type === 'jumphost' || d.purdueLevel >= 4 || (d.purdueLevel >= 3.5 && offersRemote(d));
}

/**
 * Default targets: safety systems, PLCs, RTUs, and other high-criticality devices at L1–L2. Field
 * devices at L0 are left out because they are reached through their controller, already a target.
 */
export function isDefaultTarget(d: Device): boolean {
  if (!isHost(d)) return false;
  if (d.type === 'sis' || d.type === 'plc' || d.type === 'rtu') return true;
  return d.purdueLevel >= 1 && d.purdueLevel <= 2 && d.criticality === 'high';
}

function entryTechnique(d: Device): IcsTechniqueId {
  if (d.type === 'internet') return 'T0883';
  if (d.type === 'wap') return 'T0860';
  if (d.type === 'jumphost' || (d.purdueLevel >= 3.5 && offersRemote(d))) return 'T0822';
  if (d.type === 'workstation' || d.type === 'ews' || d.type === 'hmi') return 'T0865';
  return 'T0866';
}

const RANK: Record<Device['criticality'], number> = { high: 0, medium: 1, low: 2 };

/**
 * Whether a firewall lets at least some traffic from `a` to `b` through: rules are read top to
 * bottom, an allow counts unless an earlier deny already covers its protocol and port, and a
 * deny of everything stops the search.
 */
export function firewallPasses(fw: Device, a: Device, b: Device): boolean {
  const config = fw.firewall;
  if (!config) return true;
  const denied: { protocol: string; port: number | null }[] = [];
  for (const r of config.rules) {
    if (!ruleMatches(r, a, b)) continue;
    if (r.action === 'deny') {
      if (r.protocol === 'any' && r.port === null) return false;
      denied.push({ protocol: r.protocol, port: r.port });
      continue;
    }
    const covered = denied.some((x) => (x.protocol === 'any' || x.protocol === r.protocol) && (x.port === null || x.port === r.port));
    if (!covered) return true;
  }
  return config.defaultAction === 'allow';
}

/** The link graph, split into segments: connected parts once the firewalls are taken out. */
class Topology {
  readonly device: Map<string, Device>;
  readonly links = new Map<string, { id: string; to: string }[]>();
  readonly segment = new Map<string, number>();
  readonly hostsIn: string[][] = [];
  /** Segment and firewall neighbours of each firewall; segments are numbers, firewalls ids. */
  private readonly fwNext = new Map<string, (number | string)[]>();
  private readonly segFirewalls: Set<string>[] = [];
  private readonly routes = new Map<number, Map<number | string, number | string>>();

  constructor(project: Project) {
    this.device = new Map(project.devices.map((d) => [d.id, d]));
    for (const l of project.links) {
      if (!this.device.has(l.source) || !this.device.has(l.target) || l.source === l.target) continue;
      this.edge(l.source, l.target, l);
      this.edge(l.target, l.source, l);
    }
    for (const d of project.devices) {
      if (isBoundary(d) || this.segment.has(d.id)) continue;
      const n = this.hostsIn.length;
      this.hostsIn.push([]);
      this.segFirewalls.push(new Set());
      const stack = [d.id];
      this.segment.set(d.id, n);
      while (stack.length) {
        const id = stack.pop()!;
        if (isHost(this.device.get(id)!)) this.hostsIn[n].push(id);
        for (const { to } of this.links.get(id) ?? []) {
          const other = this.device.get(to)!;
          if (isBoundary(other)) this.segFirewalls[n].add(to);
          else if (!this.segment.has(to)) {
            this.segment.set(to, n);
            stack.push(to);
          }
        }
      }
      // Hosts in device order, so results do not depend on the order links were drawn in.
      const order = new Map(project.devices.map((x, i) => [x.id, i]));
      this.hostsIn[n].sort((x, y) => order.get(x)! - order.get(y)!);
    }
    for (const d of project.devices.filter(isBoundary)) {
      const next = new Set<number | string>();
      for (const { to } of this.links.get(d.id) ?? []) {
        const other = this.device.get(to)!;
        next.add(isBoundary(other) ? to : this.segment.get(to)!);
      }
      this.fwNext.set(d.id, [...next]);
    }
  }

  private edge(from: string, to: string, l: Link) {
    const list = this.links.get(from);
    if (list) list.push({ id: l.id, to });
    else this.links.set(from, [{ id: l.id, to }]);
  }

  /** Firewalls on the shortest route between two segments, or null when no links join them. */
  firewallsBetween(from: number, to: number): string[] | null {
    if (from === to) return [];
    let parent = this.routes.get(from);
    if (!parent) {
      parent = new Map<number | string, number | string>([[from, from]]);
      const queue: (number | string)[] = [from];
      for (let i = 0; i < queue.length; i++) {
        const at = queue[i];
        const next = typeof at === 'number' ? this.segFirewalls[at] : this.fwNext.get(at)!;
        for (const n of next) {
          if (parent.has(n)) continue;
          parent.set(n, at);
          queue.push(n);
        }
      }
      this.routes.set(from, parent);
    }
    if (!parent.has(to)) return null;
    const fws: string[] = [];
    for (let at: number | string = to; at !== from; at = parent.get(at)!) if (typeof at === 'string') fws.unshift(at);
    return fws;
  }

  /** Shortest chain of links from `a` to `b` that crosses only the given firewalls. */
  linkRoute(a: string, b: string, firewalls: readonly string[]): { links: string[]; devices: string[] } {
    const allowed = new Set(firewalls);
    const parent = new Map<string, { from: string; link: string }>();
    const queue = [a];
    const seen = new Set([a]);
    for (let i = 0; i < queue.length && !seen.has(b); i++) {
      for (const { id, to } of this.links.get(queue[i]) ?? []) {
        if (seen.has(to) || (isBoundary(this.device.get(to)!) && !allowed.has(to))) continue;
        seen.add(to);
        parent.set(to, { from: queue[i], link: id });
        queue.push(to);
      }
    }
    if (!seen.has(b)) return { links: [], devices: [] };
    const links: string[] = [];
    const devices: string[] = [];
    for (let at = b; at !== a; at = parent.get(at)!.from) {
      links.unshift(parent.get(at)!.link);
      if (at !== b) devices.unshift(at);
    }
    return { links, devices };
  }
}

type Reach = { from: string; flowId?: string };

/** Every possible attack path in the design, best ranked first, at most MAX_PATHS of them. */
export function findAttackPaths(project: Project, overrides: PathOverrides = NO_OVERRIDES): PathReport {
  const topo = new Topology(project);
  const hosts = project.devices.filter(isHost);
  const pick = (ids: Readonly<Record<string, boolean>>, byDefault: (d: Device) => boolean) =>
    hosts.filter((d) => ids[d.id] ?? byDefault(d)).map((d) => d.id);
  const entryIds = pick(overrides.entries, isDefaultEntry);
  const targetIds = pick(overrides.targets, isDefaultTarget);
  const dev = (id: string) => topo.device.get(id)!;
  const seg = (id: string) => topo.segment.get(id)!;

  // Hosts that firewall rules treat alike share a class: same segment, same zone, and not named
  // in any rule. Reach across firewalls is decided once per pair of classes.
  const named = new Set<string>();
  for (const d of project.devices) {
    for (const r of d.firewall?.rules ?? []) {
      for (const ep of [r.src, r.dst]) if (ep.kind === 'device') named.add(ep.id);
    }
  }
  const classOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const id of topo.hostsIn.flat()) {
    const d = dev(id);
    const key = `${seg(id)}|${d.zoneId ?? ''}|${named.has(id) ? id : ''}`;
    classOf.set(id, key);
    const list = members.get(key);
    if (list) list.push(id);
    else members.set(key, [id]);
  }
  const classes = [...members.keys()];
  const passCache = new Map<string, boolean>();
  const crosses = (a: string, b: string): boolean => {
    const key = `${classOf.get(a)}>${classOf.get(b)}`;
    let ok = passCache.get(key);
    if (ok === undefined) {
      const fws = topo.firewallsBetween(seg(a), seg(b));
      ok = fws !== null && fws.every((fw) => firewallPasses(dev(fw), dev(a), dev(b)));
      passCache.set(key, ok);
    }
    return ok;
  };
  const flowsFrom = new Map<string, Flow[]>();
  for (const f of project.flows) {
    if (!topo.device.has(f.source) || !topo.device.has(f.target) || !isHost(dev(f.source)) || !isHost(dev(f.target))) continue;
    const list = flowsFrom.get(f.source);
    if (list) list.push(f);
    else flowsFrom.set(f.source, [f]);
  }
  /** A flow is usable unless a firewall on the link route between its ends denies it. */
  const flowPasses = (f: Flow) => {
    const fws = topo.firewallsBetween(seg(f.source), seg(f.target));
    return fws === null || fws.every((fw) => firewallVerdict(dev(fw), dev(f.source), dev(f.target), f.protocol, f.port) !== 'deny');
  };
  const reaches = (a: string, b: string) =>
    seg(a) === seg(b) || crosses(a, b) || (flowsFrom.get(a) ?? []).some((f) => f.target === b && flowPasses(f));

  // Breadth-first search from each entry. A segment is opened by the first host reached in it, and
  // each class pair once, from the first host of its class: every later host is no closer.
  const searches = new Map<string, Map<string, Reach & { depth: number }>>();
  const candidates: { entry: string; target: string; hops: number }[] = [];
  const targets = new Set(targetIds);
  for (const entry of entryIds) {
    const reach = new Map<string, Reach & { depth: number }>([[entry, { from: entry, depth: 0 }]]);
    const queue = [entry];
    const openSegs = new Set<number>();
    const openClasses = new Set<string>();
    const visit = (id: string, from: string, flowId?: string) => {
      if (reach.has(id)) return;
      reach.set(id, { from, flowId, depth: reach.get(from)!.depth + 1 });
      queue.push(id);
    };
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i];
      if (!openSegs.has(seg(u))) {
        openSegs.add(seg(u));
        for (const v of topo.hostsIn[seg(u)]) visit(v, u);
      }
      const cls = classOf.get(u)!;
      if (!openClasses.has(cls)) {
        openClasses.add(cls);
        for (const k of classes) {
          const first = members.get(k)![0];
          if (seg(first) !== seg(u) && crosses(u, first)) for (const v of members.get(k)!) visit(v, u);
        }
      }
      for (const f of flowsFrom.get(u) ?? []) if (flowPasses(f)) visit(f.target, u, f.id);
    }
    searches.set(entry, reach);
    for (const [id, r] of reach) if (id !== entry && targets.has(id)) candidates.push({ entry, target: id, hops: r.depth });
  }

  const order = new Map(project.devices.map((d, i) => [d.id, i]));
  candidates.sort((x, y) => {
    const a = dev(x.target);
    const b = dev(y.target);
    return (
      Number(b.type === 'sis') - Number(a.type === 'sis') ||
      RANK[a.criticality] - RANK[b.criticality] ||
      x.hops - y.hops ||
      order.get(x.target)! - order.get(y.target)! ||
      order.get(x.entry)! - order.get(y.entry)!
    );
  });

  const flowBetween = (a: string, b: string) => (flowsFrom.get(a) ?? []).find((f) => f.target === b && flowPasses(f));
  const paths = candidates.slice(0, MAX_PATHS).map(({ entry, target }): AttackPath => {
    const reach = searches.get(entry)!;
    // The last hop carries the impair-process-control step, so prefer a host one hop closer that
    // has a flow into the target, then an engineering workstation, over the search's first choice.
    const depth = reach.get(target)!.depth;
    const closer = (id: string) => reach.get(id)?.depth === depth - 1 && reaches(id, target);
    const t = dev(target);
    const last =
      project.flows.find((f) => f.target === target && closer(f.source) && flowBetween(f.source, target))?.source ??
      (CONTROLLERS.has(t.type) ? hosts.find((d) => d.type === 'ews' && closer(d.id))?.id : undefined) ??
      reach.get(target)!.from;
    const chain = [target];
    for (let at = last; at !== entry; at = reach.get(at)!.from) chain.unshift(at);
    chain.unshift(entry);

    const steps = chain.map((id, i): PathStep => {
      const d = dev(id);
      if (i === 0) return { deviceId: id, viaLinkIds: [], viaDeviceIds: [], tactic: 'initial-access', technique: entryTechnique(d) };
      const prev = chain[i - 1];
      const flow = flowBetween(prev, id);
      const fws = topo.firewallsBetween(seg(prev), seg(id)) ?? [];
      const route = topo.linkRoute(prev, id, fws);
      const base = { deviceId: id, viaLinkIds: route.links, viaDeviceIds: route.devices, ...(flow ? { viaFlowId: flow.id } : {}) };
      const final = i === chain.length - 1;
      if (final && CONTROLLERS.has(d.type) && dev(prev).type === 'ews') return { ...base, tactic: 'lateral-movement', technique: 'T0843' };
      if (final && flow) return { ...base, tactic: 'impair-process-control', technique: 'T1692.001' };
      const remote = d.type === 'jumphost' || d.services.some((s) => INTERACTIVE.has(s.protocol));
      return { ...base, tactic: 'lateral-movement', technique: remote ? 'T0886' : 'T0866' };
    });
    return { id: `${entry}>${target}`, entryId: entry, targetId: target, steps, impact: { tactic: 'impact', technique: t.type === 'sis' ? 'T0880' : 'T0831' } };
  });

  return { paths, total: candidates.length, entryIds, targetIds };
}

/** Links, flows and crossed devices a path uses, for highlighting and for finding what it relies on. */
export function pathItems(path: AttackPath): { links: string[]; flows: string[]; via: string[] } {
  return {
    links: [...new Set(path.steps.flatMap((s) => s.viaLinkIds))],
    flows: path.steps.flatMap((s) => (s.viaFlowId ? [s.viaFlowId] : [])),
    via: [...new Set(path.steps.flatMap((s) => s.viaDeviceIds))],
  };
}

/** Findings on the links and flows a path uses or on the firewalls it crosses. */
export function pathFindings(project: Project, path: AttackPath, findings: readonly Finding[]): Finding[] {
  const { links, flows, via } = pathItems(path);
  const firewalls = new Set(via.filter((id) => project.devices.find((d) => d.id === id)?.type === 'firewall'));
  const used = new Set([...links, ...flows]);
  return findings.filter(
    (f) => f.items.links.some((id) => used.has(id)) || f.items.flows.some((id) => used.has(id)) || f.items.devices.some((id) => firewalls.has(id)),
  );
}

/** Canvas marks for a path: its step number for each step device, `via` for everything crossed. */
export function pathMarks(path: AttackPath): Map<string, number | 'via'> {
  const marks = new Map<string, number | 'via'>();
  const { links, flows, via } = pathItems(path);
  for (const id of [...links, ...flows, ...via]) marks.set(id, 'via');
  path.steps.forEach((s, i) => marks.set(s.deviceId, i + 1));
  return marks;
}

const cache = new WeakMap<Project, WeakMap<PathOverrides, PathReport>>();

/** findAttackPaths, computed once per project and overrides object. */
export function attackPathsOf(project: Project, overrides: PathOverrides): PathReport {
  let byOverrides = cache.get(project);
  if (!byOverrides) cache.set(project, (byOverrides = new WeakMap()));
  let report = byOverrides.get(overrides);
  if (!report) byOverrides.set(overrides, (report = findAttackPaths(project, overrides)));
  return report;
}
