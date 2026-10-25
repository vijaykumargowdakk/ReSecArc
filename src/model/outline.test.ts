import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { arrowDirection, nearestInDirection, type Spot } from './direction';
import { dimmedIds } from './filter';
import { addLink, updateLink } from './ops';
import { buildOutline, nextMatch, visibleRows, type OutlineItem } from './outline';
import { addArea } from './structure';

const find = (items: OutlineItem[], id: string): OutlineItem | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const hit = find(item.children, id);
    if (hit) return hit;
  }
  return undefined;
};

describe('outline tree', () => {
  const base = loadTemplate('water-treatment');

  it('nests sites, Purdue levels, devices and their connections, with zones last', () => {
    const tree = buildOutline(base);
    expect(tree.map((i) => i.label)).toEqual(['Main site', 'Zones']);
    const site = tree[0];
    expect(site.detail).toBe('19 devices');
    expect(site.children.map((i) => i.label)).toEqual([
      'L5 Enterprise network',
      'L4 Business planning & logistics',
      'L3.5 Industrial DMZ',
      'L3 Site operations',
      'L2 Supervisory control',
      'L1 Basic control',
      'L0 Physical process',
      'Notes',
    ]);
    const plc = find(tree, 'plc-filter')!;
    expect(plc.detail).toBe('Modular PLC, Control zone');
    expect(plc.children.map((i) => `${i.label} | ${i.detail}`)).toEqual([
      'Link to Control switch | Ethernet, no ports',
      'Link to Turbidity sensor | Serial, no ports',
      'Modbus RW from Filtration HMI | port 502',
      'Modbus R from SCADA server | port 502',
    ]);
    // A link is listed under both ends with distinct ids.
    expect(find(tree, 'ctrl-switch/link-ctrl-switch-plc-filter')?.label).toBe('Link to Filtration PLC');
    expect(find(tree, 'outline/zones')!.children.find((z) => z.label === 'Control')?.detail).toBe('SL-T 3, 8 devices, trusted');
  });

  it('shows ports and VLANs from the device’s side, areas, and peers on other sites', () => {
    let p = updateLink(base, 'link-ctrl-switch-plc-filter', { sourcePort: 'Gi1/0/3', targetPort: 'X1', vlans: [20] });
    p = { ...p, sites: [...p.sites, { id: 'site-b', name: 'Pump house' }], devices: p.devices.map((d) => (d.id === 'level' ? { ...d, siteId: 'site-b' } : d)) };
    p = addLink(p, 'plc-filter', 'level', 'remote');
    p = addArea(p, { id: 'area-1', siteId: 'site-main', name: 'Filtration', color: '#0f766e', rect: { x: 0, y: 0, width: 10, height: 10 }, collapsed: false, locked: false });
    const tree = buildOutline(p);
    expect(find(tree, 'plc-filter/link-ctrl-switch-plc-filter')?.detail).toBe('Ethernet, port X1 to Gi1/0/3, VLAN 20');
    expect(find(tree, 'plc-filter/remote')?.label).toBe('Link to Reservoir level sensor (Pump house site)');
    expect(find(tree, 'site-main/areas')?.children.map((a) => `${a.label}: ${a.detail}`)).toEqual(['Filtration: 0 devices']);
    expect(tree.map((i) => i.label)).toEqual(['Main site', 'Pump house', 'Zones']);
  });

  it('leaves out what the filter hides, and levels left empty', () => {
    const hidden = dimmedIds(base, { zones: [], types: [], levels: [1], protocols: [], tags: [] });
    const site = buildOutline(base, hidden)[0];
    expect(site.children.map((i) => i.label)).toEqual(['L1 Basic control', 'Notes']);
    expect(site.detail).toBe('4 devices');
    // Links to filtered-out devices are hidden too.
    expect(find([site], 'plc-filter')!.children).toEqual([]);
  });
});

describe('outline rows', () => {
  const tree = buildOutline(loadTemplate('water-treatment'));

  it('lists only expanded branches with level, set size and position', () => {
    expect(visibleRows(tree, new Set()).map((r) => r.item.id)).toEqual(['site-main', 'outline/zones']);
    const rows = visibleRows(tree, new Set(['site-main', 'site-main/level-1']));
    const plc = rows.find((r) => r.item.id === 'plc-filter')!;
    // L1 devices are sorted by name: Chemical dosing PLC, Dosing safety controller, Filtration PLC, Pump station RTU.
    expect(plc).toMatchObject({ level: 3, parentId: 'site-main/level-1', setSize: 4, posInSet: 3 });
    expect(rows.at(-1)!.item.id).toBe('outline/zones');
  });

  it('jumps to the next label starting with a letter, wrapping round', () => {
    const rows = visibleRows(tree, new Set(['site-main', 'site-main/level-1']));
    const first = nextMatch(rows, 0, 'f');
    expect(rows[first].item.label).toBe('Filtration PLC');
    expect(nextMatch(rows, first, 'F')).toBe(first);
    expect(rows[nextMatch(rows, rows.length - 1, 'm')].item.label).toBe('Main site');
    expect(nextMatch(rows, 0, 'q')).toBe(-1);
  });
});

describe('nearest device in a direction', () => {
  //  a . b
  //  . o c
  //  d . .
  const spots: Spot[] = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 200, y: 0 },
    { id: 'c', x: 200, y: 100 },
    { id: 'd', x: 0, y: 200 },
  ];
  const o = { x: 100, y: 100 };

  it('picks the closest device that way, preferring ones in line', () => {
    expect(nearestInDirection(o, spots, 'right')).toBe('c');
    expect(nearestInDirection(o, spots, 'down')).toBe('d');
    // a and b are both 45° off upwards; a comes first.
    expect(nearestInDirection(o, spots, 'up')).toBe('a');
    expect(nearestInDirection({ x: 200, y: 100 }, spots, 'up')).toBe('b');
    expect(nearestInDirection({ x: 200, y: 100 }, spots, 'left')).toBe('a');
  });

  it('falls back to devices further off the line, and returns null when nothing is there', () => {
    expect(nearestInDirection({ x: 0, y: 0 }, [{ id: 'far', x: 50, y: 400 }], 'right')).toBe('far');
    expect(nearestInDirection({ x: 0, y: 0 }, [{ id: 'near-line', x: 300, y: 20 }, { id: 'off', x: 100, y: 120 }], 'right')).toBe('near-line');
    expect(nearestInDirection({ x: 300, y: 300 }, spots, 'right')).toBeNull();
    expect(nearestInDirection(o, [], 'left')).toBeNull();
    // A device at the same spot is not "in a direction".
    expect(nearestInDirection(o, [{ id: 'same', x: 100, y: 100 }], 'up')).toBeNull();
  });

  it('reads arrow keys', () => {
    expect(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].map(arrowDirection)).toEqual(['up', 'down', 'left', 'right', null]);
  });
});
