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

## 2026-10-25 — v0.4 roadmap (M18–M26)
**Decision:** v0.4 adds browser tests with accessibility checks and speed work first (M18), then schema v4 (M19), ports/bend points/layers/locking (M20), custom fields and tags (M21), command palette/tour/history panel (M22), outline view and keyboard connections (M23), touch/text size/Hindi (M24), full report/draw.io/merge (M25) and offline support (M26). Security analysis items from the original scope stay out.
**Why:** Make the tool easier, more accessible and more capable; protect the larger changes with end-to-end tests before making them.
**User input:** Owner selected every proposed item and approved the plan.

## 2026-10-25 — Browser tests, accessibility gate and startup bundle budget (M18)
**Decision:** Playwright tests run against the production build (`vite preview`) in a separate CI job. They cover the main flows, axe WCAG 2.1 A/AA scans of every main view and dialog in all three themes (any violation fails), and a benchmark with 1,000 generated devices. The Inventory, dialogs, CSV and Markdown writers, image export and four of the five templates now load on demand. The startup bundle went from 617 kB to 546 kB (169 kB gzipped), and `scripts/check-bundle.mjs` fails CI above 575 kB. The 350 kB target in the plan was dropped: React, React DOM, React Flow with its d3 helpers, and zod alone come to about 380 kB, so 350 kB would mean replacing core libraries. Sites with more than 300 nodes draw only the visible part, and export temporarily draws everything so files stay complete. Site framing now uses bounds computed from known node sizes, because unmeasured (undrawn) nodes would be ignored by `fitView`. The minimum zoom is now 5% so large sites fit on screen. The address report and conduit list are computed once per change and shared.
**Other fixes found by the new tests:** buttons in information banners had too little contrast in the dark theme. Replacing an unedited design (New, Open, shared link) no longer asks for confirmation; only edited work does.
**Why:** Later v0.4 milestones change the file format and the canvas heavily, so they need an automated safety net first.
**User input:** Approved in the v0.4 plan.

## 2026-10-25 — Schema v4
**Decision:** Format 4 adds the following:
- on links: `sourcePort`, `targetPort`, `vlans` and `networkId`;
- on links and flows: `waypoints`;
- on devices, notes and areas: `locked`;
- on devices: `tags` and `fields`;
- on the project: `fieldDefs`.

The v3 → v4 step also upgrades the designs stored in revisions, so old revisions stay comparable. The diff reports port, VLAN, network, tag and custom-field changes; a change to bend points alone is shown as "re-routed" and hidden with moves. A select value that is no longer an option is kept rather than rejected. Copy and paste copies tags, fields and VLANs, and shifts bend points with the paste. The substation and manufacturing templates now carry fictional interface names, VLANs and link networks.
**Why:** One format bump for every v0.4 data change means one migration.
**User input:** Approved in the v0.4 plan.

## 2026-10-25 — Ports, bend points, layers and locking (M20)
**Decision:** Links are edited for ports, VLANs (lists and ranges, validated as typed) and network in the properties panel and a new Links inventory tab, with CSV export and import. Port names are drawn near each end. `linkIssues` warns when an end device with addresses has none in the link's network, or when the link's VLANs leave out the network's VLAN. Devices without addresses are not flagged.

Bend points are added by double-clicking an edge; handles appear on the selected edge, a drag is one undo step, and double-clicking a handle removes it. A bent flow no longer runs offset from its link. Tidy clears bend points on the site it arranges.

The View menu toggles links, flows, flow labels, port names, notes and area frames. It is stored as a browser preference in `src/store/prefs.ts`, not in the file, and collapsed areas stay visible because they stand in for their devices. Locked devices, notes and areas are not draggable, show a lock badge, and are kept in place by Tidy, align and distribute.

Also fixed:
- loading a project now re-frames the canvas even when the first site keeps the same id;
- the legend text can no longer be selected by double-clicking;
- the autosave status was shortened to "Saved 10:52", so the toolbar fits at 1440 px.
**Why:** Interface-level detail and readable busy diagrams were the main usability gaps for larger plants.
**User input:** Approved in the v0.4 plan.

## 2026-10-25 — Custom fields and tags (M21)
**Decision:** Custom fields are defined once per project (text, date or choice list) under Custom fields in the project panel, and edited on each device, for a whole selection, or as inventory columns. Tags are free labels: trimmed, de-duplicated without regard to case (the first spelling is kept), and capped at 50 per device. They can be added and removed in bulk, filtered by (a device matches any selected tag) and searched, together with field values.

Device CSV gains a `tags` column (separated by `;`) and a `field:<name>` column per field. Import rejects unknown field columns and invalid dates rather than guessing. The Markdown record shows tags and a custom-field table per site. Deleting a field asks first and removes its values.

Also fixed:
- "Add zone", "Add network" and "Add custom field" now have full accessible names;
- date inputs share the standard input style.
**Why:** Every site tracks different asset attributes; fixed columns cannot cover them.
**User input:** Approved in the v0.4 plan.

## 2026-10-25 — Translation dropped from M24
**Decision:** M24 covers only touch and tablet support and the text size setting. There will be no second language, no i18n dictionaries, no `t()` hook and no language setting; the interface stays in English. This replaces the "Hindi" part of the v0.4 roadmap entry above.
**Why:** Owner's decision.
**User input:** "For M24, leave out translation entirely — no Hindi, no i18n dictionaries, no t() hook, no language setting. Keep only touch/tablet support and the text size setting."

## 2026-10-25 — Command palette, edit history and first-run tour (M22)
**Decision:**
- **Command palette:** opened with Ctrl + Shift + P, or Alt + P because some browsers reserve the first. It searches a registry (`src/ui/commands.ts`) covering file, export, edit, view, layer, theme, connection, protocol, site and help actions. Each command reads the current state when it runs. Toolbar, palette and commands share one set of actions (`src/ui/actions.ts`).
- **Edit history:** a toolbar menu lists the last 40 undo steps. Their names come from running `diffDesigns` on neighbouring snapshots (`describeChange`), computed only while the menu is open. Jumping to a step is one store update.
- **Tour:** six steps, each pointing at an element. It opens on a first visit on screens at least 900 px wide, is remembered per browser, and can be replayed from Help or the palette.
- **Smaller additions:**
  - an empty site shows what to do next;
  - Ctrl + S saves the project file;
  - clicking a device in the palette now places it in the first free spot of its lane instead of on top of other devices (found by the new browser test).
- **Bundle:** the panels for multi-selection, areas, notes, comparison, firewall rules, revisions and custom fields now load on demand. This brought the startup bundle from 569 kB to 547 kB before this milestone's additions; it is 553 kB after them.
- **Contrast fixes:** the search dialog's "Esc" hint and the command group labels.
**Why:** Faster access to every action, safer experimentation, and a guided start for new users.
**User input:** Approved in the v0.4 plan. The owner asked to stop after M22 and start M23 in a new session.

## 2026-10-25 — Security analysis added to the roadmap as M24–M25, right after M23
**Decision:** Security analysis is now in scope. It reverses "Analysis features left out of this build" and the line in the v0.4 roadmap entry that kept the original scope's security analysis items out.
- **M24, security checks and company policies:**
  - schema v5 with `policies` and `disabledChecks`;
  - built-in checks that cite IEC 62443 clauses, e.g. a direct IT-to-OT link with no boundary device is an "IEC 62443 communication violation";
  - user-defined rules that report "Company policy violation".
- **M25, attack paths:**
  - possible attack paths from entry points to critical OT devices, honouring firewall rules;
  - each step labelled with MITRE ATT&CK for ICS tactics and techniques, generated from MITRE's published data;
  - an export in MITRE's Attack Flow format (STIX 2.1 extension).
- **Order:** both come straight after M23. The milestones after them are renumbered: touch and text size is now M26, report/draw.io/merge M27 (it gains the security sections), offline M28. Where earlier entries say "M24", meaning translation or touch, that milestone is now M26.
- **Wording rules:**
  - findings say "violates" or "relates to IEC 62443", never "compliant";
  - clauses are cited by number only, because the standard is paid;
  - ATT&CK IDs are never typed by hand.
- **Plan:** the full plan is in `docs/roadmap/security-analysis.md`. Nothing is built yet.

**Why:** A collaborator's feedback. Their example was a line drawn from Office workstation (L4) straight to Pump station RTU (L1) on the water-treatment demo: the tool should warn that this breaks IEC 62443. They also said that the people who will accept or reject the product expect MITRE ATT&CK attack flows to be used by name. Finding attack paths is graph reachability either way; the ATT&CK labels and the Attack Flow export make that visible.

**User input:**
- The collaborator, in paraphrase:
  - add OT architecture security checks with IEC 62443 and MITRE ATT&CK for ICS;
  - "company policy" was only an example, and the warning should name the IEC 62443 standard;
  - MITRE is for identifying possible attack paths.
- The owner chose:
  - checks and attack paths together, with the Attack Flow export;
  - company policy rules as well;
  - this work goes after M23 and ahead of the rest of v0.4.

  The owner asked for the plan to be recorded in detail now and built later.

## 2026-10-25 — Outline view and keyboard connections (M23)
**Decision:**
- **Outline view:** a third view beside Diagram and Inventory, loaded on demand. The tree runs site → Purdue level → device → the device's links and flows (peer, ports, VLANs, protocol, port). Areas and notes are grouped under their site; zones are listed last. Empty levels are left out. It follows the WAI-ARIA tree pattern with one Tab stop; the row is the treeitem and owns its child group through `aria-owns`, because nesting the group inside the treeitem made every parent's name include all of its children (axe flagged it).
- **Keys in the outline:** Up/Down, Right (open, then first child), Left (close, then parent), Home/End, a letter or digit jumps to the next match. Enter shows the item in the properties panel and moves focus to its first field; Space selects without moving focus. Enter on a group (level, Areas, Notes, Zones) opens or closes it; on a site or zone it shows the project panel, where those are edited. On a device, L and F open the existing device picker and Delete uses the properties panel's confirmation (now one shared helper). L and F therefore do not type-ahead while a device is focused; the help text says so.
- **Filter in the outline:** filtered-out devices, links and flows are **left out**, with a line saying how many devices are shown, rather than listed as "(filtered out)". A tree is read item by item, so dimmed entries would only add noise; the filter bar is shown above the outline so the filter is visible and easy to clear.
- **Keyboard connections on the canvas:** L or F on the focused device (or the single selected device while focus is on the canvas) starts a pending connection stored as `pendingConnect`. Arrow keys move a target highlight to the nearest drawn device in that direction (`nearestInDirection`: devices within 45° of the direction win, then distance along it plus twice the sideways offset). Enter connects with `addLink` / `addFlow` + `defaultFlow` and the toolbar's protocol; Esc, a click, or changing site cancels. Each step is announced. The source gets a dashed outline and a "From" badge, the target a solid outline and a "To" badge, so it does not rely on colour. When nothing is pending, arrow keys still move the selection.
- **Command palette and help:** "Show the outline", "Link the selected device to another" (L) and "Add a flow from the selected device" (F) are commands; the help dialog lists the new keys.
- **Also fixed:** the device picker (properties panel, right-click menu, outline) marked its buttons as listbox options inside list items, which axe reported once the picker was scanned; it is now a labelled list of buttons.
- **Bundle:** 557 kB at startup (budget 575 kB); the outline is a separate chunk.
**Why:** Screen-reader and keyboard-only users could already edit everything, but had no overview of the design and had to connect devices through a filtered list. The outline gives them a structured reading order; keyboard connections make the canvas usable without a mouse.
**User input:** Approved in the v0.4 plan. The owner asked to decide and log how the outline treats the filter, and to stop after M23.

## 2026-10-28 — Branches are pushed and merged through pull requests from now on
**Decision:** Every milestone branch is pushed to GitHub and merged into `main` through a pull request with a merge commit, once CI passes. A branch is not merged locally and is not deleted before its PR is merged.
**Why:** The owner saw no branches on GitHub. Checking the history showed that all 25 branches up to M23 were merged into `main` on the dev machine. Only `main` was pushed, and each branch was then deleted locally, so no branch or PR ever reached GitHub. That broke the project rule that `main` changes only through merged PRs. The history itself is intact (each merge commit names its branch), and CI passed on `main`. Opening PRs from the dev machine was also blocked: its clock was behind (Windows Time service stopped). GitHub's API certificate was not yet valid by local time, so `gh` failed with a TLS error, while `git push`, which checks certificates differently, still worked.
**User input:** The owner asked why no milestone branches appear on GitHub and asked for the git state to be checked before M24 starts.

## 2026-10-28 — M24 model: schema v5 and the check engine
**Decision:**
- Schema v5 adds `policies` (company policy rules) and `disabledChecks` to the design, so revisions, share links and the change diff carry them. v4 files and revisions migrate with both empty. Unknown ids in `disabledChecks` are kept, because a newer version may add checks.
- A policy rule forbids direct links and flows between two selectors (any, levels, zone, device type, tag; tags compare without case). **Links match either way round**, because a link has no direction. Flows respect the direction unless "both ways" is set. A protocol filter applies to flows only, so a rule with protocols never matches links.
- **Boundary device = any firewall.** The data diode is a firewall variant in `catalog.ts`; no gateway variant is one-way, unlike what the plan assumed.
- **Protocol security** (`isSecured`), checked against each registry entry's fields: Modbus `variant = tls`; DNP3 Secure Authentication or TLS; EtherNet/IP CIP Security; PROFINET Security; OPC UA security mode other than none; IEC 104 and MMS `tls` (the plan said IEC 104 `authenticated`, but that field does not exist); GOOSE `authenticated`; BACnet/SC; MQTT TLS; custom `encrypted`; S7 never.
- **One finding per link:** `zone-boundary-unprotected` skips links that `it-ot-direct` or `sis-not-separated` already report.
- **Less noise from `zone-boundary-unprotected`:** a link counts as a zone crossing only when both ends are network devices (switch or router) or both are end devices. Run over the five templates, the plan's version raised 13 high findings for end devices plugged into a switch drawn in the neighbouring zone (Line switch ↔ Cell A PLC, Station bus switch ↔ relays). Zones are drawn around devices, so the real conduit there is the switch. The narrower rule keeps the water demo's real gap (Operations switch ↔ Control switch with no firewall).
- **Safety separation:** a SIS may share its zone with switches, routers, firewalls, sensors, actuators and other safety systems; any other device type in its zone is reported.
- The clause numbers (62443-3-2 ZCR 3.1, 3.2, 3.3; 62443-3-3 SR 1.13, 2.6, 3.1, 4.1, 5.1, 5.2) were confirmed against the ISA 62443-3-2 table of contents and public summaries of 62443-3-3. Only numbers and our own descriptions are used.
- `firewallVerdict` follows the inspector's wording: top to bottom, the first match applies, otherwise the default action. An `any` protocol or `null` port in a query matches every rule.
**Why:** The plan in `docs/roadmap/security-analysis.md`, adjusted where the code or the template results disagreed with it, as the plan asked.
**User input:** The owner asked to start M24.

## 2026-10-28 — M24 interface: Security panel, canvas marks and toolbar
**Decision:**
- **Security panel** (lazy) replaces the project panel while it is open and nothing is selected, like the Changes panel. It takes precedence over a running comparison. It has two tabs, Findings and Rules, following the WAI-ARIA tabs pattern with arrow keys. The plan's "paths" tab is left for M25. Choosing a finding selects its links, flows and devices and frames those devices on the first device's site; the store's `focus` now holds a list of device ids for this.
- **Findings tab** groups by headline (communication violation, configuration issue, each company policy), most severe first inside each group, and shows the reference and a suggested fix.
- **Rules tab:** on/off switches for the built-in checks with their rationale and clause numbers, plus company policies with an editor for each one (selectors, severity, both ways, links/flows, protocols). "Add example: no direct IT → OT" appears while there are no policies. Every change is an ordinary undoable edit.
- **Canvas:** a new "Security findings" layer, on by default. Links and flows in a high-severity finding are red and thicker. Devices get a badge with their finding count, coloured by worst severity, and their accessible name gets "N security findings", so the mark does not rely on colour.
- **Inspectors** of devices, links and flows list the findings that concern them. The Markdown architecture record has a "Security findings" section with company policies and switched-off checks.
- **Toolbar:** a Security button with a finding count. Below 1600 px its word, and Find's, are hidden visually but kept in the accessible name. The brand name now ends in an ellipsis instead of overlapping the buttons. The toolbar is still over-full at 1440 px and below; that is recorded as a known issue rather than reworked in M24.
- **Commands:** "Show security findings" and "Add a company policy rule".
- Startup bundle: 571 kB of the 575 kB budget. The panel is a separate chunk; the checks run at startup because the badges need them.
**Why:** The plan in `docs/roadmap/security-analysis.md`. axe found the policy selector dropdowns unlabelled and the Security button's name not matching its visible text; both were fixed before commit.
**User input:** The owner asked to start M24.

## 2026-10-28 — M24 merged; M25 in a new session
**Decision:** PR #1 (M24) is merged into `main` with a merge commit after CI, e2e and the Vercel preview passed. The `feat/security-checks` branch stays on GitHub. M25 starts in a separate session, from `docs/roadmap/security-analysis.md`.
**Why:** This is the first milestone merged through a pull request, under the branch-and-PR workflow adopted on the same day.
**User input:** The owner approved the merge and said they will start M25 in another session.

## 2026-10-28 — M25 data: ATT&CK for ICS v20.0, generated; T0855 replaced by T1692.001
**Decision:**
- `scripts/attack-ics.mjs` downloads `ics-attack/ics-attack.json` from mitre/cti at the pinned tag **`ATT&CK-v20.0`** (the newest release on 2026-10-28) and writes `src/model/attack/icsTechniques.ts`: all 12 tactics in matrix order and the 10 techniques we use, with IDs, names, tactics and URLs. It fails if a technique is missing, revoked or deprecated, or is not under the tactic we show it in. Nothing in the table is typed by hand.
- **T0855 Unauthorized Command Message is revoked in this release**, replaced by **T1692.001 Command Message** (Evasion, Impair Process Control). The plan's candidate mapping is updated to it. T0886 Remote Services sits under both Initial Access and Lateral Movement, which settles the disagreement the plan noted; we show it under Lateral Movement.
- Left out for now: T0836 Modify Parameter and the optional hop notes (T0842 Network Sniffing, T0830 Adversary-in-the-Middle). Each label we show has one clear rule; fewer guesses, fewer arguable labels.
**Why:** The plan asked for generated data, a pinned release and a check against revoked IDs. The check caught T0855 on its first run.
**User input:** The owner asked to start the next milestone (M25) on a new branch and keep it updated in git.

## 2026-10-28 — M25 path finding: where it differs from the plan
**Decision:**
- **Firewalls:** a firewall passes traffic from A to B when, reading rules top to bottom, an allow rule matches before a deny of everything, and no earlier deny already covers that allow's protocol and port; otherwise the default action applies. The plan's "first match is an allow" would let a narrow deny (say, Modbus) hide a later HTTPS allow.
- **Flows** give reach unless a firewall on the link route between their ends denies that protocol and port; a flow with no link route at all (a design drawn with flows only) still counts.
- **Default entries** leave out hosts below L3.5 that offer a remote service. In the water demo SCADA and the engineering workstation offer RDP; treating them as entry points would claim they can be reached from outside, when the design only allows it through the jump host. The path through the jump host is shown instead. Hosts at L3.5 or above with a remote service are entries, as are internet, wireless access point and jump host devices and every L4–L5 host.
- **Default targets** leave out L0 sensors and actuators: they are reached through their controller, which is already a target, and listing them doubled the paths. SIS, PLC, RTU and other high-criticality L1–L2 devices are targets.
- **Last hop:** among the hosts one hop before the target, one with a flow into the target is preferred, then an engineering workstation (for controllers), so the step carries Command Message or Program Download rather than a generic label. Earlier hops keep the search's first choice.
- **Search cost:** hosts that firewall rules treat alike (same segment and zone, not named in a rule) share a class, so crossing a firewall is decided once per class pair. The 1,000-device unit test runs in well under a second.
- **Templates:** water treatment 12 paths, substation 4, manufacturing 8, building 12, pipeline 0. No template floods the list.
- **Overrides** of entries and targets live in the security store for the visit, as planned; the Markdown record uses the defaults.
**Why:** Fewer false alarms, as the plan asks, and firewall verdicts that match how the rule editor reads.
**User input:** The owner asked to start M25.

## 2026-10-28 — M25 interface and Attack Flow export
**Decision:**
- **Attack paths tab** between Findings and Rules, titled "MITRE ATT&CK® for ICS — possible attack paths". Each path is a button (pressed while highlighted) and a stacked chain of chips: device, tactic · technique ID (linked to attack.mitre.org), technique name, ending with the impact. The chips stack vertically because a horizontal chain wrapped one chip per line in the side panel. Each path lists the findings on its links, flows and crossed firewalls ("Relies on").
- **Canvas:** choosing a path numbers its steps with a badge and draws its links, flows and crossed devices in a new violet `--path` colour (dashed outline for crossed devices), defined in every theme. It shows even with the security layer off, because the user chose the path on purpose. The path finder loads only when a path is chosen (`usePathMarks`), and choosing a path frames it without selecting anything, so the panel stays open.
- **Export:** Attack Flow 2.0.0, as planned. The extension definition and its MITRE identity are copied exactly from `attack-flow-extension-2.0.0.json` (a test compares them). An `identity` "ConduitOT" (class system) is the author. Each path becomes a chain of `attack-action` objects joined by `effect_refs`, ending in its impact action; one `attack-asset` per device; `scope: "attack-tree"`. IDs are random v4 UUIDs from `crypto.getRandomValues`, which, unlike `crypto.randomUUID`, also works outside secure contexts.
- **Validation:** the plan's `af validate` was not used. The Attack Flow repo's corpus is now in the Builder's `.afb` format, and its validator is a Python package. Instead, unit tests check every object against the vendored official schemas with ajv (dev dependency only): Attack Flow 2.0.0 for the attack objects, OASIS STIX 2.1 for the identity and extension definition. A test also checks that broken objects fail, so the validator is not passing everything.
- **Builder import, checked by hand:** MITRE's hosted Attack Flow Builder (version 4.0) has **Import STIX**. The demo's export opened there with "Valid Attack Flow" and no problems; name, description, author and scope came through. The UI wording therefore says the file opens through Import STIX.
- **Bundle:** 573.3 kB at startup (budget 575 kB, was 571 kB). The path finder (7.5 kB) and the exporter (3.4 kB) are separate chunks. The next milestone has under 2 kB left, so new features must load on demand or the budget needs a decision.
**Why:** The plan in `docs/roadmap/security-analysis.md`, adjusted where the data or the tools disagreed with it.
**User input:** The owner asked to start M25 on a new branch and keep it updated in git.

## 2026-10-28 — Startup bundle budget stays at 575 kB for M26
**Decision:** The 575 kB startup budget stays. M26 loads its new code on demand wherever it can. The budget is raised only if a feature truly cannot wait to load, and that would be decided and logged then.
**Why:** After M25 the startup bundle is 573.3 kB (about 179 kB compressed), leaving under 2 kB. Loading on demand keeps the first load fast; raising the limit is a one-line change kept in reserve.
**User input:** The owner asked what the budget was, then agreed to try on-demand loading in M26 before raising the limit.

## 2026-10-28 — M25 merged; M26 in a new session
**Decision:** PR #2 (M25) is merged into `main` with a merge commit after CI, e2e and the Vercel preview passed. The `feat/attack-paths` branch stays on GitHub. M26 (touch and text size) starts in a separate session on a new branch from `main`, loading new code on demand (see the budget entry above).
**Why:** The branch-and-PR workflow adopted on 2026-10-28.
**User input:** The owner asked to merge and said they will start the next milestone in a new session.

## 2026-10-28 — Zone-based findings name zones, not Purdue levels
**Decision:**
- Findings from the zone-based checks now name each device's **zone** instead of its Purdue level. Before: "Operations switch (L3) and Control switch (L2) are in different zones with no boundary device between them". After: "Operations switch (zone Operations) and Control switch (zone Control) are linked with no boundary device between the zones". The same applies to the unsecured-protocol and safety-separation messages.
- Level-based checks keep levels: direct IT/OT connection, remote access at L0–L2, OT device without a zone.
- The check logic itself is unchanged: it always compared zone assignments, never levels.
- README section 2.2 now explains that zones and levels are separate. One level can hold several zones, and one zone can span several levels, as the demo's Control zone does (L2–L0).
- A test pins the new wording and checks that no zone-based finding shows a level.
**Why:** A user pointed out that the old message put levels next to "different zones", which reads as if L3 and L2 were the zones. Levels come from the Purdue model; zones and conduits come from IEC 62443.
**User input:** The owner passed on a user's comment: "Zones are different from Levels. Single level can have multiple zones and a single zone can be spread across multiple levels. Levels are from Purdue model; zones and conduits are from IEC 62443."

## 2026-10-28 — Policy findings follow their selectors; the IT/OT check stays level-based
**Decision:**
- **Company policy findings** name devices by what the rule selects on: levels ("Office workstation (L4)"), zones ("(zone Enterprise)"), both, or just the label for type and tag rules. Before, they always showed levels, so a zone-to-zone rule reported levels it never looked at. This turned up when the zone wording fix was checked against every message.
- **"Direct connection between IT and OT" stays based on Purdue levels.** No zone property ("business" / "control") is added. Reasons:
  - IEC 62443-3-2 ZCR 3.2 is "Separate business and IACS assets" (ISA 62443-3-2 table of contents). It is about two kinds of *asset* being in separate zones. The Purdue level is how the design says which kind an asset is, so the level classifies the asset; it does not stand in for a zone.
  - A zone property would repeat what the levels already say. Every user would have to set it. Where it was not set, the check would stay silent, and the office-to-RTU link that started this work would go unreported.
  - Zone boundaries are already checked from zones by `zone-boundary-unprotected`, and policies can select on zones.
- The check's rationale now says this in plain words, and so does README section 2.2.
**Why:** The owner asked for the earlier proposal to be checked again before deciding.
**User input:** "Do what is right and decide after cross-inspecting your decision again."

## 2026-10-28 — M27 before M26; nothing merged into main until the owner says so
**Decision:** M27 (report, draw.io, merge) is built before M26 (touch and text size), on the branch `feat/report-drawio-merge`. Neither milestone depends on the other. The branch is pushed and a pull request opened so CI runs, but it is **not merged into `main` until the owner says so**, even once CI passes.
**Why:** The owner's choice of order. The merge hold replaces, for this work, the usual "merge once CI passes" step.
**User input:** "Can we start with m27?" and then "But don't merge into main till I say so".

## 2026-10-30 — Full report, draw.io export and merging sites (M27)
**Decision:**
- **Static SVG renderer** (`src/export/siteSvg.ts`): draws any site from the project alone, without the canvas, so the report can include every site. It shares the edge routing with the canvas (moved into `src/model/routing.ts`) and turns the device icons into SVG text with a small serialiser (`src/export/markup.ts`) instead of react-dom/server. Colours are fixed for print. Areas are always drawn open so no device is hidden. Edge labels go under devices, as on the canvas. Text cannot be measured outside the browser, so names are shortened by an estimate and clipped to the device box. Links and flows in a high-severity finding are red, and devices show their finding count, as on the canvas.
- **Full report** (`src/export/report.ts`): one self-contained HTML file with a summary, contents, and per site the diagram, devices, custom fields, links (with ports, VLANs, networks and link warnings), flows, firewall rules and notes; then zones and conduits, networks and address warnings, security findings and policies, attack paths with ATT&CK technique links and the checks each path relies on, and revisions. PDF comes from the browser's print dialog: diagrams print on landscape pages of their own and table headers repeat. The attack paths use the default entry points and targets, because Security panel choices are not saved in the project file, and the report says so.
- **Report safety:** every name is escaped; the file carries a content security policy (`default-src 'none'; style-src 'unsafe-inline'; img-src data:`); **Print full report** loads it into a hidden iframe sandboxed with `allow-same-origin allow-modals` and no `allow-scripts`. A test injects markup through the project name, a device, a note and a zone.
- **draw.io export** (`src/export/drawio.ts`): one page per site, layers *Purdue levels* (locked), *Areas*, *Network links*, *Protocol flows*, *Devices*, *Notes*. Devices use draw.io's label shape with the icon as a base64 SVG data URI and carry asset details as shape data; stubs for devices on other sites link to that site's page. Cell ids are prefixed by kind (`x-`, `s-`, `p-`) so a crafted id cannot clash with a layer. Values are plain text (`html=0`). A unit test caught that the first style escaping also replaced the `=` of base64 padding; draw.io splits each style entry at its first `=`, so only `;` is now removed. **Checked by hand on 2026-10-29:** the water-treatment and pipeline exports opened in app.diagrams.net (loaded through the URL fragment, which is not sent to a server) with no errors, every page, the icons, the locked lanes layer and the stubs.
- **Merge sites** (`src/model/merge.ts`, `src/ui/MergeDialog.tsx`): copies ticked sites from another project file under fresh ids, as one undo step. Zones match by name (this project's settings are kept), custom fields by label and kind (choice options are combined), networks that span every site by subnet, and are brought over only when a copied link uses them or a copied device has an address in them. Links and flows to unticked sites are dropped; firewall rules naming a device on an unticked site are dropped, never widened (as with paste). A taken site name becomes "Name (2)". Policies, switched-off checks and revisions are not merged, because they belong to the whole project. The dialog previews what is added and left out. Entry points: a button beside the site tabs and the command palette.
- **Startup bundle:** the new entry points first took it to 575.8 kB, over the 575 kB budget. Following the on-demand rule, the Export menu's items now load the first time the menu opens (`src/ui/ExportMenuItems.tsx`), and the export actions moved to `src/ui/exports.ts`, which only on-demand code imports. The startup bundle is 573.3 kB, a little below where M25 left it.
- **Canvas bar at 1440 px:** the merge button did not fit. The add and merge buttons now sit outside the scrolling tab list, and below 1600 px the words "Tidy" and "View" are hidden visually (kept for screen readers), like "Find" and "Security" in the toolbar.
- **Also fixed:** the CSV import dialog's file chooser was a label around a hidden input, which the keyboard could not reach; it is now a button.
**Why:** The approved v0.4 plan for M27, including the security sections the report gained when M24–M25 were added.
**User input:** The owner asked to start M27 and not to merge until they say so.

## 2026-10-30 — M27 merged; M26 next
**Decision:** PR #4 (M27) is merged into `main` with a merge commit after CI, e2e and the Vercel preview passed. The `feat/report-drawio-merge` branch stays on GitHub. M26 (touch and text size) is the next milestone, then M28 (works offline).
**Why:** The owner gave the go-ahead to merge, as the hold from 2026-10-28 required.
**User input:** "ok merge it and tell me what is the next milestone in plan"

## 2026-10-30 — M26 gains panels and a Tidy toggle; level tabs and stacks become M28; offline moves to M29
**Decision:**
- **M26 (touch, text size and panels)** keeps its touch targets, long-press menus and text size setting, and adds:
  - Left (palette) and right (properties) panels that collapse to a thin strip with an icon to reopen, each with a keyboard shortcut (checked against the existing ones), and resize by dragging their edge (double-click resets). Open state and widths persist per browser. Below 900 px the drawers stay as they are.
  - Collapsible sections in both panels (palette groups, Annotate, Your blocks, inspector and Project panel sections), each remembered per browser.
  - **Tidy as a toggle:** after tidying the button reads "Undo tidy" and a second click restores the previous positions, area sizes and bend points (through undo). Any edit after the tidy turns the button back to "Tidy", so a stale restore never discards work.
- **New M28, level tabs and stacks** (schema v6, optional fields so v5 files open):
  - A tab per Purdue level of the current site beside the **Overview** tab, opened from the lane label or the command palette. It shows only that level, with wrapped rows, the same palette and inspector, and stubs at the top and bottom for links to other levels (clicking one goes to the other end). Devices keep a separate position for the level tab, so arranging it never moves the Overview. Tidy there lays out a grid grouped by area.
  - **Stacks** in the Overview, switched on per level and saved in the project file (like collapsed areas) so shared links, the report and draw.io match. Devices are stacked **automatically** when they share type, variant, level, area and zone and are not locked. A stack is one card with overlapping cards behind it and a ×N badge; links merge with a count, finding counts add up; click selects all members (bulk inspector), double-click opens the level tab.
  - New code loads on demand to stay within the 575 kB startup budget.
- **Works offline** is renumbered from M28 to M29. Order: M26 → M28 → M29.
**Why:** With one row per area per level, about six devices fit a 1,500 px lane, so 10–15 devices in a level make the whole diagram tiny when fitted. Widening or heightening lanes shrinks the overview in the same way; a level tab for editing and stacks for reading fix both sides. Level tabs and stacks change the file format, the report renderer and draw.io, so they get their own milestone and PR; building touch support first means the level tab inherits it.
**User input:** The owner asked for VS Code-style collapsible panels and sections, a Tidy that restores on a second click, and a per-layer editing tab with stacked devices ("show 1 temp sensor and the overlap design and the indication that there are 15"), and asked whether it fits M26 or a new milestone before M28. The proposal (automatic stacks, new milestone as M28 with offline as M29, drag-to-resize in M26) was approved with "ok".

## 2026-10-30 — Touch, text size and panels (M26)
**Decision:**
- **Side panels fold and resize.** Each panel has a header with a fold button (also **Ctrl + B** for the palette and **Ctrl + Alt + B** for properties, as in code editors; on a Mac the physical B key is read, so Option does not get in the way, and elsewhere AltGr characters on B still type). A folded panel is a 40 px strip with the open button and the panel's name written vertically. The inner edge resizes the panel by drag or arrow keys (Shift for bigger steps, Home and End for the limits, Enter or a double-click for the default). Palette 180–420 px, properties 280–600 px; neither may take more than about a third of the screen. While dragging only a CSS variable changes, so nothing re-renders until the drop. Below 900 px the panels stay drawers and folding does not apply. Opening the Security panel, the Changes list or a device from the Outline, and the tour, open a folded properties panel, because each is a request to see it.
- **Sections fold.** The shared `Section` heading and the palette group headings are buttons with `aria-expanded`. A section is stored by its title with numbers replaced ("Devices (3)" and "Devices (12)" share one state); its header actions stay in reach while it is folded. The body box uses `display: contents` while open, so the section lays out exactly as before.
- **Tidy toggles.** After a tidy the button reads **Undo tidy** and a second click undoes it through the normal history, so Redo still works. The offer ends as soon as the design differs from what the tidy produced (any edit, an undo, loading a file, another site). "Undo tidy" is also in the command palette while it applies.
- **Text size** (Default, Large, Larger, Largest: 100, 115, 130, 150 %) is set in a new **Display** menu ("Aa"), which also takes over the theme choice from the toolbar's theme dropdown and so frees toolbar width. It is applied with CSS `zoom` on the interface regions (toolbar, notices, canvas bar, panels, inventory, outline, dialogs), not by changing font sizes, so fixed sizes inside the interface grow with the text and nothing is cut off; panel widths grow with it. The canvas is never zoomed: it has its own zoom, and React Flow needs unscaled coordinates. At larger sizes the toolbar and canvas bar wrap onto a second row. Display preferences (layers, panels, folded sections, text size) stay in `conduitot:prefs`; stored values are checked and clamped on read.
- **Touch.** Under `(pointer: coarse)`: every button, summary, select, text field, menu option and checkbox row is at least 44 px tall (WCAG 2.5.5), icon buttons at least 44 px wide; connection handles 18 px; the grab area of links 28 px; the toolbar and canvas bar wrap; no text selection or callout on the canvas; a device starts moving only after 8 px. **Long-press** (500 ms, within 10 px) on a device opens the device menu; the click from the lifting finger is swallowed so it cannot choose a menu item. The long-press code loads only on devices with a touch screen (`any-pointer: coarse`). On a tablet, devices are added by tapping the palette; HTML5 drag from the palette needs a mouse.
- **Tablet browser tests:** a second Playwright project runs `e2e/tablet.spec.ts` as a 1180 × 820 touch screen: coarse pointer, 44 px targets (checkboxes measured by their label row), nothing off screen, tap to add and select, the long-press menu (driven by CDP touch events), and an axe scan. `e2e/panels.spec.ts` covers folding, sections, resizing and text size on the desktop.
- **Startup bundle:** the new code first took it to 583.6 kB. Following the on-demand rule, these now load when first needed: the resize edge (just after first paint), the Display menu's choices, the device menu, the edit history list, the filter menus' choices, and the long-press code (touch devices only). The panel buttons reuse icons already in the bundle, and the Display menu uses an "Aa" text mark instead of a new icon (0.5 kB). Result: **574.9 kB of 575 kB**. The budget was not raised.
- **Found and fixed on the way:**
  - In the dark themes the high-severity tag, canvas badge and toolbar count had dark text on red at 3.8:1. They are now white on red (6.5:1 light, 4.8:1 dark, 9.6:1 high contrast). The new panel layout let axe measure the tag in the Security panel for the first time.
  - Below 900 px the page could scroll sideways, because the closed properties drawer waits just off screen; the workspace now clips it.
  - The Outline's "Enter moves focus to the properties panel" skips the panel and section fold buttons.
- **Screenshots:** `diagram.png` and `device-panel.png` were retaken. The others still show the interface from before M23 and should be retaken in a later pass.
**Why:** The approved M26 scope (touch and text size, plus the panel work added on 2026-10-30).
**User input:** "proceed", after approving the plan with "ok".

## 2026-10-30 — M26 merged; M28 next
**Decision:** PR #5 (M26) is merged into `main` with a merge commit after CI, e2e and the Vercel preview passed. The `feat/touch-panels` branch stays on GitHub. M28 (level tabs and stacks) is next, then M29 (works offline). With 0.1 kB of the startup budget left, the owner decides before M28 whether all of it loads on demand or the budget is raised.
**Why:** The owner gave the go-ahead to merge.
**User input:** "merge it"

## 2026-10-30 — M28 keeps the startup budget; built on its own branch in a new session
**Decision:** The 575 kB startup budget stays for M28 (0.1 kB is left after M26). All new M28 code loads on demand: a level tab exists only once opened, and stacks are drawn only on levels where stacking is switched on. If a piece truly cannot wait to load, work stops and the owner is asked before the budget changes. M28 is built on `feat/level-tabs-stacks`, started from `main` after the M26 merge, in a new session.
**Why:** Loading on demand keeps the first load fast, and M28 is a natural fit for it.
**User input:** The owner followed the recommendation ("ill follow your recomendation") and will continue M28 in another chat.

## 2026-10-30 — M28 plan approved: room in startup, stack-aware Tidy, tabs on demand
**Decision:**
- **Startup budget:** a few small hooks cannot load on demand (the v6 schema fields and migration step, the lane label buttons, the canvas, card and edge hooks for level mode and stacks, level-aware palette adding and Tidy; about 2–2.5 kB). To pay for them without raising the 575 kB budget, the revision diff engine (`src/model/revisions.ts`, 8.6 kB) loads on demand: it was in startup only because `store/compare.ts` imported it, and it is needed only while comparing. Everything else new in M28 loads on demand.
- **Tidy in the Overview with stacks on** treats each stack as one slot and moves all its members to that slot. When stacking is switched off again they sit in a pile until the next Tidy spreads them out.
- **Level tabs** exist only once opened (lane label or command palette), are not saved in the project file, and close when the site changes or a project is loaded. The tab strip shows only while at least one level tab is open.
**Why:** The plan given before M28 was built; the three points above were the open choices, each with a recommendation.
**User input:** "do the recomended things for a,b,c"

## 2026-10-30 — Level tabs and stacks (M28)
**Decision:**
- **File format 6:** `device.levelPosition` and `site.stackedLevels`, both optional, so the 5 → 6 step only changes the version. The diff lists a level-tab move as a move (hidden with moves) and stacking as a site change. Paste drops the level position, so copies are placed afresh in the level tab; merging sites keeps stacked levels.
- **Level tabs:**
  - The tab strip sits above the canvas, below the canvas bar, and shows only while a level tab is open; the canvas bar had no room.
  - A level tab is the same canvas, built by an on-demand module on top of `buildView`, so filters, layers, findings, comparison marks, attack paths, keyboard connections and touch all work there.
  - Dragging in a level tab sets only `levelPosition`; it never changes the level, area or overview position. Area frames are drawn around their members and cannot be moved there.
  - Notes stay in the overview; adding one in a level tab says so.
  - A device added in a level tab joins that level, at the first free cell of the tab and the first free spot of its lane in the overview.
  - Clicking a stub for another level opens that level's tab. Search, Outline and Inventory follow one rule: from a level tab the device opens in its own level's tab, from the overview it stays in the overview. Security findings and attack paths, which can span levels, show in the overview.
- **Stacks:**
  - Drawn where the leftmost member is. The card shows as selected only when every member is, so selecting one member from search does not highlight the whole stack.
  - Click selects all members (bulk inspector), Delete removes them all (one undo step), drag moves them all. A stack has no right-click menu and cannot be a connection end, because it would be unclear which member is meant.
  - Merged links and flows carry a count and cannot be selected. An edge that is re-pointed at a stack but merges with no other keeps its own id and stays selectable.
  - Criticality shows the highest among the members.
- **Report and draw.io:** a stack is one card with two cards behind it and ×N, links and flows merge with a count, and the report caption names each stack while its tables still list every device. In draw.io the two back cards are separate cells, not a group, so the stack's cell stays a normal device that edges attach to. **Checked by hand on 2026-10-30:** the 15-sensor export opened in app.diagrams.net (through the URL fragment, which is not sent to a server) with no errors; the stack, its back cards and both ×15 counts showed.
- **Startup bundle:** 570.4 kB of 575 kB. Loading the revision diff engine on demand brought it from 574.8 kB to 566.5 kB; the M28 startup hooks then cost 3.9 kB, more than the 2–2.5 kB estimated before building, mainly the lane buttons (1.0 kB) and the canvas hooks (1.0 kB). The level view (4.9 kB), stacks (2.7 kB), level layout (2.3 kB) and tab strip (1.3 kB) are separate chunks. The lane buttons reuse icons already in the bundle.
- **Found and fixed on the way:**
  - Framing a site now includes the lane labels at the left edge. On a wide site they were at the canvas's edge, under the palette's resize edge, so the new lane buttons could not be clicked (found by the browser test).
  - In the dark themes, low-severity badges (canvas, toolbar count, Security panel tag) had dark text on grey at 3.8:1; they now use white (4.8:1), as high-severity badges already did. A stack of devices without a zone was the first view to show a low-only badge to axe.
**Why:** The approved M28 plan, with the three choices from the entry above.
**User input:** "do the recomended things for a,b,c"

## 2026-10-30 — M28 merged; M29 next
**Decision:** PR #6 (M28) is merged into `main` with a merge commit after CI, e2e and the Vercel preview passed. The `feat/level-tabs-stacks` branch stays on GitHub. M29 (works offline: installable app, offline precache, update prompt) is next, on a new branch from `main`, within the 575 kB startup budget (4.6 kB left).
**Also:** the first CI run of PR #6 failed one tablet test, the long-press menu, on both attempts, while it passed locally. Its trace showed the canvas still animating to frame the site when the test measured the device and pressed, so the finger landed where the device had been; framing now includes the lane labels, which changed that animation enough to show the race on the slower CI machine. The test now waits until the device has stopped moving. The app was not changed.
**Why:** The owner gave the go-ahead to merge.
**User input:** "merge it and tell what is next"
