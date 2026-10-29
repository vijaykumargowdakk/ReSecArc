import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { projectToMarkdown } from './exportDoc';
import { parseProject, serializeProject } from './io';
import { addLink } from './ops';
import { addPolicy, describePolicy, examplePolicy, setCheckEnabled, updatePolicy } from './policies';
import { changesToMarkdown, designOf, diffDesigns, saveRevision } from './revisions';
import { SCHEMA_VERSION, type Project } from './schema';
import { decodeShare, encodeShare } from './share';

function load(raw: unknown): Project {
  const result = parseProject(JSON.stringify(raw));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.project;
}

/** The water-treatment template as a format-4 file with one revision. */
function v4File() {
  const { policies: _p, disabledChecks: _d, revisions: _r, ...design } = loadTemplate('water-treatment');
  return { ...design, schemaVersion: 4, revisions: [{ id: 'r1', name: 'Baseline', createdAt: '2026-01-01T00:00:00.000Z', design: { ...design, schemaVersion: undefined } }] };
}

describe('v4 → v5 migration', () => {
  it('adds empty policies and switched-off checks to the project and its revisions', () => {
    const p = load(v4File());
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.policies).toEqual([]);
    expect(p.disabledChecks).toEqual([]);
    expect(p.revisions[0].design.policies).toEqual([]);
    expect(p.revisions[0].design.disabledChecks).toEqual([]);
  });

  it('round-trips policies through the file and a share link', async () => {
    const p = setCheckEnabled(addPolicy(loadTemplate('water-treatment'), examplePolicy('pol')), 'device-without-zone', false);
    const again = load(JSON.parse(serializeProject(p)));
    expect(again.policies).toEqual(p.policies);
    expect(again.disabledChecks).toEqual(['device-without-zone']);
    const shared = await decodeShare(await encodeShare(p));
    expect(shared.ok && shared.project.policies).toEqual(p.policies);
  });
});

describe('v5 reference checks', () => {
  it('rejects a policy naming an unknown zone or protocol, and duplicate ids', () => {
    const base = loadTemplate('water-treatment');
    const bad = addPolicy(base, { ...examplePolicy('pol'), from: { kind: 'zone', id: 'ghost' }, protocols: ['nope'] });
    const result = parseProject(serializeProject(addPolicy(bad, examplePolicy('scada'))));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('Policy "pol" from refers to unknown zone "ghost"');
      expect(result.errors).toContain('Policy "pol" uses unknown protocol "nope"');
      expect(result.errors).toContain('Duplicate id "scada"');
    }
  });

  it('keeps unknown ids in disabledChecks, which may come from a newer version', () => {
    const p = { ...loadTemplate('water-treatment'), disabledChecks: ['future-check'] };
    expect(parseProject(serializeProject(p)).ok).toBe(true);
  });
});

describe('v5 in the change diff', () => {
  it('lists policy rules added and changed, and checks switched on or off', () => {
    let p = saveRevision(addPolicy(loadTemplate('water-treatment'), examplePolicy('pol')), 'Baseline', new Date('2026-01-01T00:00:00Z'), 'rev');
    p = updatePolicy(p, 'pol', { severity: 'medium', to: { kind: 'zone', id: 'zone-control' } });
    p = addPolicy(p, { ...examplePolicy('pol-2'), name: 'No vendor access' });
    p = setCheckEnabled(p, 'device-without-zone', false);
    const changes = diffDesigns(p.revisions[0].design, designOf(p));
    expect(changes.find((c) => c.id === 'pol')!.details).toEqual([
      'severity: high → medium',
      'rule: L5, L4 ↔ L3, L2, L1, L0, links and flows → L5, L4 ↔ zone Control, links and flows',
    ]);
    expect(changes.find((c) => c.id === 'pol-2')).toMatchObject({ item: 'policy', change: 'added', label: 'No vendor access' });
    expect(changes.find((c) => c.id === 'device-without-zone')).toMatchObject({ item: 'check', label: 'OT device without a zone', details: ['switched off'] });
    expect(changesToMarkdown(changes, 'Baseline', 'Now')).toContain('## Company policies');
  });

  it('describes a rule in one line', () => {
    const p = loadTemplate('water-treatment');
    const rule = { ...examplePolicy('x'), bothWays: false, connection: 'flow' as const, protocols: ['modbus', 'dnp3'] };
    expect(describePolicy(rule, p)).toBe('L5, L4 → L3, L2, L1, L0, flows: Modbus, DNP3');
  });
});

describe('v5 in the Markdown record', () => {
  it('lists findings, company policies and switched-off checks', () => {
    let p = addPolicy(addLink(loadTemplate('water-treatment'), 'office-ws', 'rtu-pump'), examplePolicy('pol'));
    p = setCheckEnabled(p, 'device-without-zone', false);
    const md = projectToMarkdown(p, new Date('2026-10-26T00:00:00Z'));
    expect(md).toContain('## Security findings');
    expect(md).toContain('| high | IEC 62443 communication violation | Office workstation (L4) connects directly to Pump station RTU (L1) |');
    expect(md).toContain('| high | Company policy violation: No direct IT → OT |');
    expect(md).toContain('Checks switched off for this project: OT device without a zone.');
    expect(md).toContain('| No direct IT → OT | L5, L4 ↔ L3, L2, L1, L0, links and flows | high | yes |');
  });
});
