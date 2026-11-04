// The parts of the file format that startup code needs, without the validator. The zod schemas in
// schema.ts and the parser in io.ts load on demand (see parseProjectText below), so they stay out
// of the startup bundle; startup modules import values from here and only types from schema.ts.
import type { Project } from './schema';

export const SCHEMA_VERSION = 6;

/** Canvas coordinates and sizes. The bound is far beyond any real diagram and keeps layout arithmetic exact. */
export const MAX_COORDINATE = 1_000_000;

export const DEVICE_TYPES = [
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
] as const;

const DEVICE_TYPE_SET: ReadonlySet<string> = new Set(DEVICE_TYPES);

export function isDeviceType(value: unknown): value is (typeof DEVICE_TYPES)[number] {
  return typeof value === 'string' && DEVICE_TYPE_SET.has(value);
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2) + '\n';
}

/** Validates a project file like `parseProject` in io.ts, loading the validator first. */
export async function parseProjectText(text: string): Promise<import('./io').ParseResult> {
  const { parseProject } = await import('./io');
  return parseProject(text);
}
