import { Badge, DinRail, fill, Leds, Ports, type IconSet } from './shared';

const bricks = (x: number, y: number, w: number, h: number) => {
  const row = h / 3;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="1" {...fill} />
      <path
        d={[
          `M${x} ${y + row}h${w}M${x} ${y + 2 * row}h${w}`,
          `M${x + w / 2} ${y}v${row}M${x + w / 4} ${y + row}v${row}M${x + (3 * w) / 4} ${y + row}v${row}`,
          `M${x + w / 2} ${y + 2 * row}v${row}`,
        ].join('')}
      />
    </>
  );
};

const firewall = bricks(4, 6, 24, 20);

const industrialFirewall = (
  <>
    <DinRail />
    <rect x="9" y="3" width="14" height="20" rx="1.2" {...fill} />
    <path d="M11.5 7h9M11.5 10.5h9M16 7v3.5M13.7 10.5v3.5M18.3 10.5v3.5M11.5 14h9" />
    <Ports x={11.5} y={17.5} n={3} gap={3.2} />
  </>
);

const ngfw = (
  <>
    <rect x="2" y="16" width="28" height="9" rx="1.2" {...fill} />
    <Ports x={4.5} y={19.5} n={6} />
    <Leds x={25} y={20.5} n={2} gap={2.4} />
    {bricks(9, 4, 14, 10)}
  </>
);

const diode = (
  <>
    <rect x="3" y="8" width="26" height="16" rx="1.5" {...fill} />
    <path d="M6 16h20" />
    <path d="M13 11.5v9l7-4.5Z" {...fill} />
    <path d="M20.5 11.5v9" strokeWidth="2" />
  </>
);

const managedSwitch = (
  <>
    <rect x="2" y="10" width="28" height="12" rx="1.5" {...fill} />
    <Ports x={4.5} y={13} n={8} gap={2.9} />
    <Ports x={4.5} y={17} n={8} gap={2.9} />
  </>
);

const unmanagedSwitch = (
  <>
    <rect x="6" y="11" width="20" height="10" rx="1.5" {...fill} />
    <Ports x={8.6} y={15} n={5} gap={3.2} />
  </>
);

const industrialSwitch = (
  <>
    <DinRail y={28} />
    <rect x="10" y="3" width="12" height="23" rx="1.2" {...fill} />
    <Leds x={13} y={6} n={3} />
    {[9.5, 13, 16.5, 20].map((y) => (
      <rect key={y} x="13.5" y={y} width="5" height="2.2" rx="0.3" strokeWidth="1" />
    ))}
  </>
);

const l3Switch = (
  <>
    {managedSwitch}
    <path d="M10 6.5h12M19.5 4.5l2.5 2-2.5 2M12.5 4.5l-2.5 2 2.5 2" />
    <path d="M10 26h12M19.5 24l2.5 2-2.5 2" />
  </>
);

const routerPuck = (
  <>
    <ellipse cx="16" cy="19" rx="12" ry="5" {...fill} />
    <path d="M4 19v4c0 2.8 5.4 5 12 5s12-2.2 12-5v-4" {...fill} />
    <path d="M11 17.5h4M13.5 15.8l1.7 1.7-1.7 1.7M21 20.5h-4M18.5 18.8l-1.7 1.7 1.7 1.7" />
  </>
);

const router = (
  <>
    {routerPuck}
    <path d="M16 13V4M13.5 6.5 16 4l2.5 2.5" />
  </>
);

const cellularRouter = (
  <>
    <rect x="4" y="13" width="24" height="12" rx="1.5" {...fill} />
    <Ports x={7} y={20} n={4} />
    <Leds x={21} y={17} n={3} />
    <path d="M8 13V4M24 13V4" strokeWidth="2" />
    <path d="M12 9.5v1.5M15 8v3M18 6.5v4.5" strokeWidth="1.6" />
  </>
);

const vpnGateway = (
  <>
    {routerPuck}
    <rect x="11" y="6" width="10" height="7" rx="1" {...fill} />
    <path d="M13 6V4.5a3 3 0 0 1 6 0V6" />
  </>
);

const converter = (
  <>
    <rect x="3" y="9" width="26" height="14" rx="1.5" {...fill} />
    <path d="M6 13.5h6v5H6Z" />
    <circle cx="7.6" cy="16" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="10.4" cy="16" r="0.6" fill="currentColor" stroke="none" />
    <rect x="21" y="13.5" width="5" height="5" rx="0.5" />
    <path d="M14 16h5M17 14l2 2-2 2" />
  </>
);

const edgeGateway = (
  <>
    <rect x="4" y="15" width="24" height="12" rx="1.5" {...fill} />
    <Ports x={7} y={22} n={4} />
    <path d="M10 11a4 4 0 0 1 .6-7.9A5.2 5.2 0 0 1 20.3 4a3.6 3.6 0 0 1 .7 7Z" {...fill} />
    <path d="M16 15V8M14 10l2-2 2 2" />
  </>
);

const wifiAp = (
  <>
    <path d="M4 25h24a12 5 0 0 0-24 0Z" {...fill} />
    <path d="M4 25v2h24v-2" />
    <path d="M11 13.5a7 7 0 0 1 10 0M8 10.5a11 11 0 0 1 16 0M14 16.5a3 3 0 0 1 4 0" />
  </>
);

const radio = (
  <>
    <path d="M12 29l4-18 4 18M13.3 23h5.4" />
    <path d="M9 11h14M10.5 8h11M12 5h8" />
    <path d="M25 15c1.5 1.4 1.5 3.6 0 5M27.5 13c2.6 2.6 2.6 6.4 0 9" />
    <circle cx="16" cy="11" r="1" {...fill} />
  </>
);

const monitor = (
  <>
    <rect x="3" y="4" width="26" height="17" rx="1.5" {...fill} />
    <path d="M16 21v4M10 26h12" />
  </>
);

const jumpHost = (
  <>
    {monitor}
    <path d="M8 16c1-5 6-7 10.5-5" />
    <path d="M17 8.5l2.5 2.5-2.8 2" />
    <circle cx="8" cy="16" r="1.2" {...fill} />
    <circle cx="23.5" cy="15" r="1.5" {...fill} />
  </>
);

const raGateway = (
  <>
    {monitor}
    <Badge>
      <>
        <rect x="21.8" y="24" width="6.4" height="4.5" rx="0.7" />
        <path d="M23.2 24v-1.3a1.8 1.8 0 0 1 3.6 0V24" />
      </>
    </Badge>
  </>
);

export const NETWORK_ICONS: IconSet = {
  firewall,
  'firewall:industrial': industrialFirewall,
  'firewall:ngfw': ngfw,
  'firewall:diode': diode,
  switch: managedSwitch,
  'switch:managed': managedSwitch,
  'switch:unmanaged': unmanagedSwitch,
  'switch:industrial': industrialSwitch,
  'switch:l3': l3Switch,
  router,
  'router:router': router,
  'router:cellular': cellularRouter,
  'router:vpn': vpnGateway,
  gateway: converter,
  'gateway:converter': converter,
  'gateway:edge': edgeGateway,
  wap: wifiAp,
  'wap:wifi': wifiAp,
  'wap:radio': radio,
  jumphost: jumpHost,
  'jumphost:jump': jumpHost,
  'jumphost:ra-gateway': raGateway,
};
