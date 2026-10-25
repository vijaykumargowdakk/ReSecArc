import { z } from 'zod';

export const SCHEMA_VERSION = 4;

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
/** Canvas coordinates and sizes. The bound is far beyond any real diagram and keeps layout arithmetic exact. */
export const MAX_COORDINATE = 1_000_000;
const coordSchema = z.number().min(-MAX_COORDINATE).max(MAX_COORDINATE);
const sizeSchema = z.number().positive().max(MAX_COORDINATE);
const pointSchema = z.object({ x: coordSchema, y: coordSchema });
/** Bend points of a link or flow, in drawing order. */
const waypointsSchema = z.array(pointSchema).max(100);
const vlanSchema = z.number().int().min(1).max(4094);

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
  position: pointSchema,
  services: z.array(remoteServiceSchema),
  asset: assetSchema,
  /** Free labels such as "patch-pending" or "line-3"; trimmed, without duplicates. */
  tags: z.array(z.string().min(1).max(60)).max(50),
  /** Values of the project's custom fields, keyed by field definition id. */
  fields: z.record(z.string()),
  locked: z.boolean(),
  firewall: firewallConfigSchema.optional(),
});

export const linkSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  medium: z.enum(['ethernet', 'serial', 'wireless']),
  /** Interface or port names at each end, e.g. "Gi1/0/12" or "X1"; empty when unknown. */
  sourcePort: z.string().max(60),
  targetPort: z.string().max(60),
  /** One VLAN for an access link, several for a trunk. */
  vlans: z.array(vlanSchema).max(200),
  /** The planned network this link carries, if any. */
  networkId: idSchema.nullable(),
  waypoints: waypointsSchema,
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
  waypoints: waypointsSchema,
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
    x: coordSchema,
    y: coordSchema,
    width: sizeSchema,
    height: sizeSchema,
  }),
  collapsed: z.boolean(),
  locked: z.boolean(),
});

export const noteSchema = z.object({
  id: idSchema,
  siteId: idSchema,
  text: z.string(),
  position: pointSchema,
  width: sizeSchema,
  color: colorSchema,
  locked: z.boolean(),
});

export const networkSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** IPv4 subnet in CIDR notation, e.g. `10.10.1.0/24`; checked in referenceErrors. */
  cidr: z.string(),
  vlan: z.number().int().min(1).max(4094).nullable(),
  zoneId: idSchema.nullable(),
  /** `null` when the network spans every site. */
  siteId: idSchema.nullable(),
});

/** A project-specific device attribute, such as owner, cabinet or support end date. */
export const fieldDefSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(60),
  kind: z.enum(['text', 'date', 'select']),
  /** Choices for a `select` field; empty for the other kinds. */
  options: z.array(z.string().min(1).max(60)).max(100),
});

/** Everything that describes the design itself; a revision stores a copy of this. */
export const designSchema = z.object({
  name: z.string(),
  sites: z.array(siteSchema).min(1),
  devices: z.array(deviceSchema),
  links: z.array(linkSchema),
  flows: z.array(flowSchema),
  zones: z.array(zoneSchema),
  areas: z.array(areaSchema),
  notes: z.array(noteSchema),
  networks: z.array(networkSchema),
  fieldDefs: z.array(fieldDefSchema).max(50),
});

export const revisionSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** ISO 8601 timestamp. */
  createdAt: z.string().datetime(),
  design: designSchema,
});

export const projectSchema = designSchema.extend({
  schemaVersion: z.literal(SCHEMA_VERSION),
  revisions: z.array(revisionSchema),
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
export type Note = z.infer<typeof noteSchema>;
export type Network = z.infer<typeof networkSchema>;
export type FieldDef = z.infer<typeof fieldDefSchema>;
export type Design = z.infer<typeof designSchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type Project = z.infer<typeof projectSchema>;
