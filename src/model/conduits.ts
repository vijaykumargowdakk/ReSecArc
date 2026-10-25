import type { Project } from './schema';

export interface Conduit {
  /** Zone ids, sorted so each pair appears once. */
  zones: [string, string];
  linkIds: string[];
  flowIds: string[];
}

/**
 * Lists the zone pairs that are directly connected by a link or a protocol flow.
 * Devices without a zone are left out.
 */
export function deriveConduits(project: Project): Conduit[] {
  const zoneOf = new Map(project.devices.map((d) => [d.id, d.zoneId]));
  const byKey = new Map<string, Conduit>();

  const visit = (source: string, target: string, id: string, bucket: 'linkIds' | 'flowIds') => {
    const a = zoneOf.get(source);
    const b = zoneOf.get(target);
    if (!a || !b || a === b) return;
    const zones = (a < b ? [a, b] : [b, a]) as [string, string];
    const key = zones.join('|');
    const conduit = byKey.get(key) ?? { zones, linkIds: [], flowIds: [] };
    conduit[bucket].push(id);
    byKey.set(key, conduit);
  };

  project.links.forEach((l) => visit(l.source, l.target, l.id, 'linkIds'));
  project.flows.forEach((f) => visit(f.source, f.target, f.id, 'flowIds'));
  return [...byKey.values()].sort((x, y) => x.zones.join('|').localeCompare(y.zones.join('|')));
}
