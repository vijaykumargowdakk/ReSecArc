// The design as a tree for the outline view: site, Purdue level, device, then the device's links and
// flows. Areas and notes are listed under their site and zones at the end. Pure, so it can be tested.
import { kindLabel } from './catalog';
import { flowLabel } from './protocols';
import { levelLabel, PURDUE_LANES } from './purdue';
import type { Project } from './schema';

export type OutlineKind = 'site' | 'level' | 'device' | 'link' | 'flow' | 'areas' | 'area' | 'notes' | 'note' | 'zones' | 'zone';

export interface OutlineItem {
  /** Unique within the tree; a link or flow appears under both of its devices, so ids include the parent. */
  id: string;
  kind: OutlineKind;
  label: string;
  detail: string;
  /** The project item this row stands for (device, link, site…); empty for groups. */
  ref: string;
  siteId: string | null;
  children: OutlineItem[];
}

/** An item as drawn: its depth and place among its siblings, for aria-level, aria-setsize and aria-posinset. */
export interface OutlineRow {
  item: OutlineItem;
  level: number;
  setSize: number;
  posInSet: number;
  parentId: string | null;
}

const MEDIUM = { ethernet: 'Ethernet', serial: 'Serial', wireless: 'Wireless' } as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const firstLine = (text: string) => {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 59)}…` : line || '(empty note)';
};

/**
 * Builds the outline. Devices, links and flows in `hidden` (those the filter leaves out) are skipped,
 * as are Purdue levels left without devices.
 */
export function buildOutline(project: Project, hidden: ReadonlySet<string> = new Set()): OutlineItem[] {
  const deviceById = new Map(project.devices.map((d) => [d.id, d]));
  const zoneName = new Map(project.zones.map((z) => [z.id, z.name]));
  const siteName = new Map(project.sites.map((s) => [s.id, s.name]));
  const multiSite = project.sites.length > 1;

  const peerName = (peerId: string, siteId: string) => {
    const peer = deviceById.get(peerId);
    if (!peer) return peerId;
    return multiSite && peer.siteId !== siteId ? `${peer.label} (${siteName.get(peer.siteId) ?? ''} site)` : peer.label;
  };

  const connections = (deviceId: string, siteId: string): OutlineItem[] => {
    const links = project.links
      .filter((l) => (l.source === deviceId || l.target === deviceId) && !hidden.has(l.id))
      .map((l): OutlineItem => {
        const outgoing = l.source === deviceId;
        const peer = outgoing ? l.target : l.source;
        const here = outgoing ? l.sourcePort : l.targetPort;
        const there = outgoing ? l.targetPort : l.sourcePort;
        const ports = here || there ? `port ${here || '?'} to ${there || '?'}` : 'no ports';
        const vlans = l.vlans.length ? `, VLAN ${l.vlans.join(', ')}` : '';
        return { id: `${deviceId}/${l.id}`, kind: 'link', label: `Link to ${peerName(peer, siteId)}`, detail: `${MEDIUM[l.medium]}, ${ports}${vlans}`, ref: l.id, siteId, children: [] };
      });
    const flows = project.flows
      .filter((f) => (f.source === deviceId || f.target === deviceId) && !hidden.has(f.id))
      .map((f): OutlineItem => {
        const outgoing = f.source === deviceId;
        const protocol = flowLabel(f.protocol, f.settings);
        const label = `${protocol} ${outgoing ? 'to' : 'from'} ${peerName(outgoing ? f.target : f.source, siteId)}`;
        return { id: `${deviceId}/${f.id}`, kind: 'flow', label, detail: f.port === null ? 'layer 2' : `port ${f.port}`, ref: f.id, siteId, children: [] };
      });
    return [...links, ...flows];
  };

  const sites = project.sites.map((site): OutlineItem => {
    const devices = project.devices.filter((d) => d.siteId === site.id && !hidden.has(d.id));
    const levels = PURDUE_LANES.flatMap((lane): OutlineItem[] => {
      const onLevel = devices.filter((d) => d.purdueLevel === lane.level).sort((a, b) => a.label.localeCompare(b.label));
      if (onLevel.length === 0) return [];
      return [
        {
          id: `${site.id}/level-${lane.level}`,
          kind: 'level',
          label: `${levelLabel(lane.level)} ${lane.name}`,
          detail: plural(onLevel.length, 'device'),
          ref: '',
          siteId: site.id,
          children: onLevel.map((d) => {
            const zone = d.zoneId ? `${zoneName.get(d.zoneId) ?? ''} zone` : 'no zone';
            return { id: d.id, kind: 'device', label: d.label, detail: `${kindLabel(d.type, d.variant)}, ${zone}`, ref: d.id, siteId: site.id, children: connections(d.id, site.id) };
          }),
        },
      ];
    });
    const areas = project.areas
      .filter((a) => a.siteId === site.id)
      .map((a): OutlineItem => {
        const members = project.devices.filter((d) => d.areaId === a.id).length;
        return { id: a.id, kind: 'area', label: a.name, detail: `${plural(members, 'device')}${a.collapsed ? ', collapsed' : ''}`, ref: a.id, siteId: site.id, children: [] };
      });
    const notes = project.notes
      .filter((n) => n.siteId === site.id)
      .map((n): OutlineItem => ({ id: n.id, kind: 'note', label: firstLine(n.text), detail: '', ref: n.id, siteId: site.id, children: [] }));
    const groups: OutlineItem[] = [];
    if (areas.length) groups.push({ id: `${site.id}/areas`, kind: 'areas', label: 'Areas', detail: plural(areas.length, 'area'), ref: '', siteId: site.id, children: areas });
    if (notes.length) groups.push({ id: `${site.id}/notes`, kind: 'notes', label: 'Notes', detail: plural(notes.length, 'note'), ref: '', siteId: site.id, children: notes });
    return { id: site.id, kind: 'site', label: site.name, detail: plural(devices.length, 'device'), ref: site.id, siteId: site.id, children: [...levels, ...groups] };
  });

  const zones = project.zones.map((z): OutlineItem => {
    const members = project.devices.filter((d) => d.zoneId === z.id).length;
    return { id: z.id, kind: 'zone', label: z.name, detail: `SL-T ${z.targetSL}, ${plural(members, 'device')}${z.trusted ? ', trusted' : ''}`, ref: z.id, siteId: null, children: [] };
  });
  return zones.length ? [...sites, { id: 'outline/zones', kind: 'zones', label: 'Zones', detail: plural(zones.length, 'zone'), ref: '', siteId: null, children: zones }] : sites;
}

/** The rows shown with the given items expanded, in reading order. */
export function visibleRows(tree: OutlineItem[], expanded: ReadonlySet<string>): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const walk = (items: OutlineItem[], level: number, parentId: string | null) => {
    items.forEach((item, i) => {
      rows.push({ item, level, setSize: items.length, posInSet: i + 1, parentId });
      if (item.children.length && expanded.has(item.id)) walk(item.children, level + 1, item.id);
    });
  };
  walk(tree, 1, null);
  return rows;
}

/** Type-ahead: the next row after `from` (wrapping around) whose label starts with `char`, or -1. */
export function nextMatch(rows: readonly OutlineRow[], from: number, char: string): number {
  const c = char.toLowerCase();
  for (let step = 1; step <= rows.length; step++) {
    const i = (from + step) % rows.length;
    if (rows[i].item.label.toLowerCase().startsWith(c)) return i;
  }
  return -1;
}
