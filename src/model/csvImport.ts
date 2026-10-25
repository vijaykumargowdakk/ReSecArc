// CSV import of protocol flows and firewall rules, in the same columns the exports write, so an
// exported table can be edited in a spreadsheet and read back. Every row is checked on its own and
// rejected rows are reported with the reason; nothing is imported until the user confirms.
import Papa from 'papaparse';
import { norm, unescapeFormula } from './csv';
import { addFlow, newId } from './ops';
import { defaultPortFor, defaultSettings, PROTOCOLS, ruleProtocolOptions, settingsErrors, type Settings } from './protocols';
import type { FirewallRule, Flow, Project, RuleEndpoint } from './schema';

export const FLOW_COLUMNS = ['source', 'target', 'protocol', 'port', 'settings'] as const;
export const RULE_COLUMNS = ['firewall', 'order', 'action', 'source', 'destination', 'protocol', 'port', 'note'] as const;

export interface RowResult<T> {
  line: number;
  name: string;
  value: T | null;
  errors: string[];
}

function rows(text: string) {
  return Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: norm }).data.map(
    (row, i) => ({ line: i + 2, get: (col: string) => unescapeFormula((row[col] ?? '').trim()) }),
  );
}

/** Finds a device by its name; names must be unique for an import to know which one is meant. */
function deviceFinder(project: Project) {
  const byName = new Map<string, string[]>();
  for (const d of project.devices) byName.set(norm(d.label), [...(byName.get(norm(d.label)) ?? []), d.id]);
  return (name: string, role: string, errors: string[]): string | null => {
    if (!name) {
      errors.push(`${role} is required`);
      return null;
    }
    const ids = byName.get(norm(name)) ?? [];
    if (ids.length === 0) errors.push(`no device named "${name}"`);
    if (ids.length > 1) errors.push(`${ids.length} devices are named "${name}"; rename them so the ${role} is unambiguous`);
    return ids.length === 1 ? ids[0] : null;
  };
}

function parsePort(raw: string, errors: string[]): number | null | undefined {
  if (raw === '' || norm(raw) === 'any' || norm(raw) === 'n/a') return raw === '' ? undefined : null;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 65535) return n;
  errors.push(`port "${raw}" must be a whole number from 1 to 65535`);
  return undefined;
}

/** Reads `key=value; key=value` (as exported) on top of the protocol's defaults. */
function parseSettings(raw: string, defaults: Settings, kinds: Map<string, string>, errors: string[]): Settings {
  const settings = { ...defaults };
  for (const part of raw.split(';').map((p) => p.trim()).filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq < 1) {
      errors.push(`setting "${part}" should look like name=value`);
      continue;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    const kind = kinds.get(key);
    if (kind === 'bool') {
      if (/^(true|yes|1)$/i.test(value)) settings[key] = true;
      else if (/^(false|no|0)$/i.test(value)) settings[key] = false;
      else errors.push(`setting "${key}" must be true or false`);
    } else {
      settings[key] = value;
    }
  }
  return settings;
}

export function parseFlowCsv(project: Project, text: string): RowResult<Flow>[] {
  const device = deviceFinder(project);
  const planned: Flow[] = [];
  return rows(text).map(({ line, get }) => {
    const errors: string[] = [];
    const source = device(get('source'), 'source', errors);
    const target = device(get('target'), 'target', errors);
    const name = `${get('source') || '?'} → ${get('target') || '?'}`;
    const def = PROTOCOLS.find((p) => norm(p.id) === norm(get('protocol')) || norm(p.label) === norm(get('protocol')));
    if (!def) errors.push(get('protocol') ? `unknown protocol "${get('protocol')}"` : 'protocol is required');
    if (!def || errors.length) return { line, name, value: null, errors };

    const settings = parseSettings(get('settings'), defaultSettings(def), new Map(def.fields.map((f) => [f.key, f.kind])), errors);
    errors.push(...settingsErrors(def, settings));
    let port = parsePort(get('port'), errors);
    if (port === undefined) port = defaultPortFor(def, settings);
    if (def.defaultPort === null && !def.portOptional) port = null;
    if (def.defaultPort !== null && !def.portOptional && port === null) errors.push(`${def.label} needs a port`);
    if (source === target) errors.push('source and target are the same device');

    const flow: Flow = { id: newId('flow'), source: source!, target: target!, protocol: def.id, port, settings, waypoints: [] };
    const clash = [...project.flows, ...planned].some((f) => f.source === flow.source && f.target === flow.target && f.protocol === flow.protocol);
    if (clash) errors.push(`a ${def.label} flow from ${get('source')} to ${get('target')} already exists`);
    if (errors.length) return { line, name, value: null, errors };
    planned.push(flow);
    return { line, name, value: flow, errors };
  });
}

export function importFlows(project: Project, results: RowResult<Flow>[]): Project {
  return results.reduce((p, r) => (r.value ? addFlow(p, r.value) : p), project);
}

export interface ImportedRule {
  firewallId: string;
  order: number;
  rule: FirewallRule;
}

export function parseRuleCsv(project: Project, text: string): RowResult<ImportedRule>[] {
  const device = deviceFinder(project);
  const zoneByName = new Map(project.zones.map((z) => [norm(z.name), z.id]));
  const protocols = ruleProtocolOptions();
  const endpoint = (raw: string, role: string, errors: string[]): RuleEndpoint | null => {
    if (norm(raw) === 'any' || raw === '') return { kind: 'any' };
    const zone = /^zone\s*:\s*(.+)$/i.exec(raw);
    if (zone) {
      const id = zoneByName.get(norm(zone[1]));
      if (!id) errors.push(`no zone named "${zone[1].trim()}"`);
      return id ? { kind: 'zone', id } : null;
    }
    const id = device(raw, role, errors);
    return id ? { kind: 'device', id } : null;
  };

  return rows(text).map(({ line, get }, index) => {
    const errors: string[] = [];
    const fwId = device(get('firewall'), 'firewall', errors);
    const fw = project.devices.find((d) => d.id === fwId);
    if (fw && !fw.firewall) errors.push(`"${fw.label}" is not a firewall`);
    const action = norm(get('action'));
    if (action !== 'allow' && action !== 'deny') errors.push('action must be allow or deny');
    const src = endpoint(get('source'), 'source', errors);
    const dst = endpoint(get('destination'), 'destination', errors);
    const protocol = protocols.find((o) => norm(o.value) === norm(get('protocol') || 'any') || norm(o.label) === norm(get('protocol')));
    if (!protocol) errors.push(`unknown protocol "${get('protocol')}"`);
    const port = parsePort(get('port'), errors);
    const order = get('order') ? Number(get('order')) : index + 1;
    if (!Number.isFinite(order)) errors.push(`order "${get('order')}" must be a number`);
    const name = `${get('firewall') || '?'} #${get('order') || index + 1}`;
    if (errors.length || !fw || !src || !dst || !protocol) return { line, name, value: null, errors };
    const rule: FirewallRule = { id: newId('rule'), src, dst, protocol: protocol.value, port: port ?? null, action: action as FirewallRule['action'], note: get('note') };
    return { line, name, value: { firewallId: fw.id, order, rule }, errors };
  });
}

/**
 * Adds imported rules to their firewalls in `order`. With `replace`, the listed firewalls' existing
 * rules are dropped first, which is what re-importing an edited export needs.
 */
export function importRules(project: Project, results: RowResult<ImportedRule>[], replace: boolean): Project {
  const byFirewall = new Map<string, ImportedRule[]>();
  for (const r of results) if (r.value) byFirewall.set(r.value.firewallId, [...(byFirewall.get(r.value.firewallId) ?? []), r.value]);
  return {
    ...project,
    devices: project.devices.map((d) => {
      const incoming = byFirewall.get(d.id);
      if (!incoming || !d.firewall) return d;
      const sorted = [...incoming].sort((a, b) => a.order - b.order).map((r) => r.rule);
      return { ...d, firewall: { ...d.firewall, rules: replace ? sorted : [...d.firewall.rules, ...sorted] } };
    }),
  };
}
