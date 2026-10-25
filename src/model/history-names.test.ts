import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { commit, initHistory, jump, timeline } from '../store/history';
import { filterCommands, type Command } from '../ui/commands';
import { addDevice, createDevice, moveDevice, removeDevice, updateDevice } from './ops';
import { describeChange, saveRevision } from './revisions';

describe('undo step names', () => {
  const base = loadTemplate('water-treatment');

  it('names single additions, removals, edits and moves', () => {
    const plc = createDevice('plc', { x: 900, y: 787 }, { siteId: 'site-main', id: 'new' });
    expect(describeChange(base, addDevice(base, plc))).toBe('Added device PLC');
    expect(describeChange(base, removeDevice(base, 'level'))).toMatch(/^Removed device Reservoir level sensor and 1 more change$/);
    const firmware = updateDevice(base, 'plc-filter', { asset: { ...base.devices.find((d) => d.id === 'plc-filter')!.asset, firmware: 'V4.2' } });
    expect(describeChange(base, firmware)).toBe('Filtration PLC: firmware: — → V4.2');
    const y = base.devices.find((d) => d.id === 'plc-filter')!.position.y;
    expect(describeChange(base, moveDevice(base, 'plc-filter', { x: 5, y }))).toBe('Moved Filtration PLC');
  });

  it('summarises several changes of one kind and revision saves', () => {
    const ys = (id: string) => base.devices.find((d) => d.id === id)!.position.y;
    const moved = moveDevice(moveDevice(base, 'hmi', { x: 1, y: ys('hmi') }), 'scada', { x: 2, y: ys('scada') });
    expect(describeChange(base, moved)).toBe('Moved 2 devices');
    expect(describeChange(base, saveRevision(base, 'Baseline'))).toBe('Saved revision “Baseline”');
  });
});

describe('history jumps', () => {
  it('moves several steps at once and stops at either end', () => {
    const a = loadTemplate('building');
    const b = { ...a, name: 'b' };
    const c = { ...a, name: 'c' };
    let h = commit(commit(initHistory(a), b), c);
    expect(timeline(h).current).toBe(2);
    h = jump(h, -2);
    expect(h.present).toBe(a);
    expect(jump(h, 10).present).toBe(c);
    expect(jump(h, -5)).toEqual(h);
  });
});

describe('command search', () => {
  const cmd = (id: string, label: string, group = 'Edit', keywords = '', enabled = true): Command => ({ id, label, group, keywords, enabled, run: () => {} });
  const list = [cmd('svg', 'Export the diagram as SVG', 'Export', 'image'), cmd('tidy', 'Tidy the layout of this site', 'Edit', 'arrange'), cmd('undo', 'Undo', 'Edit', '', false)];

  it('matches words in labels, groups and keywords and hides disabled commands', () => {
    expect(filterCommands(list, '').map((c) => c.id)).toEqual(['svg', 'tidy']);
    expect(filterCommands(list, 'image').map((c) => c.id)).toEqual(['svg']);
    expect(filterCommands(list, 'arrange site').map((c) => c.id)).toEqual(['tidy']);
    expect(filterCommands(list, 'undo')).toEqual([]);
  });
});
