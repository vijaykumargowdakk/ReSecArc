import { z } from 'zod';

export const SCHEMA_VERSION = 1;

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

export const remoteServiceSchema = z.object({
  protocol: z.enum(['rdp', 'ssh', 'vnc', 'https']),
  port: portSchema,
});

export const ruleEndpointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('any') }),
  z.object({ kind: z.literal('zone'), id: idSchema }),
  z.object({ kind: z.literal('device'), id: idSchema }),
]);

export const ruleProtocolSchema = z.enum(['any', 'modbus', 'dnp3', 'rdp', 'ssh', 'vnc', 'https']);

export const firewallRuleSchema = z.object({
  id: idSchema,
  src: ruleEndpointSchema,
  dst: ruleEndpointSchema,
  protocol: ruleProtocolSchema,
  port: portSchema.nullable(),
  action: z.enum(['allow', 'deny']),
  note: z.string(),
});

export const firewallConfigSchema = z.object({
  defaultAction: z.enum(['allow', 'deny']),
  rules: z.array(firewallRuleSchema),
});

export const deviceSchema = z.object({
  id: idSchema,
  type: deviceTypeSchema,
  label: z.string(),
  purdueLevel: purdueLevelSchema,
  zoneId: idSchema.nullable(),
  criticality: z.enum(['low', 'medium', 'high']),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  services: z.array(remoteServiceSchema),
  firewall: firewallConfigSchema.optional(),
});

export const linkSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  medium: z.enum(['ethernet', 'serial', 'wireless']),
});

export const modbusFlowSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  protocol: z.literal('modbus'),
  variant: z.enum(['tcp', 'tls']),
  port: portSchema,
  access: z.enum(['read', 'write', 'read-write']),
  authentication: z.boolean(),
});

export const dnp3FlowSchema = z.object({
  id: idSchema,
  source: idSchema,
  target: idSchema,
  protocol: z.literal('dnp3'),
  transport: z.enum(['tcp', 'udp']),
  port: portSchema,
  secureAuthentication: z.boolean(),
  tls: z.boolean(),
  controlCommands: z.boolean(),
});

export const flowSchema = z.discriminatedUnion('protocol', [modbusFlowSchema, dnp3FlowSchema]);

export const zoneSchema = z.object({
  id: idSchema,
  name: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  trusted: z.boolean(),
  targetSL: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string(),
  devices: z.array(deviceSchema),
  links: z.array(linkSchema),
  flows: z.array(flowSchema),
  zones: z.array(zoneSchema),
});

export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type PurdueLevel = z.infer<typeof purdueLevelSchema>;
export type RemoteService = z.infer<typeof remoteServiceSchema>;
export type RuleEndpoint = z.infer<typeof ruleEndpointSchema>;
export type RuleProtocol = z.infer<typeof ruleProtocolSchema>;
export type FirewallRule = z.infer<typeof firewallRuleSchema>;
export type FirewallConfig = z.infer<typeof firewallConfigSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type Link = z.infer<typeof linkSchema>;
export type ModbusFlow = z.infer<typeof modbusFlowSchema>;
export type Dnp3Flow = z.infer<typeof dnp3FlowSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FlowProtocol = Flow['protocol'];
export type Zone = z.infer<typeof zoneSchema>;
export type Project = z.infer<typeof projectSchema>;
