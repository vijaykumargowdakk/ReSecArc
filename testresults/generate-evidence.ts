// Builds the sample designs and machine-readable results for the TRL 6 evidence record, and
// compares what the analysis reports with the answer key below. Run from the repository root:
//   npx vite-node testresults/generate-evidence.ts
// It writes into testresults/samples/ and exits non-zero if any expectation is not met.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { loadTemplate, TEMPLATES } from '../src/examples/templates';
import { toAttackFlow, type StixObject } from '../src/model/attack/attackFlow';
import { findAttackPaths, type AttackPath } from '../src/model/attack/paths';
import { BUILTIN_CHECKS, runChecks, type Finding } from '../src/model/checks';
import { parseProject, serializeProject } from '../src/model/io';
import { addLink, newRule, updateDevice } from '../src/model/ops';
import type { FirewallRule, Project } from '../src/model/schema';
import { projectToDrawio } from '../src/export/drawio';
import { projectToHtmlReport } from '../src/export/report';

const OUT = join('testresults', 'samples');
// Fixed so the outputs are byte-identical between runs.
const AT = new Date('2026-10-31T00:00:00.000Z');

/** Puts a rule first on the IT/OT firewall. */
function firstRule(p: Project, rule: Partial<FirewallRule>): Project {
  const fw = p.devices.find((d) => d.id === 'fw-itot')!;
  return updateDevice(p, fw.id, { firewall: { ...fw.firewall!, rules: [{ ...newRule('rule-evidence-deny'), ...rule }, ...fw.firewall!.rules] } });
}

const baseline = loadTemplate('water-treatment');
const variants: Record<string, Project> = {
  // The template as shipped: a water plant with its own deliberate design gaps.
  baseline,
  // Seeded weakness: the office workstation (L4) linked straight to the pump station RTU (L1).
  insecure: addLink(baseline, 'office-ws', 'rtu-pump', 'link-bad'),
  // The same connection made through the IT/OT firewall.
  secure: addLink(addLink(baseline, 'office-ws', 'fw-itot', 'link-via-fw-1'), 'fw-itot', 'rtu-pump', 'link-via-fw-2'),
  // The baseline with a deny rule on the firewall from the jump host to the Operations zone.
  'firewall-deny': firstRule(baseline, { src: { kind: 'device', id: 'jump' }, dst: { kind: 'zone', id: 'zone-operations' }, protocol: 'any', port: null, action: 'deny' }),
};

const key = (f: Finding) => `${f.checkId}:${[...f.items.links, ...f.items.flows, ...f.items.devices].join('+')}`;
const pathChain = (p: AttackPath) => p.steps.map((s) => `${s.deviceId}:${s.technique}`).join(' > ');

// Answer key, written before this run: the expectations of src/model/checks.test.ts and
// src/model/attack/paths.test.ts (2026-10-28), restated per variant.
type Expect = { id: string; says: string; holds: (f: string[], p: AttackPath[], total: number) => boolean };
const has = (k: string) => (f: string[]) => f.includes(k);
const lacks = (k: string) => (f: string[]) => !f.includes(k);
const path = (id: string) => (p: AttackPath[]) => p.find((x) => x.id === id);
const EXPECTED: Record<string, Expect[]> = {
  baseline: [
    { id: 'B1', says: 'Unprotected zone boundary: Operations switch to Control switch', holds: has('zone-boundary-unprotected:link-ops-switch-ctrl-switch') },
    { id: 'B2', says: 'Safety controller linked to the dosing PLC without a boundary device', holds: has('sis-not-separated:link-plc-dosing-sis') },
    { id: 'B3', says: 'Plain Modbus from SCADA to the filtration PLC across zones', holds: has('insecure-protocol-cross-zone:flow-scada-filter') },
    { id: 'B4', says: 'Not flagged: DNP3 with Secure Authentication from SCADA to the RTU', holds: lacks('insecure-protocol-cross-zone:flow-scada-rtu') },
    { id: 'B5', says: 'No direct IT to OT finding', holds: (f) => !f.some((k) => k.startsWith('it-ot-direct:')) },
    {
      id: 'B6',
      says: 'Attack path office workstation > jump host > SCADA > pump RTU, labelled T0865, T0886, T0886, T1692.001',
      holds: (_f, p) => path('office-ws>rtu-pump')(p) !== undefined && pathChain(path('office-ws>rtu-pump')(p)!) === 'office-ws:T0865 > jump:T0886 > scada:T0886 > rtu-pump:T1692.001',
    },
  ],
  insecure: [
    { id: 'I1', says: 'IEC 62443 communication violation (it-ot-direct, high) on the seeded link', holds: has('it-ot-direct:link-bad') },
    { id: 'I2', says: 'The seeded link raises exactly one finding', holds: (f) => f.filter((k) => k.includes('link-bad')).length === 1 },
    { id: 'I3', says: 'Attack path goes straight from the office workstation to the RTU (T0865 > T0866)', holds: (_f, p) => pathChain(path('office-ws>rtu-pump')(p)!) === 'office-ws:T0865 > rtu-pump:T0866' },
  ],
  secure: [
    { id: 'S1', says: 'No direct IT to OT finding', holds: (f) => !f.some((k) => k.startsWith('it-ot-direct:')) },
    { id: 'S2', says: 'No finding on either link through the firewall', holds: (f) => !f.some((k) => k.includes('link-via-fw-')) },
  ],
  'firewall-deny': [
    { id: 'D1', says: 'The deny rule removes the office workstation to RTU path', holds: (_f, p) => path('office-ws>rtu-pump')(p) === undefined },
    { id: 'D2', says: 'No attack path remains', holds: (_f, _p, total) => total === 0 },
  ],
};

function attackFlowValidator() {
  const STIX = join('src', 'model', 'attack', '__fixtures__', 'stix');
  const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
  const schema = (...parts: string[]) => ({ ...JSON.parse(readFileSync(join(STIX, ...parts), 'utf8')), $schema: DRAFT });
  const ajv = new Ajv2020({ strict: false, allErrors: true, unicodeRegExp: false });
  addFormats(ajv);
  for (const dir of ['common', 'sdos']) for (const f of readdirSync(join(STIX, 'oasis-open', dir))) ajv.addSchema(schema('oasis-open', dir, f));
  const timestamp = schema('oasis-open', 'common', 'timestamp.json');
  ajv.addSchema({ ...timestamp, $id: 'https://raw.githubusercontent.com/oasis-open/cti-stix2-json-schemas/master/schemas/common/timestamp.json' });
  const flow = ajv.compile(schema('attack-flow-schema-2.0.0.json'));
  const base = 'http://raw.githubusercontent.com/oasis-open/cti-stix2-json-schemas/stix2.1/schemas';
  const identity = ajv.getSchema(`${base}/sdos/identity.json`)!;
  const extension = ajv.getSchema(`${base}/common/extension-definition.json`)!;
  return (o: StixObject) => {
    const v = o.type === 'identity' ? identity : o.type === 'extension-definition' ? extension : flow;
    return v(o) ? [] : (v.errors ?? []).map((e) => `${o.id} ${e.instancePath} ${e.message}`);
  };
}

mkdirSync(OUT, { recursive: true });
const write = (name: string, text: string) => writeFileSync(join(OUT, name), text);
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
let failed = 0;
const results: Record<string, unknown> = {};

// RA-01: the design saves and opens again unchanged.
const roundTrip: Record<string, boolean> = {};
for (const [name, p] of Object.entries(variants)) {
  const text = serializeProject(p);
  write(`water-treatment-${name}.resecarc.json`, text);
  const back = parseProject(text);
  roundTrip[name] = back.ok && serializeProject(back.project) === text;
  if (!roundTrip[name]) failed++;
}
results.ra01 = {
  design: {
    levels: [...new Set(baseline.devices.map((d) => d.purdueLevel))].sort((a, b) => b - a),
    zones: baseline.zones.map((z) => z.name),
    devices: baseline.devices.length,
    links: baseline.links.length,
    flows: baseline.flows.length,
    flowProtocols: [...new Set(baseline.flows.map((f) => f.protocol))].sort(),
    firewalls: baseline.devices.filter((d) => d.firewall).length,
    firewallRules: baseline.devices.reduce((n, d) => n + (d.firewall?.rules.length ?? 0), 0),
  },
  saveAndReopenUnchanged: roundTrip,
};

// RA-02 and RA-03: findings and attack paths per variant, against the answer key.
for (const [name, p] of Object.entries(variants)) {
  const findings = runChecks(p);
  const report = findAttackPaths(p);
  const keys = findings.map(key);
  write(`findings-${name}.json`, json(findings.map((f) => ({ key: key(f), severity: f.severity, headline: f.headline, reference: f.reference, message: f.message }))));
  write(`attack-paths-${name}.json`, json({ total: report.total, paths: report.paths.map((x) => ({ id: x.id, chain: pathChain(x), impact: x.impact })) }));
  results[name] = {
    findings: findings.length,
    attackPaths: report.total,
    expectations: EXPECTED[name].map((e) => {
      const ok = e.holds(keys, report.paths, report.total);
      if (!ok) failed++;
      return { id: e.id, expected: e.says, observed: ok ? 'as expected' : 'NOT as expected' };
    }),
  };
}

// RA-03: Attack Flow export of the insecure design, validated against the official schema.
let n = 0;
const flow = toAttackFlow(variants.insecure, findAttackPaths(variants.insecure).paths, { now: AT, uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` });
write('attack-flow-insecure.json', json(flow));
const schemaErrors = flow.objects.flatMap(attackFlowValidator());
if (schemaErrors.length) failed++;
results.attackFlow = { objects: flow.objects.length, schema: 'Attack Flow 2.0.0 (attack-flow v4.1.0)', errors: schemaErrors };

// RA-03: report and draw.io exports.
write('report-insecure.html', projectToHtmlReport(variants.insecure, AT));
write('water-treatment-baseline.drawio', projectToDrawio(baseline));

// Noise check: findings per built-in check on every shipped template.
results.templates = Object.fromEntries(
  TEMPLATES.map((t) => {
    const fs = runChecks(loadTemplate(t.id));
    return [t.id, Object.fromEntries(BUILTIN_CHECKS.map((c) => [c.id, fs.filter((f) => f.checkId === c.id).length]))];
  }),
);
results.rules = BUILTIN_CHECKS.map((c) => ({ id: c.id, title: c.title, severity: c.severity, reference: c.reference }));

write('results.json', json({ ...results, failed }));
console.log(json({ ...results, failed }));
process.exit(failed ? 1 : 0);
