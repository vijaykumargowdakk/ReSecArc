# ConduitOT — Project Status

*Last updated 2026-10-25.*

## Read first
- This file for status
- [`decisions.md`](decisions.md) for why things are the way they are
- [`CLAUDE.md`](CLAUDE.md) for working rules

## Start here (next session)
ConduitOT is a browser-based designer for OT network architectures. Users place devices on Purdue levels, draw network links and industrial protocol flows, define IEC 62443 zones, and edit firewall rules. M0–M17 are complete (v0.3). v0.4 is in progress: M18–M23 are done; **M24 (touch and text size) is next**, to be started only when the owner asks. The approved v0.4 plan is summarised in the milestone table below; M24 no longer includes translation.

No analysis features have been built, and none are planned.

Work is committed on feature branches and merged into `main` with merge commits, then pushed to `origin` (github.com/vijaykumargowdakk/conduitot). Before each push, sweep history for retired names and confirm no AI attribution lines.

## Dev loop
- Install: `npm ci` (browser tests also need `npx playwright install chromium` once)
- Dev server: `npm run dev`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`
- Production build: `npm run build`
- CI (run before pushing): `npm run ci`, then `npm run e2e`
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
| M9 | More protocols | EtherNet/IP, PROFINET, OPC UA, IEC 104, IEC 61850, BACnet, S7, MQTT, custom | Every protocol editable from the registry ✅ |
| M10 | Scale | Sites, areas, search, filter | Multi-site project navigable ✅ |
| M11 | Templates | Five fictional starter plants, reusable blocks | New-from-template works ✅ |
| M12 | Inventory and export | Asset table, CSV import/export, SVG/PNG/PDF, Markdown document | Round-trips through CSV ✅ |
| M13 | Accessibility and themes | Keyboard-only use, screen-reader labels, dark/high-contrast, responsive | Lighthouse a11y ≥ 95 ✅ (100) |
| M14 | Schema v3, notes, auto-layout | File format v3 (notes, networks, revisions), text notes on the canvas, one-click tidy layout per site | v2 files open; notes editable; layout is one undo step ✅ |
| M15 | IP and VLAN planning | Networks (CIDR, VLAN, zone, site), IP plan table, duplicate/invalid/out-of-subnet address warnings | Warnings shown in inspector and inventory ✅ |
| M16 | Revisions and change diff | Named revisions saved in the project file, compare any revision with the current design, highlight changes on the canvas | Diff lists added/removed/changed items ✅ |
| M17 | Share by link, more CSV import | Whole project compressed into the link's #fragment, open-shared-project banner, CSV import of flows and firewall rules | A shared link opens the same project ✅ |
| M18 | Safety net and speed | Playwright end-to-end tests with axe checks in CI, code splitting, visible-only rendering, shared derived data, 1,000-device benchmark | e2e green in CI; startup bundle within budget ✅ (546 kB, was 617 kB) |
| M19 | Schema v4 | Link ports/VLANs/network, waypoints, locking, device tags and custom fields | v3 files open; revisions diff the new fields ✅ |
| M20 | Ports, bend points, layers, locking | Link interface editing and Links tab, polyline edges, layer toggles, lock | Ports shown on canvas; layers persist per browser ✅ |
| M21 | Custom fields and tags | Field definitions, editing, bulk edit, inventory columns, tag filter, search, CSV | Round-trips through CSV ✅ |
| M22 | Command palette, tour, history panel | Action registry, first-run tour, named undo steps | Every toolbar action reachable from the palette ✅ |
| M23 | Outline view, keyboard connections | Accessible tree view of the design, connect devices on the canvas by keyboard | Keyboard-only connection e2e passes ✅ |
| M24 | Touch and text size | Coarse-pointer targets, long-press menus, text size setting (no translation: dropped by the owner) | Tablet e2e passes; text size persists |
| M25 | Report, draw.io, merge | Static SVG renderer, full HTML/PDF report, draw.io export, merge sites from another project | Report includes every site |
| M26 | Works offline | Installable app with offline precache and update prompt | Edits work with the network off |

## Documentation
- `README.md` is the full guide: purpose, features, architecture and data-flow diagrams (Mermaid, checked with Mermaid 11 in light and dark themes), and the development guide. Screenshots are in `docs/images/`; retake them when the UI changes noticeably.

## Notes for the next session
- Run both `npm run ci` and `npm run e2e` before merging; browser tests need `npx playwright install chromium` once.
- The startup bundle budget is 575 kB (`scripts/check-bundle.mjs`); it is at about 557 kB. Load new dialogs and panels with `lazy()` / `import()`.
- Unit tests run in Node: modules imported by tests must not touch `document` at import time (see the guard in `src/store/theme.ts`).
- `gh` could not reach the GitHub API from this machine (TLS certificate error) late on 2026-10-25, although `git push` worked; CI results were read from the repository's public Actions page instead.
- Shared actions (open, save, exports, tidy, add note, confirm-and-delete a device) live in `src/ui/actions.ts`; the command palette registry is `src/ui/commands.ts`. New features should add their commands there.

- Keyboard connections: `src/ui/canvas/useKeyboardConnect.ts` listens in the capture phase so that, while a connection is pending, arrow keys and Enter never reach React Flow. `pendingConnect` in the store is cleared on load, on site change and when the canvas unmounts.
- The Outline (`src/ui/Outline.tsx`) uses the treeitem-owns-group structure (`aria-owns`) so each item's accessible name is only its own row; nesting the group inside the treeitem fails axe's label-content-name-mismatch.

## Known issues
- At 1440 px with a 12-hour clock, the autosave status ("Saved 11:45 PM") is long enough to squeeze the toolbar so the brand name is cut off. Seen while checking M23; the toolbar itself was not changed in M23.
- Below 900px the palette and properties panel become slide-over drawers. The canvas itself is still best used with a mouse or trackpad on a larger screen.
- `NODE_HEIGHT` in `src/model/purdue.ts` must match the `.device-node` height in `src/styles.css` (64px). If they drift apart, lane detection shifts slightly.
- Chromium's synthetic drag in Playwright can't drive the palette's HTML5 drag-and-drop. In automated checks, dispatch `DragEvent`s on the canvas pane instead.

## Hosting
- The owner deploys the app on Vercel and manages that deployment. Don't change hosting or deploy settings. The manual GitHub Pages workflow is unused.
