# Data model and file format

A ConduitOT project is one JSON document. The zod schema in [`src/model/schema.ts`](../src/model/schema.ts) is the source of truth. This page summarises it.

```jsonc
{
  "schemaVersion": 3,
  "name": "Riverbend Water Treatment (fictional demo)",
  "sites":   [ /* Site, at least one */ ],
  "devices": [ /* Device */ ],
  "links":   [ /* Link */ ],
  "flows":   [ /* Flow */ ],
  "zones":   [ /* Zone */ ],
  "areas":   [ /* Area */ ],
  "notes":   [ /* Note */ ],
  "networks":  [ /* Network */ ],
  "revisions": [ /* Revision */ ]
}
```

Files saved by older versions (`schemaVersion` 1 or 2) are upgraded automatically when opened; see [`src/model/migrate.ts`](../src/model/migrate.ts).

## Device

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique across the whole project |
| `type` | `plc` `rtu` `sis` `machine` `sensor` `actuator` `hmi` `scada` `ews` `historian` `server` `firewall` `switch` `router` `gateway` `wap` `jumphost` `workstation` `internet` | |
| `variant` | string | A kind of that type from the catalog, e.g. `compact` for a PLC; `generic` when unspecified |
| `label` | string | Display name |
| `purdueLevel` | `0` `1` `2` `3` `3.5` `4` `5` | Derived from the lane the device is placed in |
| `siteId` | string | Must name an existing site |
| `zoneId` | string or `null` | Must name an existing zone |
| `areaId` | string or `null` | Must name an area on the same site |
| `criticality` | `low` `medium` `high` | |
| `position` | `{ x, y }` | Canvas coordinates |
| `services` | `{ protocol: rdp/ssh/vnc/https, port }[]` | Listening remote-access services |
| `asset` | `{ vendor, model, firmware, serial, ip, notes }` | Inventory details; all strings, may be empty |
| `firewall` | `{ defaultAction, rules[] }` | Present only on `firewall` devices, and required there |

### Firewall rule

Rules are evaluated in array order, and the first match applies. If no rule matches, `defaultAction` applies.

| Field | Type |
|-------|------|
| `id` | string |
| `src`, `dst` | `{ kind: "any" }`, `{ kind: "zone", id }` or `{ kind: "device", id }` |
| `protocol` | `any`, any flow protocol id, or `rdp` `ssh` `vnc` `https` |
| `port` | 1–65535, or `null` for any port |
| `action` | `allow` or `deny` |
| `note` | string |

Removing a zone or device also removes any rule that refers to it, so no rule silently widens to "any". The editor asks for confirmation first.

## Link

An undirected network connection: `{ id, source, target, medium }`, where `medium` is `ethernet`, `serial` or `wireless`. Duplicate links between the same pair of devices, in either direction, are rejected.

## Flow

A directed protocol session from `source` to `target`:

```jsonc
{ "id": "flow-1", "source": "hmi", "target": "plc", "protocol": "modbus", "port": 502,
  "settings": { "variant": "tcp", "access": "read-write", "authentication": false } }
```

`protocol` is an id from the protocol registry in [`src/model/protocols.ts`](../src/model/protocols.ts). The registry defines each protocol's roles (for example client → server or master → outstation), default port and `settings` fields. `settings` must contain exactly those fields, with values of the right type. `port` is `null` for layer-2 protocols, and required otherwise.

| Protocol | Roles | Settings |
|----------|-------|----------|
| `modbus` | client → server | `variant` (`tcp`/`tls`), `access` (`read`/`write`/`read-write`), `authentication` |
| `dnp3` | master → outstation | `transport` (`tcp`/`udp`), `secureAuthentication`, `tls`, `controlCommands` |
| `enip` | scanner → adapter | `messaging` (`explicit` 44818 / `implicit` 2222), `cipSecurity` |
| `profinet` | IO controller → IO device (layer 2) | `realtime` (`rt`/`irt`), `conformance` (`A`/`B`/`C`), `security` |
| `opcua` | client → server | `securityMode` (`none`/`sign`/`signandencrypt`), `userAuth` (`anonymous`/`username`/`certificate`) |
| `iec104` | controlling → controlled station | `tls` (2404 / 19998), `controlCommands` |
| `mms` | client → server (IED) | `tls` (102 / 3782), `controlCommands` |
| `goose` | publisher → subscriber (layer 2) | `authenticated` |
| `bacnet` | client → device | `secureConnect` (47808 / 443), `access` |
| `s7` | client → controller | `variant` (`classic`/`plus`), `access` |
| `mqtt` | client → broker | `tls` (1883 / 8883), `clientAuth` (`none`/`password`/`certificate`) |
| `custom` | source → destination | `name`, `transport` (`tcp`/`udp`/`l2`/`serial`), `encrypted`; port optional |

Where two ports are listed, the port follows the setting unless the user has typed a different one.

## Zone

`{ id, name, color, trusted, targetSL }`. `color` is a `#rrggbb` hex string and `targetSL` is 1–4.

## Site and area

A site is `{ id, name }`; every project has at least one. An area is a named rectangle on one site, used for cells, lines or substations: `{ id, siteId, name, color, rect: { x, y, width, height }, collapsed }`.

## Note

Free text on one site's canvas: `{ id, siteId, text, position: { x, y }, width, color }`. Notes are annotations only; they are included in the Markdown record.

## Network

An IPv4 subnet: `{ id, name, cidr, vlan, zoneId, siteId }`. `cidr` is a string such as `10.10.1.0/24`. `vlan` is 1–4094 or `null`. `zoneId` is the security zone the subnet belongs to, or `null`. `siteId` is `null` for a network that spans every site.

A device's `asset.ip` may hold several addresses separated by commas, semicolons or spaces. Each address is matched to the most specific network on the device's site. Problems are shown as warnings and never stop a file from saving or opening:

- a malformed CIDR, or one with host bits set;
- overlapping subnets, or the same VLAN id on two different subnets, on the same site;
- a malformed device address, or a network or broadcast address;
- an address outside every network planned for the site;
- an address whose network belongs to a different zone than the device;
- two devices with the same address on the same site, or anywhere inside a network that spans every site.

## Revision

A named copy of the design at a point in time: `{ id, name, createdAt, design }`. `createdAt` is an ISO 8601 timestamp. `design` holds every top-level field above except `schemaVersion` and `revisions`, so revisions do not nest.

Conduits are not stored. They are derived as the zone pairs joined directly by a link or flow; see [`src/model/conduits.ts`](../src/model/conduits.ts).

## Validation on load

A file is accepted only if:

1. it parses as JSON,
2. after any upgrade, it matches the schema, including `schemaVersion: 3`, and
3. it passes the reference checks:
   - every id is unique;
   - links, flows, sites, zones, areas, notes, networks and rule endpoints point at things that exist;
   - every variant is in the catalog, and every flow's settings match its protocol;
   - nothing connects a device to itself;
   - only firewalls carry rules;
   - the design inside every revision passes the same checks.

Otherwise every problem found is listed and the current project is left unchanged.
