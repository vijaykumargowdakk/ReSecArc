// Merges chosen sites from another project into this one. Everything copied gets a fresh id, so a
// project can even be merged with a copy of itself. Zones, estate-wide networks and custom fields
// are matched by name (CIDR for networks) so the merged sites share them instead of duplicating them.
import { cidrContains, deviceAddresses, parseCidr, parseIpv4 } from './ipam';
import { newId } from './ops';
import type { Design, Device, FieldDef, Network, Project, RuleEndpoint, Zone } from './schema';

const MAX_FIELD_DEFS = 50;
const key = (s: string) => s.trim().toLowerCase();

export interface MergeSummary {
  sites: number;
  devices: number;
  links: number;
  flows: number;
  areas: number;
  notes: number;
  networks: number;
  /** Source zone names that matched an existing zone, and those added as new zones. */
  zonesMatched: string[];
  zonesAdded: string[];
  fieldsMatched: string[];
  fieldsAdded: string[];
  /** Custom field values left out because the project already has the most fields allowed. */
  fieldValuesDropped: number;
  /** Links and flows to a device on a site that was not chosen; left out. */
  connectionsDropped: number;
  /** Firewall rules naming a device on a site that was not chosen; left out rather than widened. */
  rulesDropped: number;
  /** Sites renamed because this project already has a site of that name. */
  renamed: { from: string; to: string }[];
}

/** A name not yet in `taken` (compared without case): the name itself, or "name (2)", "name (3)"… */
function uniqueName(name: string, taken: Set<string>): string {
  let candidate = name;
  for (let n = 2; taken.has(key(candidate)); n++) candidate = `${name} (${n})`;
  taken.add(key(candidate));
  return candidate;
}

export function mergeSites(
  target: Project,
  source: Design,
  siteIds: readonly string[],
): { project: Project; summary: MergeSummary; siteIds: string[] } {
  const chosen = new Set(siteIds.filter((id) => source.sites.some((s) => s.id === id)));
  const summary: MergeSummary = {
    sites: chosen.size,
    devices: 0,
    links: 0,
    flows: 0,
    areas: 0,
    notes: 0,
    networks: 0,
    zonesMatched: [],
    zonesAdded: [],
    fieldsMatched: [],
    fieldsAdded: [],
    fieldValuesDropped: 0,
    connectionsDropped: 0,
    rulesDropped: 0,
    renamed: [],
  };

  // Sites, renamed where the name is taken.
  const siteNames = new Set(target.sites.map((s) => key(s.name)));
  const siteMap = new Map<string, string>();
  const sites = source.sites
    .filter((s) => chosen.has(s.id))
    .map((s) => {
      const name = uniqueName(s.name, siteNames);
      if (name !== s.name) summary.renamed.push({ from: s.name, to: name });
      const id = newId('site');
      siteMap.set(s.id, id);
      return { id, name };
    });

  // Zones: matched by name, otherwise added. Only zones something copied refers to are brought over.
  const zones: Zone[] = [];
  const zoneMap = new Map<string, string>();
  const sourceZone = new Map(source.zones.map((z) => [z.id, z]));
  const zoneFor = (id: string | null): string | null => {
    if (id === null) return null;
    const known = zoneMap.get(id);
    if (known) return known;
    const z = sourceZone.get(id);
    if (!z) return null;
    const match = target.zones.find((t) => key(t.name) === key(z.name)) ?? zones.find((t) => key(t.name) === key(z.name));
    if (match) {
      if (!summary.zonesMatched.includes(z.name)) summary.zonesMatched.push(z.name);
      zoneMap.set(id, match.id);
      return match.id;
    }
    const copy = { ...z, id: newId('zone') };
    zones.push(copy);
    summary.zonesAdded.push(z.name);
    zoneMap.set(id, copy.id);
    return copy.id;
  };

  // Custom fields: matched by label and kind, otherwise added while there is room.
  const fieldDefs = target.fieldDefs.map((f) => ({ ...f, options: [...f.options] }));
  const fieldMap = new Map<string, string | null>();
  const sourceField = new Map(source.fieldDefs.map((f) => [f.id, f]));
  const fieldFor = (id: string): string | null => {
    if (fieldMap.has(id)) return fieldMap.get(id)!;
    const f = sourceField.get(id);
    let result: string | null = null;
    if (f) {
      const match = fieldDefs.find((t) => key(t.label) === key(f.label) && t.kind === f.kind);
      if (match) {
        for (const o of f.options) if (!match.options.includes(o) && match.options.length < 100) match.options.push(o);
        summary.fieldsMatched.push(f.label);
        result = match.id;
      } else if (fieldDefs.length < MAX_FIELD_DEFS) {
        const labels = new Set(fieldDefs.map((t) => key(t.label)));
        const def: FieldDef = { ...f, id: newId('field'), label: uniqueName(f.label, labels).slice(0, 60), options: [...f.options] };
        fieldDefs.push(def);
        summary.fieldsAdded.push(def.label);
        result = def.id;
      }
    }
    fieldMap.set(id, result);
    return result;
  };

  // Areas and notes of the chosen sites.
  const areaMap = new Map<string, string>();
  const areas = source.areas
    .filter((a) => chosen.has(a.siteId))
    .map((a) => {
      const id = newId('area');
      areaMap.set(a.id, id);
      return { ...a, id, siteId: siteMap.get(a.siteId)!, rect: { ...a.rect } };
    });
  const notes = source.notes.filter((n) => chosen.has(n.siteId)).map((n) => ({ ...n, id: newId('note'), siteId: siteMap.get(n.siteId)!, position: { ...n.position } }));

  // Devices, with firewall rules remapped; a rule naming a device left behind is dropped.
  const picked = source.devices.filter((d) => chosen.has(d.siteId));
  const deviceMap = new Map(picked.map((d) => [d.id, newId(d.type)]));
  const endpoint = (ep: RuleEndpoint): RuleEndpoint | null => {
    if (ep.kind === 'device') return deviceMap.has(ep.id) ? { kind: 'device', id: deviceMap.get(ep.id)! } : null;
    if (ep.kind === 'zone') {
      const id = zoneFor(ep.id);
      return id ? { kind: 'zone', id } : null;
    }
    return ep;
  };
  const devices = picked.map((d): Device => {
    const fields: Record<string, string> = {};
    for (const [id, value] of Object.entries(d.fields)) {
      const to = fieldFor(id);
      if (to) fields[to] = value;
      else if (value !== '') summary.fieldValuesDropped++;
    }
    const copy: Device = {
      ...d,
      id: deviceMap.get(d.id)!,
      siteId: siteMap.get(d.siteId)!,
      zoneId: zoneFor(d.zoneId),
      areaId: d.areaId ? (areaMap.get(d.areaId) ?? null) : null,
      position: { ...d.position },
      services: d.services.map((s) => ({ ...s })),
      asset: { ...d.asset },
      tags: [...d.tags],
      fields,
    };
    if (d.firewall) {
      copy.firewall = {
        defaultAction: d.firewall.defaultAction,
        rules: d.firewall.rules.flatMap((r) => {
          const src = endpoint(r.src);
          const dst = endpoint(r.dst);
          if (src && dst) return [{ ...r, id: newId('rule'), src, dst }];
          summary.rulesDropped++;
          return [];
        }),
      };
    }
    return copy;
  });

  // Networks: those of the chosen sites are copied; estate-wide ones are brought over when a copied
  // link uses them or a copied device has an address in them, and matched to one with the same CIDR.
  const networkMap = new Map<string, string>();
  const networks: Network[] = [];
  for (const n of source.networks) {
    if (n.siteId !== null && chosen.has(n.siteId)) {
      const id = newId('net');
      networkMap.set(n.id, id);
      networks.push({ ...n, id, siteId: siteMap.get(n.siteId)!, zoneId: zoneFor(n.zoneId) });
    }
  }
  const copiedLinks = source.links.filter((l) => deviceMap.has(l.source) && deviceMap.has(l.target));
  const ips = picked.flatMap((d) => deviceAddresses(d).map(parseIpv4)).filter((ip): ip is number => ip !== null);
  for (const n of source.networks) {
    if (n.siteId !== null) continue;
    const cidr = parseCidr(n.cidr);
    const used = copiedLinks.some((l) => l.networkId === n.id) || (cidr.ok && ips.some((ip) => cidrContains(cidr.cidr, ip)));
    if (!used) continue;
    const match = target.networks.find((t) => t.siteId === null && t.cidr.trim() === n.cidr.trim());
    if (match) {
      networkMap.set(n.id, match.id);
      continue;
    }
    const id = newId('net');
    networkMap.set(n.id, id);
    networks.push({ ...n, id, zoneId: zoneFor(n.zoneId) });
  }

  const links = copiedLinks.map((l) => ({
    ...l,
    id: newId('link'),
    source: deviceMap.get(l.source)!,
    target: deviceMap.get(l.target)!,
    vlans: [...l.vlans],
    networkId: l.networkId ? (networkMap.get(l.networkId) ?? null) : null,
    waypoints: l.waypoints.map((p) => ({ ...p })),
  }));
  const flows = source.flows
    .filter((f) => deviceMap.has(f.source) && deviceMap.has(f.target))
    .map((f) => ({
      ...f,
      id: newId('flow'),
      source: deviceMap.get(f.source)!,
      target: deviceMap.get(f.target)!,
      settings: { ...f.settings },
      waypoints: f.waypoints.map((p) => ({ ...p })),
    }));
  const touches = (e: { source: string; target: string }) => deviceMap.has(e.source) !== deviceMap.has(e.target);
  summary.connectionsDropped = source.links.filter(touches).length + source.flows.filter(touches).length;

  Object.assign(summary, {
    devices: devices.length,
    links: links.length,
    flows: flows.length,
    areas: areas.length,
    notes: notes.length,
    networks: networks.length,
  });
  return {
    project: {
      ...target,
      sites: [...target.sites, ...sites],
      zones: [...target.zones, ...zones],
      fieldDefs,
      areas: [...target.areas, ...areas],
      notes: [...target.notes, ...notes],
      networks: [...target.networks, ...networks],
      devices: [...target.devices, ...devices],
      links: [...target.links, ...links],
      flows: [...target.flows, ...flows],
    },
    summary,
    siteIds: sites.map((s) => s.id),
  };
}
