// Upgrades older project files to the current schema before validation.
// Works on untyped JSON: anything unexpected is passed through for the schema to reject.

export const DEFAULT_SITE = { id: 'site-main', name: 'Main site' } as const;

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function v1ToV2(p: Json): Json {
  const devices = list(p.devices).map((d) =>
    isObject(d)
      ? {
          ...d,
          variant: 'generic',
          siteId: DEFAULT_SITE.id,
          areaId: null,
          asset: { vendor: '', model: '', firmware: '', serial: '', ip: '', notes: '' },
        }
      : d,
  );
  // v1 kept protocol properties at the top level of each flow; v2 nests them under `settings`.
  const flows = list(p.flows).map((f) => {
    if (!isObject(f)) return f;
    const { id, source, target, protocol, port, ...settings } = f;
    return { id, source, target, protocol, port, settings };
  });
  return { ...p, schemaVersion: 2, sites: [{ ...DEFAULT_SITE }], areas: [], devices, flows };
}

function v2ToV3(p: Json): Json {
  return { ...p, schemaVersion: 3, notes: [], networks: [], revisions: [] };
}

const STEPS: Record<number, (p: Json) => Json> = { 1: v1ToV2, 2: v2ToV3 };

export function migrate(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  let doc = raw;
  while (typeof doc.schemaVersion === 'number' && STEPS[doc.schemaVersion]) {
    doc = STEPS[doc.schemaVersion](doc);
  }
  return doc;
}
