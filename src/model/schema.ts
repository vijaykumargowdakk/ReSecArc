import { z } from 'zod';

export const SCHEMA_VERSION = 2;

export const deviceTypeSchema = z.enum([
  'plc',
  'rtu',
  'hmi',
  'scada',
  'ews',
  'historian',
  'sis',
  'firewall',
  'switch',
  'router',
  'sensor',
  'actuator',
  'jumphost',
  'workstation',
  'internet',
  'gateway',
  'wap',
  'server',
  'machine',
]);

export const purdueLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(3.5),
  z.literal(4),
  z.literal(5),
]);

const idSchema = z.string().min(1);
const portSchema = z.number().int().min(1).max(65535);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const remoteServiceSchema = z.object({
  protocol: z.enum(['rdp', 'ssh', 'vnc', 'https']),
  port: portSchema,
});

export const ruleEndpointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('any') }),
  z.object({ kind: z.literal('zone'), id: idSchema }),
  z.object({ kind: z.literal('device'), id: idSchema }),
]);

export const firewallRuleSchema = z.object({
  id: idSchema,
  src: ruleEndpointSchema,
  dst: ruleEndpointSchema,
  /** `any`, a flow protocol id or a remote-access protocol; checked against the registry. */
  protocol: z.string().min(1),
  port: portSchema.nullable(),
  action: z.enum(['allow', 'deny']),
  note: z.string(),
});

export const firewallConfigSchema = z.object({
  defaultAction: z.enum(['allow', 'deny']),
  rules: z.array(firewallRuleSchema),
});

export const assetSchema = z.object({
  vendor: z.string(),
  model: z.string(),
  firmware: z.string(),
  serial: z.string(),
  ip: z.string(),
  notes: z.string(),
});

export const deviceSchema = z.object({
  id: idSchema,
  type: deviceTypeSchema,
  /** A catalog variant id for this type, `generic` by default. */
  variant: idSchema,
  label: z.string(),
  purdueLevel: purdueLevelSchema,
  siteId: idSchema,
  zoneId: idSchema.nullable(),
  areaId: idSchema.nullable(),
  criticality: z.enum(['low', 'medium', 'high']),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  services: z.array(remoteServiceSchema),
  asset: assetSchema,
  firewall: firewallConfigSchema.optional(),
});

export const linkSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  medium: z.enum(['ethernet', 'serial', 'wireless']),
});

export const flowSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  /** Protocol registry id; see model/protocols.ts. */
  protocol: idSchema,
  /** `null` for layer-2 protocols. */
  port: portSchema.nullable(),
  settings: z.record(z.union([z.boolean(), z.string(), z.number()])),
});

export const zoneSchema = z.object({
  id: idSchema,
  name: z.string(),
  color: colorSchema,
  trusted: z.boolean(),
  targetSL: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export const siteSchema = z.object({
  id: idSchema,
  name: z.string(),
});

export const areaSchema = z.object({
  id: idSchema,
  siteId: idSchema,
  name: z.string(),
  color: colorSchema,
  rect: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }),
  collapsed: z.boolean(),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string(),
  sites: z.array(siteSchema).min(1),
  devices: z.array(deviceSchema),
  links: z.array(linkSchema),
  flows: z.array(flowSchema),
  zones: z.array(zoneSchema),
  areas: z.array(areaSchema),
});

export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type PurdueLevel = z.infer<typeof purdueLevelSchema>;
export type RemoteService = z.infer<typeof remoteServiceSchema>;
export type RuleEndpoint = z.infer<typeof ruleEndpointSchema>;
export type FirewallRule = z.infer<typeof firewallRuleSchema>;
export type FirewallConfig = z.infer<typeof firewallConfigSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Site = z.infer<typeof siteSchema>;
export type Area = z.infer<typeof areaSchema>;
export type Project = z.infer<typeof projectSchema>;
