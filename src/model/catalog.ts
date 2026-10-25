import type { DeviceType, PurdueLevel } from './schema';

export interface DeviceTypeInfo {
  label: string;
  description: string;
  defaultLevel: PurdueLevel;
  defaultCriticality: 'low' | 'medium' | 'high';
}

export const DEVICE_CATALOG: Record<DeviceType, DeviceTypeInfo> = {
  plc: { label: 'PLC', description: 'Programmable logic controller', defaultLevel: 1, defaultCriticality: 'high' },
  rtu: { label: 'RTU', description: 'Remote terminal unit', defaultLevel: 1, defaultCriticality: 'high' },
  sis: { label: 'Safety controller', description: 'Safety instrumented system controller', defaultLevel: 1, defaultCriticality: 'high' },
  hmi: { label: 'HMI', description: 'Human-machine interface', defaultLevel: 2, defaultCriticality: 'medium' },
  scada: { label: 'SCADA server', description: 'Supervisory control and data acquisition server', defaultLevel: 3, defaultCriticality: 'high' },
  ews: { label: 'Engineering workstation', description: 'Programs and configures controllers', defaultLevel: 3, defaultCriticality: 'high' },
  historian: { label: 'Historian', description: 'Process data historian', defaultLevel: 3, defaultCriticality: 'medium' },
  jumphost: { label: 'Jump host', description: 'Brokered remote-access host', defaultLevel: 3.5, defaultCriticality: 'medium' },
  firewall: { label: 'Firewall', description: 'Filters traffic between network segments', defaultLevel: 3.5, defaultCriticality: 'high' },
  switch: { label: 'Switch', description: 'Layer 2 network switch', defaultLevel: 2, defaultCriticality: 'medium' },
  router: { label: 'Router', description: 'Layer 3 router', defaultLevel: 4, defaultCriticality: 'medium' },
  workstation: { label: 'Corporate workstation', description: 'Enterprise IT endpoint', defaultLevel: 4, defaultCriticality: 'low' },
  internet: { label: 'Internet / remote', description: 'External network or remote party', defaultLevel: 5, defaultCriticality: 'low' },
  sensor: { label: 'Sensor', description: 'Field instrument', defaultLevel: 0, defaultCriticality: 'medium' },
  actuator: { label: 'Actuator', description: 'Valve, motor or other final element', defaultLevel: 0, defaultCriticality: 'high' },
};

/** Palette order, grouped roughly from field level upwards. */
export const PALETTE_GROUPS: { title: string; types: DeviceType[] }[] = [
  { title: 'Control', types: ['plc', 'rtu', 'sis', 'sensor', 'actuator'] },
  { title: 'Supervisory', types: ['hmi', 'scada', 'ews', 'historian'] },
  { title: 'Network', types: ['firewall', 'switch', 'router', 'jumphost'] },
  { title: 'Enterprise & external', types: ['workstation', 'internet'] },
];

export const FLOW_ROLES = {
  modbus: { source: 'Client', target: 'Server' },
  dnp3: { source: 'Master', target: 'Outstation' },
} as const;

export const DEFAULT_PORTS = {
  modbus: { tcp: 502, tls: 802 },
  dnp3: 20000,
  rdp: 3389,
  ssh: 22,
  vnc: 5900,
  https: 443,
} as const;
