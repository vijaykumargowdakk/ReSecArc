import type { DeviceType } from '../../model/schema';
import { CONTROL_ICONS } from './control';
import { ENTERPRISE_ICONS } from './enterprise';
import { FIELD_ICONS } from './field';
import { NETWORK_ICONS } from './network';
import { SUPERVISORY_ICONS } from './supervisory';
import type { IconSet } from './shared';

export const ICONS: IconSet = {
  ...CONTROL_ICONS,
  ...FIELD_ICONS,
  ...SUPERVISORY_ICONS,
  ...NETWORK_ICONS,
  ...ENTERPRISE_ICONS,
};

/** Icon key for a device kind: the variant's own icon if drawn, else the type's base icon. */
export function iconKey(type: DeviceType, variant = 'generic'): string {
  const own = `${type}:${variant}`;
  return variant !== 'generic' && own in ICONS ? own : type;
}

/** Original two-tone device silhouettes on a 32×32 grid. */
export function DeviceIcon({ type, variant, size = 32 }: { type: DeviceType; variant?: string; size?: number }) {
  return (
    <svg
      className="device-icon"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[iconKey(type, variant)]}
    </svg>
  );
}
