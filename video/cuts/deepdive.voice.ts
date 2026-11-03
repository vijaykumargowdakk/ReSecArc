// What the narrator says in the dubbed deep dive (npx showpilot dub deepdive), by beat id. The on-screen subtitles of the
// silent cut were written to be read; these are written to be spoken, in the launch video's presenter style, and each
// one fits the time its scene is on screen. Delivery marks: | breath, || beat, *stress*, <up>lift</up> (see Showpilot's voice docs).
export const SPOKEN: Record<string, string> = {
  // Intro (the big words on screen follow the subtitle text, so these stay close to it)
  c01b001: '<up>ReSecArc!</up> | The complete walkthrough.',
  c01b002: 'Part one: | *every* feature, | step by step. || Part two: | the repository, | and how the code is built.',
  c01b003: 'Everything here runs right in your browser, | on fictional demo plants.',

  // 1. The screen
  c02b001: 'So, | this is *ReSecArc*. | A browser-based designer for OT and ICS networks. || It opens on a fictional water treatment plant, | ready to explore.',
  c02b002: 'Up top is the toolbar: | search, undo and redo, how new connections are drawn, your files, export, display settings and help. || All one click away.',
  c02b003: 'On the left, | the device palette. || Just click a device to add it, | or drag it straight onto a level.',
  c02b004: 'The middle is the canvas, | built on the *Purdue model*: | the enterprise network at the top, at L5, | right down to the physical process at L0.',
  c02b005: 'On the right, | the properties panel. || Select anything, and you edit it here. | Select nothing, | and it shows you the whole project.',
  c02b006: 'Need more room? | Both side panels fold away. || Ctrl+B for the palette, | and Ctrl+Alt+B for the properties.',

  // 2. Templates
  c03b001: 'Click *New*, | and you get the template gallery: | a blank canvas, | or one of five reference plants.',
  c03b002: "There's a water treatment plant, an electrical substation, a manufacturing line, building automation, | and a gas pipeline across three sites.",
  c03b003: "But for now, | we'll stick with the water plant.",

  // 3. Devices
  c04b001: "ReSecArc knows *nineteen* device types, | and *eighty-five* kinds, | each with its own icon. || Open the arrow beside a type, | and you'll see them all.",
  c04b002: 'Select a device, | and the panel shows its kind, its Purdue level, its security zone, | and how critical it is.',
  c04b003: 'Asset details live here too: | vendor, model, firmware, serial number, IP addresses and notes.',
  c04b004: 'Tags flag devices for follow-up, | like *patch-pending*.',
  c04b005: 'Want to track something more? | Add your own custom fields, | like an owner, a cabinet, | or a support end date.',
  c04b006: "Once it's defined, | the field shows up on *every* device, | in the inventory, | and in your CSV exports.",
  c04b007: 'Remote access, too: | RDP, SSH, VNC or HTTPS, | with their ports.',

  // 4. Links and flows
  c05b001: 'Adding a device is easy. | Click it in the palette, | and it drops into the first free spot on its level.',
  c05b002: 'Network links are the physical cables. | *Link to* connects it to any device, | by name.',
  c05b003: 'Protocol flows are the conversations on top. | They have a direction: | client to server, | or master to outstation.',
  c05b004: 'Every flow speaks one of *twelve* industrial protocols, | each with its own settings. || Here, the SCADA server talks DNP3 to the pump station, | with Secure Authentication switched on.',
  c05b005: 'And you can do all of this from the keyboard. | Press L for a link, or F for a flow, | pick a device with the arrow keys, | and hit Enter. || <up>No mouse needed.</up>',

  // 5. Firewall rules
  c06b001: "Now, firewalls. | Each one carries an ordered list of rules. || They're read from the top down, | and the *first* match wins.",
  c06b002: 'Sources and destinations can be anything, | a whole zone, | or one single device, | plus a protocol and a port.',
  c06b003: "And if nothing matches? | The default action applies. || Here, that's *deny*.",
  c06b004: 'Add a rule, | and it lands at the bottom of the list. || Changed your mind? | Ctrl+Z takes it right back.',

  // 6. Zones, conduits and networks
  c07b001: 'Clear the selection, | and you see the whole project.',
  c07b002: 'These are your *IEC 62443* security zones: | devices grouped by their security needs, | each with a target level, from SL 1 to SL 4.',
  c07b003: 'Below them, | the networks: | every IPv4 subnet, with its VLAN and zone.',
  c07b004: 'And conduits? | ReSecArc works those out for you: | every pair of zones that a link or a flow connects.',

  // 7. IP and VLAN planning
  c08b001: "Every address is matched to its network. | So let's give the PLC the HMI's address…",
  c08b002: '<up>And there it is!</up> | An instant warning: | that address is *already* taken by the Filtration HMI.',
  c08b003: "Warnings never block you. | Undo, and it's fixed.",
  c08b004: 'And the IP plan lists every address in order, | with its network, VLAN and zone.',

  // 8. Inventory and CSV
  c09b001: 'The inventory is the same design, as tables: | devices, links, flows, firewall rules, and the IP plan.',
  c09b002: 'Edit any cell, | or filter the table down.',
  c09b003: 'Every table exports to CSV, | and you can import devices, links, flows and rules, too.',
  c09b004: 'Bad rows get rejected, | with a reason, | *before* anything changes. || The good rows come in as one undoable step.',

  // 9. Editing tools
  c10b001: 'Made a mistake? | Undo and redo keep a *hundred* steps. || The clock button lists them by name, | so you can jump straight to any one.',
  c10b002: 'The command palette runs *any* action. | Just type part of its name.',
  c10b003: 'Select a few devices, | and edit them together, | or line them up neatly.',
  c10b004: "Messy layout? | Tidy cleans up the whole site in one go. || Don't like it? | Click again, and it's back.",
  c10b005: 'Right-click a device to lock it, | so nobody drags it by accident.',
  c10b006: 'And text notes are perfect for legends, | remarks, | and open questions.',

  // 10. Search, filters and layers
  c11b001: 'Ctrl+K finds any device, on any site: | by name, kind, IP address, vendor, tag or custom field.',
  c11b002: 'Filters dim everything else, | so the layout still makes sense.',
  c11b003: 'And the View menu shows or hides links, flows, labels, port names, notes, and area frames.',

  // 11. Large estates
  c12b001: 'Got a big estate? | Split it into sites, | each with its own tab. || This pipeline has three.',
  c12b002: 'A connection to another site ends at a stub. | Click it, | and you jump straight there.',
  c12b003: 'Areas frame your cells, lines or substations, | and fold into a single node.',
  c12b004: 'Busy level? | Open it in its own tab, | laid out in tidy rows, | so it stays readable.',
  c12b005: 'Similar devices can stack into one card, | like these two welding robots.',
  c12b006: 'You can even merge sites in from another project file, | in one undoable step.',

  // 12. Revisions
  c13b001: "Before a change, | save the design as a named revision. || Let's call it *Baseline*.",
  c13b002: 'Now make some changes: | new firmware on a PLC, | a new HMI, | and one pump removed.',
  c13b003: 'Hit *Compare*, | and you see exactly what changed: | green for new, | amber for changed, | and removed items, listed right here.',
  c13b004: 'And the whole change list downloads as a Markdown record, | ready for review.',

  // 13. Security checks
  c14b001: 'Now, the security side. | The Security button counts the findings, | live, | on every edit.',
  c14b002: 'Each finding names the *IEC 62443* requirement it breaks, | and tells you how to fix it.',
  c14b003: 'Click one, | and you go straight to the devices involved.',
  c14b004: 'The Rules tab lists every built-in check, | and you can switch any of them off, | per project.',
  c14b005: "Got your own company rules? | Add them as policies, | like *no direct IT to OT*, | and they're checked the same way.",

  // 14. Attack paths
  c15b001: 'Now, my favourite part. || Attack paths show how an attacker could move, | from an entry point, | to your most critical equipment.',
  c15b002: 'Entry points and targets are picked for you, | but you can change them.',
  c15b003: 'Pick a path, | and watch it light up, | hop by hop. || Every step is labelled with a *MITRE ATT&CK for ICS* tactic and technique.',
  c15b004: "Each hop follows the firewall rules. | So, | let's set rule two to *deny*…",
  c15b005: '<up>And look at that!</up> || *Every* attack path is gone. | That one rule was the way in, | for all of them.',
  c15b006: 'Undo puts it back. || And any path, | or all of them, | exports as a *MITRE* Attack Flow, | in STIX 2.1.',

  // 15. Exports and sharing
  c16b001: 'The Export menu has everything else: | SVG and PNG diagrams, a full report, draw.io, Markdown and CSV.',
  c16b002: 'Share as a link packs the *whole* design into the link itself. || And it never touches a server.',
  c16b003: 'Save writes your project as one JSON file, | to open later, | or keep in version control.',
  c16b004: 'And the full report? | Every site, the zones, the findings and the attack paths, | in one HTML document…',
  c16b005: '…that prints straight to PDF, | right from your browser.',

  // 16. Display and accessibility
  c17b001: 'Pick your theme: | light, dark, high contrast, | or just follow your system.',
  c17b002: 'Text size goes up to 150 percent, | for the toolbar and the panels.',
  c17b003: 'The outline shows the whole design as a tree, | made for the keyboard, | and for screen readers.',
  c17b004: "Every action has a shortcut. | Press the question mark, | and you'll see them all.",
  c17b005: 'New here? | A six-step tour shows you around on your first visit, | and you can replay it any time.',

  // 17. Works offline
  c18b001: "Here's something cool. | The first time ReSecArc opens, | it saves itself in your browser, | and tells you when it's ready.",
  c18b002: "Now, | let's cut the network…",
  c18b003: '…and reload. | It opens from its own copy, | <up>and everything still works!</up>',
  c18b004: 'It even installs as an app in Chrome and Edge, | and only updates when *you* say so.',

  // 18. The repository
  c19b001: "That's the tool. || Now, part two: | the code. | This is the repository, on GitHub.",
  c19b002: 'The About box links to the live app, | and sums up what it does.',
  c19b003: 'At the top level: | src for the app, e2e for the browser tests, docs, scripts, | and the project notes.',
  c19b004: 'And below that, the README. | A full guide to the tool, | with a contents list and thirty-two diagrams.',

  // 19. README: the ideas
  c20b001: 'Section one: why this exists. | One model, | instead of drawings, spreadsheets and emails all over the place.',
  c20b002: '2.1: the Purdue model. | Levels L5 to L0, | coloured IT, DMZ and OT.',
  c20b003: '2.2: *IEC 62443* zones and conduits, | and what flows between them.',
  c20b004: '2.3: the building blocks. | Sites, devices, connections, zones, networks and revisions.',
  c20b005: 'Section three maps the screen.',
  c20b006: 'And section four is the feature guide, | with a screenshot of every area.',

  // 20. README: workflows and architecture
  c21b001: 'Section five walks through real jobs, | like documenting a site…',
  c21b002: '…or planning a change for review.',
  c21b003: "Section six: how it's built. | A static site that runs entirely in your browser. || No server. | No account.",
  c21b004: 'Three layers, | with dependencies pointing one way: | the UI, the state stores, | and a pure model.',
  c21b005: 'And the principles behind the code: | the schema is the source of truth, | edits are pure functions, | and views are derived, | never stored.',
  c21b006: 'Section seven maps the source code, | folder by folder, | file by file.',

  // 21. README: how it works inside
  c22b001: 'Section eight: the data model. | One JSON document, | checked against a zod schema when it opens.',
  c22b002: 'Section nine follows an edit through the app: | from a click, | to the model, | the undo history, | and autosave.',
  c22b003: 'Ten: how the canvas gets drawn.',
  c22b004: "Eleven: every file is migrated and validated before it opens. || If anything's wrong, | your current design stays safe.",
  c22b005: 'Twelve and thirteen: autosave, and comparing revisions.',
  c22b006: 'Fourteen: the IP address checks.',
  c22b007: 'Fifteen: share links. | The design travels *inside* the link, | and never reaches the server.',
  c22b008: 'Sixteen and seventeen: CSV import, and tidy layout.',
  c22b009: 'Eighteen: the catalogs. | Eighty-five device kinds, | twelve protocols, | five templates.',

  // 22. README: quality and testing
  c23b001: 'Nineteen: themes and accessibility, | even connecting devices by keyboard.',
  c23b002: 'Twenty: privacy. | Your designs stay in your browser, | unless *you* share them.',
  c23b003: 'Twenty-two: the dev guide, | and CI. | Two jobs, | on every push and pull request.',
  c23b004: 'Twenty-three: testing. | 252 unit tests, | 84 browser tests, | and accessibility scans.',
  c23b005: 'And twenty-four: the history, | up to version 0.4.',

  // 23. The code
  c24b001: 'Inside src: | the model, the stores, the UI, the exports, offline support, | and the templates.',
  c24b002: 'src/model is pure TypeScript. | No React, | so every rule gets unit-tested directly.',
  c24b003: 'schema.ts defines the file format. | The types come straight from it, | so types and validation never drift apart.',
  c24b004: 'checks.ts holds the *IEC 62443* checks, | each one citing the requirement it tests…',
  c24b005: '…and attack/paths.ts finds the attack paths, | through the links and the firewall rules.',
  c24b006: 'src/ui has the React components: | the canvas, the panels, | and the dialogs.',
  c24b007: 'e2e has the browser tests…',
  c24b008: '…and the CI workflow runs them, | with type checks, lint, unit tests and the bundle budget, | on every pull request.',

  // 24. How it is built
  c25b001: 'Every change gets built and tested on GitHub Actions.',
  c25b002: "Work lands through pull requests, | each one tested before it's merged.",
  c25b003: 'Every decision is written down, | with the reason, | and the request behind it.',
  c25b004: "And PROJECT_STATUS tracks the milestones, the known issues, | and what's next.",

  // Closing card
  c26b001: "And that's *ReSecArc*! || Try it right in your browser, | and dig into the code on GitHub. || <up>Thanks so much for watching!</up>",
};
