// The detailed walkthrough (~15–18 min, silent): every feature of ReSecArc, then the GitHub repository, the README's
// architecture and the codebase. No voice: each line is shown for as long as it takes to read, and the lines are
// written to out/deepdive/deepdive.srt for closed captions. Facts come from the README and are checked in the app.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Locator } from 'playwright';
import { beat, beatId, chapter, cut, scene, web, type Box, type Studio } from 'showpilot';
import { LINKS } from '../showpilot.config';
import { SPOKEN } from './deepdive.voice';
import { around, clearSelection, device, paletteItem, panel, PROPERTIES, securityButton } from './moves';

const OFFICE_PATH = 'Office workstation → Pump station RTU';
const REPO = LINKS.repo;
/** The ReSecArc checkout this video folder lives in. */
const APP = path.resolve(import.meta.dirname, '..', '..');
const OUT = path.resolve(import.meta.dirname, '..', 'out');
const now = () => Date.now() / 1000;
const BLOB = `${REPO}/blob/main`;

const properties = (s: Studio) => s.page.getByRole('complementary', { name: 'Properties' });
/** A section of the properties panel, found by its heading. */
const section = (s: Studio, name: RegExp) => properties(s).getByRole('heading', { name }).locator('xpath=ancestor::section[1]');

async function ctrlClick(s: Studio, target: Locator, label?: string) {
  await s.page.keyboard.down('Control');
  await s.click(target, label);
  await s.page.keyboard.up('Control');
}

async function rightClick(s: Studio, target: Locator) {
  const b = await s.box(target);
  const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await s.moveTo(at);
  s.log({ t: now(), type: 'down', ...at });
  await s.page.mouse.click(at.x, at.y, { button: 'right' });
  s.log({ t: now(), type: 'up', ...at });
  await s.wait(0.3);
}

async function template(s: Studio, name: RegExp) {
  await s.click(s.page.getByRole('button', { name: 'New', exact: true }));
  await s.wait(0.8);
  await s.click(s.page.getByRole('button', { name }));
  await s.settle();
}

/** The part of an element that is on screen, so a tall diagram is framed where it is visible. */
async function visible(target: Locator): Promise<Box> {
  const b = (await target.boundingBox())!;
  const y = Math.max(60, b.y);
  return { x: b.x, y, width: b.width, height: Math.min(1060, b.y + b.height) - y };
}

const anchor = (s: Studio, slug: string) => s.page.locator(`[id="user-content-${slug}"]`);
const diagramAfter = (s: Studio, slug: string) => anchor(s, slug).locator('xpath=following::section[@data-type="mermaid"][1]');

/** Scrolls the README to a heading and frames the diagram under it (GitHub renders diagrams once they are seen). */
async function readme(s: Studio, slug: string, { diagram = true, scale = 1.45 } = {}) {
  s.wide();
  await s.scrollTo(anchor(s, slug), 1.6, 90);
  await s.wait(1.4);
  if (diagram) await s.focus(await visible(diagramAfter(s, slug)), scale);
}

async function broll(s: Studio) {
  await s.wait(1);
  await s.click(securityButton(s));
  await s.click(s.page.getByRole('tab', { name: /^Attack paths/ }));
  await s.click(panel(s).getByRole('button', { name: OFFICE_PATH }));
  await s.wait(3);
  await s.click(s.page.getByRole('tab', { name: 'Inventory' }));
  await s.wait(2);
  await s.click(s.page.getByRole('tab', { name: 'Diagram' }));
}

const deepdive = cut({
  id: 'deepdive',
  title: 'ReSecArc — the complete walkthrough',
  silent: true,
  chapterTitles: true,
  chapters: [
    scene(
      'ReSecArc: the complete walkthrough',
      'kinetic',
      [
        beat({ say: 'ReSecArc: | the complete walkthrough.' }),
        beat({ say: 'Part one: | every feature, step by step. || Part two: | the repository, | and how the code is built.' }),
        beat({ say: 'Everything here runs in the browser, | on fictional demo plants.' }),
      ],
      { broll },
    ),

    // ───────────── Part 1: using ReSecArc ─────────────
    chapter('The screen', [
      beat({
        say: 'This is ReSecArc, | a browser-based designer for OT and ICS network architectures. | It opens on a fictional water treatment plant.',
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 900, y: 420 });
          await s.wait(1.5);
          await s.moveTo({ x: 1150, y: 700 }, 1.4);
        },
      }),
      beat({
        say: 'Across the top is the toolbar: | find, | undo and redo, | how new connections are drawn, | the files, | export, | display settings | and help.',
        do: async (s) => {
          await s.focus({ x: 0, y: 0, width: 1920, height: 52 }, 1.4);
          for (const x of [520, 740, 1030, 1480, 1720, 1860]) {
            await s.moveTo({ x, y: 25 });
            await s.wait(0.5);
          }
        },
      }),
      beat({
        say: 'On the left, the device palette. | Click a device to add it, | or drag it onto a level.',
        do: async (s) => s.focus({ x: 0, y: 50, width: 300, height: 700 }, 1.5),
      }),
      beat({
        say: 'In the middle, the canvas, | drawn as Purdue levels: | from the enterprise network at L5 | down to the physical process at L0.',
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 420, y: 230 });
          await s.wait(0.6);
          await s.moveTo({ x: 420, y: 980 }, 2.4);
        },
      }),
      beat({
        say: 'On the right, the properties panel. | It edits whatever is selected, | and shows the whole project when nothing is.',
        do: async (s) => s.focus(PROPERTIES, 1.5),
      }),
      beat({
        say: 'Both side panels fold away to give the canvas more room: | Ctrl+B for the palette, | Ctrl+Alt+B for the properties.',
        camera: 'wide',
        do: async (s) => {
          await s.press('Control+b');
          await s.wait(1);
          await s.press('Control+b');
          await s.wait(0.6);
          await s.press('Control+Alt+b');
          await s.wait(1);
          await s.press('Control+Alt+b');
        },
      }),
    ]),

    chapter('Templates', [
      beat({
        say: 'New opens the template gallery: | a blank canvas, | or one of five fictional reference plants.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'New', exact: true }));
          await s.wait(0.6);
          await s.focus(s.page.getByRole('dialog'), 1.3);
        },
      }),
      beat({
        say: 'A water treatment plant, | an electrical substation, | a discrete manufacturing line, | building automation, | and a gas pipeline spread over three sites.',
        do: async (s) => {
          for (const t of [/Water treatment/, /Electrical substation/, /Discrete manufacturing/, /Building automation/, /Gas pipeline/]) await s.hover(s.page.getByRole('button', { name: t }), 0.9);
        },
      }),
      beat({
        say: "We'll stay with the water plant for now.",
        camera: 'wide',
        do: async (s) => s.press('Escape'),
      }),
    ]),

    chapter('Devices and their details', [
      beat({
        say: 'There are 19 device types and 85 kinds, | each with its own icon. | The arrow beside a type lists its kinds.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Show kinds of PLC' }));
          await s.focus({ x: 0, y: 150, width: 300, height: 360 }, 1.6);
          await s.wait(2.5);
          await s.click(s.page.getByRole('button', { name: 'Hide kinds of PLC' }));
        },
      }),
      beat({
        say: 'Select a device, | and the properties panel shows its kind, | its Purdue level, | its security zone | and its criticality.',
        do: async (s) => {
          await s.click(device(s, 'Filtration PLC'), 'Filtration PLC');
          await s.wait(0.4);
          await s.focus(PROPERTIES, 1.5);
        },
      }),
      beat({
        say: 'Asset details hold the vendor, | model, | firmware, | serial number, | IP addresses | and notes.',
        do: async (s) => {
          await s.type(properties(s).getByLabel('Firmware'), 'V4.2');
          await s.focus(await s.box(properties(s).getByLabel('Firmware')), 1.6);
        },
      }),
      beat({
        say: 'Tags mark devices for follow-up, | such as patch-pending.',
        do: async (s) => {
          await s.type(s.page.getByRole('combobox', { name: 'Add a tag' }), 'patch-pending');
          await s.press('Enter');
          await s.focus(s.page.getByRole('list', { name: 'Tags' }), 1.6);
        },
      }),
      beat({
        say: 'Custom fields add your own attributes, | like an owner, | a cabinet | or a support end date.',
        do: async (s) => {
          await clearSelection(s);
          await s.click(s.page.getByRole('button', { name: 'Add custom field' }));
          await s.type(s.page.getByRole('textbox', { name: 'Field name' }), 'Owner');
          await s.press('Enter');
          await s.page.getByRole('combobox', { name: 'Kind' }).selectOption('select');
          await s.type(s.page.getByLabel('Choices, separated by commas'), 'OT team, IT team');
          await s.press('Enter');
        },
      }),
      beat({
        say: 'Once defined, the field is on every device, | in the inventory, | and in the CSV exports.',
        do: async (s) => {
          await s.click(device(s, 'Filtration PLC'), 'Filtration PLC');
          const owner = s.page.getByRole('combobox', { name: 'Owner' });
          await s.click(owner, 'Owner');
          await owner.selectOption('OT team');
          await s.focus(await s.box(owner), 1.6);
        },
      }),
      beat({
        say: 'Remote-access services record RDP, | SSH, | VNC | or HTTPS listeners, | with their ports.',
        do: async (s) => {
          await s.click(device(s, 'SCADA server'), 'SCADA server');
          await s.focus(await s.box(properties(s).locator('.service-list')), 1.6);
        },
      }),
    ]),

    chapter('Links and protocol flows', [
      beat({
        say: "Click a device in the palette, | and it's placed in the first free spot of its level.",
        do: async (s) => {
          await s.click(paletteItem(s, 'HMI'), 'HMI');
          await s.settle();
          await s.click(s.page.locator('.react-flow__node-device', { hasText: /^HMI/ }).first(), 'HMI');
        },
      }),
      beat({
        say: 'Network links are the physical connections. | Link to… connects the selected device by name.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Link to…' }));
          await s.type(s.page.getByRole('textbox', { name: /^Link HMI to/ }), 'Control switch');
          await s.click(s.page.getByRole('list', { name: /^Link HMI to/ }).getByRole('button', { name: /Control switch/ }).first());
        },
      }),
      beat({
        say: 'Protocol flows are the conversations on top: | directed, | from client to server, | or from master to outstation.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Flow to…' }));
          await s.type(s.page.getByRole('textbox', { name: /^Flow from HMI to/ }), 'Filtration PLC');
          await s.click(s.page.getByRole('list', { name: /^Flow from HMI to/ }).getByRole('button', { name: /Filtration PLC/ }).first());
        },
      }),
      beat({
        say: 'Each flow uses one of twelve industrial protocols, | each with its own settings. | Here, the SCADA server talks DNP3 to the pump station, | with Secure Authentication on.',
        do: async (s) => {
          await s.click(s.page.getByRole('tab', { name: 'Inventory' }));
          await s.click(s.page.getByRole('tab', { name: /^Flows/ }));
          await s.wait(0.6);
          await s.click(s.page.locator('.inventory__table tbody tr', { hasText: 'DNP3' }).getByRole('button', { name: 'Show flow on diagram' }));
          await s.wait(0.8);
          await s.focus(PROPERTIES, 1.5);
        },
      }),
      beat({
        say: 'Connections can be made from the keyboard, too: | press L for a link or F for a flow, | choose a device with the arrow keys, | and press Enter.',
        do: async (s) => {
          await clearSelection(s);
          await device(s, 'Filtration PLC').focus();
          await s.press('l');
          await s.wait(0.6);
          await s.press('ArrowRight');
          await s.wait(1.2);
          await s.press('Escape');
        },
      }),
    ]),

    chapter('Firewall rules', [
      beat({
        say: 'A firewall carries an ordered list of rules. | They are read top to bottom, | and the first match wins.',
        do: async (s) => {
          await s.click(device(s, 'IT/OT firewall'), 'IT/OT firewall');
          await s.focus(await s.box(s.page.locator('.rule-list')), 1.4);
        },
      }),
      beat({
        say: 'Sources and destinations can be any, | a zone | or a single device, | with a protocol and a port.',
        do: async (s) => s.focus(await s.box(s.page.locator('.rule-list > li').first()), 1.7),
      }),
      beat({
        say: 'When no rule matches, | the default action applies. | Here, that is deny.',
        do: async (s) => s.focus(await s.box(s.page.getByLabel('When no rule matches')), 1.7),
      }),
      beat({
        say: 'Adding a rule puts a new line at the end of the list, | and Ctrl+Z takes it back.',
        do: async (s) => {
          await s.click(properties(s).getByRole('button', { name: 'Rule', exact: true }));
          await s.wait(1.2);
          await s.press('Control+z');
        },
      }),
    ]),

    chapter('Zones, conduits and networks', [
      beat({
        say: 'With nothing selected, | the properties panel shows the whole project.',
        do: async (s) => {
          await clearSelection(s);
          await s.focus(PROPERTIES, 1.4);
        },
      }),
      beat({
        say: 'IEC 62443 security zones group devices with the same security needs, | each with a target security level, | from SL 1 to SL 4.',
        do: async (s) => s.focus(await s.box(section(s, /Security zones/i)), 1.5),
      }),
      beat({
        say: 'Networks list the IPv4 subnets in use, | with their VLAN and zone.',
        do: async (s) => s.focus(await s.box(section(s, /^Networks/i)), 1.5),
      }),
      beat({
        say: 'Conduits are worked out for you: | every pair of zones joined by a link or a flow.',
        do: async (s) => s.focus(await s.box(section(s, /^Conduits/i)), 1.5),
      }),
    ]),

    chapter('IP and VLAN planning', [
      beat({
        say: "Every address is matched to its network. | Let's give the Filtration PLC the HMI's address…",
        do: async (s) => {
          await s.click(device(s, 'Filtration PLC'), 'Filtration PLC');
          await s.type(properties(s).getByLabel('IP address', { exact: true }), '10.50.2.11');
        },
      }),
      beat({
        say: '…and the warning appears at once: | that address is already used by the Filtration HMI.',
        do: async (s) => s.focus(await s.box(properties(s).locator('.address-info')), 1.7),
      }),
      beat({
        say: 'Warnings never block saving. | Undo puts the address back.',
        do: async (s) => {
          const ip = properties(s).getByLabel('IP address', { exact: true });
          for (let i = 0; i < 4 && (await ip.inputValue()) !== '10.50.2.21'; i++) await s.press('Control+z');
        },
      }),
      beat({
        say: 'The IP plan lists every address in order, | with its network, | VLAN | and zone.',
        camera: 'wide',
        do: async (s) => {
          await s.click(s.page.getByRole('tab', { name: 'Inventory' }));
          await s.click(s.page.getByRole('tab', { name: 'IP plan' }));
        },
      }),
    ]),

    chapter('Inventory and CSV', [
      beat({
        say: 'The inventory is the same design as tables: | devices, | links, | flows, | firewall rules | and the IP plan.',
        camera: 'wide',
        do: async (s) => {
          await s.click(s.page.getByRole('tab', { name: 'Inventory' }));
          for (const t of [/^Links/, /^Flows/, /^Firewall rules/, /^Devices/]) {
            await s.click(s.page.getByRole('tab', { name: t }));
            await s.wait(0.7);
          }
        },
      }),
      beat({
        say: 'Cells are editable, | and the filter narrows the table down.',
        do: async (s) => s.type(s.page.getByLabel('Filter devices'), 'PLC'),
      }),
      beat({
        say: 'Every table exports to CSV, | and devices, links, flows and rules import from it.',
        do: async (s) => {
          await s.type(s.page.getByLabel('Filter devices'), ' ');
          await s.page.getByLabel('Filter devices').fill('');
          await s.click(s.page.getByRole('button', { name: 'Import CSV' }));
          const csv = 'name,type,variant,level,ip\nNew pump PLC,plc,compact,1,10.50.2.60\nMystery box,toaster,,,\n';
          await s.page.locator('.import-dialog input[type=file]').setInputFiles({ name: 'devices.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
          await s.wait(0.6);
          await s.focus(s.page.locator('.import-dialog'), 1.3);
        },
      }),
      beat({
        say: 'Bad rows are rejected with a reason before anything changes. | The rest import as one undoable step.',
        do: async (s) => {
          await s.focus(await s.box(s.page.locator('.import-errors')), 1.6);
          await s.wait(1.5);
          await s.click(s.page.getByRole('button', { name: 'Import 1 device' }));
        },
      }),
    ]),

    chapter('Editing tools', [
      beat({
        say: 'Undo and redo keep a hundred steps. | The clock button lists them by name, | and jumps to any of them.',
        do: async (s) => {
          await s.click(s.page.locator('.palette__item', { hasText: /^PLC$/ }), 'PLC');
          await s.click(s.page.locator('.history-menu summary'), 'Edit history');
          await s.wait(2);
          await s.click(s.page.locator('.history-menu summary'));
        },
      }),
      beat({
        say: 'The command palette runs any action by typing part of its name.',
        do: async (s) => {
          await s.press('Control+Shift+P');
          for (const ch of 'tidy') await s.page.keyboard.type(ch, { delay: 90 });
          await s.wait(1.6);
          await s.press('Escape');
        },
      }),
      beat({
        say: 'Select several devices to edit them together, | or to align and distribute them.',
        do: async (s) => {
          await s.click(device(s, 'Filtration PLC'), 'Filtration PLC');
          await ctrlClick(s, device(s, 'Chemical dosing PLC'), 'Chemical dosing PLC');
          await ctrlClick(s, device(s, 'Dosing safety controller'), 'Dosing safety controller');
          await s.focus(PROPERTIES, 1.4);
        },
      }),
      beat({
        say: 'Tidy lays out the whole site in one step. | A second click puts the old layout back.',
        camera: 'wide',
        do: async (s) => {
          await clearSelection(s);
          await s.click(s.page.getByRole('button', { name: 'Tidy layout' }));
          await s.wait(2);
          await s.click(s.page.getByRole('button', { name: 'Undo tidy' }));
        },
      }),
      beat({
        say: "Lock a device from its right-click menu, | so it can't be dragged by accident.",
        do: async (s) => {
          await rightClick(s, device(s, 'Site historian'));
          await s.click(s.page.getByRole('menuitem', { name: 'Lock in place' }));
        },
      }),
      beat({
        say: 'Text notes hold legends, | remarks | and open questions.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Text note' }));
          await s.type(s.page.locator('.inspector textarea').first(), 'Check rule 2 with the vendor');
        },
      }),
    ]),

    chapter('Search, filters and layers', [
      beat({
        say: 'Ctrl+K finds any device on any site: | by name, kind, IP address, vendor, tag or custom field.',
        do: async (s) => {
          await s.press('Control+k');
          await s.type(s.page.getByLabel('Search devices'), '10.50.2.40');
          await s.wait(0.6);
          await s.press('Enter');
        },
      }),
      beat({
        say: "Filters dim everything that doesn't match, | so the layout stays readable.",
        camera: 'wide',
        do: async (s) => {
          await clearSelection(s);
          const zone = s.page.getByRole('group', { name: 'Filter' }).locator('summary', { hasText: 'Zone' });
          await s.click(zone, 'Zone');
          await s.click(s.page.getByRole('checkbox', { name: /^Control/ }));
          await s.click(zone);
          await s.wait(1.6);
          await s.click(s.page.getByRole('button', { name: 'Clear' }));
        },
      }),
      beat({
        say: 'The View menu shows or hides links, | flows, | labels, | port names, | notes | and area frames.',
        camera: 'wide',
        do: async (s) => {
          const view = s.page.locator('summary', { hasText: 'View' });
          await s.click(view, 'View');
          await s.click(s.page.getByRole('checkbox', { name: 'Protocol flows' }));
          await s.wait(1.4);
          await s.click(s.page.getByRole('checkbox', { name: 'Protocol flows' }));
          await s.click(view);
        },
      }),
    ]),

    chapter('Large estates', [
      beat({
        say: 'Big estates split into sites, | each with its own tab. | This gas pipeline has three.',
        camera: 'wide',
        do: async (s) => {
          await template(s, /Gas pipeline/);
          await s.focus(await s.box(s.page.locator('.site-tabs')), 1.6);
        },
      }),
      beat({
        say: 'A connection to another site ends at a stub, | and clicking the stub opens that site.',
        do: async (s) => {
          await s.click(s.page.locator('.site-tab__button').nth(1));
          await s.settle();
          await s.click(s.page.locator('.react-flow__node-portal', { hasText: 'Pipeline SCADA server' }), 'Stub');
          await s.settle();
        },
      }),
      beat({
        say: 'Areas frame cells, | lines | or substations, | and collapse into a single node.',
        camera: 'wide',
        do: async (s) => {
          await template(s, /Discrete manufacturing/);
          await s.click(s.page.getByRole('button', { name: 'Collapse Cell A – welding' }));
          await s.wait(1.5);
          await s.click(s.page.getByRole('button', { name: 'Expand Cell A – welding' }));
        },
      }),
      beat({
        say: 'Any Purdue level opens in a tab of its own, | laid out in rows, | so a busy level stays readable.',
        camera: 'wide',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Open L1 in its own tab' }));
          await s.wait(2.2);
          await s.click(s.page.getByRole('navigation', { name: 'Levels' }).getByRole('button', { name: 'Overview' }));
        },
      }),
      beat({
        say: 'Similar devices on a level can stack into one card, | like these two welding robots.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Stack similar devices on L0' }));
          await s.wait(0.6);
          await s.focus(await s.box(s.page.locator('.react-flow__node.is-stack').first()), 1.6);
        },
      }),
      beat({
        say: 'Sites can be merged in from another project file, | in one undoable step.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Merge sites from another project' }));
          const dialog = s.page.getByRole('dialog', { name: 'Merge sites from another project' });
          await dialog.locator('input[type=file]').setInputFiles(path.join(APP, 'src/examples/templates/pipeline.json'));
          await s.wait(0.8);
          await s.focus(dialog, 1.3);
          await s.wait(1.5);
          await s.click(dialog.getByRole('button', { name: /^Merge \d sites?/ }));
          await s.settle();
        },
      }),
    ]),

    chapter('Revisions and change records', [
      beat({
        say: 'Save the design as a named revision, | such as a baseline before a change.',
        do: async (s) => {
          await clearSelection(s);
          await s.type(s.page.getByLabel('Revision name').first(), 'Baseline');
          await s.click(s.page.getByRole('button', { name: 'Save revision' }));
        },
      }),
      beat({
        say: 'Then make the change: | new firmware on a PLC, | a new HMI, | and a pump removed.',
        do: async (s) => {
          await s.click(device(s, 'Filtration PLC'), 'Filtration PLC');
          await s.type(properties(s).getByLabel('Firmware'), 'V4.2');
          await s.click(paletteItem(s, 'HMI'), 'HMI');
          await rightClick(s, device(s, 'Dosing pump'));
          await s.click(s.page.getByRole('menuitem', { name: 'Delete' }));
        },
      }),
      beat({
        say: 'Compare shows what changed against the baseline: | green for new, | amber for changed, | and removed items listed in the panel.',
        camera: 'wide',
        do: async (s) => {
          await clearSelection(s);
          await s.click(s.page.getByRole('button', { name: 'Compare', exact: true }));
          await s.wait(1.2);
          await s.focus(PROPERTIES, 1.4);
        },
      }),
      beat({
        say: 'The change list downloads as a Markdown change record, | ready for review.',
        do: async (s) => s.hover(s.page.getByRole('button', { name: /Change record \(Markdown\)/ }), 1.2),
      }),
    ]),

    chapter('Security checks', [
      beat({
        say: 'The Security button counts the findings. | The checks run again on every edit.',
        do: async (s) => {
          await s.focus(await s.box(securityButton(s)), 1.8);
          await s.wait(1);
          await s.click(securityButton(s));
        },
      }),
      beat({
        say: 'Each finding names the IEC 62443 requirement it breaks, | and says how to fix it.',
        do: async (s) => s.focus(panel(s), 1.4),
      }),
      beat({
        say: 'Click a finding, | and the canvas goes straight to the devices involved.',
        do: async (s) => {
          await s.click(panel(s).locator('li button').first(), 'Finding');
          await s.settle();
        },
      }),
      beat({
        say: 'The Rules tab lists every built-in check, | and any of them can be switched off for a project.',
        do: async (s) => {
          await clearSelection(s);
          await s.click(s.page.getByRole('tab', { name: 'Rules' }));
          await s.focus(panel(s), 1.4);
        },
      }),
      beat({
        say: 'Company policies add your own rules, | such as no direct IT to OT connection, | and are checked the same way.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Add example: no direct IT → OT' }));
          await s.wait(0.5);
          await s.focus(await s.box(s.page.locator('.policy').first()), 1.6);
        },
      }),
    ]),

    chapter('Attack paths', [
      beat({
        say: 'Attack paths show how an attacker could move | from an entry point | to your most critical equipment.',
        do: async (s) => {
          await s.click(securityButton(s));
          await s.click(s.page.getByRole('tab', { name: /^Attack paths/ }));
          await s.focus(panel(s), 1.4);
        },
      }),
      beat({
        say: 'The entry points and targets are chosen for you, | and you can change them.',
        do: async (s) => {
          await s.click(s.page.locator('summary', { hasText: 'Where an attacker could start' }));
          await s.wait(1.4);
          await s.click(s.page.locator('summary', { hasText: 'Where an attacker could start' }));
          await s.click(s.page.locator('summary', { hasText: 'What an attacker could aim for' }));
          await s.wait(1.4);
          await s.click(s.page.locator('summary', { hasText: 'What an attacker could aim for' }));
        },
      }),
      beat({
        say: 'Pick a path, | and it lights up hop by hop. | Each step is labelled with a MITRE ATT&CK for ICS tactic and technique.',
        do: async (s) => {
          await s.click(panel(s).getByRole('button', { name: OFFICE_PATH }), OFFICE_PATH);
          await s.wait(0.6);
          await s.focus(await around(s, ['Office workstation', 'Remote access jump host', 'SCADA server', 'Pump station RTU']), 1.4);
        },
      }),
      beat({
        say: 'Every hop follows the firewall rules. | Set rule 2 on the IT/OT firewall to deny…',
        do: async (s) => {
          await s.click(device(s, 'IT/OT firewall'), 'IT/OT firewall');
          const rule = s.page.locator('.rule-list > li').nth(1);
          await rule.scrollIntoViewIfNeeded();
          const action = rule.locator('.rule__head select');
          await s.click(action, 'Rule #2');
          await action.selectOption('deny');
        },
      }),
      beat({
        say: '…and no attack path is left at all: | that one rule was the way in for every one of them.',
        do: async (s) => {
          await clearSelection(s);
          await s.focus(panel(s), 1.4);
        },
      }),
      beat({
        say: 'Undo puts the rule back. | Any path, or all of them, | exports as a MITRE Attack Flow in STIX 2.1.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Undo', exact: true }), 'Undo');
          await s.wait(0.6);
          const exportPath = panel(s).getByRole('button', { name: 'Export this path (Attack Flow)' });
          if (!(await exportPath.isVisible())) await s.click(panel(s).getByRole('button', { name: OFFICE_PATH }), OFFICE_PATH);
          await s.hover(exportPath, 1.2);
        },
      }),
    ]),

    chapter('Exports and sharing', [
      beat({
        say: 'The Export menu covers the rest: | the diagram as SVG or PNG, | a full report, | draw.io, | Markdown | and CSV.',
        do: async (s) => {
          await s.click(s.page.locator('.export-menu > summary'), 'Export');
          await s.wait(0.6);
          await s.focus(await s.box(s.page.locator('.export-menu')), 1.3);
          await s.wait(2.4);
        },
      }),
      beat({
        say: 'Share as a link packs the whole design into the link itself. | It is never sent to a server.',
        do: async (s) => {
          await s.click(s.page.getByRole('menuitem', { name: /Share as a link/ }));
          await s.wait(0.6);
          await s.focus(s.page.getByRole('dialog'), 1.3);
          await s.wait(2.4);
          await s.press('Escape');
        },
      }),
      beat({
        say: 'Save writes the project as one JSON file, | to open again later or keep in version control.',
        do: async (s) => s.hover(s.page.getByRole('button', { name: 'Save', exact: true }), 1.2),
      }),
      beat({
        say: 'The full report puts every site, | the zones, | the findings | and the attack paths | into a single HTML document…',
        camera: 'wide',
        do: async (s) => {
          await s.click(s.page.locator('.export-menu > summary'), 'Export');
          const file = await s.download(() => s.click(s.page.getByRole('menuitem', { name: 'Full report (HTML)' })), path.join(OUT, 'deepdive', 'report.html'));
          await s.goto(pathToFileURL(file).href);
          await s.moveTo({ x: 960, y: 600 });
        },
      }),
      beat({
        say: '…that prints straight to PDF from the browser.',
        camera: 'wide',
        do: async (s) => s.scroll(2600, 4),
      }),
    ]),

    chapter('Display and accessibility', [
      beat({
        say: 'The Display menu sets the theme: | light, | dark, | high contrast, | or follow the system.',
        camera: 'wide',
        do: async (s) => {
          await s.click(s.page.locator('.display-menu summary'), 'Display');
          await s.click(s.page.getByRole('radio', { name: 'Dark' }));
          await s.wait(1.4);
          await s.click(s.page.getByRole('radio', { name: 'High contrast' }));
          await s.wait(1.4);
          await s.click(s.page.getByRole('radio', { name: 'Light' }));
        },
      }),
      beat({
        say: 'And the text size, | up to 150 percent, | for the toolbar and panels.',
        camera: 'wide',
        do: async (s) => {
          await s.click(s.page.getByRole('radio', { name: 'Largest (150%)' }));
          await s.wait(1.6);
          await s.click(s.page.getByRole('radio', { name: 'Default (100%)' }));
          await s.click(s.page.locator('.display-menu summary'));
        },
      }),
      beat({
        say: 'The outline shows the whole design as a tree, | built for the keyboard and for screen readers.',
        do: async (s) => {
          await s.click(s.page.getByRole('tab', { name: 'Outline' }));
          await s.click(s.page.getByRole('treeitem').first());
          for (let i = 0; i < 5; i++) {
            await s.press('ArrowDown');
            await s.wait(0.25);
          }
        },
      }),
      beat({
        say: 'Every action has a keyboard shortcut. | Press the question mark to see them all.',
        do: async (s) => {
          await s.click(s.page.getByRole('tab', { name: 'Diagram' }));
          await s.page.locator('.react-flow__pane').dispatchEvent('click');
          await s.press('?');
          await s.wait(0.6);
          await s.focus(s.page.getByRole('dialog'), 1.3);
        },
      }),
      beat({
        say: 'A six-step tour introduces the screen on the first visit, | and can be replayed from here.',
        do: async (s) => {
          await s.click(s.page.getByRole('button', { name: 'Take the tour' }));
          for (let i = 0; i < 2; i++) {
            await s.wait(1);
            await s.click(s.page.getByRole('button', { name: 'Next' }));
          }
          await s.wait(0.8);
          await s.click(s.page.getByRole('button', { name: 'Skip tour' }));
        },
      }),
    ]),

    chapter(
      'Works offline',
      [
        beat({
          say: 'The first time ReSecArc opens, | it stores itself in the browser, | and a notice says when it is ready.',
          do: async (s) => {
            const toast = s.page.locator('.toast', { hasText: 'works offline' });
            await toast.waitFor({ timeout: 20000 });
            await s.focus(await s.box(toast), 1.5);
          },
        }),
        beat({
          say: 'Now the network goes off…',
          do: async (s) => {
            await s.click(s.page.locator('.toast', { hasText: 'works offline' }).getByRole('button', { name: 'Dismiss' }));
            await s.context.setOffline(true);
            await s.wait(0.6);
            await s.focus(await s.box(s.page.locator('.toast', { hasText: 'You are offline' })), 1.5);
          },
        }),
        beat({
          say: '…and the app reloads from its stored copy, | with every view still working.',
          camera: 'wide',
          do: async (s) => {
            await s.page.reload({ waitUntil: 'domcontentloaded' });
            await s.page.locator('.react-flow__node-device').first().waitFor();
            await s.click(paletteItem(s, 'PLC'), 'PLC');
            await s.click(s.page.getByRole('tab', { name: 'Inventory' }));
            await s.wait(1);
            await s.click(s.page.getByRole('tab', { name: 'Diagram' }));
          },
        }),
        beat({
          say: 'It also installs as an app in Chrome and Edge, | and updates only when you choose.',
          camera: 'wide',
          do: async (s) => s.moveTo({ x: 900, y: 600 }),
        }),
      ],
      undefined,
      { offline: true },
    ),

    // ───────────── Part 2: the repository ─────────────
    web('The repository', REPO, [
      beat({
        say: 'Part two: the code. | It lives on GitHub, | and this is the repository home.',
        camera: 'wide',
        do: async (s) => s.moveTo({ x: 900, y: 500 }),
      }),
      beat({
        say: 'The About box links to the live app, | and describes what the tool does.',
        do: async (s) => s.focus(await s.box(s.page.locator('h2:visible', { hasText: 'About' }).first().locator('xpath=..')), 1.6),
      }),
      beat({
        say: 'At the top level: | src for the app, | e2e for the browser tests, | docs, | scripts, | and the project notes.',
        do: async (s) => s.focus(await s.box(s.page.locator('table[aria-labelledby="folders-and-files"]')), 1.3),
      }),
      beat({
        say: 'Below it, the README: | a full guide to the tool, | with a contents list and thirty-two diagrams.',
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 900, y: 700 });
          await s.scroll(1500, 3);
        },
      }),
    ]),

    web('README: the ideas', `${BLOB}/README.md`, [
      beat({
        say: 'Section 1 explains why the tool exists: | one model, | instead of drawings, spreadsheets and emails scattered everywhere.',
        do: async (s) => readme(s, '1-why-resecarc-exists'),
      }),
      beat({ say: 'Section 2.1: | the Purdue model, | levels L5 to L0, | coloured by IT, | DMZ | and OT.', do: async (s) => readme(s, '21-the-purdue-reference-model') }),
      beat({ say: 'Section 2.2: | IEC 62443 zones and conduits, | and the flows allowed between them.', do: async (s) => readme(s, '22-zones-and-conduits-iec-62443') }),
      beat({ say: 'Section 2.3: | the building blocks of a design: | sites, devices, connections, zones, networks and revisions.', do: async (s) => readme(s, '23-the-building-blocks-of-a-design') }),
      beat({ say: 'Section 3 maps the screen, | area by area.', do: async (s) => readme(s, '3-a-tour-of-the-screen') }),
      beat({
        say: 'Section 4 is the feature guide, | with a screenshot of each area.',
        do: async (s) => {
          await readme(s, '4-feature-guide', { diagram: false });
          await s.scroll(1800, 3.5);
        },
      }),
    ]),

    web('README: workflows and architecture', `${BLOB}/README.md`, [
      beat({ say: 'Section 5 walks through typical jobs, | such as documenting an existing site…', do: async (s) => readme(s, '51-documenting-an-existing-site') }),
      beat({ say: '…or planning a change and sending it for review.', do: async (s) => readme(s, '52-planning-and-recording-a-change') }),
      beat({
        say: 'Section 6: how the app is built. | A static site that runs entirely in the browser, | with no server and no account.',
        do: async (s) => readme(s, '61-runtime-picture'),
      }),
      beat({ say: 'Three layers, with dependencies pointing one way: | the UI, | the state stores, | and a pure model.', do: async (s) => readme(s, '62-layers') }),
      beat({
        say: 'The principles behind the code: | the schema is the source of truth, | edits are pure functions, | and views are derived, never stored.',
        do: async (s) => {
          await readme(s, '63-principles-that-shape-the-code', { diagram: false });
          await s.focus(await visible(anchor(s, '63-principles-that-shape-the-code').locator('xpath=following::table[1]')), 1.4);
        },
      }),
      beat({
        say: 'Section 7 maps the source code, | folder by folder | and file by file.',
        do: async (s) => {
          await readme(s, '7-source-code-map');
          await s.wait(1.5);
          await s.scroll(1400, 3);
        },
      }),
    ]),

    web('README: how it works inside', `${BLOB}/README.md`, [
      beat({ say: 'Section 8: the data model. | One JSON document, | checked against a zod schema when it opens.', do: async (s) => readme(s, '8-data-model-and-file-format') }),
      beat({
        say: 'Section 9: how an edit flows through the app, | from a click, | to the model, | the undo history | and autosave.',
        do: async (s) => readme(s, '9-how-an-edit-flows-through-the-app'),
      }),
      beat({ say: 'Section 10: how the canvas is drawn from the project.', do: async (s) => readme(s, '10-drawing-the-canvas') }),
      beat({
        say: 'Section 11: every file is migrated and validated before it opens. | On any error, the current design is kept.',
        do: async (s) => readme(s, '11-opening-files-migration-and-validation'),
      }),
      beat({ say: 'Sections 12 and 13: | autosave, | and how revisions are compared.', do: async (s) => readme(s, '13-revisions-and-the-change-diff') }),
      beat({ say: 'Section 14: the IP checks behind every address warning.', do: async (s) => readme(s, '14-ip-and-vlan-planning') }),
      beat({
        say: 'Section 15: share links. | The design travels in the link itself, | and never reaches the server.',
        do: async (s) => readme(s, '15-share-links'),
      }),
      beat({ say: 'Sections 16 and 17: | CSV import, | and the tidy layout.', do: async (s) => readme(s, '17-tidy-layout') }),
      beat({ say: 'Section 18: the catalogs: | 85 device kinds, | 12 protocols | and 5 templates.', do: async (s) => readme(s, '181-devices') }),
    ]),

    web('README: quality and testing', `${BLOB}/README.md`, [
      beat({ say: 'Section 19: themes and accessibility, | including a keyboard-only way to connect devices.', do: async (s) => readme(s, '19-themes-and-accessibility') }),
      beat({ say: 'Section 20: privacy. | Designs stay in the browser, | unless you choose to share them.', do: async (s) => readme(s, '20-privacy-and-security') }),
      beat({
        say: 'Section 22: the development guide, | and continuous integration: | two jobs on every push and pull request.',
        do: async (s) => readme(s, '222-continuous-integration'),
      }),
      beat({
        say: 'Section 23: testing. | 252 unit tests, | 84 browser tests, | and accessibility scans in every theme.',
        do: async (s) => readme(s, '23-testing'),
      }),
      beat({ say: 'And section 24: the project history, | up to version 0.4.', do: async (s) => readme(s, '24-project-history') }),
    ]),

    web('The code', `${REPO}/tree/main/src`, [
      beat({
        say: 'Inside src: | the model, | the stores, | the user interface, | the exports, | offline support | and the templates.',
        do: async (s) => s.focus(await s.box(s.page.locator('table[aria-labelledby="folders-and-files"]')), 1.4),
      }),
      beat({
        say: 'src/model is pure TypeScript with no React, | so every rule is unit-tested directly.',
        camera: 'wide',
        do: async (s) => s.goto(`${REPO}/tree/main/src/model`),
      }),
      beat({
        say: 'schema.ts defines the file format. | The TypeScript types are inferred from it, | so types and validation never drift apart.',
        camera: 'wide',
        do: async (s) => {
          await s.goto(`${BLOB}/src/model/schema.ts`);
          await s.moveTo({ x: 1100, y: 650 });
          await s.scroll(900, 3);
        },
      }),
      beat({
        say: 'checks.ts holds the IEC 62443 checks, | each one citing the requirement it tests…',
        camera: 'wide',
        do: async (s) => {
          await s.goto(`${BLOB}/src/model/checks.ts`);
          await s.moveTo({ x: 1100, y: 650 });
          await s.scroll(1400, 3);
        },
      }),
      beat({
        say: '…and attack/paths.ts finds the attack paths, | through the links and the firewall rules.',
        camera: 'wide',
        do: async (s) => {
          await s.goto(`${BLOB}/src/model/attack/paths.ts`);
          await s.moveTo({ x: 1100, y: 650 });
          await s.scroll(900, 3);
        },
      }),
      beat({
        say: 'src/ui holds the React components: | the canvas, | the properties panel, | the security panel | and the dialogs.',
        camera: 'wide',
        do: async (s) => s.goto(`${REPO}/tree/main/src/ui`),
      }),
      beat({ say: 'e2e holds the Playwright browser tests…', camera: 'wide', do: async (s) => s.goto(`${REPO}/tree/main/e2e`) }),
      beat({
        say: '…and the CI workflow runs them, | with the type check, | lint, | unit tests | and the bundle budget, | on every pull request.',
        camera: 'wide',
        do: async (s) => s.goto(`${BLOB}/.github/workflows/ci.yml`),
      }),
    ]),

    web('How it is built', `${REPO}/actions?query=branch%3Amain`, [
      beat({ say: 'Every change is built and tested in GitHub Actions.', camera: 'wide', do: async (s) => s.moveTo({ x: 900, y: 500 }) }),
      beat({
        say: 'Work lands through pull requests, | each one tested before it is merged.',
        camera: 'wide',
        do: async (s) => s.goto(`${REPO}/pulls?q=is%3Apr+is%3Aclosed`),
      }),
      beat({
        say: 'Every decision is written down, | with the reason and the request behind it.',
        camera: 'wide',
        do: async (s) => {
          await s.goto(`${BLOB}/decisions.md`);
          await s.moveTo({ x: 1100, y: 650 });
          await s.scroll(1200, 3);
        },
      }),
      beat({
        say: 'And PROJECT_STATUS tracks the milestones, | the known issues, | and what comes next.',
        camera: 'wide',
        do: async (s) => {
          await s.goto(`${BLOB}/PROJECT_STATUS.md`);
          await s.moveTo({ x: 1100, y: 650 });
          await s.scroll(1000, 3);
        },
      }),
    ]),

    scene('Thanks for watching', 'cta', [beat({ say: "That's ReSecArc. | Try it in your browser, | and explore the code on GitHub. || Thanks for watching!", hold: 1.5 })], {
      props: { line: 'Secure OT architecture, designed right from the start.' },
    }),
  ],
});

// The dubbed copy's narration (cuts/deepdive.voice.ts): written to be spoken, while the subtitles above are written to be read.
deepdive.chapters.forEach((c, ci) =>
  c.beats.forEach((b, bi) => {
    const line = SPOKEN[beatId(ci, bi)];
    if (b.say && !line) throw new Error(`No spoken line for ${beatId(ci, bi)}`);
    b.speak = line;
  }),
);
if (Object.keys(SPOKEN).length !== deepdive.chapters.reduce((n, c) => n + c.beats.filter((b) => b.say).length, 0)) throw new Error('cuts/deepdive.voice.ts has lines for beats that do not exist');

export default deepdive;
