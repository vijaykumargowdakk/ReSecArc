import type { ReactElement } from 'react';

/** Icon bodies keyed by device type (`plc`) or a specific variant (`plc:compact`). */
export type IconSet = Record<string, ReactElement>;

/** Spread onto a shape to give it the theme's two-tone fill. */
export const fill = { fill: 'var(--icon-fill)' } as const;
/** Spread onto a small detail that should be solid in the stroke colour. */
export const solid = { fill: 'currentColor', stroke: 'none' } as const;

/** Horizontal DIN rail that cabinet-mounted devices sit on. */
export const DinRail = ({ y = 25 }: { y?: number }) => <path d={`M2 ${y}h28`} strokeWidth="2.2" />;

/** Row of small status LEDs. */
export const Leds = ({ x, y, n = 3, gap = 2.5 }: { x: number; y: number; n?: number; gap?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <circle key={i} cx={x + i * gap} cy={y} r="0.8" {...solid} />
    ))}
  </>
);

/** Row of network ports drawn as small squares. */
export const Ports = ({ x, y, n, gap = 3.2 }: { x: number; y: number; n: number; gap?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <rect key={i} x={x + i * gap} y={y} width="2.2" height="2" rx="0.3" strokeWidth="1" />
    ))}
  </>
);

/** Small circular badge in the bottom-right corner that distinguishes a variant. */
export const Badge = ({ children }: { children: ReactElement }) => (
  <g>
    <circle cx="25" cy="25" r="6" fill="var(--icon-badge-bg, #fff)" />
    <circle cx="25" cy="25" r="6" {...fill} />
    {children}
  </g>
);
