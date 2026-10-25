import type { ReactElement } from 'react';
import type { DeviceType } from '../model/schema';

// Original line icons drawn on a 24×24 grid; colour comes from `currentColor`.
const PATHS: Record<DeviceType, ReactElement> = {
  plc: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M8 5v14M13 5v14" />
      <path d="M15.5 9h3M15.5 12h3M15.5 15h3" />
      <circle cx="5.5" cy="8" r="0.6" fill="currentColor" />
    </>
  ),
  rtu: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M12 9V4M9 6.5a4 4 0 0 1 6 0" />
      <path d="M7.5 13h4M7.5 16h6" />
    </>
  ),
  sis: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16" r="0.7" fill="currentColor" />
    </>
  ),
  hmi: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M9 21h6M12 17v4" />
      <path d="M6.5 13l3-3 2.5 2 4-4.5" />
    </>
  ),
  scada: (
    <>
      <rect x="4" y="3.5" width="16" height="5" rx="1" />
      <rect x="4" y="9.5" width="16" height="5" rx="1" />
      <rect x="4" y="15.5" width="16" height="5" rx="1" />
      <path d="M7 6h.01M7 12h.01M7 18h.01" strokeWidth="2.2" />
      <path d="M11 6h6M11 12h6M11 18h6" />
    </>
  ),
  ews: (
    <>
      <rect x="4.5" y="5" width="15" height="10" rx="1" />
      <path d="M2.5 18.5h19l-1.5-3.5h-16Z" />
      <path d="M9.5 8.5 7.5 10l2 1.5M14.5 8.5l2 1.5-2 1.5" />
    </>
  ),
  historian: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" />
      <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  firewall: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 4v5.3M6 9.3v5.4M12 9.3v5.4M18 9.3v5.4M9 14.7V20M15 14.7V20" />
    </>
  ),
  switch: (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="1.5" />
      <path d="M6 10.5h7l-1.5-1.5M18 13.5h-7l1.5 1.5" />
    </>
  ),
  router: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6v4.5M10.5 7.5 12 6l1.5 1.5M12 18v-4.5M10.5 16.5 12 18l1.5-1.5M6 12h4.5M7.5 10.5 6 12l1.5 1.5M18 12h-4.5M16.5 10.5 18 12l-1.5 1.5" />
    </>
  ),
  sensor: (
    <>
      <path d="M4.5 16a7.5 7.5 0 1 1 15 0" />
      <path d="M12 16l3.5-4.5" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
      <path d="M3 19.5h18" />
    </>
  ),
  actuator: (
    <>
      <path d="M3 8.5v9l9-4.5Zm18 0v9l-9-4.5Z" />
      <path d="M12 13V6M8.5 6h7" />
    </>
  ),
  jumphost: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
      <path d="M7 10h8M12.5 7.5 15 10l-2.5 2.5" />
    </>
  ),
  workstation: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  internet: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5Z" />
    </>
  ),
};

export function DeviceIcon({ type, size = 24 }: { type: DeviceType; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[type]}
    </svg>
  );
}
