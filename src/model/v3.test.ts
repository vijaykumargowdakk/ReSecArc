import { describe, expect, it } from 'vitest';
import water from '../examples/templates/water-treatment.json';
import { loadTemplate } from '../examples/templates';
import { projectToMarkdown } from './exportDoc';
import { parseProject, serializeProject } from './io';
import { overlapping, tidyLayout } from './layout';
import { addNote, createNote, moveNote, removeNote, updateNote } from './notes';
import { addDevice, addLink, addZone, createDevice, emptyProject, removeZone } from './ops';
import { buildView } from '../ui/canvas/view';
import { NO_SELECTION } from '../store/useProject';
import { addArea, addSite, createArea, removeSite } from './structure';
import { MAX_COORDINATE, SCHEMA_VERSION, type Project } from './schema';

function load(raw: unknown): Project {
  const result = parseProject(JSON.stringify(raw));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.project;
}

describe('v2 → v3 migration', () => {
  it('adds empty notes, networks and revisions to a v2 file', () => {
    const { notes, networks, revisions, ...rest } = water;
    expect([notes, networks, revisions].every(Array.isArray)).toBe(true);
    const p = load({ ...rest, schemaVersion: 2 });
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.notes).toEqual([]);
    expect(p.networks).toEqual([]);
    expect(p.revisions).toEqual([]);
  });
});

describe('reference checks for v3 collections', () => {
  const base = () => emptyProject('Test');

  it('rejects notes and networks that point at unknown sites or zones', () => {
    const p: Project = {
      ...base(),
      notes: [{ ...createNote('nowhere', { x: 0, y: 0 }, 'n1') }],
      networks: [{ id: 'net1', name: 'Control', cidr: '10.0.0.0/24', vlan: 10, zoneId: 'zone-x', siteId: 'site-x' }],
    };
    const result = parseProject(serializeProject(p));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('Note "n1" refers to unknown site "nowhere"');
      expect(result.errors).toContain('Network "net1" refers to unknown site "site-x"');
      expect(result.errors).toContain('Network "net1" refers to unknown zone "zone-x"');
    }
  });

  it('checks the design inside each revision too', () => {
    const p = base();
    const broken = { ...p, revisions: [{ id: 'r1', name: 'Baseline', createdAt: '2026-01-01T00:00:00.000Z', design: { ...p, sites: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] } }] };
    const result = parseProject(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('Revision "Baseline": Duplicate id "a"');
  });
});

describe('notes', () => {
  it('adds, edits, moves and removes a note', () => {
    let p = emptyProject();
    const note = createNote(p.sites[0].id, { x: 10, y: 20 }, 'note-1');
    p = addNote(p, note);
    p = updateNote(p, 'note-1', { text: 'Patch window: Sundays', width: 360 });
    p = moveNote(p, 'note-1', { x: 50, y: 60 });
    expect(p.notes[0]).toMatchObject({ text: 'Patch window: Sundays', width: 360, position: { x: 50, y: 60 } });
    expect(moveNote(p, 'note-1', { x: 50, y: 60 })).toBe(p);
    expect(removeNote(p, 'note-1').notes).toEqual([]);
  });

  it('round-trips through save and open, and appears in the Markdown record', () => {
    const p = addNote(emptyProject('Notes'), { ...createNote('site-main', { x: 0, y: 0 }, 'n'), text: 'Firewall change\npending approval' });
    const again = parseProject(serializeProject(p));
    expect(again.ok && again.project).toEqual(p);
    expect(projectToMarkdown(p)).toContain('### Notes\n\n- Firewall change pending approval');
  });

  it('are removed with their site; networks of a removed site or zone are kept but unassigned', () => {
    let p = addSite(emptyProject(), 'Remote', 'site-2');
    p = addZone(p, { id: 'z', name: 'Control', color: '#0ea5e9', trusted: true, targetSL: 2 });
    p = addNote(p, createNote('site-2', { x: 0, y: 0 }, 'n'));
    p = { ...p, networks: [{ id: 'net', name: 'Remote LAN', cidr: '10.2.0.0/24', vlan: null, zoneId: 'z', siteId: 'site-2' }] };
    p = removeSite(p, 'site-2');
    expect(p.notes).toEqual([]);
    expect(p.networks[0].siteId).toBeNull();
    expect(removeZone(p, 'z').networks[0].zoneId).toBeNull();
  });
});

describe('tidy layout', () => {
  const sites = (p: Project) => p.sites.map((s) => s.id);

  it.each(['water-treatment', 'manufacturing', 'pipeline'])('keeps levels and areas and leaves no overlaps (%s)', (id) => {
    const before = loadTemplate(id);
    let after = before;
    for (const s of sites(before)) after = tidyLayout(after, s);
    expect(parseProject(serializeProject(after)).ok).toBe(true);
    for (const d of after.devices) {
      const old = before.devices.find((x) => x.id === d.id)!;
      expect(d.purdueLevel, d.label).toBe(old.purdueLevel);
      expect(d.areaId, d.label).toBe(old.areaId);
      expect(d.siteId).toBe(old.siteId);
    }
    for (const s of sites(after)) {
      const onSite = after.devices.filter((d) => d.siteId === s);
      for (let i = 0; i < onSite.length; i++) {
        for (let j = i + 1; j < onSite.length; j++) {
          expect(overlapping(onSite[i].position, onSite[j].position), `${onSite[i].label} / ${onSite[j].label}`).toBe(false);
        }
      }
    }
  });

  it('is stable: running it twice changes nothing more', () => {
    const once = tidyLayout(loadTemplate('manufacturing'), 'site-main');
    const twice = tidyLayout(once, 'site-main');
    expect(twice.devices.map((d) => d.position)).toEqual(once.devices.map((d) => d.position));
  });

  it('leaves other sites untouched', () => {
    const p = loadTemplate('pipeline');
    const [first, second] = sites(p);
    const after = tidyLayout(p, first);
    expect(after.devices.filter((d) => d.siteId === second)).toEqual(p.devices.filter((d) => d.siteId === second));
  });

  it('returns an empty site unchanged', () => {
    const p = emptyProject();
    expect(tidyLayout(p, 'site-main')).toBe(p);
  });
});

describe('hostile coordinates', () => {
  it('rejects positions and sizes beyond the canvas bound', () => {
    const p = loadTemplate('water-treatment');
    const far = { ...p, devices: p.devices.map((d, i) => (i === 0 ? { ...d, position: { x: 0, y: 1e300 } } : d)) };
    const result = parseProject(serializeProject(far));
    expect(result.ok).toBe(false);
    const wide = { ...p, notes: p.notes.map((n) => ({ ...n, width: 1e12 })) };
    expect(parseProject(serializeProject(wide)).ok).toBe(false);
  });

  it('places many stubs at the same height without hanging', () => {
    let p = addSite(emptyProject(), 'Remote', 'site-2');
    p = addDevice(p, { ...createDevice('scada', { x: 0, y: 450 }, { siteId: 'site-main', id: 'hub' }) });
    for (let i = 0; i < 40; i++) {
      p = addDevice(p, { ...createDevice('rtu', { x: i * 200, y: 750 }, { siteId: 'site-2', id: `rtu-${i}` }) });
      p = addLink(p, 'hub', `rtu-${i}`, `link-${i}`);
    }
    const stubs = buildView(p, 'site-main', NO_SELECTION, new Set()).nodes.filter((n) => n.type === 'portal');
    expect(stubs).toHaveLength(40);
    expect(new Set(stubs.map((s) => s.position.y)).size).toBe(40);
  });

  it('tidies areas at the edge of the canvas without hanging', () => {
    let p = emptyProject();
    for (let i = 0; i < 5; i++) {
      p = addArea(p, createArea('site-main', { x: MAX_COORDINATE - 100, y: 600, width: 300, height: 300 }, `A${i}`, '#0ea5e9', `a${i}`));
      p = addDevice(p, createDevice('plc', { x: MAX_COORDINATE - 50, y: 787 }, { siteId: 'site-main', id: `d${i}` }));
    }
    expect(() => tidyLayout(p, 'site-main')).not.toThrow();
  });
});
