// Project-specific custom fields on devices (owner, cabinet, support end date…) and free tags.
import { newId } from './ops';
import type { Device, FieldDef, Project } from './schema';

export const MAX_TAGS = 50;
export const FIELD_KINDS = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choice list' },
] as const;

export function createFieldDef(label: string, kind: FieldDef['kind'] = 'text', id = newId('field')): FieldDef {
  return { id, label: label.trim().slice(0, 60) || 'Field', kind, options: [] };
}

export function addFieldDef(project: Project, def: FieldDef): Project {
  return { ...project, fieldDefs: [...project.fieldDefs, def] };
}

export function updateFieldDef(project: Project, id: string, patch: Partial<Omit<FieldDef, 'id'>>): Project {
  return { ...project, fieldDefs: project.fieldDefs.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

/** Removes a field definition and every device's value for it. */
export function removeFieldDef(project: Project, id: string): Project {
  return {
    ...project,
    fieldDefs: project.fieldDefs.filter((f) => f.id !== id),
    devices: project.devices.map((d) => (id in d.fields ? { ...d, fields: withoutKey(d.fields, id) } : d)),
  };
}

export function countFieldValues(project: Project, id: string): number {
  return project.devices.filter((d) => (d.fields[id] ?? '') !== '').length;
}

function withoutKey(fields: Record<string, string>, key: string): Record<string, string> {
  const next = { ...fields };
  delete next[key];
  return next;
}

/** Sets one field on one device; an empty value removes the entry. */
export function setDeviceField(project: Project, deviceIds: readonly string[], fieldId: string, value: string): Project {
  const ids = new Set(deviceIds);
  return {
    ...project,
    devices: project.devices.map((d) => {
      if (!ids.has(d.id)) return d;
      return { ...d, fields: value === '' ? withoutKey(d.fields, fieldId) : { ...d.fields, [fieldId]: value } };
    }),
  };
}

/** Trims, drops empties and case-insensitive duplicates (keeping the first spelling), and caps the count. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out.slice(0, MAX_TAGS);
}

/** Splits "a; b, c" as typed in a table cell or CSV column. */
export function parseTags(text: string): string[] {
  return normalizeTags(text.split(/[;,]/));
}

export function setTags(project: Project, deviceId: string, tags: readonly string[]): Project {
  return { ...project, devices: project.devices.map((d) => (d.id === deviceId ? { ...d, tags: normalizeTags(tags) } : d)) };
}

export function addTag(project: Project, deviceIds: readonly string[], tag: string): Project {
  const ids = new Set(deviceIds);
  return { ...project, devices: project.devices.map((d) => (ids.has(d.id) ? { ...d, tags: normalizeTags([...d.tags, tag]) } : d)) };
}

export function removeTag(project: Project, deviceIds: readonly string[], tag: string): Project {
  const ids = new Set(deviceIds);
  const key = tag.toLowerCase();
  return {
    ...project,
    devices: project.devices.map((d) => (ids.has(d.id) ? { ...d, tags: d.tags.filter((t) => t.toLowerCase() !== key) } : d)),
  };
}

/** Every tag in use with how many devices carry it, most used first. */
export function tagCounts(project: Pick<Project, 'devices'>): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const d of project.devices) {
    for (const t of d.tags) {
      const entry = counts.get(t.toLowerCase()) ?? { tag: t, count: 0 };
      entry.count++;
      counts.set(t.toLowerCase(), entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const hasTag = (d: Device, tag: string) => d.tags.some((t) => t.toLowerCase() === tag.toLowerCase());

/** A date field value must be a real calendar date written YYYY-MM-DD. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The text shown for a field value, noting a choice that is no longer in the list. */
export function displayValue(def: FieldDef, value: string | undefined): string {
  if (!value) return '';
  return def.kind === 'select' && !def.options.includes(value) ? `${value} (not in the list)` : value;
}
