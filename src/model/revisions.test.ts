import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { parseProject, serializeProject } from './io';
import { addRule, addZone, moveDevice, newRule, removeDevice, replaceFlow, updateDevice, updateZone } from './ops';
import { changesToMarkdown, designOf, diffDesigns, removeRevision, renameRevision, restoreRevision, saveRevision } from './revisions';
import type { Project } from './schema';

const AT = new Date('2026-10-01T09:30:00.000Z');

function baseline(): Project {
  return saveRevision(loadTemplate('water-treatment'), 'Baseline', AT, 'rev-1');
}

describe('revisions', () => {
  it('saves a copy of the design without nesting revisions', () => {
    const p = saveRevision(baseline(), 'Second', AT, 'rev-2');
    expect(p.revisions.map((r) => r.name)).toEqual(['Baseline', 'Second']);
    expect(p.revisions[1].design).not.toHaveProperty('revisions');
    expect(p.revisions[1].design).not.toHaveProperty('schemaVersion');
    expect(p.revisions[0].createdAt).toBe('2026-10-01T09:30:00.000Z');
    const again = parseProject(serializeProject(p));
    expect(again.ok && again.project).toEqual(p);
  });

  it('is unaffected by later edits to the live design', () => {
    const p = updateDevice(baseline(), 'plc-filter', { label: 'Renamed' });
    expect(p.revisions[0].design.devices.find((d) => d.id === 'plc-filter')!.label).toBe('Filtration PLC');
  });

  it('names an unnamed revision, renames and deletes', () => {
    let p = saveRevision(baseline(), '  ', AT, 'rev-2');
    expect(p.revisions[1].name).toBe('Revision 2');
    p = renameRevision(p, 'rev-2', 'After audit');
    expect(p.revisions[1].name).toBe('After audit');
    expect(removeRevision(p, 'rev-1').revisions.map((r) => r.id)).toEqual(['rev-2']);
  });

  it('restores a revision and keeps the revision list', () => {
    const edited = removeDevice(baseline(), 'plc-filter');
    const restored = restoreRevision(edited, 'rev-1');
    expect(restored.devices).toEqual(baseline().devices);
    expect(restored.revisions).toEqual(edited.revisions);
    expect(restoreRevision(edited, 'missing')).toBe(edited);
  });
});

describe('diff', () => {
  it('finds nothing between a design and its own revision', () => {
    const p = baseline();
    expect(diffDesigns(p.revisions[0].design, designOf(p))).toEqual([]);
  });

  it('lists additions, removals and field changes with readable details', () => {
    let p = baseline();
    p = addZone(p, { id: 'zone-new', name: 'Vendor', color: '#db2777', trusted: false, targetSL: 1 });
    p = updateDevice(p, 'plc-filter', { zoneId: 'zone-new', asset: { ...p.devices.find((d) => d.id === 'plc-filter')!.asset, firmware: 'V4.2' } });
    p = removeDevice(p, 'plc-dosing');
    const flow = p.flows.find((f) => f.protocol === 'modbus')!;
    p = replaceFlow(p, { ...flow, port: 802, settings: { ...flow.settings, variant: 'tls' } });
    const changes = diffDesigns(p.revisions[0].design, designOf(p));
    const find = (item: string, id: string) => changes.find((c) => c.item === item && c.id === id);

    expect(find('zone', 'zone-new')).toMatchObject({ change: 'added', label: 'Vendor' });
    expect(find('device', 'plc-filter')).toMatchObject({ change: 'changed', siteId: 'site-main' });
    expect(find('device', 'plc-filter')!.details).toEqual(['firmware: — → V4.2', 'zone: Control → Vendor']);
    expect(find('device', 'plc-dosing')).toMatchObject({ change: 'removed', label: 'Chemical dosing PLC' });
    expect(changes.filter((c) => c.change === 'removed' && c.item === 'flow').length).toBeGreaterThan(0);
    expect(find('flow', flow.id)!.details).toEqual(['port: 502 → 802', 'variant: tcp → tls']);
  });

  it('marks pure moves so they can be hidden', () => {
    const start = baseline();
    const p = moveDevice(start, 'plc-filter', { x: 999, y: start.devices.find((d) => d.id === 'plc-filter')!.position.y });
    const [c] = diffDesigns(p.revisions[0].design, designOf(p));
    expect(c).toMatchObject({ item: 'device', change: 'changed', moveOnly: true, details: ['moved on the canvas'] });
  });

  it('does not report devices when only a zone was renamed', () => {
    const p = updateZone(baseline(), 'zone-control', { name: 'Basic control' });
    const changes = diffDesigns(p.revisions[0].design, designOf(p));
    expect(changes).toEqual([expect.objectContaining({ item: 'zone', details: ['name: Control → Basic control'] })]);
  });

  it('lists firewall rule changes as rules, not as device changes', () => {
    const p = addRule(baseline(), 'fw-itot', { ...newRule('rule-new'), action: 'allow', protocol: 'opcua', port: 4840 });
    const changes = diffDesigns(p.revisions[0].design, designOf(p));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ item: 'rule', change: 'added' });
    expect(changes[0].label).toMatch(/rule \d+: allow opcua\/4840$/);
  });

  it('writes a Markdown change record', () => {
    const p = removeDevice(baseline(), 'plc-dosing');
    const md = changesToMarkdown(diffDesigns(p.revisions[0].design, designOf(p)), 'Baseline', 'Current');
    expect(md).toMatch(/^# Changes: Baseline → Current\n/);
    expect(md).toContain('## Devices\n\n- **removed**: Chemical dosing PLC');
    expect(changesToMarkdown([], 'A', 'B')).toContain('No changes.');
  });
});
