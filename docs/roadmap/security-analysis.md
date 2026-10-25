# Security checks, company policies and attack paths (M24–M25)

*Planned 2026-10-25. Not started. Begin once M23 (outline view and keyboard connections) is merged.*

This is the agreed plan. A future session can build these milestones from it. Read
`PROJECT_STATUS.md` and `decisions.md` first, as usual.

## Why
A collaborator reviewing ConduitOT asked for OT architecture security checks with IEC 62443 and
MITRE ATT&CK for ICS built in.

Their example used the water-treatment demo. Someone drew a direct link from **Office
workstation (L4)** to **Pump station RTU (L1)**. The link skips the IT/OT firewall and the L3.5
DMZ, yet ConduitOT shows no warning. The template has no such link; `office-ws` only links to
the corporate router.

What they want:
- Such a link is flagged as an **"IEC 62443 communication violation"**.
- Users can add their own rules, which show as a **"Company policy violation"**.
- Possible **attack paths** are found and labelled with **MITRE ATT&CK for ICS** tactics and
  techniques. Graph reachability does the real work. The reviewers who accept or reject the
  product expect to see the MITRE wording. An export in MITRE's own **Attack Flow** format shows
  that we use MITRE's framework itself, not just its name.

The owner chose to build the checks and the attack paths together, with the Attack Flow export
and company policy rules (decisions.md, 2026-10-25).

## Ground rules
- Wording says "violates" or "relates to IEC 62443", never "compliant" or "certified".
- IEC 62443 is a paid standard. Cite clauses by number and describe them in our own words; never
  quote it.
- Generate every ATT&CK ID, name and tactic from MITRE's published data. Never type them by hand.
- Attack paths are "possible paths based on the design", not predictions.
- Checks are hints, like the IP-plan warnings in `src/model/ipam.ts`. They never block saving.
- The startup bundle budget is 575 kB (`scripts/check-bundle.mjs`). Load the new panels with
  `lazy()`.

## Delivery
| Milestone | Branch | Content |
|---|---|---|
| M24 | `feat/security-checks` | Schema v5, check engine, company policies, findings panel, canvas marks |
| M25 | `feat/attack-paths` | Path finding, ATT&CK mapping, path highlight, Attack Flow export |

Merge M24 before starting M25. The report milestone (M27) should include the findings and attack
paths sections in the HTML/PDF report.

---

## M24 — Checks and company policies

### Schema v5 (`src/model/schema.ts`, `src/model/migrate.ts`)
Add these fields to `designSchema`, so revisions, share links and the change diff carry them:

```ts
policies: PolicyRule[]
disabledChecks: string[]   // built-in check ids switched off for this project

PolicyRule = {
  id, name, enabled,
  severity: 'high' | 'medium' | 'low',
  from: Selector, to: Selector,
  bothWays: boolean,
  connection: 'link' | 'flow' | 'any',
  protocols: string[],      // flow protocol ids; empty = any
}
Selector =
  | { kind: 'any' }
  | { kind: 'levels', levels: PurdueLevel[] }
  | { kind: 'zone', id }
  | { kind: 'type', types: DeviceType[] }
  | { kind: 'tag', tag }
```

A policy rule forbids any direct link or flow that matches its from and to selectors, or either
direction when `bothWays` is set.

- `SCHEMA_VERSION = 5`.
- Add a migration step `4: v4ToV5` that adds `policies: []` and `disabledChecks: []` to the
  project and to every revision's design. Follow the `designToV4` pattern.
- Extend the reference checks in `io.ts`/`structure.ts`: zone ids used in selectors must exist.
- Add to `diffDesigns` in `src/model/revisions.ts`:
  - a `compare('policy', …)` block for added, removed and changed rules;
  - a change entry for checks switched on or off.
- `docs/data-model.md`: document the v5 fields.

### Protocol security (`src/model/protocols.ts`)
Add an `isSecured(settings)` predicate to each protocol entry, using its existing fields. Likely
mappings:

| Protocol | Secured when |
|---|---|
| DNP3 | `secureAuthentication` or `tls` |
| OPC UA | `securityMode !== 'none'` |
| IEC 104 | `authenticated` |
| BACnet | `secureConnect` |
| MQTT | `tls` |
| Modbus TCP, S7 | never |

Check every registry entry before writing its predicate.

### Check engine (`src/model/checks.ts`, pure functions)
```ts
interface Finding {
  id: string;            // stable: checkId + item ids
  source: 'iec62443' | 'policy';
  headline: string;      // see below
  checkId: string;       // built-in check id or policy rule id
  severity: 'high' | 'medium' | 'low';
  message: string;       // "Office workstation (L4) connects directly to Pump station RTU (L1)"
  reference?: string;    // "IEC 62443-3-2 ZCR 3.2; IEC 62443-3-3 SR 5.1, SR 5.2"
  fix: string;
  items: { devices: string[]; links: string[]; flows: string[] };
}
export const BUILTIN_CHECKS: CheckDef[];  // id, title, reference, rationale, severity, run(ctx)
export function runChecks(p: Project): Finding[];
export function firewallVerdict(fw: Device, src: Device, dst: Device, protocol: string, port: number | null): 'allow' | 'deny';
```

Definitions:
- **IT** is L4 and L5. **DMZ** is L3.5. **OT** is L0–L3.
- A **boundary device** is a `firewall`, or a `gateway` whose variant is a data diode. Check
  `catalog.ts` for the variant ids.
- `firewallVerdict` walks the rules in order; the first match wins, otherwise `defaultAction`
  applies. `ops.ts` already speaks of an "evaluation order". Confirm against the wording in
  `FirewallRules.tsx`.

Built-in checks. Before shipping, confirm each clause number against public ISA/IEC summaries:

| id | Flags | Reference | Severity |
|---|---|---|---|
| `it-ot-direct` | A link or flow directly between an IT device and an OT device, with no boundary device at either end (the reported case) | 62443-3-2 ZCR 3.2; 62443-3-3 SR 5.1, SR 5.2 | high |
| `zone-boundary-unprotected` | A link between devices in different zones where neither end is a boundary device | 62443-3-3 SR 5.2 | high |
| `firewall-default-allow` | A firewall whose default action is allow | 62443-3-3 SR 5.2 (deny by default, allow by exception) | high |
| `firewall-any-any` | An allow rule with any source, any destination and any protocol | 62443-3-3 SR 5.2 | high |
| `insecure-protocol-cross-zone` | A flow between zones whose protocol settings are not secured | 62443-3-3 SR 3.1, SR 4.1 | medium |
| `remote-access-control` | An L0–L2 device offering RDP, VNC, SSH or HTTPS | 62443-3-3 SR 1.13, SR 2.6 | medium |
| `sis-not-separated` | A safety system in the same zone as non-safety devices, or linked to one without a boundary device | 62443-3-2 ZCR 3.3 | high |
| `device-without-zone` | An OT device not assigned to a zone | 62443-3-2 ZCR 3.1 | low |

Headlines:
- `it-ot-direct`, `zone-boundary-unprotected` and `insecure-protocol-cross-zone`: **"IEC 62443
  communication violation"**
- the other built-in checks: **"IEC 62443 configuration issue"**
- policy rules: **"Company policy violation: <rule name>"**

Leave out noisy checks. Do not flag Purdue level skips inside OT: SCADA-to-PLC flows are normal.
False alarms would cost credibility with reviewers.

### State and UI
- `src/store/derived.ts`: add `findingsOf = cached(runChecks)` and a `useFindings()` hook.
- `src/store/security.ts`: a zustand store kept outside undo history, like
  `src/store/compare.ts`. It holds `{ open, tab: 'findings' | 'paths' | 'rules', focusId }`.
- `src/ui/security/SecurityPanel.tsx`, loaded with `lazy()`. When it is open and nothing is
  selected, it replaces `ProjectPanel` in `Inspector()`, the same way `ChangesPanel` does.
  - **Findings** tab: grouped by headline, then severity. Clicking a finding selects its items
    and fits the view to them.
  - **Rules** tab:
    - built-in checks with on/off switches and their 62443 references;
    - company policies with add, edit, delete and enable controls and a selector editor;
    - an "Add example: no direct IT → OT" button.
  - Footer: "Design-time checks based on IEC 62443 zone and conduit principles. Not a compliance
    assessment."
- Canvas (`src/ui/canvas/view.ts`, `nodes.tsx`, `edges.tsx`):
  - a new `security` layer in `LAYER_LABELS` (`src/store/prefs.ts`), on by default;
  - edges in a high-severity finding get the `sec-violation` class (red);
  - devices get a small finding-count badge;
  - aria labels add "N security findings".
- Device, link and flow inspectors list their own findings with the existing `IssueList`.
- Toolbar: a "Security" button with a count badge.
- `src/ui/commands.ts`: "Show security findings" and "Add a company policy rule".
- `src/model/exportDoc.ts`: a "Security findings" section in the Markdown record.
- Bundle: `checks.ts` loads at startup because the badges need it, so keep it small. Everything
  else stays lazy.

### Tests
- `src/model/checks.test.ts`:
  - one case per built-in check;
  - water-treatment template plus an `office-ws`→`rtu-pump` link ⇒ an `it-ot-direct` finding
    with the exact headline;
  - the same connection made through the firewall ⇒ no finding;
  - policy rules: each selector kind, `bothWays`, the protocol filter, disabled rules.
- `firewallVerdict`: rule order, first match, default action.
- v4 → v5 migration, including revisions. Add `v5.test.ts`.
- The revisions diff reports policy changes.

---

## M25 — Attack paths, ATT&CK for ICS, Attack Flow export

### ATT&CK data, generated and verified
- Add `scripts/attack-ics.mjs`. It downloads `ics-attack/ics-attack.json` from `mitre/cti` at a
  **pinned release tag**.
- It extracts the techniques we use and all tactics: ID, name, tactic shortnames, URL, and the
  dataset version.
- It fails if an ID is missing, revoked or deprecated.
- It writes `src/model/attack/icsTechniques.ts`: generated, committed, with a version header.
- On 2026-10-25, attack.mitre.org failed with a TLS certificate error from the dev machine. The
  raw GitHub data was reachable.

Candidate mapping. The script's output is authoritative for names and tactics. Web sources
disagreed on whether T0886 sits under Initial Access or Lateral Movement, and did not confirm
T0855.

| Step | Technique |
|---|---|
| Initial access from an internet-facing device | T0883 Internet Accessible Device |
| Initial access through remote services or a jump host | T0822 External Remote Services |
| Initial access at an enterprise workstation | T0865 Spearphishing Attachment |
| Initial access through a wireless access point | T0860 Wireless Compromise |
| Lateral move to a host offering RDP, VNC or SSH | T0886 Remote Services |
| Other lateral moves | T0866 Exploitation of Remote Services |
| Engineering workstation to controller | T0843 Program Download |
| Existing write or control flow into the target | T0855 Unauthorized Command Message, or T0836 Modify Parameter |
| Safety system target | T0880 Loss of Safety (Impact) |
| Other targets | T0831 Manipulation of Control (Impact) |
| Hop over an unsecured protocol (optional note) | T0842 Network Sniffing, or T0830 Adversary-in-the-Middle |

Also update `docs/third-party.md`: add MITRE's ATT&CK® terms-of-use attribution, and state that
IEC 62443 is cited by clause number only.

### Path finding (`src/model/attack/paths.ts`, pure)
- **Segments** are the connected components of the link graph after removing boundary devices.
  Switches and routers are transit inside a segment, not attack steps.
- **Host A reaches host B** when one of these holds:
  - they are in the same segment;
  - every boundary device between their segments returns
    `firewallVerdict(fw, A, B, 'any', null) === 'allow'`. Treat a firewall as allowing when any
    allow rule matching A and B comes before any matching deny.
  - a flow A → B exists.
- **Default entries**: `internet`, `wap` and `jumphost` devices, every L4/L5 device, and any
  device offering remote services.
- **Default targets**: L0–L2 devices with high criticality, plus every `sis`, `plc` and `rtu`.
- Users can override entries and targets in the panel. The override lives in the security
  store, not in the project file.
- Search: BFS over the host graph from each entry, keeping the shortest path per entry–target
  pair.
- Ranking: safety system targets first, then criticality, then hop count. Keep at most 50 paths.
- Output:
  `AttackPath { id, entryId, targetId, steps: { deviceId, viaLinkIds, viaFlowId?, tactic, technique }[] }`.
- Performance: add a 1,000-device case to `scale.test.ts` or `e2e/perf.spec.ts`.

### UI
- An **Attack paths** tab in the Security panel, titled "MITRE ATT&CK® for ICS — possible attack
  paths".
- Each path shows as a chain of chips:
  `Initial Access · T0822 → Lateral Movement · T0886 → Impair Process Control · T0855 → Impact · T0880`.
  Technique IDs link to attack.mitre.org.
- Selecting a path highlights its devices and edges on the canvas with numbered steps. Add a
  `pathMarks` map to `buildView`, next to the existing `marks`, with classes `sec-path` and
  `sec-path-step`.
- Each path lists the findings it relies on, for example "uses the it-ot-direct link".
- Commands: "Show attack paths" and "Export attack paths (MITRE Attack Flow)".
- The Markdown record gets an "Attack paths (MITRE ATT&CK for ICS)" section.

### Attack Flow export (`src/model/attack/attackFlow.ts`, lazy)
Format, confirmed on 2026-10-25 from `center-for-threat-informed-defense/attack-flow`,
`stix/attack-flow-schema-2.0.0.json`:
- STIX 2.1, extended with the new object types `attack-flow`, `attack-action`, `attack-asset`,
  `attack-condition` and `attack-operator`.
- Extension definition id: `extension-definition--fb9c968a-745b-4ade-9b25-c324172197f4`, with
  `extension_type: "new-sdo"`.
- `attack-flow` requires `name`, `scope` and `start_refs`. Scope is one of: incident, campaign,
  threat-actor, malware, emulation-plan, attack-tree, other.
- `attack-action` requires `name`. It may carry `technique_id`, `tactic_id`, `description`,
  `asset_refs` and `effect_refs`.
- `attack-asset` requires `name`. It may carry `description` and `object_ref`.

Export a STIX 2.1 `bundle` containing:
- the extension-definition object, structured like the files in the repo's `corpus/`;
- an `identity` object for the author;
- one `attack-flow` with `scope: "attack-tree"`, named after the project, whose `start_refs`
  point to the first action of each exported path;
- one `attack-action` per step: `name`, `technique_id`, `tactic_id`, a description (device,
  level, zone), `asset_refs`, and `effect_refs` pointing to the next step;
- one `attack-asset` per device.

Every object needs `spec_version: "2.1"`, an `id` of the form `<type>--<uuid>`, `created`,
`modified` and the `extensions` block. Inject the id generator so tests are deterministic.

The user can export the selected path or all paths shown. The file is named
`<project>-attack-flow.json`.

Before shipping:
- Validate the output against the official schema. Use the repo's `af validate` if available;
  otherwise test against a vendored copy of the schema with a JSON-schema validator (dev
  dependency only).
- Open the file in MITRE's Attack Flow Builder. If the Builder only opens its own `.afb` format,
  record that in decisions.md and adjust the wording in the UI.

### Tests
- `paths.test.ts`:
  - template plus the office→RTU link ⇒ a path from `office-ws` to `rtu-pump` with the expected
    technique sequence;
  - a deny rule removes the path;
  - an allow rule restores it.
- `attackFlow.test.ts`: structure, every reference resolves, schema validation.
- `e2e/security.spec.ts`:
  - open the demo;
  - draw the office→RTU link by dispatching DragEvents (see Known issues in PROJECT_STATUS);
  - see the "IEC 62443 communication violation" finding;
  - open Attack paths, select a path, and see it highlighted;
  - export the Attack Flow file;
  - run an axe check on the panel.

---

## Housekeeping (each branch)
- `decisions.md`: record schema v5, the pinned ATT&CK dataset version, the 62443 citation
  approach, and anything learned while verifying clauses or the Builder import.
- `PROJECT_STATUS.md`: milestone rows, bundle size, and known issues.
- `README.md`: feature section, plus a screenshot in `docs/images/` showing findings and a
  highlighted path. Update the data-flow diagram if it lists derived data.
- Before pushing, sweep for retired names and AI attribution lines.

## Verification
1. `npm run ci`, then `npm run e2e`.
2. Manual check in `npm run dev`:
   - Load the water-treatment demo and draw Office workstation → Pump station RTU. The link
     turns red and the finding appears.
   - Add a "No IT → OT" policy. "Company policy violation" appears alongside.
   - Attack paths shows office-ws → … → rtu-pump with ATT&CK chips.
   - Add a deny rule on the IT/OT firewall. Paths through it disappear.
   - Export the Attack Flow file and open it in Attack Flow Builder.
3. Open a v4 project file and an old share link. Both migrate to v5.
