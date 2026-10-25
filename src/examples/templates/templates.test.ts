import { describe, expect, it } from 'vitest';
import { parseProject, serializeProject } from '../../model/io';
import { addressReport, networkSummaries } from '../../model/ipam';
import { loadTemplate, TEMPLATES } from './index';

describe('templates', () => {
  it.each(TEMPLATES.map((t) => t.id))('%s loads, validates and round-trips', (id) => {
    const project = loadTemplate(id);
    expect(project.devices.length).toBeGreaterThan(5);
    expect(project.name).toMatch(/fictional/i);
    const again = parseProject(serializeProject(project));
    expect(again.ok && again.project).toEqual(project);
  });

  it('includes a multi-site template and one with areas', () => {
    expect(loadTemplate('pipeline').sites.length).toBeGreaterThan(1);
    const line = loadTemplate('manufacturing');
    expect(line.areas.length).toBe(2);
    expect(line.devices.filter((d) => d.areaId !== null).length).toBeGreaterThan(4);
  });

  it('uses every protocol at least once across the templates', () => {
    const used = new Set(TEMPLATES.flatMap((t) => loadTemplate(t.id).flows.map((f) => f.protocol)));
    for (const p of ['modbus', 'dnp3', 'enip', 'profinet', 'opcua', 'iec104', 'mms', 'goose', 'bacnet', 's7', 'mqtt', 'custom']) {
      expect(used, p).toContain(p);
    }
  });

  it.each(TEMPLATES.map((t) => t.id))('%s has a consistent IP plan', (id) => {
    const project = loadTemplate(id);
    expect(project.networks.length).toBeGreaterThan(1);
    expect([...addressReport(project).issues.values()].flat()).toEqual([]);
    for (const s of networkSummaries(project)) {
      expect(s.error, s.network.name).toBeNull();
      expect(s.overlaps, s.network.name).toEqual([]);
      expect(s.vlanClashes, s.network.name).toEqual([]);
    }
  });
});
