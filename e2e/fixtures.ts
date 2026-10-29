// Generated, fictional projects for tests that need more than the templates provide.

const LEVELS = [5, 4, 3.5, 3, 2, 1, 0];
const TYPE_FOR_LEVEL: Record<number, string> = { 5: 'workstation', 4: 'workstation', 3.5: 'server', 3: 'scada', 2: 'hmi', 1: 'plc', 0: 'sensor' };

/** A valid format-3 project with `perSite` devices on each of `sites` sites, linked in chains per lane. */
export function largeProject(sites = 5, perSite = 200): string {
  const asset = { vendor: '', model: '', firmware: '', serial: '', ip: '', notes: '' };
  const siteList = Array.from({ length: sites }, (_, s) => ({ id: `site-${s}`, name: `Site ${s + 1}` }));
  const devices: object[] = [];
  const links: object[] = [];
  const flows: object[] = [];
  for (const site of siteList) {
    for (let i = 0; i < perSite; i++) {
      const level = LEVELS[i % LEVELS.length];
      const column = Math.floor(i / LEVELS.length);
      const id = `${site.id}-d${i}`;
      devices.push({
        id,
        type: TYPE_FOR_LEVEL[level],
        variant: 'generic',
        label: `Device ${i + 1}`,
        purdueLevel: level,
        siteId: site.id,
        zoneId: null,
        areaId: null,
        criticality: 'medium',
        position: { x: 220 + column * 220, y: LEVELS.indexOf(level) * 150 + 43 },
        services: [],
        asset: { ...asset, ip: `10.${siteList.indexOf(site)}.${Math.floor(i / 250)}.${(i % 250) + 1}` },
      });
      if (i >= LEVELS.length) links.push({ id: `${id}-l`, source: `${site.id}-d${i - LEVELS.length}`, target: id, medium: 'ethernet' });
      if (level === 1) {
        flows.push({
          id: `${id}-f`,
          source: `${site.id}-d${i - 1}`,
          target: id,
          protocol: 'modbus',
          port: 502,
          settings: { variant: 'tcp', access: 'read-write', authentication: false },
        });
      }
    }
  }
  return JSON.stringify({
    schemaVersion: 3,
    name: 'Generated large estate (fictional)',
    sites: siteList,
    devices,
    links,
    flows,
    zones: [],
    areas: [],
    notes: [],
    networks: [],
    revisions: [],
  });
}

/**
 * A format-5 file (from before level tabs and stacks): a SCADA server, a switch and a PLC above
 * fifteen temperature sensors on L0, each sensor linked to the switch and polled by the PLC.
 */
export function sensorLevelProject(): string {
  const asset = { vendor: '', model: '', firmware: '', serial: '', ip: '', notes: '' };
  const device = (id: string, type: string, variant: string, label: string, level: number, x: number) => ({
    id,
    type,
    variant,
    label,
    purdueLevel: level,
    siteId: 'site-main',
    zoneId: null,
    areaId: null,
    criticality: 'medium',
    position: { x, y: LEVELS.indexOf(level) * 150 + 43 },
    services: [],
    asset,
    tags: [],
    fields: {},
    locked: false,
  });
  const link = (id: string, source: string, target: string) => ({
    id,
    source,
    target,
    medium: 'ethernet',
    sourcePort: '',
    targetPort: '',
    vlans: [],
    networkId: null,
    waypoints: [],
  });
  const sensors = Array.from({ length: 15 }, (_, i) => device(`tt-${i + 1}`, 'sensor', 'temperature', `TT-${101 + i}`, 0, 220 + i * 220));
  return JSON.stringify({
    schemaVersion: 5,
    name: 'Sensor level (fictional)',
    sites: [{ id: 'site-main', name: 'Main site' }],
    devices: [device('scada', 'scada', 'generic', 'SCADA server', 3, 220), device('sw', 'switch', 'generic', 'Field switch', 1, 220), device('plc', 'plc', 'generic', 'Line PLC', 1, 500), ...sensors],
    links: [link('l-scada', 'scada', 'plc'), ...sensors.map((s) => link(`l-${s.id}`, 'sw', s.id))],
    flows: sensors.map((s) => ({ id: `f-${s.id}`, source: 'plc', target: s.id, protocol: 'modbus', port: 502, settings: { variant: 'tcp', access: 'read', authentication: false }, waypoints: [] })),
    zones: [],
    areas: [],
    notes: [],
    networks: [],
    fieldDefs: [],
    policies: [],
    disabledChecks: [],
    revisions: [],
  });
}
