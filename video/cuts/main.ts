// The judged submission video (~5–6 min): hello and the problem, a speed-run build, the attack-path hook, the
// standards, a tour of the tool, the GitHub walkthrough, and the call to action.
// Narration facts come from ReSecArc's README and PROJECT_STATUS and are checked in the running app.
import { beat, chapter, cut, scene, web, type Chapter, type Studio } from 'showpilot';
import { LINKS } from '../showpilot.config';
import { around, clearSelection, device, link, paletteItem, panel, PROPERTIES, securityButton } from './moves';

const OFFICE_PATH = 'Office workstation → Pump station RTU';

/** The standards slam: a badge for each as it is named, then the tagline. */
export const STANDARDS = {
  badges: [
    { word: 'purdue', title: 'Purdue model', sub: 'Levels 0–5 and the industrial DMZ' },
    { word: '62443', title: 'IEC 62443', sub: 'Zones, conduits and requirement-level checks' },
    { word: 'mitre', title: 'MITRE ATT&CK® for ICS', sub: 'Every attack-path step labelled' },
    { word: 'stix', title: 'STIX 2.1 Attack Flow', sub: 'Export that passes the official schema' },
  ],
  tagline: { text: 'No server · No account · Works offline', after: 'server' },
};

async function darkTheme(s: Studio) {
  await s.click(s.page.locator('.display-menu summary'));
  await s.page.getByRole('radio', { name: 'Dark' }).check();
  await s.click(s.page.locator('.display-menu summary'));
}

/** Behind the opening words: features the tour does not cover (templates, sites, dark theme, command palette, inventory, IP plan, outline). */
async function introBroll(s: Studio) {
  await s.wait(0.8);
  await s.click(s.page.getByRole('button', { name: 'New', exact: true }));
  await s.wait(1.6);
  await s.click(s.page.getByRole('button', { name: /Gas pipeline/ }));
  await s.settle();
  await s.wait(1);
  await s.click(s.page.locator('.site-tab__button').nth(1));
  await s.settle();
  await s.wait(1.2);
  await darkTheme(s);
  await s.wait(1.2);
  await s.press('Control+Shift+P');
  for (const ch of 'inventory') await s.page.keyboard.type(ch, { delay: 70 });
  await s.wait(0.4);
  await s.press('Enter');
  await s.wait(1.4);
  await s.click(s.page.getByRole('tab', { name: 'IP plan' }));
  await s.wait(1.6);
  await s.click(s.page.getByRole('tab', { name: 'Outline' }));
  await s.wait(1.6);
  await s.click(s.page.getByRole('tab', { name: 'Diagram' }));
  await s.settle();
  await s.click(s.page.locator('.site-tab__button').nth(0));
}

/** Behind the standards badges (blurred): attack paths lighting up and findings, in the dark theme. */
async function standardsBroll(s: Studio) {
  await s.wait(0.5);
  await s.click(securityButton(s));
  await s.click(s.page.getByRole('tab', { name: /^Attack paths/ }));
  await s.click(panel(s).getByRole('button', { name: OFFICE_PATH }));
  await s.wait(2.4);
  await s.click(panel(s).getByRole('button', { name: / → / }).nth(1));
  await s.wait(2.4);
  await s.click(s.page.getByRole('tab', { name: /^Findings/ }));
  await s.wait(1);
  await s.click(panel(s).locator('li button').first());
}

const speedRun: Chapter = {
  ...chapter('Speed-run: a plant from a blank canvas', [
    beat({
      do: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'New', exact: true }));
        await s.click(s.page.getByRole('button', { name: /Blank/ }));
        await s.settle();
      },
    }),
    beat({
      do: async (s) => {
        for (const item of ['Corporate workstation', 'Firewall', 'Jump host', 'SCADA server', 'Historian', 'HMI', 'Switch', 'PLC', 'RTU', 'Sensor', 'Actuator']) {
          await s.click(paletteItem(s, item), item);
        }
        await s.click(s.page.getByRole('button', { name: /Tidy/ }));
        await s.settle();
      },
    }),
    beat({
      do: async (s) => {
        for (const [a, b] of [
          ['Corporate workstation', 'Firewall'],
          ['Firewall', 'Jump host'],
          ['Jump host', 'SCADA server'],
          ['SCADA server', 'Switch'],
          ['Historian', 'Switch'],
          ['HMI', 'Switch'],
          ['Switch', 'PLC'],
          ['PLC', 'Sensor'],
          ['PLC', 'Actuator'],
        ]) {
          await link(s, a, b);
        }
        await clearSelection(s);
        await s.wait(1.5);
      },
    }),
  ]),
  speed: 5,
  voiceover: 'From a blank canvas | to a connected plant, | in about a minute. || <up>Now, here is why it matters.</up>',
};

export default cut({
  id: 'main',
  title: 'ReSecArc — submission video',
  chapters: [
    scene(
      'Hello and the problem',
      'kinetic',
      [
        beat({ say: "Hello! I'm Vijay Kumar. || Today, I want to walk you through something I've built." }),
        beat({ say: "Here's the thing. | The networks that run our water plants and pipelines | are still mostly drawn by hand. | And checking them for security? || That's still a manual job!" }),
        beat({ say: '<up>So I built a tool that does it with you.</up> || Watch this.' }),
      ],
      { broll: introBroll, props: { highlight: ['IEC', '62443', 'MITRE', 'ATT&CK', 'ICS', 'security', 'hand', 'manual'] } },
    ),

    speedRun,

    chapter('Hook: one firewall rule', [
      beat({
        say: '<slow>One misconfigured firewall rule.</slow> [pause 0.45] That is all it takes.',
        camera: 'wide',
        do: async (s) => {
          await s.click(securityButton(s));
          await s.click(s.page.getByRole('tab', { name: /^Attack paths/ }));
        },
      }),
      beat({
        say: 'From an office workstation, | hop by hop, | all the way down to the pump station!',
        do: async (s) => {
          await s.click(panel(s).getByRole('button', { name: OFFICE_PATH }), OFFICE_PATH);
          await s.wait(0.6);
          await s.focus(await around(s, ['Office workstation', 'Remote access jump host', 'SCADA server', 'Pump station RTU']), 1.4);
        },
      }),
      beat({
        say: 'And every step is labelled with *MITRE ATT&CK for ICS*.',
        do: async (s) => s.focus(panel(s).getByRole('listitem').filter({ has: s.page.getByRole('button', { name: OFFICE_PATH }) }), 1.6),
      }),
      beat({
        say: 'Now watch. | Flip one firewall rule to deny,',
        do: async (s) => {
          await s.click(device(s, 'IT/OT firewall'), 'IT/OT firewall');
          const rule = s.page.locator('.rule-list > li').nth(1);
          await rule.scrollIntoViewIfNeeded();
          const action = rule.locator('.rule__head select');
          await s.click(action, 'Rule #2');
          await action.selectOption('deny');
          await s.wait(0.4);
        },
      }),
      beat({
        say: 'and that path is *gone*.',
        do: async (s) => {
          await clearSelection(s);
          await s.focus(panel(s), 1.4);
          const left = await panel(s).getByRole('button', { name: OFFICE_PATH }).count();
          if (left) console.log('  ! the office → RTU path is still listed after the deny rule');
        },
        hold: 1.2,
      }),
    ]),

    scene(
      'Built on the standards',
      'badges',
      [
        beat({
          say: "This is *ReSecArc*. | And it's built on the standards that *matter*. | The *Purdue model*. | *IEC 62443* zones and conduits. | *MITRE ATT&CK for ICS*. | And *STIX 2.1* Attack Flow. [pause 0.4] <fast>No server. | No account. | And it works offline!</fast>",
          hold: 1.2,
        }),
      ],
      { setup: darkTheme, broll: standardsBroll, props: STANDARDS },
    ),

    chapter('Tour: designing the network', [
      beat({
        say: "Let's take a proper tour. | This is a fictional water treatment plant, | laid out on the *Purdue model*, | from the enterprise network at the top, | down to the sensors at level zero.",
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 520, y: 250 });
          await s.wait(1.2);
          await s.moveTo({ x: 520, y: 980 }, 1.6);
        },
      }),
      beat({
        say: 'Click any device, | and everything about it is right here. | Its kind, | its Purdue level, | its security zone, | and its asset details.',
        do: async (s) => {
          await s.click(device(s, 'Filtration PLC'), 'Filtration PLC');
          await s.wait(0.5);
          await s.focus(PROPERTIES, 1.5);
        },
      }),
      beat({
        say: 'Every connection carries a real industrial protocol. | Modbus, | DNP3, | OPC UA, | and many more, | each with its own settings.',
        do: async (s) => {
          await s.click(s.page.getByText('Modbus RW').first(), 'Modbus flow');
          await s.wait(0.6);
          await s.focus(PROPERTIES, 1.5);
        },
      }),
      beat({
        say: 'Devices are grouped into *IEC 62443* security zones, | each with its own target security level.',
        do: async (s) => {
          await clearSelection(s);
          await s.focus(s.page.getByRole('heading', { name: /Security zones/i }).locator('xpath=ancestor::section[1]'), 1.5);
        },
      }),
      beat({
        say: 'Big plant? | Open any level in its own tab, | and work on it without the clutter.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Open L1 in its own tab' }));
          await s.wait(1.6);
          await s.click(s.page.getByRole('navigation', { name: 'Levels' }).getByRole('button', { name: 'Overview' }));
        },
      }),
    ]),

    chapter('Tour: security checks', [
      beat({
        say: 'Now, the important part. | ReSecArc checks your design against *IEC 62443*, | live, | while you draw.',
        do: async (s) => {
          await s.click(securityButton(s));
          await s.click(s.page.getByRole('tab', { name: /^Findings/ }));
        },
      }),
      beat({
        say: 'Each finding names the exact requirement it breaks, | and one click takes you straight to the problem.',
        do: async (s) => {
          await s.focus(panel(s), 1.4);
          await s.wait(1.2);
          await s.click(panel(s).locator('li button').first(), 'Finding');
        },
      }),
      beat({
        say: 'Got your own company rules? | Add them as policies, | and they are checked the same way.',
        do: async (s) => {
          await clearSelection(s);
          await s.click(s.page.getByRole('tab', { name: 'Rules' }));
          await s.click(s.page.getByRole('button', { name: 'Add example: no direct IT → OT' }));
          await s.wait(0.5);
          await s.click(s.page.getByRole('tab', { name: /^Findings/ }));
        },
      }),
      beat({
        say: 'Attack paths show how an attacker could move from an entry point | to your most critical equipment, | following every firewall rule along the way.',
        do: async (s) => {
          await s.click(s.page.getByRole('tab', { name: /^Attack paths/ }));
          await s.focus(panel(s), 1.3);
        },
      }),
      beat({
        say: 'And the paths export as a *MITRE* Attack Flow, | ready for your threat-modelling tools.',
        do: async (s) => s.hover(panel(s).getByRole('button', { name: 'Export', exact: true }), 1),
      }),
    ]),

    chapter('Tour: sharing the design', [
      beat({
        say: "When it's time to share, | export a full report, | draw dot I-O diagrams, | spreadsheets, | or send the whole design as a single link.",
        do: async (s) => {
          // The toolbar's Export is a disclosure menu (<summary>), not a button.
          const menu = s.page.locator('.export-menu > summary');
          await s.click(menu, 'Export');
          await s.wait(2.5);
          await s.click(menu);
        },
      }),
      beat({ say: 'And it all runs right in your browser.', camera: 'wide', hold: 0.8 }),
    ]),

    web('GitHub walkthrough', LINKS.profile, [
      beat({
        say: "Everything I've shown you lives on GitHub.",
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 900, y: 500 });
          await s.wait(1.6);
          await s.goto(LINKS.repo); // loads while the line finishes
        },
      }),
      beat({
        say: "Here's the repository. | The README covers every feature, | the architecture, | and the data model, | with diagrams.",
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 900, y: 600 });
          await s.scroll(2200, 4);
        },
      }),
      beat({
        say: 'Recent milestones land through pull requests,',
        camera: 'wide',
        do: async (s) => s.goto(`${LINKS.repo}/pulls?q=is%3Apr+is%3Aclosed`),
      }),
      beat({
        say: 'and continuous integration runs type checks, | linting, | two hundred and fifty-two unit tests, | and eighty-four browser tests | with accessibility checks.',
        camera: 'wide',
        do: async (s) => s.goto(`${LINKS.repo}/actions`),
      }),
    ]),

    scene(
      'Call to action',
      'cta',
      [beat({ say: "That's *ReSecArc*. | Secure OT architecture, | designed right from the start. || Try it now, | right in your browser. || Thanks for watching!", hold: 1.5 })],
      { props: { line: 'Secure OT architecture, designed right from the start.' } },
    ),
  ],
  // The hook's highlighted path (office workstation → pump station RTU, hops numbered), 9 s into chapter 3.
  thumbnail: {
    chapter: 3,
    at: 9,
    crop: { x: 370, y: 215, width: 1080, height: 745 },
    headlines: [
      { lines: ['One firewall', 'rule.', 'Whole plant', 'exposed.'], accentFrom: 2 },
      { lines: ['Find the', 'attack path', 'before', 'attackers do.'], accentFrom: 1 },
    ],
    chips: ['IEC 62443', 'MITRE ATT&CK for ICS'],
  },
});
