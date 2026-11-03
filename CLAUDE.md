# ReSecArc — Project Notes

For session continuity (including other Claude Code sessions/agents working on this repo).

## Read at the start of a session
- **PROJECT_STATUS.md** — what's done, on hold, known issues, recommended next steps.
- **decisions.md** — running log of decisions, why, and the user input behind them. Append an entry whenever something decision-worthy happens.
- **FILEMAP.md** — auto-generated tree of every file. Check it before exploring blindly.

## Working rules
- **FILEMAP first:** Read FILEMAP.md before using Glob for file discovery. It has every file in the project. Only use Glob when it's missing/stale, or Grep when searching file *contents*.
- **Git:** commit logical chunks on a feature branch. Never commit directly on `main`; it changes only through merged PRs. Merge with a **merge commit** once CI passes. Before pushing, run the project's CI steps and confirm no conflicts with `main`.
- **decisions.md:** Append an entry for every decision-worthy event. Format: date, decision, why, user input. This is maintained manually — do it as part of normal replies, not as an afterthought.
- **PROJECT_STATUS.md:** Keep it current. Update it when milestones change, work completes, or blockers appear.
- **Verify before trusting.** Don't assume external data, AI output, or copied code is correct. Check it.
- **No placeholder data in production paths.** If something is simulated/demo, label it clearly.
- **Releases:** follow **docs/RELEASING.md** for every release. In short: a version PR that raises `package.json` and adds the version to the README timeline (section 24); release notes checked against the code and approved by the owner; an annotated tag on the merge commit on `main`; `gh release create`; then a record in decisions.md and PROJECT_STATUS.md. When a version's milestones are all merged, offer a release. Never move or delete a pushed tag.

The PostToolUse hooks in `.claude/settings.json` regenerate FILEMAP.md and mark edits for an end-of-turn review hook. Don't hand-edit FILEMAP.md.
