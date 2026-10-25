import type { DeviceType, PurdueLevel } from './schema';

export interface VariantInfo {
  id: string;
  label: string;
  description: string;
}

export interface DeviceTypeInfo {
  label: string;
  description: string;
  defaultLevel: PurdueLevel;
  defaultCriticality: 'low' | 'medium' | 'high';
  /** Always starts with `generic`. */
  variants: readonly VariantInfo[];
}

const generic = (description: string): VariantInfo => ({ id: 'generic', label: 'General', description });

export const DEVICE_CATALOG: Record<DeviceType, DeviceTypeInfo> = {
  plc: {
    label: 'PLC',
    description: 'Programmable logic controller',
    defaultLevel: 1,
    defaultCriticality: 'high',
    variants: [
      generic('Programmable logic controller'),
      { id: 'compact', label: 'Compact PLC', description: 'Fixed-format controller with built-in I/O' },
      { id: 'modular', label: 'Modular PLC', description: 'Rack or DIN-rail controller with plug-in I/O cards' },
      { id: 'micro', label: 'Micro PLC', description: 'Small controller for simple machines' },
      { id: 'pac', label: 'PAC', description: 'Programmable automation controller' },
      { id: 'soft', label: 'Soft PLC', description: 'Control runtime on an industrial PC' },
      { id: 'remote-io', label: 'Remote I/O station', description: 'Distributed I/O on a fieldbus' },
    ],
  },
  rtu: {
    label: 'RTU',
    description: 'Remote terminal unit',
    defaultLevel: 1,
    defaultCriticality: 'high',
    variants: [
      generic('Remote terminal unit'),
      { id: 'field', label: 'Field RTU', description: 'Pole- or kiosk-mounted unit at a remote site' },
      { id: 'substation', label: 'Substation RTU', description: 'Gathers bay data inside a substation' },
      { id: 'concentrator', label: 'Data concentrator', description: 'Aggregates several IEDs or RTUs upstream' },
    ],
  },
  sis: {
    label: 'Safety controller',
    description: 'Safety instrumented system controller',
    defaultLevel: 1,
    defaultCriticality: 'high',
    variants: [
      generic('Safety instrumented system controller'),
      { id: 'safety-plc', label: 'Safety PLC', description: 'SIL-rated logic solver' },
      { id: 'esd', label: 'Emergency shutdown', description: 'Plant or unit emergency shutdown system' },
      { id: 'bms', label: 'Burner management', description: 'Combustion safeguarding system' },
    ],
  },
  machine: {
    label: 'Machine',
    description: 'Production machine with its own controller',
    defaultLevel: 1,
    defaultCriticality: 'high',
    variants: [
      generic('Production machine with its own controller'),
      { id: 'robot', label: 'Industrial robot', description: 'Robot arm and its controller' },
      { id: 'cnc', label: 'CNC machine', description: 'Computer-controlled machine tool' },
      { id: 'skid', label: 'Packaged skid', description: 'Vendor-supplied packaged unit' },
    ],
  },
  sensor: {
    label: 'Sensor',
    description: 'Field instrument',
    defaultLevel: 0,
    defaultCriticality: 'medium',
    variants: [
      generic('Field instrument'),
      { id: 'temperature', label: 'Temperature', description: 'Temperature transmitter' },
      { id: 'pressure', label: 'Pressure', description: 'Pressure transmitter' },
      { id: 'flow', label: 'Flow', description: 'Flow meter' },
      { id: 'level', label: 'Level', description: 'Level transmitter' },
      { id: 'analyser', label: 'Analyser', description: 'Process analyser' },
      { id: 'vibration', label: 'Vibration', description: 'Vibration monitor' },
    ],
  },
  actuator: {
    label: 'Actuator',
    description: 'Valve, motor or other final element',
    defaultLevel: 0,
    defaultCriticality: 'high',
    variants: [
      generic('Valve, motor or other final element'),
      { id: 'control-valve', label: 'Control valve', description: 'Modulating valve' },
      { id: 'onoff-valve', label: 'On/off valve', description: 'Isolation valve' },
      { id: 'motor', label: 'Motor', description: 'Electric motor' },
      { id: 'pump', label: 'Pump', description: 'Pump and drive' },
      { id: 'vfd', label: 'Variable-speed drive', description: 'Motor drive' },
    ],
  },
  hmi: {
    label: 'HMI',
    description: 'Human-machine interface',
    defaultLevel: 2,
    defaultCriticality: 'medium',
    variants: [
      generic('Human-machine interface'),
      { id: 'panel', label: 'Panel HMI', description: 'Touch panel on a machine or cabinet' },
      { id: 'station', label: 'Operator station', description: 'Control-room operator PC' },
      { id: 'web', label: 'Web / thin client', description: 'Browser or thin-client HMI' },
      { id: 'mobile', label: 'Mobile HMI', description: 'Tablet or handheld' },
    ],
  },
  scada: {
    label: 'SCADA server',
    description: 'Supervisory control and data acquisition server',
    defaultLevel: 3,
    defaultCriticality: 'high',
    variants: [
      generic('Supervisory control and data acquisition server'),
      { id: 'scada', label: 'SCADA server', description: 'Polls field devices and serves operators' },
      { id: 'dcs', label: 'DCS server', description: 'Distributed control system server' },
      { id: 'alarm', label: 'Alarm server', description: 'Alarm and event management' },
      { id: 'opc', label: 'OPC server', description: 'Publishes process data to other systems' },
    ],
  },
  ews: {
    label: 'Engineering workstation',
    description: 'Programs and configures controllers',
    defaultLevel: 3,
    defaultCriticality: 'high',
    variants: [
      generic('Programs and configures controllers'),
      { id: 'desktop', label: 'Desktop', description: 'Fixed engineering PC' },
      { id: 'laptop', label: 'Laptop', description: 'Portable engineering laptop' },
    ],
  },
  historian: {
    label: 'Historian',
    description: 'Process data historian',
    defaultLevel: 3,
    defaultCriticality: 'medium',
    variants: [
      generic('Process data historian'),
      { id: 'site', label: 'Site historian', description: 'Collects plant data on site' },
      { id: 'replica', label: 'DMZ replica', description: 'Read-only copy for business users' },
      { id: 'cloud', label: 'Cloud historian', description: 'Hosted time-series store' },
    ],
  },
  server: {
    label: 'Server',
    description: 'Infrastructure server',
    defaultLevel: 3,
    defaultCriticality: 'medium',
    variants: [
      generic('Infrastructure server'),
      { id: 'domain', label: 'Domain controller', description: 'Directory and authentication' },
      { id: 'patch', label: 'Patch / antivirus', description: 'Update and endpoint-protection server' },
      { id: 'file', label: 'File server', description: 'Shared storage' },
    ],
  },
  firewall: {
    label: 'Firewall',
    description: 'Filters traffic between network segments',
    defaultLevel: 3.5,
    defaultCriticality: 'high',
    variants: [
      generic('Filters traffic between network segments'),
      { id: 'industrial', label: 'Industrial firewall', description: 'DIN-rail firewall for cabinets' },
      { id: 'ngfw', label: 'Next-generation firewall', description: 'Rack firewall with application inspection' },
      { id: 'diode', label: 'Data diode', description: 'Hardware-enforced one-way gateway' },
    ],
  },
  switch: {
    label: 'Switch',
    description: 'Network switch',
    defaultLevel: 2,
    defaultCriticality: 'medium',
    variants: [
      generic('Network switch'),
      { id: 'managed', label: 'Managed switch', description: 'Configurable VLANs and port security' },
      { id: 'unmanaged', label: 'Unmanaged switch', description: 'No configuration interface' },
      { id: 'industrial', label: 'Industrial switch', description: 'DIN-rail, extended temperature range' },
      { id: 'l3', label: 'Layer 3 switch', description: 'Switch with routing' },
    ],
  },
  router: {
    label: 'Router',
    description: 'Layer 3 router',
    defaultLevel: 4,
    defaultCriticality: 'medium',
    variants: [
      generic('Layer 3 router'),
      { id: 'router', label: 'Router', description: 'Wired router' },
      { id: 'cellular', label: 'Cellular router', description: '4G/5G router for remote sites' },
      { id: 'vpn', label: 'VPN gateway', description: 'Terminates site-to-site or remote VPNs' },
    ],
  },
  gateway: {
    label: 'Gateway',
    description: 'Connects different networks or protocols',
    defaultLevel: 2,
    defaultCriticality: 'medium',
    variants: [
      generic('Connects different networks or protocols'),
      { id: 'converter', label: 'Protocol converter', description: 'Translates between fieldbus and Ethernet protocols' },
      { id: 'edge', label: 'IIoT edge gateway', description: 'Collects data and forwards it upstream' },
    ],
  },
  wap: {
    label: 'Wireless access point',
    description: 'Wireless network access point',
    defaultLevel: 2,
    defaultCriticality: 'medium',
    variants: [
      generic('Wireless network access point'),
      { id: 'wifi', label: 'Wi-Fi access point', description: 'Plant Wi-Fi' },
      { id: 'radio', label: 'Industrial radio', description: 'Point-to-point or mesh radio link' },
    ],
  },
  jumphost: {
    label: 'Jump host',
    description: 'Brokered remote-access host',
    defaultLevel: 3.5,
    defaultCriticality: 'medium',
    variants: [
      generic('Brokered remote-access host'),
      { id: 'jump', label: 'Jump host', description: 'Intermediate host for administrative sessions' },
      { id: 'ra-gateway', label: 'Remote-access gateway', description: 'Brokered vendor or staff access' },
    ],
  },
  workstation: {
    label: 'Corporate workstation',
    description: 'Enterprise IT endpoint',
    defaultLevel: 4,
    defaultCriticality: 'low',
    variants: [
      generic('Enterprise IT endpoint'),
      { id: 'desktop', label: 'Desktop', description: 'Office desktop' },
      { id: 'laptop', label: 'Laptop', description: 'Office laptop' },
    ],
  },
  internet: {
    label: 'Internet / remote',
    description: 'External network or remote party',
    defaultLevel: 5,
    defaultCriticality: 'low',
    variants: [
      generic('External network or remote party'),
      { id: 'internet', label: 'Internet', description: 'Public internet' },
      { id: 'vendor', label: 'Vendor remote', description: 'Equipment vendor or integrator' },
      { id: 'cloud', label: 'Cloud service', description: 'Hosted service provider' },
    ],
  },
};

export function variantInfo(type: DeviceType, variant: string): VariantInfo | undefined {
  return DEVICE_CATALOG[type].variants.find((v) => v.id === variant);
}

/** The most specific name for a device kind: the variant label, or the type label for `generic`. */
export function kindLabel(type: DeviceType, variant: string): string {
  return variant === 'generic' ? DEVICE_CATALOG[type].label : (variantInfo(type, variant)?.label ?? DEVICE_CATALOG[type].label);
}

/** Palette order, grouped roughly from field level upwards. */
export const PALETTE_GROUPS: { title: string; types: DeviceType[] }[] = [
  { title: 'Control', types: ['plc', 'rtu', 'sis', 'machine'] },
  { title: 'Field', types: ['sensor', 'actuator'] },
  { title: 'Supervisory', types: ['hmi', 'scada', 'ews', 'historian', 'server'] },
  { title: 'Network', types: ['firewall', 'switch', 'router', 'gateway', 'wap', 'jumphost'] },
  { title: 'Enterprise & external', types: ['workstation', 'internet'] },
];

export const REMOTE_SERVICE_PORTS = {
  rdp: 3389,
  ssh: 22,
  vnc: 5900,
  https: 443,
} as const;
