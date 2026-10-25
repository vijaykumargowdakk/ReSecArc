# ConduitOT — Project Status

*Last updated 2026-10-25.*

## Read first
- This file for status
- [`decisions.md`](decisions.md) for why things are the way they are
- [`CLAUDE.md`](CLAUDE.md) for working rules

## Start here (next session)
ConduitOT is a browser-based designer for OT network architectures. Users place devices on Purdue levels, draw network links and Modbus/DNP3 protocol flows, define IEC 62443 zones, and edit firewall rules. M0–M8 are complete. v0.2 work (M7–M13) is in progress; see the milestone table.

Next: the owner decides the scope of any further features. No analysis features have been built.

## Dev loop
- Install: `npm ci`
- Dev server: `npm run dev`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`
- Production build: `npm run build`
- CI (run before pushing): `npm run ci`
- Regenerate file map: `python filemap_watcher.py --once`

## Milestones
| # | Milestone | Main work | Done when |
|---|-----------|-----------|-----------|
| M0 | Clean repository | Fresh history, neutral project notes, .gitignore | One clean bootstrap commit ✅ |
| M1 | Project skeleton and CI | Vite + React + TS, lint, tests, GitHub Actions | `npm run ci` passes ✅ |
| M2 | Architecture canvas | Purdue level lanes, OT device palette, drag-and-drop, network links | Devices can be placed, moved and linked ✅ |
| M3 | Protocol flows and firewalls | Modbus TCP and DNP3 flow properties, firewall allow/deny rule editor | Every property can be edited in the inspector ✅ |
| M4 | Zones and conduits | IEC 62443 zones, device zone assignment, derived conduit list | Zones colour devices and conduits list correctly ✅ |
| M5 | Save/load, demo, docs | JSON save/load with validation, fictional demo project, README and docs | Demo loads from the toolbar and round-trips through save/load ✅ |
| M6 | Schema v2, variants, asset fields | Device kinds per type, 4 new types, asset details, sites/areas in the file format, protocol registry, v1 migration | v1 files open; Kind and Asset details editable ✅ |
| M7 | Silhouette icons | Two-tone device icons per variant, node and palette redesign | Every variant has an icon ✅ |
| M8 | Editing power, autosave | Undo/redo, copy/paste, multi-select, align, snap, local autosave | Shortcuts work and autosave restores ✅ |
| M9 | More protocols | EtherNet/IP, PROFINET, OPC UA, IEC 104, IEC 61850, BACnet, S7, MQTT, custom | Every protocol editable from the registry |
| M10 | Scale | Sites, areas, search, filter | Multi-site project navigable |
| M11 | Templates | Five fictional starter plants, reusable blocks | New-from-template works |
| M12 | Inventory and export | Asset table, CSV import/export, SVG/PNG/PDF, Markdown document | Round-trips through CSV |
| M13 | Accessibility and themes | Keyboard-only use, screen-reader labels, dark/high-contrast, responsive | Lighthouse a11y ≥ 95 |

## Known issues
- Desktop-only layout. Below about 900px wide the three panels get cramped; there is no phone layout.
- `NODE_HEIGHT` in `src/model/purdue.ts` must match the `.device-node` height in `src/styles.css` (64px). If they drift apart, lane detection shifts slightly.
- Chromium's synthetic drag in Playwright can't drive the palette's HTML5 drag-and-drop. In automated checks, dispatch `DragEvent`s on the canvas pane instead.

## Action items for the owner
- To publish the demo, enable GitHub Pages (**Settings → Pages → Source: GitHub Actions**), then run the "Deploy demo to GitHub Pages" workflow from the Actions tab.
