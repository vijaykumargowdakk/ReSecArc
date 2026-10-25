import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { buildView, portalId } from '../ui/canvas/view';
import { NO_SELECTION } from '../store/useProject';
import { areaAt, boundsOf } from './areas';
import { dimmedIds, NO_FILTER } from './filter';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, emptyProject, moveDevice, updateDevice } from './ops';
import { laneTop, NODE_WIDTH } from './purdue';
import { searchDevices } from './search';
import type { Project } from './schema';
import { addArea, addSite, canRemoveSite, createArea, moveArea, moveDevicesToSite, removeArea, removeSite, updateArea } from './structure';

const MAIN = 'site-main';

function plant(): Project {
  let p = addSite(emptyProject(), 'Pump station', 'site-b');
  p = addDevice(p, createDevice('scada', { x: 100, y: laneTop(3) + 37 }, { siteId: MAIN, id: 'scada' }));
  p = addDevice(p, createDevice('hmi', { x: 100, y: laneTop(2) + 37 }, { siteId: MAIN, id: 'hmi' }));
  p = addDevice(p, createDevice('plc', { x: 100, y: laneTop(1) + 37 }, { siteId: MAIN, id: 'plc1' }));
  p = addDevice(p, createDevice('plc', { x: 350, y: laneTop(1) + 37 }, { siteId: MAIN, id: 'plc2' }));
  p = addDevice(p, createDevice('rtu', { x: 100, y: laneTop(1) + 37 }, { siteId: 'site-b', id: 'rtu' }));
  p = updateDevice(p, 'rtu', { label: 'Remote pump RTU', asset: { vendor: 'Acme', model: 'R-200', firmware: '', serial: '', ip: '10.9.0.5', notes: '' } });
  p = addLink(p, 'scada', 'hmi', 'l-scada-hmi');
  p = addLink(p, 'hmi', 'plc1', 'l-hmi-plc1');
  p = addLink(p, 'hmi', 'plc2', 'l-hmi-plc2');
  p = addLink(p, 'plc1', 'plc2', 'l-plc1-plc2');
  p = addFlow(p, defaultFlow('modbus', 'hmi', 'plc1', 'f-hmi-plc1'));
  p = addFlow(p, defaultFlow('modbus', 'hmi', 'plc2', 'f-hmi-plc2'));
  p = addFlow(p, defaultFlow('dnp3', 'scada', 'rtu', 'f-scada-rtu'));
  return p;
}

const cellRect = { x: 50, y: laneTop(1) - 10, width: 560, height: 140 };

describe('sites', () => {
  it('only removes empty, non-last sites', () => {
    const p = plant();
    expect(canRemoveSite(p, 'site-b')).toBe(false);
    expect(removeSite(p, 'site-b')).toBe(p);
    const moved = moveDevicesToSite(p, ['rtu'], MAIN);
    expect(canRemoveSite(moved, 'site-b')).toBe(true);
    expect(removeSite(moved, 'site-b').sites.map((s) => s.id)).toEqual([MAIN]);
    expect(canRemoveSite(removeSite(moved, 'site-b'), MAIN)).toBe(false);
  });
});

describe('areas', () => {
  it('assigns devices by their centre and follows moves', () => {
    let p = addArea(plant(), createArea(MAIN, cellRect, 'Cell 1', '#0ea5e9', 'cell'));
    const area = (id: string) => p.devices.find((d) => d.id === id)!.areaId;
    expect([area('plc1'), area('plc2'), area('hmi'), area('rtu')]).toEqual(['cell', 'cell', null, null]);
    p = moveDevice(p, 'plc2', { x: 900, y: laneTop(1) + 37 });
    expect(area('plc2')).toBeNull();
    p = addDevice(p, createDevice('sensor', { x: 300, y: laneTop(1) + 37 }, { siteId: MAIN, id: 's1' }));
    expect(area('s1')).toBe('cell');
    expect(areaAt(p, 'site-b', { x: 300, y: laneTop(1) + 37 })).toBeNull();
  });

  it('moves member devices with the area and keeps them inside', () => {
    let p = addArea(plant(), createArea(MAIN, cellRect, 'Cell 1', '#0ea5e9', 'cell'));
    p = moveArea(p, 'cell', { x: cellRect.x + 200, y: cellRect.y });
    expect(p.devices.find((d) => d.id === 'plc1')!.position.x).toBe(300);
    expect(p.devices.find((d) => d.id === 'plc1')!.areaId).toBe('cell');
    expect(p.devices.find((d) => d.id === 'hmi')!.position.x).toBe(100);
  });

  it('re-evaluates membership on resize and frees devices on removal', () => {
    let p = addArea(plant(), createArea(MAIN, cellRect, 'Cell 1', '#0ea5e9', 'cell'));
    p = updateArea(p, 'cell', { rect: { ...cellRect, width: 260 } });
    expect(p.devices.filter((d) => d.areaId === 'cell').map((d) => d.id)).toEqual(['plc1']);
    p = removeArea(p, 'cell');
    expect(p.devices.every((d) => d.areaId === null)).toBe(true);
  });

  it('frames a group of devices', () => {
    const r = boundsOf([{ x: 100, y: 100 }, { x: 400, y: 300 }], 30);
    expect(r.x).toBe(70);
    expect(r.x + r.width).toBe(400 + 190 + 30);
  });
});

describe('search', () => {
  it('matches every word across name, kind, IP and vendor, best names first', () => {
    const p = plant();
    expect(searchDevices(p, 'pump').map((h) => h.device.id)).toEqual(['rtu']);
    expect(searchDevices(p, '10.9').map((h) => h.device.id)).toEqual(['rtu']);
    expect(searchDevices(p, 'acme rtu')[0].siteName).toBe('Pump station');
    expect(searchDevices(p, 'plc').map((h) => h.device.id)).toEqual(['plc1', 'plc2']);
    expect(searchDevices(p, '   ')).toEqual([]);
  });
});

describe('filters', () => {
  it('dims non-matching devices and the edges that touch them', () => {
    const p = plant();
    expect(dimmedIds(p, NO_FILTER).size).toBe(0);
    const byType = dimmedIds(p, { ...NO_FILTER, types: ['plc'] });
    expect(byType.has('hmi')).toBe(true);
    expect(byType.has('plc1')).toBe(false);
    expect(byType.has('l-plc1-plc2')).toBe(false);
    expect(byType.has('l-hmi-plc1')).toBe(true);
  });

  it('by protocol keeps only matching flows and their endpoints', () => {
    const dim = dimmedIds(plant(), { ...NO_FILTER, protocols: ['dnp3'] });
    expect(dim.has('f-scada-rtu')).toBe(false);
    expect(dim.has('f-hmi-plc1')).toBe(true);
    expect(dim.has('scada')).toBe(false);
    expect(dim.has('hmi')).toBe(true);
  });
});

describe('canvas view', () => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

  it('shows one site, with stubs for devices on other sites', () => {
    const v = buildView(plant(), MAIN, NO_SELECTION, new Set());
    expect(ids(v.nodes.filter((n) => n.type === 'device'))).toEqual(['hmi', 'plc1', 'plc2', 'scada']);
    expect(ids(v.nodes.filter((n) => n.type === 'portal'))).toEqual([portalId('rtu')]);
    const wan = v.edges.find((e) => e.id === 'f-scada-rtu')!;
    expect([wan.source, wan.target]).toEqual(['scada', portalId('rtu')]);
  });

  it('places stubs to the right of every device on the site, without stacking them', () => {
    const p = loadTemplate('pipeline');
    for (const site of p.sites) {
      const v = buildView(p, site.id, NO_SELECTION, new Set());
      const devices = v.nodes.filter((n) => n.type === 'device');
      const stubs = v.nodes.filter((n) => n.type === 'portal');
      const right = Math.max(...devices.map((d) => d.position.x + NODE_WIDTH));
      for (const s of stubs) expect(s.position.x, site.name).toBeGreaterThan(right);
      const ys = stubs.map((s) => s.position.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1], site.name).toBeGreaterThanOrEqual(48);
    }
  });

  it('collapses an area into one node and merges its edges', () => {
    let p = addArea(plant(), createArea(MAIN, cellRect, 'Cell 1', '#0ea5e9', 'cell'));
    p = updateArea(p, 'cell', { collapsed: true });
    const v = buildView(p, MAIN, NO_SELECTION, new Set());
    expect(ids(v.nodes.filter((n) => n.type === 'device'))).toEqual(['hmi', 'scada']);
    // hmi→plc1 and hmi→plc2 links become one link to the area; the internal plc1–plc2 link disappears.
    const toArea = v.edges.filter((e) => e.target === 'cell' || e.source === 'cell');
    expect(toArea.filter((e) => e.type === 'link')).toHaveLength(1);
    expect(toArea.filter((e) => e.type === 'flow')).toHaveLength(1);
    expect(toArea.every((e) => e.selectable === false)).toBe(true);
    expect(v.edges.some((e) => e.id === 'l-plc1-plc2')).toBe(false);
  });

  it('removing an area leaves everything visible again', () => {
    let p = addArea(plant(), createArea(MAIN, cellRect, 'Cell 1', '#0ea5e9', 'cell'));
    p = removeArea(updateArea(p, 'cell', { collapsed: true }), 'cell');
    const v = buildView(p, MAIN, NO_SELECTION, new Set());
    expect(v.nodes.filter((n) => n.type === 'device')).toHaveLength(4);
  });
});
