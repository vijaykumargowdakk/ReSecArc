# ConduitOT

ConduitOT is a browser-based designer for operational technology (OT) network architectures. You lay out plants and estates on Purdue reference levels, choose specific kinds of industrial devices, group them into IEC 62443 zones and physical areas, describe the industrial protocols between them, and write firewall rules. The result is saved as a plain JSON file and can be exported as diagrams, spreadsheets or a written architecture record.

Everything runs in the browser. There is no server, no account and no telemetry.

## Features

### Modelling
- **Purdue reference levels.** Each site's canvas is divided into lanes from L5 (enterprise) down to L0 (physical process), with L3.5 as the industrial DMZ. A device's level follows the lane it sits in.
- **19 device types and about 85 specific kinds**, each with its own original silhouette icon. Examples:
  - compact, modular and micro PLCs, PACs and remote I/O;
  - protection relays, merging units and circuit breakers;
  - robots and CNC machines;
  - data diodes;
  - cellular routers and IIoT edge gateways.
- **Asset details:** vendor, model, firmware, serial number, IP address and notes for every device.
- **Network links** (Ethernet, serial, wireless) and **protocol flows** (directed, with roles such as client → server or master → outstation).
- **12 protocols**, each with its own settings and default ports:
  - Modbus, DNP3, EtherNet/IP, PROFINET, OPC UA;
  - IEC 60870-5-104, IEC 61850 MMS and GOOSE;
  - BACnet, S7, MQTT;
  - a custom protocol of your own naming.
- **Firewall rules:** ordered, first-match allow/deny rules per firewall, with source and destination given as any, a zone or a device, plus a default action.
- **Zones and conduits:** IEC 62443 zones with a trust flag and target security level. The conduits between zones are listed automatically.
- **Text notes** on the canvas for legends, remarks or open questions.

### Working at scale
- **Sites:** one tab per site, each with its own lanes. Connections to another site appear as clickable stubs.
- **Areas:** dashed frames for cells, lines or substations. Devices inside an area move with it, and an area can collapse into one node.
- **Search** across every site by name, kind, IP, vendor or model.
- **Filters** by zone, device type, level or protocol. Non-matching items are dimmed rather than hidden.
- **Templates:** five fictional reference architectures to start from (water treatment, substation, manufacturing line, office building, multi-site pipeline).
- **Reusable blocks:** save a group of devices and insert it again from the palette.

### Editing
- Undo and redo, copy, paste, duplicate, select all, and box selection.
- Bulk editing of zone, criticality and site, plus align and distribute for several devices at once.
- Snap to grid, and a right-click menu on devices.
- **Tidy layout:** one click lines a site's devices up in their lanes and areas and keeps connected devices close. Undo restores the previous positions.
- **Autosave** to your browser, with an offer to restore unsaved work the next time you open the app.

### Inventory and export
- An **Inventory** view with sortable, inline-editable tables of devices, protocol flows and firewall rules.
- **CSV import** of devices. Each rejected row is listed with the reason.
- **CSV export** of devices, flows and firewall rules. Cells that a spreadsheet would treat as formulas are escaped.
- **Diagram export** as SVG or PNG, or print to PDF.
- An **architecture document** in Markdown covering zones, conduits, devices, flows and firewall rules for every site.

### Accessibility
- Every action is possible from the keyboard:
  - add devices from the palette with Enter;
  - connect them from the device panel with "Link to…" or "Flow to…";
  - move the selection with the arrow keys.
- Screen-reader names for every device, plus announcements for adds, deletes, undo and redo.
- Light, dark and high-contrast themes. The theme follows your system setting by default.
- Protocols are distinguished by dash pattern and label as well as colour.
- Respects reduced-motion settings.
- On narrow screens the palette and properties panels slide in.

## Quick start

Requires Node.js 20 or later.

```sh
npm ci
npm run dev
```

Open the printed local URL. The fictional *Riverbend Water Treatment* plant loads on start. Choose **New** to pick another template or a blank canvas.

### Keyboard shortcuts

| Keys | Action |
|------|--------|
| Ctrl + K or / | Find a device |
| Ctrl + Z / Ctrl + Shift + Z | Undo / redo |
| Ctrl + C / Ctrl + V / Ctrl + D | Copy / paste / duplicate selected devices |
| Ctrl + A | Select every device on the site |
| Delete or Backspace | Delete the selection |
| Arrow keys | Move the selection |
| ? | Show all shortcuts |

## Development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript strict type check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build into `dist/` |
| `npm run ci` | All of the above, as run in CI |

The build uses relative asset paths, so `dist/` can be served from any static host. Open the app with `?gallery` to review every device icon.

## Documentation

- [Data model and file format](docs/data-model.md)
- [Third-party components and licences](docs/third-party.md)

## License

Copyright © 2026 Vijay Kumar Gowda K. All rights reserved.

This is not open-source software. Using, copying, modifying, rebuilding or distributing any part of it requires prior written permission from the copyright holder. See [LICENSE](LICENSE).
