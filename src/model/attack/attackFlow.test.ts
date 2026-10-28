import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../../examples/templates';
import { addLink } from '../ops';
import { ATTACK_FLOW_EXTENSION_ID, EXTENSION_OBJECTS, toAttackFlow, type StixObject } from './attackFlow';
import { findAttackPaths } from './paths';

// Official schemas from center-for-threat-informed-defense/attack-flow v4.1.0 (stix/); see the
// README in the fixture folder.
const STIX = join(__dirname, '__fixtures__', 'stix');
const read = (...parts: string[]) => JSON.parse(readFileSync(join(STIX, ...parts), 'utf8'));
// The OASIS files name the draft as `http://…/schema#`, which ajv does not know by that spelling.
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const schema = (...parts: string[]) => ({ ...read(...parts), $schema: DRAFT });

function validators() {
  // unicodeRegExp: false because an OASIS pattern escapes `-`, which Unicode regexes reject.
  const ajv = new Ajv2020({ strict: false, allErrors: true, unicodeRegExp: false });
  addFormats(ajv);
  for (const dir of ['common', 'sdos']) {
    for (const f of readdirSync(join(STIX, 'oasis-open', dir))) ajv.addSchema(schema('oasis-open', dir, f));
  }
  // The Attack Flow schema also refers to the timestamp schema on the OASIS master branch.
  const timestamp = schema('oasis-open', 'common', 'timestamp.json');
  ajv.addSchema({ ...timestamp, $id: 'https://raw.githubusercontent.com/oasis-open/cti-stix2-json-schemas/master/schemas/common/timestamp.json' });
  const flow = ajv.compile(schema('attack-flow-schema-2.0.0.json'));
  const base = 'http://raw.githubusercontent.com/oasis-open/cti-stix2-json-schemas/stix2.1/schemas';
  const identity = ajv.getSchema(`${base}/sdos/identity.json`)!;
  const extension = ajv.getSchema(`${base}/common/extension-definition.json`)!;
  return (o: StixObject) => {
    const validate = o.type === 'identity' ? identity : o.type === 'extension-definition' ? extension : flow;
    return validate(o) ? [] : (validate.errors ?? []).map((e) => `${o.id} ${e.instancePath} ${e.message}`);
  };
}

let n = 0;
const counter = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const now = new Date('2026-10-28T12:00:00.000Z');

function exported() {
  const project = addLink(loadTemplate('water-treatment'), 'office-ws', 'rtu-pump', 'link-bad');
  const { paths } = findAttackPaths(project);
  return { project, paths, bundle: toAttackFlow(project, paths, { uuid: counter, now }) };
}

describe('Attack Flow export', () => {
  it('copies the published extension definition exactly', () => {
    expect(EXTENSION_OBJECTS).toEqual(read('attack-flow-extension-2.0.0.json').objects);
  });

  it('passes the official Attack Flow and STIX 2.1 schemas', () => {
    const { bundle } = exported();
    const check = validators();
    expect(bundle.type).toBe('bundle');
    expect(bundle.id).toMatch(/^bundle--[0-9a-f-]{36}$/);
    expect(bundle.objects.flatMap(check)).toEqual([]);
    // The validator is live: a broken action fails.
    const action = bundle.objects.find((o) => o.type === 'attack-action')!;
    const { name: _name, ...nameless } = action;
    expect(check(nameless as StixObject).length).toBeGreaterThan(0);
    expect(check({ ...action, spec_version: '2.0' }).length).toBeGreaterThan(0);
    expect(check({ ...action, effect_refs: ['identity--00000000-0000-4000-8000-000000000001'] }).length).toBeGreaterThan(0);
  });

  it('has one attack-flow whose start_refs begin each path, and every reference resolves', () => {
    const { bundle, paths } = exported();
    const byId = new Map(bundle.objects.map((o) => [o.id, o]));
    expect(byId.size).toBe(bundle.objects.length);
    const flows = bundle.objects.filter((o) => o.type === 'attack-flow');
    expect(flows).toHaveLength(1);
    expect(flows[0]).toMatchObject({ scope: 'attack-tree', name: 'Riverbend Water Treatment (fictional demo): possible attack paths' });
    const starts = flows[0].start_refs as string[];
    expect(starts).toHaveLength(paths.length);
    for (const o of bundle.objects) {
      for (const key of ['start_refs', 'effect_refs', 'asset_refs', 'created_by_ref']) {
        for (const ref of [o[key] ?? []].flat() as string[]) expect(byId.has(ref), `${o.id} ${key} → ${ref}`).toBe(true);
      }
      if (o.type.startsWith('attack-')) expect(o.extensions).toEqual({ [ATTACK_FLOW_EXTENSION_ID]: { extension_type: 'new-sdo' } });
    }
  });

  it('turns the office → RTU path into actions labelled with ATT&CK for ICS', () => {
    const { bundle, paths } = exported();
    const byId = new Map(bundle.objects.map((o) => [o.id, o]));
    const index = paths.findIndex((p) => p.id === 'office-ws>rtu-pump');
    const start = (bundle.objects.find((o) => o.type === 'attack-flow')!.start_refs as string[])[index];
    const actions: StixObject[] = [];
    for (let at: StixObject | undefined = byId.get(start); at; at = byId.get((at.effect_refs as string[] | undefined)?.[0] ?? '')) actions.push(at);
    expect(actions.map((a) => [a.technique_id, a.tactic_id, a.name])).toEqual([
      ['T0865', 'TA0108', 'Spearphishing Attachment'],
      ['T0866', 'TA0109', 'Exploitation of Remote Services'],
      ['T0831', 'TA0105', 'Manipulation of Control'],
    ]);
    expect(byId.get((actions[1].asset_refs as string[])[0])).toMatchObject({ type: 'attack-asset', name: 'Pump station RTU' });
    expect(actions[1].description).toBe('Pump station RTU (Field RTU, L1, zone Control), reached from Office workstation.');
  });
});
