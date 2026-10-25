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
  /** When true a flow may have a port or not (used by the custom protocol). */
  portOptional?: boolean;
  /** Default port that depends on an enum setting, e.g. plain vs TLS. */
  portBySetting?: { key: string; ports: Record<string, number> };
  fields: readonly FieldDef[];
  /** Edge colour and SVG dash pattern; the pattern keeps protocols apart without colour. */
  color: string;
  dash: string;
  /** Short badges shown on the edge label after the protocol name. */
  badges: (s: Settings) => string[];
  /** Whether the settings give message authentication or encryption; used by the security checks. */
  isSecured: (s: Settings) => boolean;
  /** Overrides the protocol name on the edge label, e.g. a custom protocol's own name. */
  title?: (s: Settings) => string;
}

const ACCESS = [
  { value: 'read', label: 'Read only' },
  { value: 'write', label: 'Write only' },
  { value: 'read-write', label: 'Read and write' },
] as const;
const ACCESS_BADGE: Record<string, string> = { read: 'R', write: 'W', 'read-write': 'RW' };
const tlsField = (label = 'TLS enabled'): FieldDef => ({ key: 'tls', label, kind: 'bool', default: false });
const controlField: FieldDef = { key: 'controlCommands', label: 'Control commands permitted', kind: 'bool', default: false };

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
    isSecured: (s) => s.variant === 'tls',
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
    isSecured: (s) => s.secureAuthentication === true || s.tls === true,
  },
  {
    id: 'enip',
    label: 'EtherNet/IP',
    roles: { source: 'Scanner', target: 'Adapter' },
    defaultPort: 44818,
    portBySetting: { key: 'messaging', ports: { explicit: 44818, implicit: 2222 } },
    fields: [
      {
        key: 'messaging',
        label: 'Messaging',
        kind: 'enum',
        options: [
          { value: 'explicit', label: 'Explicit (TCP)' },
          { value: 'implicit', label: 'Implicit I/O (UDP)' },
        ],
        default: 'explicit',
      },
      { key: 'cipSecurity', label: 'CIP Security enabled', kind: 'bool', default: false },
    ],
    color: '#0369a1',
    dash: '2 3',
    badges: (s) => [s.messaging === 'implicit' ? 'I/O' : '', s.cipSecurity ? 'CIP-Sec' : ''],
    isSecured: (s) => s.cipSecurity === true,
  },
  {
    id: 'profinet',
    label: 'PROFINET',
    roles: { source: 'IO controller', target: 'IO device' },
    defaultPort: null,
    fields: [
      {
        key: 'realtime',
        label: 'Real-time class',
        kind: 'enum',
        options: [
          { value: 'rt', label: 'RT' },
          { value: 'irt', label: 'IRT (isochronous)' },
        ],
        default: 'rt',
      },
      {
        key: 'conformance',
        label: 'Conformance class',
        kind: 'enum',
        options: [
          { value: 'A', label: 'CC-A' },
          { value: 'B', label: 'CC-B' },
          { value: 'C', label: 'CC-C' },
        ],
        default: 'B',
      },
      { key: 'security', label: 'PROFINET Security enabled', kind: 'bool', default: false },
    ],
    color: '#15803d',
    dash: '12 3',
    badges: (s) => [s.realtime === 'irt' ? 'IRT' : '', s.security ? 'Sec' : ''],
    isSecured: (s) => s.security === true,
  },
  {
    id: 'opcua',
    label: 'OPC UA',
    roles: { source: 'Client', target: 'Server' },
    defaultPort: 4840,
    fields: [
      {
        key: 'securityMode',
        label: 'Security mode',
        kind: 'enum',
        options: [
          { value: 'none', label: 'None' },
          { value: 'sign', label: 'Sign' },
          { value: 'signandencrypt', label: 'Sign and encrypt' },
        ],
        default: 'none',
      },
      {
        key: 'userAuth',
        label: 'User authentication',
        kind: 'enum',
        options: [
          { value: 'anonymous', label: 'Anonymous' },
          { value: 'username', label: 'Username and password' },
          { value: 'certificate', label: 'Certificate' },
        ],
        default: 'anonymous',
      },
    ],
    color: '#a21caf',
    dash: '4 2',
    badges: (s) => [
      s.securityMode === 'sign' ? 'Sign' : s.securityMode === 'signandencrypt' ? 'Encrypt' : '',
      s.userAuth === 'anonymous' ? 'anon' : '',
    ],
    isSecured: (s) => s.securityMode !== 'none',
  },
  {
    id: 'iec104',
    label: 'IEC 104',
    roles: { source: 'Controlling station', target: 'Controlled station' },
    defaultPort: 2404,
    portBySetting: { key: 'tls', ports: { false: 2404, true: 19998 } },
    fields: [tlsField('TLS enabled (IEC 62351-3)'), controlField],
    color: '#b45309',
    dash: '8 3 2 3 2 3',
    badges: (s) => [s.tls ? 'TLS' : '', s.controlCommands ? 'ctrl' : ''],
    isSecured: (s) => s.tls === true,
  },
  {
    id: 'mms',
    label: 'IEC 61850 MMS',
    roles: { source: 'Client', target: 'Server (IED)' },
    defaultPort: 102,
    portBySetting: { key: 'tls', ports: { false: 102, true: 3782 } },
    fields: [tlsField('TLS enabled (IEC 62351-4)'), controlField],
    color: '#0f766e',
    dash: '6 2 2 2',
    badges: (s) => [s.tls ? 'TLS' : '', s.controlCommands ? 'ctrl' : ''],
    isSecured: (s) => s.tls === true,
  },
  {
    id: 'goose',
    label: 'IEC 61850 GOOSE',
    roles: { source: 'Publisher', target: 'Subscriber' },
    defaultPort: null,
    fields: [{ key: 'authenticated', label: 'Message authentication (IEC 62351-6)', kind: 'bool', default: false }],
    color: '#be123c',
    dash: '1 3',
    badges: (s) => [s.authenticated ? 'auth' : ''],
    isSecured: (s) => s.authenticated === true,
  },
  {
    id: 'bacnet',
    label: 'BACnet',
    roles: { source: 'Client', target: 'Device' },
    defaultPort: 47808,
    portBySetting: { key: 'secureConnect', ports: { false: 47808, true: 443 } },
    fields: [
      { key: 'secureConnect', label: 'BACnet/SC (secure connect)', kind: 'bool', default: false },
      { key: 'access', label: 'Access', kind: 'enum', options: ACCESS, default: 'read' },
    ],
    color: '#4d7c0f',
    dash: '9 5',
    badges: (s) => [s.secureConnect ? 'SC' : '', ACCESS_BADGE[String(s.access)] ?? ''],
    isSecured: (s) => s.secureConnect === true,
  },
  {
    id: 's7',
    label: 'S7',
    roles: { source: 'Client', target: 'Controller' },
    defaultPort: 102,
    fields: [
      {
        key: 'variant',
        label: 'Variant',
        kind: 'enum',
        options: [
          { value: 'classic', label: 'S7comm (classic)' },
          { value: 'plus', label: 'S7comm-plus' },
        ],
        default: 'classic',
      },
      { key: 'access', label: 'Access', kind: 'enum', options: ACCESS, default: 'read' },
    ],
    color: '#1d4ed8',
    dash: '3 3 9 3',
    badges: (s) => [s.variant === 'plus' ? '+' : '', ACCESS_BADGE[String(s.access)] ?? ''],
    isSecured: () => false,
  },
  {
    id: 'mqtt',
    label: 'MQTT',
    roles: { source: 'Client', target: 'Broker' },
    defaultPort: 1883,
    portBySetting: { key: 'tls', ports: { false: 1883, true: 8883 } },
    fields: [
      tlsField(),
      {
        key: 'clientAuth',
        label: 'Client authentication',
        kind: 'enum',
        options: [
          { value: 'none', label: 'None' },
          { value: 'password', label: 'Username and password' },
          { value: 'certificate', label: 'Certificate' },
        ],
        default: 'none',
      },
    ],
    color: '#ca8a04',
    dash: '14 4',
    badges: (s) => [s.tls ? 'TLS' : '', s.clientAuth === 'none' ? 'no-auth' : ''],
    isSecured: (s) => s.tls === true,
  },
  {
    id: 'custom',
    label: 'Custom',
    roles: { source: 'Source', target: 'Destination' },
    defaultPort: null,
    portOptional: true,
    fields: [
      { key: 'name', label: 'Protocol name', kind: 'text', default: 'Custom protocol' },
      {
        key: 'transport',
        label: 'Transport',
        kind: 'enum',
        options: [
          { value: 'tcp', label: 'TCP' },
          { value: 'udp', label: 'UDP' },
          { value: 'l2', label: 'Layer 2' },
          { value: 'serial', label: 'Serial' },
        ],
        default: 'tcp',
      },
      { key: 'encrypted', label: 'Encrypted', kind: 'bool', default: false },
    ],
    color: '#475569',
    dash: '5 3',
    badges: (s) => [s.encrypted ? 'enc' : ''],
    title: (s) => String(s.name || 'Custom'),
    isSecured: (s) => s.encrypted === true,
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
  return [def.title ? def.title(settings) : def.label, ...def.badges(settings).filter(Boolean)].join(' ');
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
