import { Badge, fill, type IconSet } from './shared';

const desktop = (
  <>
    <rect x="3" y="4" width="26" height="17" rx="1.5" {...fill} />
    <path d="M7 9h10M7 12.5h14M7 16h8" />
    <path d="M16 21v4M10 26h12" />
  </>
);

const laptop = (
  <>
    <rect x="5" y="5" width="22" height="15" rx="1.2" {...fill} />
    <path d="M9 10h9M9 13.5h13" />
    <path d="M2 23.5h28l-2-3.5H4Z" {...fill} />
  </>
);

const globe = (
  <>
    <circle cx="16" cy="16" r="12.5" {...fill} />
    <path d="M3.5 16h25M16 3.5c3.4 3.4 5 7.6 5 12.5s-1.6 9.1-5 12.5c-3.4-3.4-5-7.6-5-12.5s1.6-9.1 5-12.5Z" />
    <path d="M6 9h20M6 23h20" />
  </>
);

const vendor = (
  <>
    <circle cx="13" cy="9" r="5" {...fill} />
    <path d="M3 28c0-6 4.5-10 10-10s10 4 10 10Z" {...fill} />
    <Badge>
      <path d="M23 27.5l3.6-3.6M27 21.7a1.9 1.9 0 0 0-2.6 2.2l-2.7 2.7.9.9 2.7-2.7a1.9 1.9 0 0 0 2.2-2.6l-1.2 1.2-.9-.3-.3-.9Z" />
    </Badge>
  </>
);

const cloud = (
  <path d="M9 25a6.5 6.5 0 0 1 .9-12.9A8.5 8.5 0 0 1 26 13a6 6 0 0 1 .5 12Z" {...fill} />
);

export const ENTERPRISE_ICONS: IconSet = {
  workstation: desktop,
  'workstation:desktop': desktop,
  'workstation:laptop': laptop,
  internet: globe,
  'internet:internet': globe,
  'internet:vendor': vendor,
  'internet:cloud': cloud,
};
