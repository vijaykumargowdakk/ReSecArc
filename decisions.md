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
