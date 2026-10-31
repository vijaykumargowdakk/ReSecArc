# ReSecArc: TRL 6 evidence run

Recorded test run for the ReSecArc entry of the TIH-IoT TDP 11 technology readiness dossier (tests RA-01 to RA-03).

| | |
|---|---|
| Tested commit | `ce976567fd65a860d7e830db3ad31a139360d189` (`main`, 2026-10-31) |
| Run date | 2026-10-31, 16:22–16:55 IST |
| Repository | https://github.com/vijaykumargowdakk/ReSecArc |
| Live app | https://resecarc.vijaykumarkk.in/ (Vercel, page title "ReSecArc" checked on the run date) |
| Machine | Windows 11 (10.0.26300), Node 24.20.0, npm 11.21.1, Playwright 1.64.1 (Chromium) — see `logs/env.log` |

## Test environment
ReSecArc is a design-time tool. It analyses an architecture model drawn in the browser; it does not read live traffic and is not connected to any PLC, HMI or physical device. The representative environment is the built-in **water-treatment plant** (fictional, labelled as such in the app):

- Purdue levels L5, L4, L3.5 (Industrial DMZ), L3, L2, L1 and L0
- 6 IEC 62443 zones: External, Enterprise, Industrial DMZ, Operations, Control, Safety
- 19 devices, 18 network links, 4 protocol flows (Modbus TCP and DNP3 with Secure Authentication), 1 IT/OT firewall with 3 rules, a safety controller
- Designed-in weaknesses (see the answer key)

Four variants are built from it by `generate-evidence.ts`:

| Variant | Change from the template |
|---|---|
| baseline | none |
| insecure | seeded weakness: Office workstation (L4) linked straight to Pump station RTU (L1) |
| secure | the same connection, made through the IT/OT firewall |
| firewall-deny | firewall rule added first: deny any traffic from the jump host to the Operations zone |

## Answer key and results
Expectations come from the unit tests written with the checks (`src/model/checks.test.ts`, `src/model/attack/paths.test.ts`, 2026-10-28). Results come from `samples/results.json`.

| ID | Variant | Expected | Observed |
|---|---|---|---|
| B1 | baseline | Unprotected zone boundary: Operations switch ↔ Control switch (high, IEC 62443-3-3 SR 5.2) | as expected |
| B2 | baseline | Safety controller linked to the dosing PLC without a boundary device (high, IEC 62443-3-2 ZCR 3.3) | as expected |
| B3 | baseline | Plain Modbus SCADA → Filtration PLC across zones (medium, IEC 62443-3-3 SR 3.1, SR 4.1) | as expected |
| B4 | baseline | **Not** flagged: DNP3 with Secure Authentication SCADA → RTU | as expected |
| B5 | baseline | No direct IT↔OT finding | as expected |
| B6 | baseline | Attack path Office workstation → jump host → SCADA → Pump RTU, ATT&CK for ICS T0865, T0886, T0886, T1692.001 | as expected |
| I1 | insecure | "IEC 62443 communication violation", it-ot-direct, high, IEC 62443-3-2 ZCR 3.2 on the seeded link | as expected |
| I2 | insecure | The seeded link raises exactly one finding (no duplicate) | as expected |
| I3 | insecure | Attack path goes straight Office workstation → RTU (T0865 → T0866) | as expected |
| S1 | secure | No direct IT↔OT finding | as expected |
| S2 | secure | No finding on either link through the firewall | as expected |
| D1 | firewall-deny | The office → RTU path is gone | as expected |
| D2 | firewall-deny | No attack path remains (0) | as expected |

13 of 13 expectations met. Finding counts: baseline 3, insecure 4, secure 3, firewall-deny 3. Attack paths: 12, 12, 12, 0.

### RA-01: build and save a multi-zone Purdue layout
- All four variants were saved as `.resecarc.json` and opened again; the reopened file is byte-identical to the saved one (`samples/results.json`, `saveAndReopenUnchanged`).
- The browser test "saves a project file and opens it again" passed, and so did "rejects a broken file and keeps the current design" and "restores unsaved work after a reload" (`logs/e2e.log`).
- The saved files were opened in the live app: `screenshots/01-ra01-multizone-layout-baseline.png`.

### RA-02: security analysis against the answer key
- B1–B5, I1–I2, S1–S2 above. Findings per variant: `samples/findings-*.json`.
- Live app: the Security button shows 3 findings (baseline), 4 (insecure) and 3 (secure); `screenshots/02-ra02-findings-insecure.png`, `03-ra02-findings-secure.png`.

### RA-03: attack paths and exports
- B6, I3, D1–D2 above. Paths per variant: `samples/attack-paths-*.json`.
- Attack Flow export of the insecure design: `samples/attack-flow-insecure.json`, 53 STIX objects, **0 errors** against the official Attack Flow 2.0.0 schema (attack-flow release v4.1.0, vendored in `src/model/attack/__fixtures__/stix/`).
- HTML report (prints to PDF): `samples/report-insecure.html`; draw.io export: `samples/water-treatment-baseline.drawio`.
- Live app: path highlighted with numbered steps 1–4 (`screenshots/04-ra03-attack-path-baseline.png`); after the deny rule, "Attack paths (0)" (`05-ra03-attack-paths-firewall-deny.png`); report (`06-ra03-report-insecure.png`).

### Full automated suite (`logs/`)
- `ci.log`: typecheck, lint, **252 of 252** unit tests, production build, startup bundle 571.3 kB (budget 575 kB).
- `unit-security.log`: the security, attack-path, template, save/load and export tests listed one by one (75 of 75).
- `e2e.log`: **82 of 84** browser tests passed on the first run. The two that failed both ran out of time while all tests were running in parallel: the light-theme accessibility scan (90 s limit) and the 1,000-device performance test (30 s limit). Neither is a security test.
- `e2e-rerun.log`: those two files run one test at a time, **19 of 19** passed (1,000 devices on 5 sites: open 484 ms, switch site 419 ms, edit 408 ms).
- `generate-evidence.log`: output of `generate-evidence.ts`. A second run produced byte-identical sample files.

## Deviations from the normal procedure
- Tests ran in a fresh clone of the tested commit, installed with `npm ci`, outside the working folder.
- An older `vite preview` server was already holding port 4173 on this machine, and the normal config would have reused it. The browser tests therefore ran with `playwright.evidence.config.ts`: the same settings, but on port 4174 with a fresh build and server.

## Limitations and unsupported configurations
- Design-time only: the analysis reads the drawn model, not live traffic, device configurations or vulnerability (CVE) data. A design that differs from the real plant gives results for the design, not the plant.
- 8 built-in checks (listed in `samples/results.json`, `rules`) plus user-defined company policy rules. Anything outside them is not detected.
- Firewall rules are matched on zone, device, protocol and port, top to bottom with a default action. Stateful behaviour, NAT and VPNs are not modelled.
- Attack paths are possible routes through the design, not tested exploits.
- A device plugged into a switch drawn in a neighbouring zone is deliberately not flagged as a zone boundary (to avoid noise). That can hide a real problem.
- Findings on the other shipped templates (noise check, `samples/results.json`, `templates`): substation 8 (1 direct IT↔OT, 7 unsecured protocol between zones), building 5 (1 direct IT↔OT, 4 unsecured protocol), pipeline 1 (safety system not separated), manufacturing 0. They come from deliberate gaps and plain-text protocols in those fictional designs. They have not been reviewed by an independent expert.
- No independent OT-security expert review or witness yet.

## Reproduce
Check out the commit that added this folder. Its application code is identical to `ce97656`; it adds only `testresults/` and project notes (`git diff ce97656 -- src e2e` is empty).
```
npm ci
npm run ci
npx playwright test -c testresults/playwright.evidence.config.ts   # or: npm run e2e, if port 4173 is free
npx vite-node testresults/generate-evidence.ts
sha256sum -c testresults/SHA256SUMS
```
The generator writes the same bytes on every run, so its output can be checked against `SHA256SUMS`. Logs and screenshots differ between runs.
