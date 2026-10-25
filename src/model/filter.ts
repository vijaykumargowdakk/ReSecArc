import { hasTag } from './fields';
import type { DeviceType, Project, PurdueLevel } from './schema';

export interface Filter {
  zones: string[];
  types: DeviceType[];
  levels: PurdueLevel[];
  protocols: string[];
  /** A device matches when it carries any of these tags (compared without case). */
  tags: string[];
}

export const NO_FILTER: Filter = { zones: [], types: [], levels: [], protocols: [], tags: [] };

export function isFiltering(f: Filter): boolean {
  return f.zones.length + f.types.length + f.levels.length + f.protocols.length + f.tags.length > 0;
}

/**
 * Ids of devices, links and flows that do NOT match the filter. The canvas dims them rather than
 * hiding them, so the layout stays readable. `zones` may include "" for devices without a zone.
 */
export function dimmedIds(project: Project, f: Filter): Set<string> {
  const dimmed = new Set<string>();
  if (!isFiltering(f)) return dimmed;

  const flowMatches = (protocol: string) => f.protocols.length === 0 || f.protocols.includes(protocol);
  const onMatchingFlow = new Set<string>();
  for (const flow of project.flows) {
    if (flowMatches(flow.protocol)) {
      onMatchingFlow.add(flow.source);
      onMatchingFlow.add(flow.target);
    }
  }

  for (const d of project.devices) {
    const ok =
      (f.zones.length === 0 || f.zones.includes(d.zoneId ?? '')) &&
      (f.types.length === 0 || f.types.includes(d.type)) &&
      (f.levels.length === 0 || f.levels.includes(d.purdueLevel)) &&
      (f.protocols.length === 0 || onMatchingFlow.has(d.id)) &&
      (f.tags.length === 0 || f.tags.some((t) => hasTag(d, t)));
    if (!ok) dimmed.add(d.id);
  }
  for (const l of project.links) {
    if (dimmed.has(l.source) || dimmed.has(l.target)) dimmed.add(l.id);
  }
  for (const flow of project.flows) {
    if (!flowMatches(flow.protocol) || dimmed.has(flow.source) || dimmed.has(flow.target)) dimmed.add(flow.id);
  }
  return dimmed;
}
