import { Badge, DinRail, fill, Leds, type IconSet } from './shared';

const modularPlc = (
  <>
    <DinRail />
    <rect x="3" y="6" width="9" height="17" rx="1" {...fill} />
    <Leds x={5.5} y={9} />
    <path d="M5 13h5M5 16h5M5 19h3" />
    {[12, 16.5, 21, 25.5].map((x) => (
      <g key={x}>
        <rect x={x} y="6" width="4.5" height="17" rx="0.6" {...fill} />
        <path d={`M${x + 2.25} 9v11`} strokeDasharray="1 1.6" />
      </g>
    ))}
  </>
);

const compactPlc = (
  <>
    <DinRail />
    <rect x="3" y="7" width="26" height="16" rx="1.5" {...fill} />
    <path d="M5 10h22M5 20h22" strokeDasharray="1.2 1.4" />
    <rect x="6" y="12.5" width="8" height="5" rx="0.5" />
    <Leds x={18} y={15} n={4} />
  </>
);

const microPlc = (
  <>
    <DinRail />
    <rect x="9" y="9" width="14" height="14" rx="1.5" {...fill} />
    <path d="M11 12h10M11 20h10" strokeDasharray="1.2 1.4" />
    <Leds x={13.5} y={16} n={3} />
  </>
);

const pac = (
  <>
    <rect x="2.5" y="5" width="27" height="20" rx="1.5" {...fill} />
    <rect x="5" y="8" width="6" height="14" rx="0.6" />
    <Leds x={6.8} y={11} n={2} gap={2.4} />
    <path d="M14 8v14M17.5 8v14M21 8v14M24.5 8v14" />
    <path d="M2.5 28h27" />
  </>
);

const softPlc = (
  <>
    <rect x="4" y="7" width="24" height="18" rx="1.5" {...fill} />
    <path d="M7 4v3M11 4v3M15 4v3M19 4v3M23 4v3" />
    <path d="M8 12v8M24 12v8M8 16h4.5M19.5 16H24" />
    <path d="M13 14v4M15 14v4" />
    <circle cx="18" cy="16" r="1.6" />
  </>
);

const remoteIo = (
  <>
    <DinRail />
    <rect x="3" y="7" width="7" height="16" rx="1" {...fill} />
    <rect x="4.6" y="9.5" width="3.8" height="3" rx="0.4" />
    <Leds x={5.3} y={16} n={2} gap={2.4} />
    {[10, 13, 16, 19, 22, 25].map((x) => (
      <rect key={x} x={x} y="7" width="3" height="16" rx="0.4" {...fill} />
    ))}
  </>
);

const fieldRtu = (
  <>
    <path d="M16 20v10M12 30h8" />
    <rect x="8" y="9" width="16" height="11" rx="1.2" {...fill} />
    <path d="M11 13h6M11 16h4" />
    <Leds x={19} y={13} n={2} gap={2.4} />
    <path d="M21 9V3" />
    <path d="M18.5 4.5a3.5 3.5 0 0 1 5 0" />
  </>
);

const substationRtu = (
  <>
    <rect x="6" y="3" width="20" height="26" rx="1.2" {...fill} />
    <path d="M9 7h14M9 11h14M9 15h14" />
    <Leds x={10} y={19} n={3} />
    <path d="M18.5 18.5 16.5 22.5h3l-2 4" strokeWidth="1.6" />
  </>
);

const concentrator = (
  <>
    <rect x="10" y="12" width="12" height="9" rx="1.2" {...fill} />
    <Leds x={13} y={16.5} n={3} />
    <rect x="2" y="3" width="6" height="5" rx="0.8" />
    <rect x="13" y="2" width="6" height="5" rx="0.8" />
    <rect x="24" y="3" width="6" height="5" rx="0.8" />
    <path d="M5 8l6 4M16 7v5M27 8l-6 4M16 21v7" />
  </>
);

const ied = (
  <>
    <rect x="6" y="3" width="20" height="26" rx="1.5" {...fill} />
    <rect x="9" y="6" width="14" height="6" rx="0.6" />
    <path d="M11 9h3l1-1.5 1.5 3 1-1.5h3" />
    <Leds x={10} y={16} n={4} gap={2.6} />
    <path d="M10 20.5h12M10 24h8" />
  </>
);

const safetyPlc = (
  <>
    {compactPlc}
    <Badge>
      <path d="M25 20.5l-3.5 1.5v2.6c0 2 1.5 3.4 3.5 4 2-.6 3.5-2 3.5-4V22Z" />
    </Badge>
  </>
);

const esd = (
  <>
    <rect x="7" y="20" width="18" height="8" rx="1.2" {...fill} />
    <path d="M10 20v-3h12v3" />
    <path d="M7.5 17a8.5 6.5 0 0 1 17 0Z" {...fill} />
    <path d="M16 6v3" />
  </>
);

const bms = (
  <>
    <path d="M16 3.5 6 7.5v7c0 6.3 4.2 11 10 13 5.8-2 10-6.7 10-13v-7Z" {...fill} />
    <path d="M16 23c-3 0-4.5-2-4.5-4.3 0-2.6 2.6-4.2 2.6-7.2 2.2 1.4 3.5 3 3.6 4.8.8-.6 1.2-1.5 1.3-2.5 1.2 1.3 1.5 2.9 1.5 4.6 0 2.4-1.7 4.6-4.5 4.6Z" />
  </>
);

const robot = (
  <>
    <rect x="4" y="25" width="10" height="4" rx="1" {...fill} />
    <path d="M9 25v-4" />
    <circle cx="9" cy="19.5" r="2" {...fill} />
    <path d="M10.5 18 17 10" strokeWidth="2.6" />
    <circle cx="18" cy="9" r="1.8" {...fill} />
    <path d="M19.6 9.8 25 13" strokeWidth="2.2" />
    <path d="M25.5 11.5l2.5-1.5M25.5 14.5l2.5 1.5" />
  </>
);

const cnc = (
  <>
    <rect x="3" y="5" width="26" height="22" rx="1.5" {...fill} />
    <rect x="6" y="9" width="14" height="13" rx="0.8" />
    <path d="M13 9v5M11.5 14h3l-1.5 2.5Z" />
    <path d="M8 20h10" />
    <rect x="22.5" y="9" width="4" height="5" rx="0.5" />
    <Leds x={23} y={18} n={2} gap={2.6} />
  </>
);

const skid = (
  <>
    <path d="M3 27h26M5 27v-2h22v2" />
    <rect x="6" y="9" width="8" height="16" rx="3" {...fill} />
    <circle cx="21" cy="21" r="3.5" {...fill} />
    <path d="M14 13h4v4.5M24.5 21H29M10 9V5h12" />
  </>
);

export const CONTROL_ICONS: IconSet = {
  plc: modularPlc,
  'plc:modular': modularPlc,
  'plc:compact': compactPlc,
  'plc:micro': microPlc,
  'plc:pac': pac,
  'plc:soft': softPlc,
  'plc:remote-io': remoteIo,
  rtu: fieldRtu,
  'rtu:field': fieldRtu,
  'rtu:substation': substationRtu,
  'rtu:concentrator': concentrator,
  'rtu:ied': ied,
  sis: safetyPlc,
  'sis:safety-plc': safetyPlc,
  'sis:esd': esd,
  'sis:bms': bms,
  machine: robot,
  'machine:robot': robot,
  'machine:cnc': cnc,
  'machine:skid': skid,
};
