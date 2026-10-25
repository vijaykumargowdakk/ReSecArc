# Data model and file format

A ConduitOT project is one JSON document. The zod schema in [`src/model/schema.ts`](../src/model/schema.ts) is the source of truth. This page summarises it.

```jsonc
{
  "schemaVersion": 1,
  "name": "Riverbend Water Treatment (fictional demo)",
  "devices": [ /* Device */ ],
  "links":   [ /* Link */ ],
  "flows":   [ /* Flow */ ],
  "zones":   [ /* Zone */ ]
}
```

## Device

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique across the whole project |
| `type` | `plc` `rtu` `sis` `hmi` `scada` `ews` `historian` `firewall` `switch` `router` `jumphost` `workstation` `internet` `sensor` `actuator` | |
| `label` | string | Display name |
| `purdueLevel` | `0` `1` `2` `3` `3.5` `4` `5` | Derived from the lane the device is placed in |
| `zoneId` | string or `null` | Must name an existing zone |
| `criticality` | `low` `medium` `high` | |
| `position` | `{ x, y }` | Canvas coordinates |
| `services` | `{ protocol: rdp/ssh/vnc/https, port }[]` | Listening remote-access services |
| `firewall` | `{ defaultAction, rules[] }` | Present only on `firewall` devices, and required there |

### Firewall rule

Rules are evaluated in array order, and the first match applies. If no rule matches, `defaultAction` applies.

| Field | Type |
|-------|------|
| `id` | string |
| `src`, `dst` | `{ kind: "any" }`, `{ kind: "zone", id }` or `{ kind: "device", id }` |
| `protocol` | `any` `modbus` `dnp3` `rdp` `ssh` `vnc` `https` |
| `port` | 1–65535, or `null` for any port |
| `action` | `allow` or `deny` |
| `note` | string |

Removing a zone or device also removes any rule that refers to it, so no rule silently widens to "any". The editor asks for confirmation first.

## Link

An undirected network connection: `{ id, source, target, medium }`, where `medium` is `ethernet`, `serial` or `wireless`. Duplicate links between the same pair of devices, in either direction, are rejected.

## Flow

A directed protocol session from `source` to `target`.

**Modbus** (`protocol: "modbus"`): `source` is the client and `target` is the server.

| Field | Type |
|-------|------|
| `variant` | `tcp` or `tls` (Modbus/TCP Security) |
| `port` | default 502 (TCP) or 802 (TLS) |
| `access` | `read`, `write`, `read-write` |
| `authentication` | boolean |

**DNP3** (`protocol: "dnp3"`): `source` is the master and `target` is the outstation.

| Field | Type |
|-------|------|
| `transport` | `tcp` or `udp` |
| `port` | default 20000 |
| `secureAuthentication` | boolean |
| `tls` | boolean |
| `controlCommands` | boolean: whether the master may issue control operations |

## Zone

`{ id, name, color, trusted, targetSL }`. `color` is a `#rrggbb` hex string and `targetSL` is 1–4.

Conduits are not stored. They are derived as the zone pairs joined directly by a link or flow; see [`src/model/conduits.ts`](../src/model/conduits.ts).

## Validation on load

A file is accepted only if:

1. it parses as JSON,
2. it matches the schema, including `schemaVersion: 1`, and
3. it passes the reference checks:
   - every id is unique;
   - links, flows, zone assignments and rule endpoints point at things that exist;
   - nothing connects a device to itself;
   - only firewalls carry rules.

Otherwise every problem found is listed and the current project is left unchanged.
