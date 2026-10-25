// CSV export of the inventory, and CSV import of devices with per-row error reporting.
import Papa from 'papaparse';
import { DEVICE_CATALOG, kindLabel } from './catalog';
import { isValidDate, parseTags } from './fields';
import { addDevice, createDevice, emptyAsset } from './ops';
import { addressReport, addressSortKey, type AddressReport } from './ipam';
import { flowLabel, getProtocol } from './protocols';
import { laneTop, levelLabel, NODE_WIDTH, PURDUE_LANES } from './purdue';
import { deviceTypeSchema, type Device, type DeviceType, type Project, type PurdueLevel, type RuleEndpoint } from './schema';

export const DEVICE_COLUMNS = [
  'name',
  'type',
  'variant',
  'level',
  'zone',
  'site',
  'area',
  'criticality',
  'vendor',
  'model',
  'firmware',
  'serial',
  'ip',
  'notes',
] as const;

const names = (list: { id: string; name: string }[]) => new Map(list.map((x) => [x.id, x.name]));

/**
 * Every export escapes cells that a spreadsheet would treat as a formula (leading = + - @ tab or CR),
 * so names or notes from a shared project file cannot run when the CSV is opened.
 */
function unparse(table: { fields: string[]; data: unknown[][] }): string {
  return Papa.unparse(table, { escapeFormulae: true });
}

/** Undoes the formula escape added on export, so exported files re-import unchanged. */
export const unescapeFormula = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

/** Header of a custom field's column in device CSV files. */
export const fieldColumn = (label: string) => `field:${label}`;

export function devicesToCsv(project: Project): string {
  const zone = names(project.zones);
  const site = names(project.sites);
  const area = names(project.areas);
  return unparse({
    fields: [...DEVICE_COLUMNS, 'tags', ...project.fieldDefs.map((f) => fieldColumn(f.label))],
    data: project.devices.map((d) => [
      d.label,
      d.type,
      d.variant,
      d.purdueLevel,
      d.zoneId ? (zone.get(d.zoneId) ?? '') : '',
      site.get(d.siteId) ?? '',
      d.areaId ? (area.get(d.areaId) ?? '') : '',
      d.criticality,
      d.asset.vendor,
      d.asset.model,
      d.asset.firmware,
      d.asset.serial,
      d.asset.ip,
      d.asset.notes,
      d.tags.join('; '),
      ...project.fieldDefs.map((f) => d.fields[f.id] ?? ''),
    ]),
  });
}

export function flowsToCsv(project: Project): string {
  const device = new Map(project.devices.map((d) => [d.id, d.label]));
  return unparse({
    fields: ['source', 'target', 'protocol', 'port', 'summary', 'settings'],
    data: project.flows.map((f) => [
      device.get(f.source) ?? f.source,
      device.get(f.target) ?? f.target,
      getProtocol(f.protocol)?.label ?? f.protocol,
      f.port ?? '',
      flowLabel(f.protocol, f.settings),
      Object.entries(f.settings)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    ]),
  });
}

/** One row per device address: the IP plan as a table. */
export function addressesToCsv(project: Project): string {
  return unparse({
    fields: ['address', 'device', 'site', 'network', 'subnet', 'vlan', 'zone', 'warnings'],
    data: addressRows(project).map((r) => [r.address, r.device, r.site, r.network, r.subnet, r.vlan, r.zone, r.warnings.join('; ')]),
  });
}

export interface AddressRow {
  deviceId: string;
  address: string;
  device: string;
  site: string;
  network: string;
  subnet: string;
  vlan: number | '';
  zone: string;
  warnings: string[];
}

/** Every device address with its network, sorted numerically; shared by the inventory and the CSV export. */
export function addressRows(project: Project, report: AddressReport = addressReport(project)): AddressRow[] {
  const zone = names(project.zones);
  const site = names(project.sites);
  return project.devices
    .flatMap((d) =>
      (report.addresses.get(d.id) ?? []).map((a) => ({
        deviceId: d.id,
        address: a.address,
        device: d.label,
        site: site.get(d.siteId) ?? '',
        network: a.network ? a.network.name || a.network.cidr : '',
        subnet: a.network?.cidr ?? '',
        vlan: a.network?.vlan ?? ('' as const),
        zone: d.zoneId ? (zone.get(d.zoneId) ?? '') : '',
        warnings: (report.issues.get(d.id) ?? []).filter((i) => i.address === a.address).map((i) => i.message),
      })),
    )
    .sort((a, b) => addressSortKey(a.address) - addressSortKey(b.address) || a.device.localeCompare(b.device));
}

export const LINK_COLUMNS = ['source', 'source port', 'target', 'target port', 'medium', 'vlans', 'network'] as const;

export function linksToCsv(project: Project): string {
  const device = new Map(project.devices.map((d) => [d.id, d.label]));
  const network = new Map(project.networks.map((n) => [n.id, n.name || n.cidr]));
  return unparse({
    fields: [...LINK_COLUMNS],
    data: project.links.map((l) => [
      device.get(l.source) ?? l.source,
      l.sourcePort,
      device.get(l.target) ?? l.target,
      l.targetPort,
      l.medium,
      l.vlans.join(' '),
      l.networkId ? (network.get(l.networkId) ?? '') : '',
    ]),
  });
}

export function endpointName(project: Project, ep: RuleEndpoint): string {
  if (ep.kind === 'any') return 'any';
  if (ep.kind === 'zone') return `zone: ${project.zones.find((z) => z.id === ep.id)?.name ?? ep.id}`;
  return project.devices.find((d) => d.id === ep.id)?.label ?? ep.id;
}

export function rulesToCsv(project: Project): string {
  return unparse({
    fields: ['firewall', 'order', 'action', 'source', 'destination', 'protocol', 'port', 'note'],
    data: project.devices.flatMap((fw) =>
      (fw.firewall?.rules ?? []).map((r, i) => [
        fw.label,
        i + 1,
        r.action,
        endpointName(project, r.src),
        endpointName(project, r.dst),
        r.protocol,
        r.port ?? 'any',
        r.note,
      ]),
    ),
  });
}

export interface ImportRow {
  line: number;
  name: string;
  device: Device | null;
  errors: string[];
}

export const norm = (s: string) => s.trim().toLowerCase();

function findType(raw: string): DeviceType | null {
  const parsed = deviceTypeSchema.safeParse(norm(raw));
  if (parsed.success) return parsed.data;
  const byLabel = (Object.keys(DEVICE_CATALOG) as DeviceType[]).find((t) => norm(DEVICE_CATALOG[t].label) === norm(raw));
  return byLabel ?? null;
}

function findLevel(raw: string): PurdueLevel | null {
  const n = Number(norm(raw).replace(/^l/, ''));
  return PURDUE_LANES.find((l) => l.level === n)?.level ?? null;
}

/**
 * Reads devices from CSV (columns as in DEVICE_COLUMNS; only `name` and `type` are required).
 * Types and variants may be given as ids or labels; zones and sites by name. Devices are laid out
 * in their level's lane, to the right of anything already there. Area membership follows position.
 */
export function parseDeviceCsv(project: Project, text: string, defaultSiteId: string): ImportRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: norm });
  const zoneByName = new Map(project.zones.map((z) => [norm(z.name), z.id]));
  const siteByName = new Map(project.sites.map((s) => [norm(s.name), s.id]));
  const nextX = new Map<string, number>();
  const slot = (siteId: string, level: PurdueLevel) => {
    const key = `${siteId}|${level}`;
    if (!nextX.has(key)) {
      const xs = project.devices.filter((d) => d.siteId === siteId && d.purdueLevel === level).map((d) => d.position.x);
      nextX.set(key, xs.length ? Math.max(...xs) + NODE_WIDTH + 40 : 240);
    }
    const x = nextX.get(key)!;
    nextX.set(key, x + NODE_WIDTH + 40);
    return { x, y: laneTop(level) + 37 };
  };

  return parsed.data.map((row, i) => {
    const errors: string[] = [];
    const get = (col: string) => unescapeFormula((row[col] ?? '').trim());
    const name = get('name');
    if (!name) errors.push('name is required');

    const type = findType(get('type'));
    if (!type) errors.push(get('type') ? `unknown type "${get('type')}"` : 'type is required');

    let variant = 'generic';
    if (type && get('variant')) {
      const v = DEVICE_CATALOG[type].variants.find((x) => norm(x.id) === norm(get('variant')) || norm(x.label) === norm(get('variant')));
      if (v) variant = v.id;
      else errors.push(`unknown ${DEVICE_CATALOG[type].label} kind "${get('variant')}"`);
    }

    let level: PurdueLevel | null = type ? DEVICE_CATALOG[type].defaultLevel : null;
    if (get('level')) {
      level = findLevel(get('level'));
      if (level === null) errors.push(`unknown level "${get('level')}"`);
    }

    let zoneId: string | null = null;
    if (get('zone')) {
      zoneId = zoneByName.get(norm(get('zone'))) ?? null;
      if (!zoneId) errors.push(`no zone named "${get('zone')}"; create it first`);
    }

    let siteId = defaultSiteId;
    if (get('site')) {
      const found = siteByName.get(norm(get('site')));
      if (found) siteId = found;
      else errors.push(`no site named "${get('site')}"`);
    }

    const fields: Record<string, string> = {};
    for (const column of Object.keys(row)) {
      if (!column.startsWith('field:')) continue;
      const value = get(column);
      if (!value) continue;
      const def = project.fieldDefs.find((f) => norm(fieldColumn(f.label)) === column);
      if (!def) errors.push(`no custom field named "${column.slice(6)}"; add it under Custom fields first`);
      else if (def.kind === 'date' && !isValidDate(value)) errors.push(`${def.label} must be a date like 2027-03-31`);
      else fields[def.id] = value;
    }

    const criticality = norm(get('criticality'));
    if (criticality && !['low', 'medium', 'high'].includes(criticality)) errors.push(`criticality must be low, medium or high`);

    if (errors.length || !type || level === null) return { line: i + 2, name, device: null, errors };
    const device: Device = {
      ...createDevice(type, slot(siteId, level), { siteId, variant }),
      label: name,
      purdueLevel: level,
      zoneId,
      criticality: (criticality || DEVICE_CATALOG[type].defaultCriticality) as Device['criticality'],
      asset: {
        ...emptyAsset(),
        vendor: get('vendor'),
        model: get('model'),
        firmware: get('firmware'),
        serial: get('serial'),
        ip: get('ip'),
        notes: get('notes'),
      },
      tags: parseTags(get('tags')),
      fields,
    };
    return { line: i + 2, name, device, errors };
  });
}

export function importDevices(project: Project, rows: ImportRow[]): Project {
  return rows.reduce((p, r) => (r.device ? addDevice(p, r.device) : p), project);
}

/** Short description used in tables: "Compact PLC · L1". */
export function deviceSummary(d: Device): string {
  return `${kindLabel(d.type, d.variant)} · ${levelLabel(d.purdueLevel)}`;
}
