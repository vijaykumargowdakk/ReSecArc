import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { devicesToCsv, parseDeviceCsv } from './csv';
import { projectToMarkdown } from './exportDoc';
import {
  addFieldDef,
  addTag,
  createFieldDef,
  isValidDate,
  normalizeTags,
  parseTags,
  removeFieldDef,
  removeTag,
  setDeviceField,
  setTags,
  tagCounts,
} from './fields';
import { dimmedIds, NO_FILTER } from './filter';
import { parseProject, serializeProject } from './io';
import { searchDevices } from './search';
import type { Project } from './schema';

function plant(): Project {
  let p = loadTemplate('water-treatment');
  p = addFieldDef(p, createFieldDef('Owner', 'select', 'owner'));
  p = { ...p, fieldDefs: p.fieldDefs.map((f) => (f.id === 'owner' ? { ...f, options: ['OT team', 'IT team'] } : f)) };
  p = addFieldDef(p, createFieldDef('Support ends', 'date', 'eos'));
  p = setDeviceField(p, ['plc-filter', 'plc-dosing'], 'owner', 'OT team');
  p = setDeviceField(p, ['plc-filter'], 'eos', '2027-03-31');
  p = setTags(p, 'plc-filter', ['patch-pending', ' Line 1 ']);
  return addTag(p, ['plc-dosing', 'scada'], 'Patch-Pending');
}

describe('tags', () => {
  it('normalises spacing, duplicates (ignoring case) and empties', () => {
    expect(normalizeTags([' a ', 'A', '', 'b  c', 'b c'])).toEqual(['a', 'b c']);
    expect(parseTags('x; y, ;z')).toEqual(['x', 'y', 'z']);
    expect(normalizeTags(Array.from({ length: 80 }, (_, i) => `t${i}`))).toHaveLength(50);
  });

  it('adds, removes and counts tags across devices', () => {
    const p = plant();
    expect(p.devices.find((d) => d.id === 'plc-filter')!.tags).toEqual(['patch-pending', 'Line 1']);
    expect(tagCounts(p)).toEqual([
      { tag: 'Patch-Pending', count: 3 },
      { tag: 'Line 1', count: 1 },
    ]);
    const removed = removeTag(p, ['plc-filter', 'plc-dosing', 'scada'], 'PATCH-PENDING');
    expect(tagCounts(removed)).toEqual([{ tag: 'Line 1', count: 1 }]);
  });

  it('filters and searches by tag and custom field value', () => {
    const p = plant();
    const dim = dimmedIds(p, { ...NO_FILTER, tags: ['patch-pending'] });
    expect(dim.has('plc-filter')).toBe(false);
    expect(dim.has('scada')).toBe(false);
    expect(dim.has('hmi')).toBe(true);
    expect(searchDevices(p, 'ot team').map((h) => h.device.id).sort()).toEqual(['plc-dosing', 'plc-filter']);
    expect(searchDevices(p, 'line 1').map((h) => h.device.id)).toEqual(['plc-filter']);
  });
});

describe('custom fields', () => {
  it('sets and clears values, and removing a field removes its values', () => {
    let p = plant();
    expect(p.devices.find((d) => d.id === 'plc-filter')!.fields).toEqual({ owner: 'OT team', eos: '2027-03-31' });
    p = setDeviceField(p, ['plc-filter'], 'eos', '');
    expect(p.devices.find((d) => d.id === 'plc-filter')!.fields).toEqual({ owner: 'OT team' });
    p = removeFieldDef(p, 'owner');
    expect(p.devices.every((d) => !('owner' in d.fields))).toBe(true);
    expect(parseProject(serializeProject(p)).ok).toBe(true);
  });

  it('checks dates', () => {
    expect(isValidDate('2027-03-31')).toBe(true);
    expect(isValidDate('2027-02-30')).toBe(false);
    expect(isValidDate('31/03/2027')).toBe(false);
  });

  it('exports tags and fields to CSV and imports them back', () => {
    const p = plant();
    const csv = devicesToCsv(p);
    expect(csv.split('\r\n')[0]).toMatch(/,tags,field:Owner,field:Support ends$/);
    const empty = { ...p, devices: [], links: [], flows: [] };
    const rows = parseDeviceCsv(empty, csv, 'site-main');
    expect(rows.flatMap((r) => r.errors)).toEqual([]);
    const filter = rows.find((r) => r.name === 'Filtration PLC')!.device!;
    expect(filter.tags).toEqual(['patch-pending', 'Line 1']);
    expect(filter.fields).toEqual({ owner: 'OT team', eos: '2027-03-31' });
  });

  it('reports unknown field columns and bad dates on import', () => {
    const rows = parseDeviceCsv(plant(), 'name,type,field:Cabinet,field:Support ends\nNew PLC,plc,C-12,next year\n', 'site-main');
    expect(rows[0].errors).toEqual([
      'no custom field named "cabinet"; add it under Custom fields first',
      'Support ends must be a date like 2027-03-31',
    ]);
  });

  it('adds tags and a custom field table to the Markdown record', () => {
    const md = projectToMarkdown(plant());
    expect(md).toContain('| Device | Owner | Support ends |');
    expect(md).toContain('| Filtration PLC | OT team | 2027-03-31 |');
    expect(md).toMatch(/\| Filtration PLC \|.*\| patch-pending, Line 1 \|/);
  });
});
