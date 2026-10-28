# ConduitOT — Project Status

*Last updated 2026-10-28.*

## Read first
- This file for status
- [`decisions.md`](decisions.md) for why things are the way they are
- [`CLAUDE.md`](CLAUDE.md) for working rules

## Start here (next session)
ConduitOT is a browser-based designer for OT network architectures. Users place devices on Purdue levels, draw network links and industrial protocol flows, define IEC 62443 zones, and edit firewall rules. M0–M17 are complete (v0.3). v0.4 is in progress: M18–M25 are done: M24 merged through PR #1 and **M25 (attack paths and the MITRE Attack Flow export) through PR #2**. **M26 (touch and text size) is next**; the owner will start it in a new session, on a new branch from `main`. The approved v0.4 plan is summarised in the milestone table below; M26 (touch and text size) no longer includes translation.

M24 added design checks that cite IEC 62443, plus company policy rules (schema v5), a Security panel and canvas marks. M25 added possible attack paths labelled with MITRE ATT&CK for ICS (generated from ATT&CK v20.0), a numbered path highlight on the canvas, and an export in MITRE's Attack Flow format that passes the official schema and opens in the Attack Flow Builder. The full plan, with file names, rules, ATT&CK mapping, tests and verification, is in [`docs/roadmap/security-analysis.md`](docs/roadmap/security-analysis.md).

Work is committed on feature branches, **pushed to `origin`** (github.com/vijaykumargowdakk/conduitot) and merged into `main` **through a pull request** with a merge commit once CI passes. Never merge locally and push `main`, and never delete a branch before its PR is merged. Up to M23 every branch was merged locally and only `main` was pushed, so no branches or PRs exist on GitHub for M0–M23 (decisions.md, 2026-10-28). Before each push, sweep history for retired names and confirm no AI attribution lines.

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
| M24 | Security checks and company policies | Schema v5 (policy rules, disabled checks), built-in checks citing IEC 62443 clauses (direct IT↔OT, unprotected zone boundary, firewall default-allow / any-any, insecure protocol across zones, remote access to L0–L2, safety system separation, device without zone), "IEC 62443 communication violation" and "Company policy violation" findings, Security panel, red links and badges on the canvas. Plan: `docs/roadmap/security-analysis.md` | Demo plus an Office workstation → Pump station RTU link shows the IEC 62443 finding; v4 files open ✅ (PR #1; 571 kB startup) |
| M25 | Attack paths and MITRE Attack Flow export | Possible attack paths from entry points to critical OT devices, honouring firewall rules; each step labelled with MITRE ATT&CK for ICS tactics and techniques generated from MITRE's data; path highlight on the canvas; STIX 2.1 Attack Flow export. Plan: `docs/roadmap/security-analysis.md` | The office → RTU path appears with ATT&CK labels; a firewall deny rule removes it; the export passes the Attack Flow schema ✅ (PR #2; 573 kB startup) |
| M26 | Touch and text size | Coarse-pointer targets, long-press menus, text size setting (no translation: dropped by the owner) | Tablet e2e passes; text size persists |
| M27 | Report, draw.io, merge | Static SVG renderer, full HTML/PDF report including security findings and attack paths, draw.io export, merge sites from another project | Report includes every site |
| M28 | Works offline | Installable app with offline precache and update prompt | Edits work with the network off |

## Documentation
- `README.md` is the full guide: purpose, features, architecture and data-flow diagrams (Mermaid, checked with Mermaid 11 in light and dark themes), and the development guide. Screenshots are in `docs/images/`; retake them when the UI changes noticeably.

## Notes for the next session
- Run both `npm run ci` and `npm run e2e` before merging; browser tests need `npx playwright install chromium` once.
- The startup bundle budget is 575 kB (`scripts/check-bundle.mjs`); it is at 573.7 kB after M25 and the zone wording fix, so about 1.3 kB is left. The owner agreed (decisions.md, 2026-10-28): M26 loads new code on demand wherever it can, and the budget is raised only if a feature truly cannot wait. Load new dialogs and panels with `lazy()` / `import()`.
- Unit tests run in Node: modules imported by tests must not touch `document` at import time (see the guard in `src/store/theme.ts`).
- If `gh` fails with a TLS certificate error while `git push` works, check the PC clock. On 2026-10-28 the clock was found days behind with the Windows Time service stopped, so GitHub's API certificate was not yet valid by local time; once the clock was right, `gh` worked again. Fix: Settings → Time & language → Date & time → "Set time automatically" and "Sync now" (or, as administrator, `net start w32time` then `w32tm /resync`).
- Security checks live in `src/model/checks.ts` (pure, at startup because the canvas badges need them); policy rule operations in `src/model/policies.ts`; panel state in `src/store/security.ts`, outside undo history. The panel (`src/ui/security/SecurityPanel.tsx`) is lazy. `findingsOf` / `findingsByItemOf` in `src/store/derived.ts` cache findings per project object.
- Attack paths: `src/model/attack/paths.ts` (lazy; the canvas loads it through `src/ui/canvas/usePathMarks.ts` only once a path is chosen), `attackFlow.ts` (lazy export), and `icsTechniques.ts`, **generated** by `node scripts/attack-ics.mjs` from a pinned mitre/cti tag. To use a new technique or a newer ATT&CK release, change the script and run it again; never edit the table by hand. Selected path and entry/target overrides live in `src/store/security.ts`, not in the project file.
- The Attack Flow test validates against vendored schemas in `src/model/attack/__fixtures__/stix/`: the Attack Flow 2.0.0 schema and extension, taken from the attack-flow repository at release tag `v4.1.0`. MITRE's hosted Attack Flow Builder opens the export through **Import STIX** (checked by hand on 2026-10-28).
- Zones are not Purdue levels (decisions.md, 2026-10-28). A finding names a device by what its check reads: the level for level-based checks, the zone for zone-based ones, and the rule's selectors for policies. Keep new checks to that rule.
- When adding a check, run it over the five templates first: a new check that floods them with findings is probably noisy (decisions.md, 2026-10-28).
- Shared actions (open, save, exports, tidy, add note, confirm-and-delete a device) live in `src/ui/actions.ts`; the command palette registry is `src/ui/commands.ts`. New features should add their commands there.
- Keyboard connections: `src/ui/canvas/useKeyboardConnect.ts` listens in the capture phase so that, while a connection is pending, arrow keys and Enter never reach React Flow. `pendingConnect` in the store is cleared on load, on site change and when the canvas unmounts.
- The Outline (`src/ui/Outline.tsx`) uses the treeitem-owns-group structure (`aria-owns`) so each item's accessible name is only its own row; nesting the group inside the treeitem fails axe's label-content-name-mismatch.

## Known issues
- The toolbar is over-full at 1440 px and below. Since M24 the brand name is cut with an ellipsis instead of being drawn over the Find button, and below 1600 px the words "Find" and "Security" are hidden visually (kept for screen readers). At 1280 px only the logo is left. A toolbar rework (for example, moving the connect-as controls to the canvas bar) would fix it properly.
- Below 900px the palette and properties panel become slide-over drawers. The canvas itself is still best used with a mouse or trackpad on a larger screen.
- `NODE_HEIGHT` in `src/model/purdue.ts` must match the `.device-node` height in `src/styles.css` (64px). If they drift apart, lane detection shifts slightly.
- Chromium's synthetic drag in Playwright can't drive the palette's HTML5 drag-and-drop. In automated checks, dispatch `DragEvent`s on the canvas pane instead.

## Hosting
- The owner deploys the app on Vercel and manages that deployment. Don't change hosting or deploy settings. The manual GitHub Pages workflow is unused.
