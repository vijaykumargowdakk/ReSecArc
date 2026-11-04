# Releasing ReSecArc

How a version of ReSecArc becomes a git tag and a GitHub release. Follow these steps for every release, so the Releases panel, `package.json` and the README's project timeline always agree.

## When to release

- **Minor version (0.5.0, 0.6.0 …):** when every milestone of a version's roadmap is merged into `main`, or when the owner asks for a release.
- **Patch version (0.4.1 …):** a release with fixes only and no new features.
- Never release without the owner's go-ahead. Tags and releases are public.

## Steps

### 1. Prepare a branch

On a new branch from `main` (for example `chore/version-0.5.0`):

1. Raise the version without creating a tag:
   `npm version 0.5.0 --no-git-tag-version`
   This changes `package.json` and `package-lock.json`.
2. Add the version to the timeline in **README.md, section 24 "Project history"**, in the same style as the existing entries: `v0.5 <Name> : <feature> : <feature> …`. Check that the Mermaid timeline still renders on GitHub.
3. Add an entry to `decisions.md` and update `PROJECT_STATUS.md`.
4. Run `npm run ci`, and `npm run e2e` if anything besides docs and the version changed.
5. Push the branch and open a PR. **Merge only when the owner says so**, with a merge commit, once CI, e2e and the Vercel preview pass.

### 2. Write the release notes

1. Draft the notes from the README timeline entry and the version's `decisions.md` entries. Group them under short headings (for example *Security analysis*, *Drawing and editing*, *Output*, *Everyday use*, *Quality*), with one plain line per feature.
2. **Check every claim against the code at the commit you will tag:** counts (device kinds, protocols, unit and browser tests), feature names, and what a feature actually does. For example: `git show <sha>:README.md`, `git grep <text> <sha>`.
3. Never write a pre-ConduitOT name or mention the source brief. Do not add AI attribution.
4. Send the notes to the owner and wait for their approval before going on to step 3.

### 3. Tag and publish

After the PR is merged and the notes are approved:

```bash
git switch main && git pull --ff-only origin main
SHA=$(git rev-parse HEAD)          # the merge commit of the version PR
git merge-base --is-ancestor "$SHA" origin/main && echo "on main"

git tag -a v0.5.0 "$SHA" -m "ReSecArc v0.5.0 - <Name>"
git push origin v0.5.0

gh release create v0.5.0 --verify-tag --latest \
  --title "ReSecArc v0.5.0 — <Name>" \
  --notes-file notes-v0.5.0.md
gh release list
```

- **Tag:** annotated, named `vMAJOR.MINOR.PATCH`, placed on the merge commit on `main`. It must never go on a branch commit.
- **Title:** `ReSecArc vX.Y.Z — <Name>`, where the name matches the README timeline (for example *Security and scale*).
- **Latest:** the newest version gets `--latest`. A patch to an older line gets `--latest=false`.
- Keep the notes file outside the repository (a scratch folder), unless the owner wants it kept.

### 4. Record it

Add a `decisions.md` entry with the tag, the commit and the go-ahead, and update `PROJECT_STATUS.md`. Do this on a docs branch with its own PR.

## Rules

- **Never move or delete a pushed tag.** If a release is wrong, fix its notes with `gh release edit`. If the code is wrong, publish a new patch version.
- **Cloud sessions can't tag or release.** A Claude Code cloud session can push branches but not tags (its git proxy answers HTTP 403), and has no tool to create releases. There, the owner runs step 3 from their own clone and publishes the release on GitHub, with the approved notes.
- **Tags and releases are public.** Even after a delete, they may already have been seen or cached.
- The version in `package.json`, the tag, the release title and the README timeline must all name the same version.

## Released so far

| Version | Name | Tag on |
|---|---|---|
| v0.1.0 | Foundation | `913d2e5` |
| v0.2.0 | Breadth | `c9dfbcf` |
| v0.3.0 | Lifecycle | `6d09e1b` |
| v0.4.0 | Security and scale | `3f2a285` (PR #11 merge) |
| v0.5.0 | Open source | `a0dccab` (PR #24 merge); tag and release pushed by the owner |

v0.1.0 to v0.3.0 were tagged afterwards, on the last merge before the next roadmap began. In those versions the app says ConduitOT and `package.json` does not match the tag. From v0.4.0 on, the version is raised before tagging.
