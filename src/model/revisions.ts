// Named revisions of a design, kept inside the project file, and the change list between two designs.
// Items are matched by id, which copy-on-save keeps stable between a revision and the live design.
import { kindLabel } from './catalog';
import { newId } from './ops';
import { getProtocol } from './protocols';
import { levelLabel } from './purdue';
import type { Design, Device, FirewallRule, Flow, Link, Project, Revision } from './schema';

export function designOf(project: Project): Design {
  // Listing the fields keeps schemaVersion and revisions out even if more top-level fields appear later.
  const { name, sites, devices, links, flows, zones, areas, notes, networks, fieldDefs } = project;
  return structuredClone({ name, sites, devices, links, flows, zones, areas, notes, networks, fieldDefs });
}

export function saveRevision(project: Project, name: string, now = new Date(), id = newId('rev')): Project {
  const revision: Revision = { id, name: name.trim() || `Revision ${project.revisions.length + 1}`, createdAt: now.toISOString(), design: designOf(project) };
  return { ...project, revisions: [...project.revisions, revision] };
}

export function renameRevision(project: Project, id: string, name: string): Project {
  return { ...project, revisions: project.revisions.map((r) => (r.id === id ? { ...r, name } : r)) };
}

export function removeRevision(project: Project, id: string): Project {
  return { ...project, revisions: project.revisions.filter((r) => r.id !== id) };
}

/** Replaces the live design with a revision's copy. Revisions themselves are kept. */
export function restoreRevision(project: Project, id: string): Project {
  const revision = project.revisions.find((r) => r.id === id);
  if (!revision) return project;
  return { ...project, ...structuredClone(revision.design) };
}

export type ChangeKind = 'added' | 'removed' | 'changed';
export type ItemKind = 'project' | 'field' | 'site' | 'zone' | 'network' | 'area' | 'device' | 'link' | 'flow' | 'rule' | 'note';

export interface Change {
  item: ItemKind;
  id: string;
  change: ChangeKind;
  /** Human-readable name, from the newer design when the item still exists. */
  label: string;
  /** What changed, e.g. "zone: Control → Operations". Empty for additions and removals. */
  details: string[];
  /** For devices, links and flows: the site they are on, so the canvas can show them. */
  siteId?: string;
  /** True when the only difference is a new position on the canvas. */
  moveOnly?: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

/** Compares named fields and returns "field: old → new" lines. */
function fieldChanges<T>(before: T, after: T, fields: [string, (x: T) => unknown][]): string[] {
  return fields.flatMap(([label, get]) => {
    const a = get(before);
    const b = get(after);
    return same(a, b) ? [] : [`${label}: ${show(a)} → ${show(b)}`];
  });
}

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

/** Added, removed and changed items of one collection, in the newer design's order. */
function compare<T extends { id: string }>(
  item: ItemKind,
  before: T[],
  after: T[],
  label: (x: T) => string,
  details: (a: T, b: T) => string[],
  siteOf?: (x: T) => string | undefined,
): Change[] {
  const old = byId(before);
  const now = byId(after);
  const out: Change[] = [];
  for (const x of after) {
    const prev = old.get(x.id);
    if (!prev) out.push({ item, id: x.id, change: 'added', label: label(x), details: [], siteId: siteOf?.(x) });
    else if (!same(prev, x)) out.push({ item, id: x.id, change: 'changed', label: label(x), details: details(prev, x), siteId: siteOf?.(x) });
  }
  for (const x of before) {
    if (!now.has(x.id)) out.push({ item, id: x.id, change: 'removed', label: label(x), details: [], siteId: siteOf?.(x) });
  }
  return out;
}

export function diffDesigns(before: Design, after: Design): Change[] {
  const names = (d: Design) => ({
    zone: new Map(d.zones.map((z) => [z.id, z.name])),
    site: new Map(d.sites.map((s) => [s.id, s.name])),
    area: new Map(d.areas.map((a) => [a.id, a.name])),
    device: new Map(d.devices.map((x) => [x.id, x.label])),
  });
  const was = names(before);
  const now = names(after);
  // Resolve references in each design's own names, so a renamed zone does not read as a zone change.
  const deviceName = (id: string) => now.device.get(id) ?? was.device.get(id) ?? id;
  const zoneIn = (n: typeof was) => (id: string | null) => (id ? (n.zone.get(id) ?? id) : null);
  const siteIn = (n: typeof was) => (id: string | null) => (id ? (n.site.get(id) ?? id) : 'all sites');
  const areaIn = (n: typeof was) => (id: string | null) => (id ? (n.area.get(id) ?? id) : null);
  const deviceSite = new Map([...before.devices, ...after.devices].map((d) => [d.id, d.siteId]));

  const changes: Change[] = [];
  if (before.name !== after.name) {
    changes.push({ item: 'project', id: '(project)', change: 'changed', label: 'Project name', details: [`name: ${before.name} → ${after.name}`] });
  }

  changes.push(
    ...compare('field', before.fieldDefs, after.fieldDefs, (f) => f.label, (a, b) =>
      fieldChanges(a, b, [
        ['label', (f) => f.label],
        ['kind', (f) => f.kind],
        ['options', (f) => f.options.join(', ')],
      ]),
    ),
  );
  const fieldLabel = (id: string) => after.fieldDefs.find((f) => f.id === id)?.label ?? before.fieldDefs.find((f) => f.id === id)?.label ?? id;

  changes.push(...compare('site', before.sites, after.sites, (s) => s.name, (a, b) => fieldChanges(a, b, [['name', (s) => s.name]])));
  changes.push(
    ...compare('zone', before.zones, after.zones, (z) => z.name, (a, b) =>
      fieldChanges(a, b, [
        ['name', (z) => z.name],
        ['trusted', (z) => (z.trusted ? 'yes' : 'no')],
        ['target SL', (z) => z.targetSL],
        ['colour', (z) => z.color],
      ]),
    ),
  );
  changes.push(
    ...compare('network', before.networks, after.networks, (n) => n.name || n.cidr, (a, b) => [
      ...fieldChanges(a, b, [
        ['name', (n) => n.name],
        ['subnet', (n) => n.cidr],
        ['VLAN', (n) => n.vlan],
      ]),
      ...(zoneIn(was)(a.zoneId) === zoneIn(now)(b.zoneId) ? [] : [`zone: ${show(zoneIn(was)(a.zoneId))} → ${show(zoneIn(now)(b.zoneId))}`]),
      ...(siteIn(was)(a.siteId) === siteIn(now)(b.siteId) ? [] : [`site: ${siteIn(was)(a.siteId)} → ${siteIn(now)(b.siteId)}`]),
    ]),
  );
  changes.push(
    ...compare(
      'area',
      before.areas,
      after.areas,
      (a) => a.name,
      (a, b) => {
        const d = fieldChanges(a, b, [
          ['name', (x) => x.name],
          ['collapsed', (x) => (x.collapsed ? 'yes' : 'no')],
          ['colour', (x) => x.color],
          ['locked', (x) => (x.locked ? 'yes' : 'no')],
        ]);
        return d.length || same(a.rect, b.rect) ? d : ['moved or resized'];
      },
      (a) => a.siteId,
    ),
  );

  const deviceDetails = (a: Device, b: Device): string[] => {
    const d = fieldChanges(a, b, [
      ['name', (x) => x.label],
      ['kind', (x) => kindLabel(x.type, x.variant)],
      ['level', (x) => levelLabel(x.purdueLevel)],
      ['criticality', (x) => x.criticality],
      ['vendor', (x) => x.asset.vendor],
      ['model', (x) => x.asset.model],
      ['firmware', (x) => x.asset.firmware],
      ['serial', (x) => x.asset.serial],
      ['IP', (x) => x.asset.ip],
      ['notes', (x) => x.asset.notes],
      ['remote services', (x) => x.services.map((s) => `${s.protocol.toUpperCase()} ${s.port}`).join(', ')],
      ['default action', (x) => x.firewall?.defaultAction],
      ['tags', (x) => x.tags.join(', ')],
      ['locked', (x) => (x.locked ? 'yes' : 'no')],
    ]);
    for (const key of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) {
      if ((a.fields[key] ?? '') !== (b.fields[key] ?? '')) d.push(`${fieldLabel(key)}: ${show(a.fields[key])} → ${show(b.fields[key])}`);
    }
    if (siteIn(was)(a.siteId) !== siteIn(now)(b.siteId)) d.push(`site: ${siteIn(was)(a.siteId)} → ${siteIn(now)(b.siteId)}`);
    if (zoneIn(was)(a.zoneId) !== zoneIn(now)(b.zoneId)) d.push(`zone: ${show(zoneIn(was)(a.zoneId))} → ${show(zoneIn(now)(b.zoneId))}`);
    if (areaIn(was)(a.areaId) !== areaIn(now)(b.areaId)) d.push(`area: ${show(areaIn(was)(a.areaId))} → ${show(areaIn(now)(b.areaId))}`);
    return d;
  };
  for (const c of compare('device', before.devices, after.devices, (d) => d.label, deviceDetails, (d) => d.siteId)) {
    // Firewall rule edits are listed as rule changes below, so they do not need a device line too.
    if (c.change === 'changed' && c.details.length === 0) {
      const a = before.devices.find((d) => d.id === c.id)!;
      const b = after.devices.find((d) => d.id === c.id)!;
      if (!same(a.position, b.position)) changes.push({ ...c, details: ['moved on the canvas'], moveOnly: true });
      continue;
    }
    changes.push(c);
  }

  const networkIn = (d: Design) => (id: string | null) => (id ? (d.networks.find((n) => n.id === id)?.name ?? id) : null);
  const linkLabel = (l: Link) => `${deviceName(l.source)} ↔ ${deviceName(l.target)}`;
  changes.push(
    ...routed(
      compare(
        'link',
        before.links,
        after.links,
        linkLabel,
        (a, b) => [
          ...fieldChanges(a, b, [
            ['medium', (l) => l.medium],
            ['port at ' + deviceName(a.source), (l) => l.sourcePort],
            ['port at ' + deviceName(a.target), (l) => l.targetPort],
            ['VLANs', (l) => l.vlans.join(', ')],
          ]),
          ...(networkIn(before)(a.networkId) === networkIn(after)(b.networkId)
            ? []
            : [`network: ${show(networkIn(before)(a.networkId))} → ${show(networkIn(after)(b.networkId))}`]),
        ],
        (l) => deviceSite.get(l.source),
      ),
    ),
  );
  const flowLabel = (f: Flow) => `${getProtocol(f.protocol)?.label ?? f.protocol}: ${deviceName(f.source)} → ${deviceName(f.target)}`;
  changes.push(
    ...routed(
      compare(
        'flow',
        before.flows,
        after.flows,
        flowLabel,
        (a, b) => [
          ...fieldChanges(a, b, [
            ['protocol', (f) => getProtocol(f.protocol)?.label ?? f.protocol],
            ['port', (f) => f.port],
          ]),
          ...[...new Set([...Object.keys(a.settings), ...Object.keys(b.settings)])]
            .filter((k) => a.protocol === b.protocol && !same(a.settings[k], b.settings[k]))
            .map((k) => `${k}: ${show(a.settings[k])} → ${show(b.settings[k])}`),
        ],
        (f) => deviceSite.get(f.source),
      ),
    ),
  );

  const rules = (d: Design) =>
    d.devices.flatMap((fw) => (fw.firewall?.rules ?? []).map((r, i) => ({ ...r, firewallId: fw.id, order: i + 1 })));
  type OrderedRule = FirewallRule & { firewallId: string; order: number };
  const endpoint = (n: typeof was, ep: FirewallRule['src']) =>
    ep.kind === 'any' ? 'any' : ep.kind === 'zone' ? `zone ${n.zone.get(ep.id) ?? ep.id}` : (n.device.get(ep.id) ?? ep.id);
  const ruleLabel = (r: OrderedRule) =>
    `${deviceName(r.firewallId)} rule ${r.order}: ${r.action} ${r.protocol}${r.port ? `/${r.port}` : ''}`;
  changes.push(
    ...compare<OrderedRule>(
      'rule',
      rules(before),
      rules(after),
      ruleLabel,
      (a, b) => [
        ...fieldChanges(a, b, [
          ['position', (r) => r.order],
          ['action', (r) => r.action],
          ['protocol', (r) => r.protocol],
          ['port', (r) => r.port ?? 'any'],
          ['note', (r) => r.note],
        ]),
        ...(endpoint(was, a.src) === endpoint(now, b.src) ? [] : [`source: ${endpoint(was, a.src)} → ${endpoint(now, b.src)}`]),
        ...(endpoint(was, a.dst) === endpoint(now, b.dst) ? [] : [`destination: ${endpoint(was, a.dst)} → ${endpoint(now, b.dst)}`]),
      ],
      (r) => deviceSite.get(r.firewallId),
    ),
  );

  changes.push(
    ...compare(
      'note',
      before.notes,
      after.notes,
      (n) => n.text.split('\n')[0].slice(0, 60) || 'Empty note',
      (a, b) => {
        const d = fieldChanges(a, b, [['text', (n) => n.text.replace(/\s+/g, ' ')]]);
        return d.length || same(a.position, b.position) ? d : ['moved on the canvas'];
      },
      (n) => n.siteId,
    ),
  );
  return changes;
}

/** A link or flow whose only difference is its bend points has been re-routed, not changed. */
function routed(changes: Change[]): Change[] {
  return changes.map((c) => (c.change === 'changed' && c.details.length === 0 ? { ...c, details: ['re-routed on the canvas'], moveOnly: true } : c));
}

const ITEM_TITLES: Record<ItemKind, string> = {
  project: 'Project',
  field: 'Custom fields',
  site: 'Sites',
  zone: 'Zones',
  network: 'Networks',
  area: 'Areas',
  device: 'Devices',
  link: 'Network links',
  flow: 'Protocol flows',
  rule: 'Firewall rules',
  note: 'Notes',
};
export const ITEM_ORDER = Object.keys(ITEM_TITLES) as ItemKind[];
export const itemTitle = (k: ItemKind) => ITEM_TITLES[k];

const NOUNS: Record<ItemKind, [string, string]> = {
  project: ['project', 'project'],
  field: ['custom field', 'custom fields'],
  site: ['site', 'sites'],
  zone: ['zone', 'zones'],
  network: ['network', 'networks'],
  area: ['area', 'areas'],
  device: ['device', 'devices'],
  link: ['link', 'links'],
  flow: ['flow', 'flows'],
  rule: ['firewall rule', 'firewall rules'],
  note: ['note', 'notes'],
};
const VERBS: Record<ChangeKind, string> = { added: 'Added', removed: 'Removed', changed: 'Changed' };
const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * A short name for one undo step, worked out from what changed between two snapshots, such as
 * "Added device PLC", "Moved 3 devices" or "Filtration PLC: firmware: — → V4.2".
 */
export function describeChange(before: Project, after: Project): string {
  const changes = diffDesigns(before, after);
  if (changes.length === 0) {
    if (after.revisions.length > before.revisions.length) return `Saved revision “${after.revisions[after.revisions.length - 1].name}”`;
    if (after.revisions.length < before.revisions.length) return 'Deleted a revision';
    return before.revisions !== after.revisions ? 'Renamed a revision' : 'No visible change';
  }
  const one = (c: Change) => {
    if (c.moveOnly) return `Moved ${c.label}`;
    if (c.change === 'changed' && c.details.length === 1) return `${c.label}: ${c.details[0]}`;
    return `${VERBS[c.change]} ${NOUNS[c.item][0]} ${c.label}`;
  };
  const [first] = changes;
  if (changes.length === 1) return clip(one(first));
  const sameKind = changes.every((c) => c.item === first.item && c.change === first.change);
  if (sameKind && changes.every((c) => c.moveOnly)) return `Moved ${changes.length} ${NOUNS[first.item][1]}`;
  if (sameKind) return `${VERBS[first.change]} ${changes.length} ${NOUNS[first.item][1]}`;
  return clip(`${one(first)} and ${changes.length - 1} more change${changes.length === 2 ? '' : 's'}`);
}

/** A change record in Markdown, for change requests or a project log. */
export function changesToMarkdown(changes: Change[], from: string, to: string): string {
  const out = [`# Changes: ${from} → ${to}\n`];
  if (changes.length === 0) out.push('No changes.\n');
  for (const kind of ITEM_ORDER) {
    const group = changes.filter((c) => c.item === kind);
    if (group.length === 0) continue;
    out.push(`## ${ITEM_TITLES[kind]}\n`);
    for (const c of group) {
      out.push(`- **${c.change}**: ${c.label}`);
      for (const d of c.details) out.push(`  - ${d}`);
    }
    out.push('');
  }
  return out.join('\n');
}
