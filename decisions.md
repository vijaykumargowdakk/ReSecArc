# Decisions Log

## 2026-10-25 — Project management infrastructure established
**Decision:** Set up CLAUDE.md, PROJECT_STATUS.md, decisions.md, FILEMAP.md auto-generation, and self-review hooks as standard project infrastructure.
**Why:** Proven methodology for maintaining session continuity, decision traceability, and code quality across Claude Code sessions. Every decision gets logged with rationale so future sessions (and the human) understand why things are the way they are.
**User input:** User requested this setup be applied to the project.

## 2026-10-25 — Product name: ConduitOT
**Decision:** The tool is called ConduitOT.
**Why:** Refers to IEC 62443 zones and conduits, which the tool models. No existing GitHub repository uses the name.
**User input:** Owner picked ConduitOT from a shortlist.

## 2026-10-25 — Repository re-initialised before first publish
**Decision:** Started the git history fresh. Planning material stays outside the repository.
**Why:** Nothing had been pushed, and the owner wanted a clean history for the public repository.
**User input:** Owner asked for a clean history and file map.

## 2026-10-25 — Stack: Vite + React + TypeScript, React Flow, Zustand, zod
**Decision:** ConduitOT is a fully client-side static web app. React Flow (@xyflow/react) provides the canvas, Zustand holds the project model, zod validates project files on load, and Vitest runs unit tests.
**Why:** No backend means the demo is reproducible and hostable on GitHub Pages. React Flow is a mature MIT-licensed node editor.
**User input:** Owner asked for a working prototype and public demo.

## 2026-10-25 — Assets are original or permissively licensed
**Decision:** OT device icons are original inline SVGs. Generic UI icons come from Lucide (ISC). There are no vendor logos, and the demo project is fictional.
**Why:** Avoids licensing and trademark issues in a public repository.
**User input:** Owner asked where components and assets would come from.

## 2026-10-25 — Docs describe the product only
**Decision:** README and docs cover features, usage, data model and the demo, and nothing else.
**Why:** Owner preference.
**User input:** Owner chose "plain product docs".

## 2026-10-25 — Removing a zone or device also removes rules that reference it
**Decision:** Deleting a zone or device drops every firewall rule whose source or destination points at it. The editor asks for confirmation first.
**Why:** Silently changing those endpoints to "any" would widen what a rule permits.
**User input:** None. This is a design choice made while building the rule editor.

## 2026-10-25 — Purdue lanes rendered as locked background nodes
**Decision:** Each lane is a non-interactive React Flow node with zIndex -1. A device's Purdue level is derived from the lane its centre sits in.
**Why:** React Flow's viewport portal draws above the nodes. Locked nodes pan and zoom with the canvas and stay underneath everything else.
**User input:** None.

## 2026-10-25 — Analysis features left out of this build
**Decision:** This build covers the editor, zones, flows, firewall rules, save/load, docs and CI. No analysis features have been built.
**Why:** The owner will decide the scope of any further features separately.
**User input:** Owner asked to proceed with the buildable parts.

## 2026-10-25 — Proprietary licence: all rights reserved
**Decision:** Replaced the MIT licence with an all-rights-reserved notice. Any use, copying, modification, rebuild or distribution needs written permission from the owner. `package.json` declares `UNLICENSED`.
**Why:** The owner wants complete ownership, with others asking permission first.
**User input:** Owner asked for a licence that gives them full ownership and requires permission for any use.

## 2026-10-25 — GitHub Pages deploy is manual
**Decision:** The Pages workflow runs only via workflow_dispatch.
**Why:** It fails until Pages is enabled in the repository settings, and the owner decides when a public demo goes live.
**User input:** None.

## 2026-10-25 — Review hook limited to edited files
**Decision:** The Stop review hook now reviews only the files in `.claude/.pending-review`. It never blocks because a conversation or plan looks unfinished, and it exits immediately when `stop_hook_active` is true.
**Why:** It had blocked a turn nine times in a row by judging plan completeness, which is outside its purpose.
**User input:** Owner asked for the best fix.

## 2026-10-25 — v0.2 roadmap (M6–M13)
**Decision:** Add device variants, a silhouette icon set, editing power and autosave, sites/areas/search, a protocol registry with more protocols, templates, an inventory view with import/export, and accessibility/themes, as milestones M6–M13.
**Why:** Make the editor useful for large and varied plants.
**User input:** Owner approved the plan, chose two-tone device silhouettes for icons, and selected all improvement areas.

## 2026-10-25 — Schema v2 with automatic migration
**Decision:** Project files move to `schemaVersion: 2`. Devices gain `variant`, `asset`, `siteId` and `areaId`; projects gain `sites` and `areas`; flows become `{ protocol, port, settings }` validated against a protocol registry. v1 files are upgraded on open by `src/model/migrate.ts`.
**Why:** Bundling every format change into one version bump means one migration. The registry lets new protocols be added as data instead of code branches.
**User input:** None beyond the approved plan.

## 2026-10-25 — Two-tone silhouette icon set
**Decision:** Replaced the line icons with original two-tone device silhouettes (`src/ui/icons/`): a base icon per type and a specific icon for every variant, about 70 in all. Nodes show the icon with no tile, plus a lettered criticality badge. The palette expands each type into its variants. `?gallery` shows every icon for review.
**Why:** Recognisable hardware shapes are faster to read than abstract glyphs. Drawing them in-house avoids licensing and trademark issues.
**User input:** Owner chose "Device silhouettes".

## 2026-10-25 — Undo history, multi-select and per-browser autosave
**Decision:** Undo/redo is a pure snapshot history (`src/store/history.ts`, 100 steps). Rapid edits to the same field coalesce into one step within 600ms, and multi-deletes go through React Flow's `onDelete` so they are a single step. Selection is now `{ devices, links, flows }` and is owned by the store; the canvas mirrors it. Autosave writes to `localStorage` one second after the last edit and only starts after a pending snapshot has been restored or discarded, so it never overwrites unsaved work the user hasn't seen.
**Why:** Large diagrams need safe experimentation and bulk editing. Autosave guards against lost work without needing an account or server.
**User input:** Approved in the v0.2 plan.

## 2026-10-25 — Twelve protocols in the registry, chosen per new flow
**Decision:** Added EtherNet/IP, PROFINET, OPC UA, IEC 60870-5-104, IEC 61850 MMS and GOOSE, BACnet, S7, MQTT and a free-form custom protocol alongside Modbus and DNP3. Each has its own roles, settings, default ports (some follow a setting such as TLS), colour and dash pattern. A toolbar picker sets the protocol for newly drawn flows, and a canvas legend lists the protocols in use.
**Why:** Real plants mix protocols. Dash patterns plus a legend keep flows distinguishable without relying on colour.
**User input:** Approved in the v0.2 plan.

## 2026-10-25 — Sites, areas, search and filters
**Decision:** Each site gets its own tab and Purdue lanes; links or flows to another site appear as clickable stubs. Areas are dashed frames that own the devices whose centre falls inside them, move their members along, and can collapse into one node with member edges merged onto it. Ctrl+K or "/" searches every site by name, kind, IP, vendor, model or notes. Zone/type/level/protocol filters dim non-matching items instead of hiding them. The site-to-canvas mapping is a pure, tested function (`src/ui/canvas/view.ts`).
**Why:** Real estates span several sites and hundreds of devices. Dimming keeps context and layout readable; collapsing hides detail without losing connectivity.
**User input:** Approved in the v0.2 plan.

## 2026-10-25 — Template gallery and reusable blocks
**Decision:** "New" now opens a gallery: a blank canvas or one of five fictional templates (water treatment, substation, manufacturing line, office building, multi-site pipeline). Together the templates use every protocol, sites and areas. The separate Demo button is gone. Multi-device selections can be saved as named blocks (per browser) and inserted from the palette. Added protection relay (IED), merging unit and circuit breaker variants for the substation template.
**Why:** Starting from a realistic reference architecture is faster than a blank page, and blocks make repeated cells quick to build.
**User input:** Approved in the v0.2 plan.

## 2026-10-25 — Inventory view, CSV import/export and diagram/document export
**Decision:** Added a Diagram/Inventory switch. The inventory has sortable, inline-editable device, flow and firewall-rule tables; edits go through the same undoable operations. Devices import from CSV (types and kinds by id or label, zones and sites by name) with a preview that lists each rejected row and its reason. The Export menu downloads the diagram as SVG/PNG (html-to-image, pinned to 1.11.11 as React Flow recommends), prints it to PDF through a print stylesheet, and writes a Markdown architecture record and CSV tables.
**Why:** Most plants already keep an asset list in a spreadsheet. Importing it, and exporting documentation, makes the tool fit existing workflows.
**User input:** Approved in the v0.2 plan.

## 2026-10-25 — Accessibility, themes and narrow layout
**Decision:** Every colour is a CSS token with light, dark (also used automatically when the system prefers it) and high-contrast values. The choice is stored per browser. Arrow-key moves are committed as single undo steps; devices have accessible names; a live region announces adds, deletes, undo and redo; `?` lists all shortcuts; reduced motion disables animations. Below 900px wide the palette and properties panel become slide-over drawers. Lighthouse accessibility scores 100 in the light and dark themes.
**Why:** Operators and engineers use the tool in many environments, including control rooms and on laptops; it must work with keyboards and screen readers.
**User input:** Approved in the v0.2 plan.

## 2026-10-25 — CSV exports escape spreadsheet formulas
**Decision:** All CSV exports escape cells that begin with = + - @ tab or carriage return. Import removes the escape again, so round-trips are exact.
**Why:** An automated security review flagged formula injection: a device name from a shared project file could otherwise run as a formula when the CSV is opened in a spreadsheet.
**User input:** None (security fix).

## 2026-10-25 — Hosted on Vercel by the owner
**Decision:** The app is deployed on Vercel. The owner manages it; deployment and hosting settings are left alone. The GitHub Pages workflow stays manual and unused.
**Why:** The owner chose Vercel and asked that nothing be changed for it.
**User input:** "I have deployed it on vercel so don't worry or do anything regarding it."

## 2026-10-25 — v0.3 roadmap (M14–M17)
**Decision:** Add canvas notes and auto-layout, IP/VLAN planning, named revisions with a change diff, and share-by-link with CSV import of flows and firewall rules, as milestones M14–M17. Schema v3 adds `notes`, `networks` and `revisions` in one version bump. The security analysis items from the original scope stay out.
**Why:** These make the tool more useful for documenting and maintaining real estates without adding analysis features.
**User input:** Owner selected all four proposed feature groups.

## 2026-10-25 — Schema v3, canvas notes and tidy layout
**Decision:** Project files move to `schemaVersion: 3`, adding `notes`, `networks` and `revisions` (v1 and v2 files are upgraded on open). A revision stores a `design`: every top-level field except `schemaVersion` and `revisions`, so revisions cannot nest. A file whose format is newer than the app gets one clear error instead of a list of schema errors. Notes are free text on a site's canvas, edited in place or in the properties panel. "Tidy layout" (canvas bar) lays out the open site with barycentre sweeps: devices keep their Purdue level, site and area; areas widen to fit their longest row and are pushed apart if they then overlap; the whole layout is one undo step.
**Why:** One format bump for all v0.3 data means one migration. Keeping levels and areas fixed makes the layout safe to apply to a hand-arranged diagram. The button moved from the toolbar to the canvas bar because the toolbar was out of room at 1440px.
**User input:** Approved in the v0.3 scope.

## 2026-10-25 — IP and VLAN planning as warnings, not validation errors
**Decision:** Networks are free-text CIDR strings. Address problems are computed by `src/model/ipam.ts` and shown as warnings in the network list, the device panel and the inventory's IP plan tab. They never block saving or opening. A device may list several addresses (one per interface). Duplicates are scoped per site, except inside a network that spans every site such as a WAN. "Not in any network" is only reported once a site has networks planned, so projects without an IP plan see no noise. All five templates now carry a fictional IP plan with no warnings, and the templates are stored as v3. Also fixed an older CSS bug that stacked the headers of the Flows and Firewall rules tables.
**Why:** People type addresses and subnets incrementally. Hard validation would reject autosaves and half-typed edits. Per-site scoping matches reused private ranges across sites.
**User input:** Approved in the v0.3 scope.

## 2026-10-25 — Revisions stored in the project file, compared by id
**Decision:** A revision is a deep copy of the design saved in `revisions` inside the project file, so it travels with the file. The change list (`src/model/revisions.ts`) matches items by id and resolves zone, site and area names within each design, so renaming a zone is one change rather than one per device. Firewall rule edits appear as rule changes, and position-only changes are flagged so the panel can hide them (hidden by default). The comparison state lives in its own small store, outside undo history; deleting the compared revision ends the comparison. Restoring a revision replaces the design but keeps the revision list, and is undoable. Status tags use a new `--on-status` text token, so they keep their contrast in the dark theme.
**Why:** Change records need to survive sharing the file. Id matching is exact, because saving a revision copies the design with its ids.
**User input:** Approved in the v0.3 scope.

## 2026-10-25 — Share links carry the design in the URL fragment
**Decision:** "Share as a link…" (Export menu) compresses the project with the browser's built-in `CompressionStream('deflate-raw')` into `#share=v1.<base64url>`. Opening such a link shows a banner. The design replaces the current one only when the user chooses "Open it", with a confirmation if they have made edits. The fragment is then removed from the address bar. Decoding is capped at 8 MB and the result goes through the same validation as an opened file. Revisions are left out unless the sender ticks the option. The dialog says plainly that anyone with the link can read the whole design.
**Why:** The app is a static site with no server or accounts. The fragment is never sent in HTTP requests, so the design does not reach the hosting provider. The built-in compression avoids a dependency, and a template fits in about 3,000 characters.
**User input:** Approved in the v0.3 scope ("Share by link").

## 2026-10-25 — CSV import of flows and firewall rules
**Decision:** Flows and rules import from the same columns their exports write. Devices are matched by name; ambiguous names are rejected with a clear reason instead of guessing. Flow settings start from the protocol defaults, and an empty port takes the protocol's default port. Flows that already exist are rejected. Rule import replaces the named firewalls' rules by default (rules are an ordered list, so re-importing an edited export should not append duplicates), with an option to append instead.
**Why:** Rule tables and flow lists are often maintained in spreadsheets. Exact round-trips make that workflow safe.
**User input:** Approved in the v0.3 scope.

## 2026-10-25 — Detailed README with Mermaid diagrams and screenshots
**Decision:** The README is now a full guide with a table of contents. It covers why the tool exists, the core ideas, a feature guide, workflows, architecture, the code map, the data model, and how edits, rendering, validation, autosave, revisions, IP planning, share links, CSV and tidy layout work. It closes with catalogs, accessibility, privacy, the technology stack, the development guide, tests, history and limitations. It has 31 Mermaid diagrams (flowcharts, sequence, state, ER, class, mindmap, pie, gitGraph and timeline), all rendered with Mermaid 11 in the default and dark themes. Diagrams wider than GitHub's content column were redrawn or split. Real screenshots of the fictional templates are in `docs/images/`. Package version set to 0.3.0.
**Why:** The owner asked for a very detailed README with pictorial diagrams that render on GitHub.
**User input:** "make a super detailed read me file with actual visual pictorical diagrams… using mermaid… which render properly in github".

## 2026-10-25 — Off-site stubs placed clear of devices
**Decision:** Stubs for devices on other sites are drawn in a column to the right of everything on the open site, level with their local device and spaced so they never stack. Framing a site now includes stubs and notes. The water-treatment demo note moved to free space in the L4 lane.
**Why:** The README screenshots showed stubs drawn on top of devices on the pipeline template's compressor station tab, because each stub sat a fixed distance to the right of its device.
**User input:** None (found while preparing the README).

## 2026-10-25 — Bounded coordinates and loops
**Decision:** Positions and sizes in project files must lie within ±1,000,000, and each stub-placement and area-shifting loop has an explicit cap on its iterations.
**Why:** An automated security review found that a crafted file or share link with a huge coordinate (e.g. 1e300) could make `y += 48` leave `y` unchanged, freezing the tab. Bounding the inputs keeps the arithmetic exact; capping the loops guarantees they end regardless.
**User input:** None (security fix).
