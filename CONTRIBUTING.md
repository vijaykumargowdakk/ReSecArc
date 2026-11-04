# Contributing to ReSecArc

Thank you for helping with ReSecArc. This guide covers who can contribute, the terms that apply, and how a change goes from an issue to `main`.

## Who can contribute

ReSecArc is **not open-source software** (see [LICENSE](LICENSE)). The repository is public so the work can be read, but using, copying or changing it needs the copyright holder's permission.

Contributions are by invitation. The copyright holder gives that permission by adding you as a collaborator on this repository, or in writing on an issue. That permission covers working on ReSecArc in this repository; it does not grant any other use of the software.

If you are not a collaborator and want to help, open an issue and ask.

## Contribution terms

By opening a pull request, you agree that:

1. **You wrote the contribution**, or you have the right to submit it, and it does not include code, images or data you may not share.
2. **You keep the copyright** in your contribution, and you grant the copyright holder of ReSecArc a perpetual, worldwide, non-exclusive, royalty-free, irrevocable licence to use, copy, modify, publish, distribute, sublicense and **relicense** it, under any terms, as part of ReSecArc. This includes releasing it later under an open-source licence.
3. **Third-party material is marked.** Anything taken from elsewhere is named in the pull request, with its licence, and listed in [docs/third-party.md](docs/third-party.md).

These terms exist so that ReSecArc can change its licence later, for example to an open-source one, without having to trace every past contributor. They are not legal advice; the copyright holder should check them with a lawyer before relicensing.

The pull request template has a checkbox for these terms. A pull request is merged only with it ticked.

## How work is organised

- **Issues** are the to-do list. Every change starts as an issue, so it can be discussed before code is written. Look for [`good first issue`](https://github.com/vijaykumargowdakk/ReSecArc/labels/good%20first%20issue) for a small, well-described place to start, and [`help wanted`](https://github.com/vijaykumargowdakk/ReSecArc/labels/help%20wanted) for larger work that is ready to pick up.
- **Claim an issue** by commenting on it before you start, so two people don't do the same work. The maintainer assigns it to you.
- **Labels** say what an issue is (`bug`, `enhancement`, `documentation`, `chore`), which part of the app it touches (`area: …`), and where it stands (`needs triage`, `blocked`). They are defined in [.github/labels.json](.github/labels.json) and synced by a workflow, so change them there, not in the GitHub settings.
- **Decisions** that change how the project works are recorded in [decisions.md](decisions.md), and the current state is in [PROJECT_STATUS.md](PROJECT_STATUS.md). Read both before starting a larger change.

## Getting set up

Requires Node.js 20 or later (CI uses 22).

```sh
npm ci                           # install exact dependency versions
npx playwright install chromium  # once, for the browser tests
npm run dev                      # development server with hot reload
```

The README's [development guide](README.md#22-development-guide) lists every command, and [Testing](README.md#23-testing) describes the tests. [Source code map](README.md#7-source-code-map) shows where things live.

`video/` is a separate project with its own `package.json`. Leave it out of app changes.

## Making a change

1. **Branch from `main`.** Name the branch after the kind of change: `feat/…`, `fix/…`, `docs/…` or `chore/…`. Never commit on `main`; it changes only through merged pull requests.
2. **Keep it focused.** One issue per pull request. Unrelated clean-ups go in their own pull request.
3. **Follow the existing patterns.** The README's [Adding things](README.md#224-adding-things) table says where to add a device kind, a protocol, a template or a file format change.
4. **Mind the startup budget.** The startup bundle must stay under 575 kB (`scripts/check-bundle.mjs`). New dialogs and panels load on demand with `lazy()` or `import()`.
5. **Keep saved work safe.** Storage keys and the service-worker cache keep the old `conduitot` prefix on purpose; don't rename them. A file format change bumps `SCHEMA_VERSION` and adds a migration, so older files keep opening.
6. **Add tests** for new behaviour: unit tests next to the code (`*.test.ts`), browser tests in `e2e/` for anything a user clicks.
7. **Update the docs.** The README is the full guide; change it when behaviour changes. Retake screenshots with `npm run readme:images` after visible interface changes.

### Before you push

Run what CI runs:

```sh
npm run ci    # type check, lint, unit tests, build, bundle-size check
npm run e2e   # browser tests, including accessibility scans
```

Then make sure your branch has no conflicts with `main`.

### Commits

- Write the subject as a plain sentence about what changed and why, as in the existing history (`git log --oneline`).
- Commit in logical chunks; each commit should build.
- Don't add AI tool attribution lines (such as `Co-Authored-By` for an AI assistant) to commits or pull request descriptions.

## Pull requests

- Fill in the pull request template, link the issue (`Closes #123`), and tick the contribution terms.
- Add screenshots for visible changes.
- CI must pass: the `ci` and `e2e` jobs.
- The maintainer reviews every pull request. It is merged with a **merge commit**, only after CI passes and the maintainer approves.
- Merging `main` deploys the live app, so a pull request is not merged until it is ready to ship.

## Reporting bugs and asking for features

Use the issue forms: **Bug report** or **Feature request**. For a question, open an issue with the `question` label.

**Security problems are never reported in a public issue.** See [SECURITY.md](SECURITY.md).

## Code of conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Releases

Releases follow [docs/RELEASING.md](docs/RELEASING.md). Contributors don't need to tag or release anything; the maintainer does that once a version's milestones are merged.
