# ConduitOT

ConduitOT is a browser-based designer for operational technology (OT) network architectures. You lay out an industrial network on Purdue reference levels, group devices into IEC 62443 security zones, describe Modbus and DNP3 communications with their security properties, and write firewall allow/deny rules. The design is saved as a plain JSON file.

Everything runs in the browser. There is no server, no account and no telemetry.

## Features

- **Purdue reference levels.** The canvas is divided into lanes from L5 (enterprise) down to L0 (physical process), with L3.5 as the industrial DMZ. A device's level follows the lane it sits in.
- **OT device palette.** PLC, RTU, safety controller, sensor, actuator, HMI, SCADA server, engineering workstation, historian, firewall, switch, router, jump host, corporate workstation and internet/remote party. Drag a device onto the canvas, or click it to add it to its usual level.
- **Network links.** Undirected Ethernet, serial or wireless connections between devices.
- **Protocol flows.** Directed client → server (Modbus) or master → outstation (DNP3) sessions, drawn as dashed arrows.
  - Modbus: TCP or Modbus/TCP Security (TLS), port, read/write access, client authentication.
  - DNP3: TCP or UDP, port, Secure Authentication, TLS, whether control commands are permitted.
- **Remote-access services.** Record which devices listen for RDP, SSH, VNC or HTTPS, and on which port.
- **Firewall rules.** Ordered, first-match allow/deny rules per firewall. Each rule has a source and destination (any, a zone or a device), a protocol, an optional port and a note. Every firewall also has a default action.
- **Zones and conduits.** IEC 62443 zones with a colour, trust flag and target security level. The conduit list shows every zone pair joined by a link or flow.
- **Save and open.** Projects are versioned JSON files. They are validated on load, including checks for dangling references and duplicate ids.

## Quick start

Requires Node.js 20 or later.

```sh
npm ci
npm run dev
```

Open the printed local URL. The fictional demo plant, *Riverbend Water Treatment*, loads on start; **Demo** in the toolbar reloads it.

### Using the editor

1. Drag devices from the palette onto a Purdue lane.
2. Choose **Network link** or **Protocol flow** under *Connect as*, then drag from one device's handle to another device.
3. Select a device, link or flow to edit it in the right-hand panel. With nothing selected, the panel shows zones and conduits.
4. Press <kbd>Delete</kbd> or <kbd>Backspace</kbd> to remove the selected item from the canvas.
5. Use **Save** to download the project as `*.conduitot.json`, and **Open** to load it again.

## Development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript strict type check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build into `dist/` |
| `npm run ci` | All of the above, as run in CI |

The build uses relative asset paths, so `dist/` can be served from any static host, including a GitHub Pages sub-path.

## Documentation

- [Data model and file format](docs/data-model.md)
- [Third-party components and licences](docs/third-party.md)

## License

[MIT](LICENSE)
