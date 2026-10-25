import { kindLabel } from './catalog';
import type { Device, Project } from './schema';

export interface SearchHit {
  device: Device;
  siteName: string;
  score: number;
}

/**
 * Finds devices whose name, kind, IP, vendor, model, serial, notes, tags or custom field values contain
 * every word of the query.
 * Name matches rank first, then matches at the start of a field.
 */
export function searchDevices(project: Project, query: string, limit = 20): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const siteName = new Map(project.sites.map((s) => [s.id, s.name]));
  const hits: SearchHit[] = [];
  for (const d of project.devices) {
    const label = d.label.toLowerCase();
    const fields = [
      label,
      kindLabel(d.type, d.variant).toLowerCase(),
      d.asset.ip,
      d.asset.vendor,
      d.asset.model,
      d.asset.serial,
      d.asset.notes,
      ...d.tags,
      ...Object.values(d.fields),
    ]
      .join(' \u0000 ')
      .toLowerCase();
    if (!words.every((w) => fields.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (label.startsWith(w)) score += 4;
      else if (label.includes(w)) score += 2;
      else score += 1;
    }
    hits.push({ device: d, siteName: siteName.get(d.siteId) ?? '', score });
  }
  return hits.sort((a, b) => b.score - a.score || a.device.label.localeCompare(b.device.label)).slice(0, limit);
}
