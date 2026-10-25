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
