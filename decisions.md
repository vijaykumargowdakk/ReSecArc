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
