import type { ReactElement } from 'react';
import { fill, solid, type IconSet } from './shared';

/** Field transmitter: round head on a stem into a process pipe, with a measurement symbol in the head. */
const transmitter = (symbol: ReactElement) => (
  <>
    <path d="M2 27h28M2 31h28" />
    <path d="M16 18v9" />
    <circle cx="16" cy="11" r="7.5" {...fill} />
    {symbol}
  </>
);

const pressure = transmitter(
  <>
    <path d="M11 13.5a5.5 5.5 0 0 1 10 0" />
    <path d="M16 13.5l3-4" />
    <circle cx="16" cy="13.5" r="0.9" {...solid} />
  </>,
);

const temperature = transmitter(
  <>
    <path d="M16 6.5v6" strokeWidth="2.4" />
    <circle cx="16" cy="14.2" r="2" {...solid} />
  </>,
);

const flow = (
  <>
    <path d="M2 21h28M2 29h28" />
    <path d="M7 25h16M20 22.5l3 2.5-3 2.5" />
    <path d="M16 21v-4" />
    <rect x="10" y="4" width="12" height="13" rx="2" {...fill} />
    <path d="M13 8.5h6M13 12h4" />
  </>
);

const level = (
  <>
    <rect x="5" y="9" width="17" height="20" rx="2" {...fill} />
    <path d="M5 19c2.2-1.2 4.2 1.2 6.2 0s4-1.2 6 0 3.5 0 4.8-.6" />
    <path d="M18 9V4h7v4" />
    <rect x="22" y="8" width="6" height="7" rx="1" {...fill} />
    <path d="M25 15v6" strokeDasharray="1 1.5" />
  </>
);

const analyser = (
  <>
    <rect x="5" y="3" width="22" height="26" rx="1.5" {...fill} />
    <rect x="8" y="6" width="9" height="5" rx="0.6" />
    <path d="M13.5 15v4l-3.5 6h9l-3.5-6v-4" />
    <path d="M12.5 15h4" />
    <circle cx="22.5" cy="8.5" r="1.6" />
  </>
);

const vibration = (
  <>
    <rect x="3" y="14" width="16" height="12" rx="2" {...fill} />
    <path d="M19 20h4M6 26v3M16 26v3" />
    <rect x="8" y="9" width="6" height="5" rx="1" {...fill} />
    <path d="M17 6c1.5 1 1.5 3 0 4M20 4.5c2.6 1.9 2.6 5.1 0 7M23.5 3c3.6 2.8 3.6 7.2 0 10" />
  </>
);

const valveBody = (
  <>
    <path d="M2 22h5M25 22h5" />
    <path d="M7 17v10l9-5Zm18 0v10l-9-5Z" {...fill} />
    <path d="M16 22v-9" />
  </>
);

const controlValve = (
  <>
    {valveBody}
    <path d="M8 13h16a8 6 0 0 0-16 0Z" {...fill} />
  </>
);

const onOffValve = (
  <>
    {valveBody}
    <rect x="10" y="5" width="12" height="8" rx="1" {...fill} />
    <path d="M12.5 9h7" />
  </>
);

const motor = (
  <>
    <rect x="4" y="11" width="19" height="14" rx="2.5" {...fill} />
    <path d="M7 11v14M10 11v14M13 11v14" strokeWidth="1" />
    <path d="M23 18h6" strokeWidth="2.4" />
    <rect x="15" y="6" width="6" height="5" rx="0.8" {...fill} />
    <path d="M6 25v3h15v-3" />
  </>
);

const pump = (
  <>
    <circle cx="14" cy="18" r="8" {...fill} />
    <circle cx="14" cy="18" r="2" />
    <path d="M14 10h11v5h-5" />
    <path d="M2 18h4" />
    <path d="M8 28h12l-2-4h-8Z" {...fill} />
  </>
);

const vfd = (
  <>
    <rect x="7" y="3" width="18" height="26" rx="1.5" {...fill} />
    <rect x="10" y="6" width="12" height="6" rx="0.6" />
    <path d="M11 20c1.2-3 2.4-3 3.6 0s2.4 3 3.6 0 2-2.6 2.8-1.4" />
    <path d="M11 25h10" strokeDasharray="1.4 1.4" />
  </>
);

export const FIELD_ICONS: IconSet = {
  sensor: pressure,
  'sensor:pressure': pressure,
  'sensor:temperature': temperature,
  'sensor:flow': flow,
  'sensor:level': level,
  'sensor:analyser': analyser,
  'sensor:vibration': vibration,
  actuator: controlValve,
  'actuator:control-valve': controlValve,
  'actuator:onoff-valve': onOffValve,
  'actuator:motor': motor,
  'actuator:pump': pump,
  'actuator:vfd': vfd,
};
