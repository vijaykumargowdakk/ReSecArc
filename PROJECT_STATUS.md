# ConduitOT — Project Status

*Last updated 2026-10-25.*

## Read first
- This file for status
- [`decisions.md`](decisions.md) for why things are the way they are
- [`CLAUDE.md`](CLAUDE.md) for working rules

## Start here (next session)
ConduitOT is a browser-based designer for OT network architectures. Users place devices on Purdue levels, draw network links and Modbus/DNP3 protocol flows, define IEC 62443 zones, and edit firewall rules. Check the milestone table for what is in progress.

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
| M0 | Clean repository | Fresh history, neutral project notes, .gitignore | One clean bootstrap commit |
| M1 | Project skeleton and CI | Vite + React + TS, lint, tests, GitHub Actions | `npm run ci` passes |
| M2 | Architecture canvas | Purdue level lanes, OT device palette, drag-and-drop, network links | Devices can be placed, moved and linked |
| M3 | Protocol flows and firewalls | Modbus TCP and DNP3 flow properties, firewall allow/deny rule editor | Every property can be edited in the inspector |
| M4 | Zones and conduits | IEC 62443 zones, device zone assignment, derived conduit list | Zones colour devices and conduits list correctly |
| M5 | Save/load, demo, docs | JSON save/load with validation, fictional demo project, README and docs | Demo loads from the toolbar and round-trips through save/load |

## Known issues
None yet.

## Action items for the owner
- Create the GitHub repository (suggested name `conduitot`) and add it as `origin`. GitHub Pages can then serve the demo through the included workflow.
- Confirm the MIT license, or choose a different one.
