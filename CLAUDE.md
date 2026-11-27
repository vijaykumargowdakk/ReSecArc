# ReSecArc — Project Notes

For session continuity (including other Claude Code sessions/agents working on this repo).

## Read at the start of a session
- **PROJECT_STATUS.md** — what's done, on hold, known issues, recommended next steps.
- **decisions.md** — running log of decisions, why, and the user input behind them. Append an entry whenever something decision-worthy happens.
- **FILEMAP.md** — auto-generated tree of every file. Check it before exploring blindly.

## Working rules
- **FILEMAP first:** Read FILEMAP.md before using Glob for file discovery. It has every file in the project. Only use Glob when it's missing/stale, or Grep when searching file *contents*.
- **Git:** commit logical chunks on a feature branch. Never commit directly on `main`; it changes only through merged PRs. Merge with a **merge commit** once CI passes **and the owner says so** (push and open the PR, then wait for the go-ahead). Before pushing, run the project's CI steps and confirm no conflicts with `main`.
- **No AI attribution** in commits or PR descriptions (no Co-Authored-By lines for AI tools).
- **The product is ReSecArc.** Storage keys and the service-worker cache keep the old `conduitot` prefix on purpose, so saved work survives; don't rename them.
- **Licence:** AGPL-3.0-only, with commercial licences offered by the copyright holder. Keep `LICENSE` as the verbatim gnu.org text; the copyright, section 7 additional terms (attribution) and commercial offer live in `NOTICE`. Third-party code must be AGPL-compatible and listed in `docs/third-party.md`.
- **Hosting:** the owner hosts on Vercel at https://resecarc.vijaykumarkk.in; merging `main` deploys it. Leave the deploy settings alone.
- **`video/`** is a separate project (the ReSecArc videos, made with [Showpilot](https://github.com/vijaykumargowdakk/showpilot)) with its own `package.json`. Keep it out of the app's build, lint and tests.
- **decisions.md:** Append an entry for every decision-worthy event. Format: date, decision, why, user input. This is maintained manually — do it as part of normal replies, not as an afterthought.
- **PROJECT_STATUS.md:** Keep it current. Update it when milestones change, work completes, or blockers appear.
- **Verify before trusting.** Don't assume external data, AI output, or copied code is correct. Check it.
- **No placeholder data in production paths.** If something is simulated/demo, label it clearly.
- **Releases:** follow **docs/RELEASING.md** for every release. In short: a version PR that raises `package.json` and adds the version to the README timeline (section 24); release notes checked against the code and approved by the owner; an annotated tag on the merge commit on `main`; `gh release create`; then a record in decisions.md and PROJECT_STATUS.md. When a version's milestones are all merged, offer a release. Never move or delete a pushed tag.
- **Auto-resume after usage-limit pauses (owner's standing rule):** the owner may run out of their usage limit while work is running, often overnight; the limit resets about 5 hours after it starts. So that work continues without them typing "continue":
  1. At the start of any multi-step task, and again whenever the plan changes a lot, schedule a one-shot message back into this session at now + 5 h 30 min (the reset plus a 30-minute buffer), plus a backup 2 hours after that (`send_later` or `create_trigger` with `run_once_at` in cloud sessions; `CronCreate` or `ScheduleWakeup` locally).
  2. Write each message so it stands on its own: the repo and branch, what is done, the exact remaining steps, and "if this is already finished, or another turn is already handling it, do nothing and reply with one short line".
  3. Before long steps, commit and push work in progress to the feature branch, so a fresh container can pick it up.
  4. When a resume message arrives: read pending notifications, check `git status` and `git log`, and continue where the work stopped. Don't ask the owner to confirm anything they already approved.
  5. When the task is completely done, delete the remaining resume tasks.
  Tell the owner in one line which resume times were scheduled, in UTC and IST.

The PostToolUse hooks in `.claude/settings.json` regenerate FILEMAP.md and mark edits for an end-of-turn review hook. Don't hand-edit FILEMAP.md.
