// Data-driven registry of industrial protocols a flow can carry. The inspector form,
// edge label and validation are all generated from these definitions.

export type SettingValue = boolean | string | number;
export type Settings = Record<string, SettingValue>;

export type FieldDef =
  | { key: string; label: string; kind: 'bool'; default: boolean }
  | { key: string; label: string; kind: 'enum'; options: readonly { value: string; label: string }[]; default: string }
  | { key: string; label: string; kind: 'text'; default: string };

export interface ProtocolDef {
  id: string;
  label: string;
  roles: { source: string; target: string };
  /** `null` for layer-2 protocols that have no TCP/UDP port. */
  defaultPort: number | null;
  /** Default port that depends on an enum setting, e.g. plain vs TLS. */
  portBySetting?: { key: string; ports: Record<string, number> };
  fields: readonly FieldDef[];
  /** Edge colour and SVG dash pattern; the pattern keeps protocols apart without colour. */
  color: string;
  dash: string;
  /** Short badges shown on the edge label after the protocol name. */
  badges: (s: Settings) => string[];
}

const ACCESS = [
  { value: 'read', label: 'Read only' },
  { value: 'write', label: 'Write only' },
  { value: 'read-write', label: 'Read and write' },
] as const;
const ACCESS_BADGE: Record<string, string> = { read: 'R', write: 'W', 'read-write': 'RW' };

export const PROTOCOLS: readonly ProtocolDef[] = [
  {
    id: 'modbus',
    label: 'Modbus',
    roles: { source: 'Client', target: 'Server' },
    defaultPort: 502,
    portBySetting: { key: 'variant', ports: { tcp: 502, tls: 802 } },
    fields: [
      {
        key: 'variant',
        label: 'Variant',
        kind: 'enum',
        options: [
          { value: 'tcp', label: 'Modbus TCP' },
          { value: 'tls', label: 'Modbus/TCP Security (TLS)' },
        ],
        default: 'tcp',
      },
      { key: 'access', label: 'Access', kind: 'enum', options: ACCESS, default: 'read' },
      { key: 'authentication', label: 'Client authentication configured', kind: 'bool', default: false },
    ],
    color: '#c2410c',
    dash: '6 4',
    badges: (s) => [s.variant === 'tls' ? 'TLS' : '', ACCESS_BADGE[String(s.access)] ?? ''],
  },
  {
    id: 'dnp3',
    label: 'DNP3',
    roles: { source: 'Master', target: 'Outstation' },
    defaultPort: 20000,
    fields: [
      {
        key: 'transport',
        label: 'Transport',
        kind: 'enum',
        options: [
          { value: 'tcp', label: 'TCP' },
          { value: 'udp', label: 'UDP' },
        ],
        default: 'tcp',
      },
      { key: 'secureAuthentication', label: 'Secure Authentication enabled', kind: 'bool', default: false },
      { key: 'tls', label: 'TLS enabled', kind: 'bool', default: false },
      { key: 'controlCommands', label: 'Control commands permitted', kind: 'bool', default: false },
    ],
    color: '#6d28d9',
    dash: '10 4 2 4',
    badges: (s) => [s.secureAuthentication ? 'SA' : '', s.tls ? 'TLS' : '', s.controlCommands ? 'ctrl' : ''],
  },
];

const BY_ID = new Map(PROTOCOLS.map((p) => [p.id, p]));

export function getProtocol(id: string): ProtocolDef | undefined {
  return BY_ID.get(id);
}

export function defaultSettings(def: ProtocolDef): Settings {
  return Object.fromEntries(def.fields.map((f) => [f.key, f.default]));
}

export function defaultPortFor(def: ProtocolDef, settings: Settings): number | null {
  if (def.portBySetting) {
    const port = def.portBySetting.ports[String(settings[def.portBySetting.key])];
    if (port !== undefined) return port;
  }
  return def.defaultPort;
}

/** Problems with a flow's settings: unknown, missing or mistyped fields. */
export function settingsErrors(def: ProtocolDef, settings: Settings): string[] {
  const errors: string[] = [];
  const known = new Set(def.fields.map((f) => f.key));
  for (const key of Object.keys(settings)) {
    if (!known.has(key)) errors.push(`unknown ${def.label} setting "${key}"`);
  }
  for (const f of def.fields) {
    const v = settings[f.key];
    if (v === undefined) errors.push(`missing ${def.label} setting "${f.key}"`);
    else if (f.kind === 'bool' && typeof v !== 'boolean') errors.push(`${def.label} setting "${f.key}" must be true or false`);
    else if (f.kind === 'text' && typeof v !== 'string') errors.push(`${def.label} setting "${f.key}" must be text`);
    else if (f.kind === 'enum' && !f.options.some((o) => o.value === v)) {
      errors.push(`${def.label} setting "${f.key}" has unsupported value "${String(v)}"`);
    }
  }
  return errors;
}

export function flowLabel(protocol: string, settings: Settings): string {
  const def = getProtocol(protocol);
  if (!def) return protocol;
  return [def.label, ...def.badges(settings).filter(Boolean)].join(' ');
}

/** Protocols a firewall rule can name: every flow protocol, the remote-access services, or any. */
export const REMOTE_ACCESS_PROTOCOLS = [
  { id: 'rdp', label: 'RDP', port: 3389 },
  { id: 'ssh', label: 'SSH', port: 22 },
  { id: 'vnc', label: 'VNC', port: 5900 },
  { id: 'https', label: 'HTTPS', port: 443 },
] as const;

export function ruleProtocolOptions(): { value: string; label: string; port: number | null }[] {
  return [
    { value: 'any', label: 'Any protocol', port: null },
    ...PROTOCOLS.map((p) => ({ value: p.id, label: p.label, port: p.defaultPort })),
    ...REMOTE_ACCESS_PROTOCOLS.map((p) => ({ value: p.id, label: p.label, port: p.port })),
  ];
}
