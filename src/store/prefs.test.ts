import { describe, expect, it } from 'vitest';
import { PANEL_LIMITS, readPrefs, sectionKey } from './prefs';

describe('display preferences', () => {
  it('starts with both panels open at the layout width, nothing folded, default text size', () => {
    const prefs = readPrefs(null);
    expect(prefs.panels).toEqual({ palette: { open: true, width: null }, inspector: { open: true, width: null } });
    expect(prefs.collapsed).toEqual([]);
    expect(prefs.textSize).toBe(1);
  });

  it('reads stored panels, folded sections and text size', () => {
    const prefs = readPrefs(
      JSON.stringify({ panels: { palette: { open: false, width: 300 }, inspector: { open: true, width: 420 } }, collapsed: ['section:Zones'], textSize: 1.3 }),
    );
    expect(prefs.panels.palette).toEqual({ open: false, width: 300 });
    expect(prefs.panels.inspector).toEqual({ open: true, width: 420 });
    expect(prefs.collapsed).toEqual(['section:Zones']);
    expect(prefs.textSize).toBe(1.3);
  });

  it('keeps stored widths within the limits and ignores values it does not know', () => {
    const prefs = readPrefs(
      JSON.stringify({ panels: { palette: { width: 5 }, inspector: { width: 1e9, open: 'no' } }, collapsed: ['a', 3, null], textSize: 4 }),
    );
    expect(prefs.panels.palette).toEqual({ open: true, width: PANEL_LIMITS.palette.min });
    expect(prefs.panels.inspector).toEqual({ open: true, width: PANEL_LIMITS.inspector.max });
    expect(prefs.collapsed).toEqual(['a']);
    expect(prefs.textSize).toBe(1);
  });

  it('falls back to the defaults when the stored value is not JSON', () => {
    expect(readPrefs('{oops').panels.palette.open).toBe(true);
  });

  it('gives a section one key whatever count its title shows', () => {
    expect(sectionKey('section', 'Devices (3)')).toBe(sectionKey('section', 'Devices (12)'));
    expect(sectionKey('section', 'Zones')).not.toBe(sectionKey('palette', 'Zones'));
  });
});
