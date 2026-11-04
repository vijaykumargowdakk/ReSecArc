# Security policy

ReSecArc is a tool for designing secure industrial networks, so problems in its own security are taken seriously.

## Supported versions

Fixes go into the latest release only.

| Version | Supported |
|---------|-----------|
| 0.4.x (latest) | Yes |
| Older than 0.4 | No |

The live app at https://resecarc.vijaykumarkk.in always runs the latest `main`.

## Reporting a vulnerability

**Don't open a public issue, pull request or discussion for a security problem.**

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. If that button is missing, contact the maintainer privately through https://github.com/vijaykumargowdakk and ask for a private channel; don't include the details in the first message.

Please include:

- what the problem is and what an attacker could do with it,
- the steps or a sample file or link that shows it,
- the version or commit, and the browser you used.

## What to expect

- An acknowledgement within 7 days.
- An assessment, and a plan or a reason for not fixing it, within 30 days.
- Credit in the release notes when the fix ships, unless you'd rather stay anonymous.

There is no bug bounty.

## Scope

ReSecArc runs entirely in the browser, has no server or accounts, and makes no network requests after loading. The parts most worth checking are the ones that read input someone else may have made:

- opening project files (`src/model/migrate.ts`, `src/model/schema.ts`),
- share links, which carry a whole project in the URL fragment (`src/model/share.ts`),
- CSV import (`src/model/csvImport.ts`) and CSV export opened in spreadsheet programs,
- the HTML report, Markdown, SVG and draw.io exports (`src/export/`),
- the service worker (`src/offline/sw.js`).

Out of scope: problems that need an attacker to already control the user's browser or device, and findings from automated scanners without a demonstrated impact.

## Security findings in your designs

The checks and attack paths ReSecArc shows for a design are guidance, not a security assessment. If a check gives a wrong result, that is a normal bug: report it with the **Bug report** form.
