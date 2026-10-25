import { Badge, fill, Leds, solid, type IconSet } from './shared';

const trend = <path d="M8 18l3.5-4 3 2.5 4-5.5 3 3.5 2.5-2" />;

const panelHmi = (
  <>
    <rect x="2.5" y="5" width="27" height="20" rx="2" {...fill} />
    <rect x="5.5" y="8" width="21" height="14" rx="0.8" />
    {trend}
    <path d="M10 28h12" />
  </>
);

const operatorStation = (
  <>
    <rect x="2" y="5" width="13" height="10" rx="1" {...fill} />
    <rect x="17" y="5" width="13" height="10" rx="1" {...fill} />
    <path d="M4.5 12l2.5-3 2 2 3-3.5M19.5 12h3l1.5-3 1.5 4 1.5-1.5" />
    <path d="M8.5 15v3M23.5 15v3M2 18h28v3H2Z" />
    <path d="M10 25h12" />
  </>
);

const webHmi = (
  <>
    <rect x="3" y="4" width="26" height="22" rx="2" {...fill} />
    <path d="M3 9h26" />
    <Leds x={6} y={6.5} n={3} gap={2.2} />
    <path d="M7 21l4-5 3 2.5 4-6 3 4 4-3" />
  </>
);

const mobileHmi = (
  <>
    <rect x="8" y="2.5" width="16" height="27" rx="2.5" {...fill} />
    <rect x="10.5" y="6" width="11" height="17" rx="0.6" />
    <path d="M12 18l2.5-3 2 1.5 3-4" />
    <circle cx="16" cy="26" r="1" {...solid} />
  </>
);

const tower = (
  <>
    <rect x="9" y="3" width="14" height="26" rx="1.5" {...fill} />
    <path d="M12 7h8M12 10h8M12 13h8" />
    <circle cx="16" cy="24" r="1.4" />
  </>
);

const scadaServer = (
  <>
    <rect x="4" y="3" width="11" height="26" rx="1.2" {...fill} />
    <path d="M7 7h5M7 10h5M7 13h5" />
    <circle cx="9.5" cy="24" r="1.2" />
    <rect x="17" y="9" width="12" height="9" rx="1" {...fill} />
    <path d="M19 15.5l2-2.5 2 1.5 3-3.5M23 18v3M20 21h6" />
  </>
);

const dcsServer = (
  <>
    <rect x="3" y="3" width="26" height="26" rx="1.5" {...fill} />
    <rect x="6" y="6" width="9" height="20" rx="0.6" />
    <rect x="17" y="6" width="9" height="20" rx="0.6" />
    <Leds x={8.3} y={9} n={2} gap={2.4} />
    <Leds x={19.3} y={9} n={2} gap={2.4} />
    <path d="M10.5 15.5h11M19 13.5l2.5 2-2.5 2M13 17.5l-2.5-2" />
  </>
);

const alarmServer = (
  <>
    {tower}
    <Badge>
      <path d="M22 27h6M25 20.5a2.6 2.6 0 0 0-2.6 2.6v2.4L21.5 27h7l-.9-1.5v-2.4a2.6 2.6 0 0 0-2.6-2.6Z" />
    </Badge>
  </>
);

const opcServer = (
  <>
    {tower}
    <Badge>
      <path d="M21.8 25h6.4M26 22.8l2.2 2.2-2.2 2.2" />
    </Badge>
  </>
);

const engineeringDesktop = (
  <>
    <rect x="2" y="4" width="20" height="15" rx="1.2" {...fill} />
    <path d="M5.5 8v8M18.5 8v8M5.5 12h3.5M15 12h3.5M10.5 10.5v3M12.5 10.5v3" />
    <path d="M12 19v4M7 23h10" />
    <rect x="24" y="8" width="6" height="18" rx="1" {...fill} />
    <path d="M25.8 11.5h2.4" />
  </>
);

const engineeringLaptop = (
  <>
    <rect x="5" y="5" width="22" height="15" rx="1.2" {...fill} />
    <path d="M12 10l-2.5 2.5L12 15M20 10l2.5 2.5L20 15M17.2 9.5l-2.4 6" />
    <path d="M2 23.5h28l-2-3.5H4Z" {...fill} />
  </>
);

const cylinder = (cx: number, top: number, w: number, h: number) => (
  <>
    <path
      d={`M${cx - w / 2} ${top}v${h}c0 1.7 ${w / 4} 3 ${w / 2} 3s${w / 2}-1.3 ${w / 2}-3v-${h}`}
      {...fill}
    />
    <ellipse cx={cx} cy={top} rx={w / 2} ry="3" {...fill} />
    <path d={`M${cx - w / 2} ${top + h / 2}c0 1.7 ${w / 4} 3 ${w / 2} 3s${w / 2}-1.3 ${w / 2}-3`} />
  </>
);

const siteHistorian = (
  <>
    {cylinder(14, 6, 18, 18)}
    <path d="M20 28l3-4 2.5 2 4-6" strokeWidth="1.8" />
  </>
);

const replicaHistorian = (
  <>
    {cylinder(9, 8, 12, 15)}
    {cylinder(23, 8, 12, 15)}
    <path d="M14 4.5h4.5M16.5 2.5l2 2-2 2" />
  </>
);

const cloudHistorian = (
  <>
    <path d="M9 18a5.5 5.5 0 0 1 .8-10.9A7 7 0 0 1 23 8.5a4.8 4.8 0 0 1 .5 9.5Z" {...fill} />
    {cylinder(16, 19, 10, 7)}
  </>
);

const rackServer = (
  <>
    {[4, 12, 20].map((y) => (
      <g key={y}>
        <rect x="3" y={y} width="26" height="7" rx="1" {...fill} />
        <circle cx="6.5" cy={y + 3.5} r="0.9" {...solid} />
        <path d={`M17 ${y + 3.5}h9`} />
      </g>
    ))}
  </>
);

const domainServer = (
  <>
    {rackServer}
    <Badge>
      <path d="M23 26.5a2 2 0 1 1 1.6-3.2l3.4 0v1.5h-1.2v1.2h-1.4v-1.2h-.8A2 2 0 0 1 23 26.5Z" />
    </Badge>
  </>
);

const patchServer = (
  <>
    {rackServer}
    <Badge>
      <path d="M22.3 25.2l1.9 1.9 3.6-3.8" />
    </Badge>
  </>
);

const fileServer = (
  <>
    {rackServer}
    <Badge>
      <path d="M21.5 23v4.5h7v-3.6h-3.3l-1-.9Z" />
    </Badge>
  </>
);

export const SUPERVISORY_ICONS: IconSet = {
  hmi: panelHmi,
  'hmi:panel': panelHmi,
  'hmi:station': operatorStation,
  'hmi:web': webHmi,
  'hmi:mobile': mobileHmi,
  scada: scadaServer,
  'scada:scada': scadaServer,
  'scada:dcs': dcsServer,
  'scada:alarm': alarmServer,
  'scada:opc': opcServer,
  ews: engineeringDesktop,
  'ews:desktop': engineeringDesktop,
  'ews:laptop': engineeringLaptop,
  historian: siteHistorian,
  'historian:site': siteHistorian,
  'historian:replica': replicaHistorian,
  'historian:cloud': cloudHistorian,
  server: rackServer,
  'server:domain': domainServer,
  'server:patch': patchServer,
  'server:file': fileServer,
};
