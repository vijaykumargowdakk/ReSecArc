import { describe, expect, it } from 'vitest';
import { loadTemplate, TEMPLATES } from '../examples/templates';
import { createFieldDef } from './fields';
import { referenceErrors } from './io';
import { mergeSites } from './merge';
import { emptyProject } from './ops';

describe('mergeSites', () => {
  it('adds a chosen site with its devices, connections, areas and notes under fresh ids', () => {
    const target = loadTemplate('water-treatment');
    const source = loadTemplate('pipeline');
    const cs1 = source.sites.find((s) => s.name === 'Compressor station 1')!;
    const { project, summary, siteIds } = mergeSites(target, source, [cs1.id]);

    expect(referenceErrors(project)).toEqual([]);
    expect(project.sites.map((s) => s.name)).toEqual([...target.sites.map((s) => s.name), 'Compressor station 1']);
    const onSite = source.devices.filter((d) => d.siteId === cs1.id);
    expect(summary.devices).toBe(onSite.length);
    expect(project.devices.filter((d) => d.siteId === siteIds[0])).toHaveLength(onSite.length);
    // Nothing from the source keeps its id.
    const sourceIds = new Set([...source.devices, ...source.links, ...source.flows].map((x) => x.id));
    expect(project.devices.slice(target.devices.length).some((d) => sourceIds.has(d.id))).toBe(false);
    expect(project.links.slice(target.links.length).every((l) => !sourceIds.has(l.id))).toBe(true);
  });

  it('leaves out connections to sites that were not chosen and counts them', () => {
    const source = loadTemplate('pipeline');
    const cs1 = source.sites.find((s) => s.name === 'Compressor station 1')!;
    const ids = new Set(source.devices.filter((d) => d.siteId === cs1.id).map((d) => d.id));
    const crossing = [...source.links, ...source.flows].filter((e) => ids.has(e.source) !== ids.has(e.target)).length;
    expect(crossing).toBeGreaterThan(0);
    const { summary } = mergeSites(emptyProject(), source, [cs1.id]);
    expect(summary.connectionsDropped).toBe(crossing);
  });

  it('keeps connections between chosen sites', () => {
    const source = loadTemplate('pipeline');
    const { project, summary } = mergeSites(emptyProject(), source, source.sites.map((s) => s.id));
    expect(summary.connectionsDropped).toBe(0);
    expect(project.links).toHaveLength(source.links.length);
    expect(project.flows).toHaveLength(source.flows.length);
    expect(referenceErrors(project)).toEqual([]);
  });

  it('matches zones by name and adds the rest', () => {
    const target = loadTemplate('water-treatment');
    const merged = mergeSites(target, target, [target.sites[0].id]);
    // Merging a project with itself reuses every zone.
    expect(merged.summary.zonesAdded).toEqual([]);
    expect(merged.project.zones).toHaveLength(target.zones.length);
    expect(merged.summary.renamed).toEqual([{ from: target.sites[0].name, to: `${target.sites[0].name} (2)` }]);
    const copy = merged.project.devices.filter((d) => d.siteId === merged.siteIds[0]);
    const original = target.devices.find((d) => d.label === copy[0].label)!;
    expect(copy[0].zoneId).toBe(original.zoneId);

    const fromPipeline = mergeSites(target, loadTemplate('pipeline'), [loadTemplate('pipeline').sites[0].id]);
    expect(fromPipeline.summary.zonesAdded.length).toBeGreaterThan(0);
    expect(fromPipeline.project.zones.length).toBe(target.zones.length + fromPipeline.summary.zonesAdded.length);
  });

  it('brings estate-wide networks along once and reuses one with the same subnet', () => {
    const source = loadTemplate('pipeline');
    const wan = source.networks.find((n) => n.siteId === null)!;
    const cc = source.sites.find((s) => s.name === 'Control centre')!;
    const first = mergeSites(emptyProject(), source, [cc.id]);
    expect(first.project.networks.filter((n) => n.cidr === wan.cidr)).toHaveLength(1);
    const cs1 = source.sites.find((s) => s.name === 'Compressor station 1')!;
    const second = mergeSites(first.project, source, [cs1.id]);
    expect(second.project.networks.filter((n) => n.cidr === wan.cidr)).toHaveLength(1);
    expect(referenceErrors(second.project)).toEqual([]);
  });

  it('drops firewall rules that name a device left behind instead of widening them', () => {
    const source = loadTemplate('pipeline');
    // The station firewall has a rule naming the control centre's SCADA server, on another site.
    const fw = source.devices.find((d) => d.label === 'Station firewall')!;
    const others = new Set(source.devices.filter((d) => d.siteId !== fw.siteId).map((d) => d.id));
    const naming = fw.firewall!.rules.filter((r) => [r.src, r.dst].some((ep) => ep.kind === 'device' && others.has(ep.id))).length;
    expect(naming).toBeGreaterThan(0);
    const { project, summary } = mergeSites(emptyProject(), source, [fw.siteId]);
    expect(summary.rulesDropped).toBe(naming);
    const copy = project.devices.find((d) => d.label === fw.label)!;
    expect(copy.firewall!.rules).toHaveLength(fw.firewall!.rules.length - naming);
  });

  it('matches custom fields by label and kind, merging choice options', () => {
    const owner = { ...createFieldDef('Owner', 'select', 'f-src'), options: ['Ops', 'IT'] };
    const source = loadTemplate('water-treatment');
    source.fieldDefs = [owner];
    source.devices[0] = { ...source.devices[0], fields: { 'f-src': 'IT' } };
    const target = emptyProject();
    target.fieldDefs = [{ ...createFieldDef('owner', 'select', 'f-dst'), options: ['Ops'] }];
    const { project, summary } = mergeSites(target, source, [source.sites[0].id]);
    expect(summary.fieldsMatched).toEqual(['Owner']);
    expect(project.fieldDefs).toEqual([{ id: 'f-dst', label: 'owner', kind: 'select', options: ['Ops', 'IT'] }]);
    expect(project.devices.find((d) => d.label === source.devices[0].label)!.fields).toEqual({ 'f-dst': 'IT' });
    expect(referenceErrors(project)).toEqual([]);
  });

  it('produces a valid project for every template merged into every other', () => {
    for (const a of TEMPLATES) {
      for (const b of TEMPLATES) {
        const target = loadTemplate(a.id);
        const source = loadTemplate(b.id);
        const { project } = mergeSites(target, source, source.sites.map((s) => s.id));
        expect(referenceErrors(project), `${b.id} into ${a.id}`).toEqual([]);
      }
    }
  });
});
