import { describe, expect, it } from 'vitest';
import { DEVICE_CATALOG } from '../../model/catalog';
import type { DeviceType } from '../../model/schema';
import { iconKey, ICONS } from './index';

const types = Object.keys(DEVICE_CATALOG) as DeviceType[];

describe('device icons', () => {
  it('has a base icon for every device type', () => {
    for (const type of types) expect(ICONS[type], type).toBeDefined();
  });

  it('draws a specific icon for every non-generic variant', () => {
    const missing = types.flatMap((type) =>
      DEVICE_CATALOG[type].variants.filter((v) => v.id !== 'generic' && !(`${type}:${v.id}` in ICONS)).map((v) => `${type}:${v.id}`),
    );
    expect(missing).toEqual([]);
  });

  it('has no icons for kinds that are not in the catalog', () => {
    const known = new Set(types.flatMap((type) => [type, ...DEVICE_CATALOG[type].variants.map((v) => `${type}:${v.id}`)]));
    expect(Object.keys(ICONS).filter((k) => !known.has(k))).toEqual([]);
  });

  it('falls back to the type icon for generic and unknown variants', () => {
    expect(iconKey('plc')).toBe('plc');
    expect(iconKey('plc', 'compact')).toBe('plc:compact');
    expect(iconKey('plc', 'nonexistent')).toBe('plc');
  });
});
