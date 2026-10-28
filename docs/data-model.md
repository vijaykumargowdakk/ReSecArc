# Data model and file format

A ConduitOT project is one JSON document. The zod schema in [`src/model/schema.ts`](../src/model/schema.ts) is the source of truth. This page summarises it.

```jsonc
{
  "schemaVersion": 5,
  "name": "Riverbend Water Treatment (fictional demo)",
  "sites":   [ /* Site, at least one */ ],
  "devices": [ /* Device */ ],
  "links":   [ /* Link */ ],
  "flows":   [ /* Flow */ ],
  "zones":   [ /* Zone */ ],
  "areas":   [ /* Area */ ],
  "notes":   [ /* Note */ ],
  "networks":  [ /* Network */ ],
  "fieldDefs": [ /* Custom field definition */ ],
  "policies":  [ /* Company policy rule */ ],
  "disabledChecks": [ /* ids of built-in security checks switched off */ ],
  "revisions": [ /* Revision */ ]
}
```

Files saved by older versions (`schemaVersion` 1 to 4) are upgraded, including the designs stored in their revisions, automatically when opened; see [`src/model/migrate.ts`](../src/model/migrate.ts).

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
| `position` | `{ x, y }` | Canvas coordinates, each within ±1,000,000 |
| `services` | `{ protocol: rdp/ssh/vnc/https, port }[]` | Listening remote-access services |
| `asset` | `{ vendor, model, firmware, serial, ip, notes }` | Inventory details; all strings, may be empty |
| `tags` | string[] | Free labels, up to 50 |
| `fields` | `{ [fieldDefId]: string }` | Values of the project's custom fields |
| `locked` | boolean | Locked devices cannot be dragged and are skipped by Tidy, align and distribute |
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

An undirected network connection: `{ id, source, target, medium, sourcePort, targetPort, vlans, networkId, waypoints }`.

- `medium` is `ethernet`, `serial` or `wireless`.
- `sourcePort` and `targetPort` name the interface at each end, such as `Gi1/0/12` or `X1`; empty when unknown.
- `vlans` holds one VLAN id for an access link or several for a trunk, each 1–4094.
- `networkId` is the planned network the link carries, or `null`.
- `waypoints` are bend points `{ x, y }` in drawing order (at most 100).

Duplicate links between the same pair of devices, in either direction, are rejected.

## Flow

A directed protocol session from `source` to `target`, with optional bend points in `waypoints`:

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

A site is `{ id, name }`; every project has at least one. An area is a named rectangle on one site, used for cells, lines or substations: `{ id, siteId, name, color, rect: { x, y, width, height }, collapsed, locked }`.

## Note

Free text on one site's canvas: `{ id, siteId, text, position: { x, y }, width, color, locked }`. Notes are annotations only; they are included in the Markdown record.

## Custom field definition

`{ id, label, kind, options }`, where `kind` is `text`, `date` or `select` and `options` lists the choices of a `select` field. Devices store values under the definition's id. A select value that is no longer one of the options is kept and shown as such.

## Network

An IPv4 subnet: `{ id, name, cidr, vlan, zoneId, siteId }`. `cidr` is a string such as `10.10.1.0/24`. `vlan` is 1–4094 or `null`. `zoneId` is the security zone the subnet belongs to, or `null`. `siteId` is `null` for a network that spans every site.

A device's `asset.ip` may hold several addresses separated by commas, semicolons or spaces. Each address is matched to the most specific network on the device's site. Problems are shown as warnings and never stop a file from saving or opening:

- a malformed CIDR, or one with host bits set;
- overlapping subnets, or the same VLAN id on two different subnets, on the same site;
- a malformed device address, or a network or broadcast address;
- an address outside every network planned for the site;
- an address whose network belongs to a different zone than the device;
- two devices with the same address on the same site, or anywhere inside a network that spans every site.

## Company policy rule

`{ id, name, enabled, severity, from, to, bothWays, connection, protocols }`. A rule forbids direct links and flows from devices matching `from` to devices matching `to`. With `bothWays`, the reverse direction is forbidden too. Links have no direction, so they match either way round regardless.

- `severity` is `high`, `medium` or `low`.
- `connection` is `link`, `flow` or `any`.
- `protocols` lists flow protocol ids; empty means any protocol. A rule with protocols matches flows only.
- `from` and `to` are selectors: `{ kind: "any" }`, `{ kind: "levels", levels: [4, 5] }`, `{ kind: "zone", id }`, `{ kind: "type", types: ["plc"] }` or `{ kind: "tag", tag }`. Tags compare without regard to case.

## Disabled checks

`disabledChecks` lists the ids of built-in security checks switched off for the project, such as `device-without-zone`. Unknown ids are kept, because a newer version may add checks. The checks themselves and their findings are not stored; they are computed from the design, see [`src/model/checks.ts`](../src/model/checks.ts).

## Revision

A named copy of the design at a point in time: `{ id, name, createdAt, design }`. `createdAt` is an ISO 8601 timestamp. `design` holds every top-level field above except `schemaVersion` and `revisions`, so revisions do not nest.

Conduits are not stored. They are derived as the zone pairs joined directly by a link or flow; see [`src/model/conduits.ts`](../src/model/conduits.ts).

## Validation on load

A file is accepted only if:

1. it parses as JSON,
2. after any upgrade, it matches the schema, including `schemaVersion: 5`, and
3. it passes the reference checks:
   - every id is unique;
   - links, flows, sites, zones, areas, notes, networks, custom fields, rule endpoints and policy zones point at things that exist, and policy protocols are in the registry;
   - every variant is in the catalog, and every flow's settings match its protocol;
   - nothing connects a device to itself;
   - only firewalls carry rules;
   - the design inside every revision passes the same checks.

Otherwise every problem found is listed and the current project is left unchanged.
