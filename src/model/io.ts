import { variantInfo } from './catalog';
import { migrate } from './migrate';
import { getProtocol, ruleProtocolOptions, settingsErrors } from './protocols';
import { projectSchema, SCHEMA_VERSION, type Design, type Project } from './schema';

export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2) + '\n';
}

const RULE_PROTOCOLS = new Set(ruleProtocolOptions().map((o) => o.value));

/** Checks cross-references the schema alone cannot express, in the design and in every saved revision. */
export function referenceErrors(project: Project): string[] {
  const errors = designErrors(project);
  const revisionIds = new Set<string>();
  for (const r of project.revisions) {
    if (revisionIds.has(r.id)) errors.push(`Duplicate revision id "${r.id}"`);
    revisionIds.add(r.id);
    for (const e of designErrors(r.design)) errors.push(`Revision "${r.name}": ${e}`);
  }
  return errors;
}

function designErrors(project: Design): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const all = [
    ...project.sites.map((s) => s.id),
    ...project.devices.map((d) => d.id),
    ...project.links.map((l) => l.id),
    ...project.flows.map((f) => f.id),
    ...project.zones.map((z) => z.id),
    ...project.areas.map((a) => a.id),
    ...project.notes.map((n) => n.id),
    ...project.networks.map((n) => n.id),
    ...project.fieldDefs.map((f) => f.id),
    ...project.devices.flatMap((d) => d.firewall?.rules.map((r) => r.id) ?? []),
  ];
  for (const id of all) {
    if (seen.has(id)) errors.push(`Duplicate id "${id}"`);
    seen.add(id);
  }

  const deviceIds = new Set(project.devices.map((d) => d.id));
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const siteIds = new Set(project.sites.map((s) => s.id));
  const areaById = new Map(project.areas.map((a) => [a.id, a]));

  for (const a of project.areas) {
    if (!siteIds.has(a.siteId)) errors.push(`Area "${a.id}" refers to unknown site "${a.siteId}"`);
  }
  for (const n of project.notes) {
    if (!siteIds.has(n.siteId)) errors.push(`Note "${n.id}" refers to unknown site "${n.siteId}"`);
  }
  for (const n of project.networks) {
    if (n.siteId !== null && !siteIds.has(n.siteId)) errors.push(`Network "${n.id}" refers to unknown site "${n.siteId}"`);
    if (n.zoneId !== null && !zoneIds.has(n.zoneId)) errors.push(`Network "${n.id}" refers to unknown zone "${n.zoneId}"`);
  }
  const networkIds = new Set(project.networks.map((n) => n.id));
  for (const l of project.links) {
    if (l.networkId !== null && !networkIds.has(l.networkId)) errors.push(`Link "${l.id}" refers to unknown network "${l.networkId}"`);
  }
  // A select value that is no longer one of its options is kept and shown as such, not rejected,
  // so renaming an option never makes a file unopenable.
  const fieldIds = new Set(project.fieldDefs.map((f) => f.id));
  for (const d of project.devices) {
    for (const key of Object.keys(d.fields)) {
      if (!fieldIds.has(key)) errors.push(`Device "${d.id}" has a value for unknown custom field "${key}"`);
    }
  }

  for (const d of project.devices) {
    if (!variantInfo(d.type, d.variant)) errors.push(`Device "${d.id}" has unknown ${d.type} variant "${d.variant}"`);
    if (!siteIds.has(d.siteId)) errors.push(`Device "${d.id}" refers to unknown site "${d.siteId}"`);
    if (d.zoneId !== null && !zoneIds.has(d.zoneId)) errors.push(`Device "${d.id}" refers to unknown zone "${d.zoneId}"`);
    if (d.areaId !== null) {
      const area = areaById.get(d.areaId);
      if (!area) errors.push(`Device "${d.id}" refers to unknown area "${d.areaId}"`);
      else if (area.siteId !== d.siteId) errors.push(`Device "${d.id}" is in area "${d.areaId}" on a different site`);
    }
    if (d.firewall && d.type !== 'firewall') errors.push(`Device "${d.id}" has firewall rules but is a ${d.type}`);
    if (d.type === 'firewall' && !d.firewall) errors.push(`Firewall "${d.id}" has no rule configuration`);
    for (const r of d.firewall?.rules ?? []) {
      if (!RULE_PROTOCOLS.has(r.protocol)) errors.push(`Rule "${r.id}" uses unknown protocol "${r.protocol}"`);
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
  for (const f of project.flows) {
    const def = getProtocol(f.protocol);
    if (!def) {
      errors.push(`Flow "${f.id}" uses unknown protocol "${f.protocol}"`);
      continue;
    }
    for (const e of settingsErrors(def, f.settings)) errors.push(`Flow "${f.id}": ${e}`);
    if (def.portOptional) continue;
    if (def.defaultPort === null && f.port !== null) errors.push(`Flow "${f.id}": ${def.label} is layer 2 and has no port`);
    if (def.defaultPort !== null && f.port === null) errors.push(`Flow "${f.id}": ${def.label} needs a port`);
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
  const migrated = migrate(raw);
  const version = (migrated as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version !== SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`schemaVersion: file format ${version} is not supported; this version of ConduitOT reads formats 1 to ${SCHEMA_VERSION}`],
    };
  }
  const parsed = projectSchema.safeParse(migrated);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const errors = referenceErrors(parsed.data);
  return errors.length ? { ok: false, errors } : { ok: true, project: parsed.data };
}
