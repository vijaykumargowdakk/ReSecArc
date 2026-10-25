import { projectSchema, type Project } from './schema';

export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2) + '\n';
}

/** Checks cross-references the schema alone cannot express. */
export function referenceErrors(project: Project): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const all = [
    ...project.devices.map((d) => d.id),
    ...project.links.map((l) => l.id),
    ...project.flows.map((f) => f.id),
    ...project.zones.map((z) => z.id),
    ...project.devices.flatMap((d) => d.firewall?.rules.map((r) => r.id) ?? []),
  ];
  for (const id of all) {
    if (seen.has(id)) errors.push(`Duplicate id "${id}"`);
    seen.add(id);
  }

  const deviceIds = new Set(project.devices.map((d) => d.id));
  const zoneIds = new Set(project.zones.map((z) => z.id));

  for (const d of project.devices) {
    if (d.zoneId !== null && !zoneIds.has(d.zoneId)) errors.push(`Device "${d.id}" refers to unknown zone "${d.zoneId}"`);
    if (d.firewall && d.type !== 'firewall') errors.push(`Device "${d.id}" has firewall rules but is a ${d.type}`);
    if (d.type === 'firewall' && !d.firewall) errors.push(`Firewall "${d.id}" has no rule configuration`);
    for (const r of d.firewall?.rules ?? []) {
      for (const [side, ep] of [['source', r.src], ['destination', r.dst]] as const) {
        if (ep.kind === 'zone' && !zoneIds.has(ep.id)) errors.push(`Rule "${r.id}" ${side} refers to unknown zone "${ep.id}"`);
        if (ep.kind === 'device' && !deviceIds.has(ep.id)) {
          errors.push(`Rule "${r.id}" ${side} refers to unknown device "${ep.id}"`);
        }
      }
    }
  }
  for (const e of [...project.links, ...project.flows]) {
    if (!deviceIds.has(e.source)) errors.push(`"${e.id}" starts at unknown device "${e.source}"`);
    if (!deviceIds.has(e.target)) errors.push(`"${e.id}" ends at unknown device "${e.target}"`);
    if (e.source === e.target) errors.push(`"${e.id}" connects a device to itself`);
  }
  return errors;
}

export function parseProject(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] };
  }
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const errors = referenceErrors(parsed.data);
  return errors.length ? { ok: false, errors } : { ok: true, project: parsed.data };
}
