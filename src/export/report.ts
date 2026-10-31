// The full report: one self-contained HTML file with every site's diagram and tables, zones and
// conduits, the IP plan, security findings and attack paths. It prints to PDF from any browser and
// carries a content security policy, so even a crafted project cannot make it run a script.
import { ATTACK_ICS_RELEASE, ICS_TACTICS, ICS_TECHNIQUES, type IcsTacticName, type IcsTechniqueId } from '../model/attack/icsTechniques';
import { findAttackPaths, pathFindings } from '../model/attack/paths';
import { kindLabel } from '../model/catalog';
import { checkById, findingsByItem, runChecks, type Finding } from '../model/checks';
import { deriveConduits } from '../model/conduits';
import { endpointName } from '../model/csv';
import { displayValue } from '../model/fields';
import { addressReport, linkIssues, networkSummaries } from '../model/ipam';
import { describePolicy } from '../model/policies';
import { flowLabel, getProtocol } from '../model/protocols';
import { levelLabel } from '../model/purdue';
import type { Device, Project } from '../model/schema';
import { stacksOf } from '../model/stacks';
import { escapeXml as h } from './markup';
import { DIAGRAM_COLORS, renderSiteSvg } from './siteSvg';

/** Names the stacks drawn in a site's diagram; every member is still listed in the tables. */
function stackCaption(project: Project, siteId: string): string {
  const { stacks } = stacksOf(project, siteId);
  if (stacks.length === 0) return '';
  const list = stacks.map((s) => {
    const names = s.members.map((m) => m.label);
    const span = names.length > 2 ? `${names[0]} … ${names[names.length - 1]}` : names.join(', ');
    return `${levelLabel(s.level)}: ${s.members.length} × ${kindLabel(s.members[0].type, s.members[0].variant)} (${span})`;
  });
  return ` A card marked ×N is a stack of similar devices, all listed in the tables below: ${h(list.join('; '))}.`;
}

type Cell = string | number | { html: string };
const cell = (c: Cell) => (typeof c === 'object' ? c.html : h(String(c)) || '—');

function table(head: string[], rows: Cell[][], caption?: string): string {
  if (rows.length === 0) return `<p class="none">${caption ? `${h(caption)}: none.` : 'None.'}</p>`;
  return (
    `<table>${caption ? `<caption>${h(caption)}</caption>` : ''}<thead><tr>${head.map((c) => `<th scope="col">${h(c)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  );
}

const severity = (s: Finding['severity']) => ({ html: `<span class="sev sev--${s}">${s}</span>` });
const link = (url: string, text: string) => ({ html: `<a href="${h(url)}">${h(text)}</a>` });

const STYLE = `
:root { color-scheme: light; --ink: ${DIAGRAM_COLORS.ink}; --faint: ${DIAGRAM_COLORS.faint}; --line: #dde3e9; --accent: #0f766e; }
* { box-sizing: border-box; }
body { margin: 0 auto; max-width: 1180px; padding: 32px 24px 64px; background: #ffffff; color: var(--ink);
  font: 14px/1.5 Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
h1 { font-size: 28px; margin: 0 0 4px; }
h2 { font-size: 21px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--line); }
h3 { font-size: 16px; margin: 24px 0 8px; }
p { margin: 6px 0 10px; }
a { color: var(--accent); }
.meta, .none, caption, .note-text { color: var(--faint); }
caption { text-align: left; font-size: 13px; padding: 0 0 4px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 20px 0; padding: 0; list-style: none; }
.stats li { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.stats b { display: block; font-size: 22px; }
nav ol { columns: 2; margin: 0; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 12.5px; }
th, td { text-align: left; vertical-align: top; padding: 5px 8px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
th { background: #f4f6f8; font-weight: 600; }
figure { margin: 10px 0 18px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
figure svg { display: block; width: 100%; height: auto; }
figcaption { padding: 6px 10px; font-size: 12px; color: var(--faint); border-top: 1px solid var(--line); }
.sev { display: inline-block; padding: 0 7px; border-radius: 9px; color: #fff; font-size: 11px; font-weight: 600; }
.sev--high { background: ${DIAGRAM_COLORS.severity.high}; }
.sev--medium { background: ${DIAGRAM_COLORS.severity.medium}; }
.sev--low { background: ${DIAGRAM_COLORS.severity.low}; }
.path { border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; margin: 10px 0; break-inside: avoid; }
.path h3 { margin: 0 0 6px; }
.path ol { margin: 0; padding-left: 22px; }
.path li { margin: 2px 0; }
.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: baseline; }
code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 12px; }
footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--faint); font-size: 12px; }
@page { size: A4; margin: 14mm; }
@page wide { size: A4 landscape; margin: 10mm; }
@media print {
  body { max-width: none; padding: 0; font-size: 11px; }
  table { font-size: 9.5px; }
  h2 { break-after: avoid; }
  h3 { break-after: avoid; }
  .site { break-before: page; }
  figure, tr { break-inside: avoid; }
  /* Diagrams get a landscape page of their own, so names stay legible on paper. */
  figure { page: wide; border: none; }
  thead { display: table-header-group; }
  a { color: inherit; text-decoration: none; }
}`;

export function projectToHtmlReport(project: Project, generatedAt = new Date()): string {
  const date = generatedAt.toISOString().slice(0, 10);
  const zone = new Map(project.zones.map((z) => [z.id, z]));
  const zoneName = (id: string | null) => (id ? (zone.get(id)?.name ?? '') : '');
  const site = new Map(project.sites.map((s) => [s.id, s.name]));
  const area = new Map(project.areas.map((a) => [a.id, a.name]));
  const device = new Map(project.devices.map((d) => [d.id, d]));
  const label = (id: string) => device.get(id)?.label ?? id;
  const findings = runChecks(project);
  const byItem = findingsByItem(project, findings);
  const paths = findAttackPaths(project);
  const addresses = addressReport(project);
  const linkProblems = linkIssues(project, addresses);
  const count = (s: Finding['severity']) => findings.filter((f) => f.severity === s).length;

  const out: string[] = [];
  out.push(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${h(project.name)}: architecture report</title><style>${STYLE}</style></head><body>`,
    '<header>',
    `<h1>${h(project.name)}</h1>`,
    `<p class="meta">Architecture report generated by ReSecArc on ${date}.</p>`,
    '<ul class="stats">',
    ...(
      [
        ['Sites', project.sites.length],
        ['Devices', project.devices.length],
        ['Network links', project.links.length],
        ['Protocol flows', project.flows.length],
        ['Zones', project.zones.length],
        ['Networks', project.networks.length],
        ['Security findings', findings.length],
        ['Attack paths', paths.total],
      ] as const
    ).map(([name, n]) => `<li><b>${n}</b>${name}</li>`),
    '</ul>',
    `<p>Security findings by severity: ${(['high', 'medium', 'low'] as const).map((s) => `${count(s)} ${s}`).join(', ')}.</p>`,
    '</header>',
  );

  const sections: [string, string][] = [
    ...project.sites.map((s, i): [string, string] => [`site-${i + 1}`, `Site: ${s.name}`]),
    ['zones', 'Security zones and conduits'],
    ['networks', 'Networks and IP plan'],
    ['findings', 'Security findings'],
    ['paths', 'Attack paths (MITRE ATT&CK® for ICS)'],
    ...(project.revisions.length ? ([['revisions', 'Revisions']] as [string, string][]) : []),
  ];
  out.push(`<nav aria-label="Contents"><h2>Contents</h2><ol>${sections.map(([id, title]) => `<li><a href="#${id}">${h(title)}</a></li>`).join('')}</ol></nav>`);

  project.sites.forEach((s, i) => {
    const devices = project.devices
      .filter((d) => d.siteId === s.id)
      .sort((a, b) => b.purdueLevel - a.purdueLevel || a.label.localeCompare(b.label));
    const ids = new Set(devices.map((d) => d.id));
    const links = project.links.filter((l) => ids.has(l.source) || ids.has(l.target));
    const flows = project.flows.filter((f) => ids.has(f.source) || ids.has(f.target));
    const areas = project.areas.filter((a) => a.siteId === s.id);
    const notes = project.notes.filter((n) => n.siteId === s.id && n.text.trim());
    const end = (id: string, port: string) => `${label(id)}${device.get(id)?.siteId !== s.id ? ` (site ${site.get(device.get(id)?.siteId ?? '') ?? ''})` : ''}${port ? ` · ${port}` : ''}`;

    out.push(`<section class="site" id="site-${i + 1}" aria-labelledby="site-${i + 1}-h"><h2 id="site-${i + 1}-h">Site: ${h(s.name)}</h2>`);
    out.push(
      `<p>${devices.length} devices, ${links.length} network links and ${flows.length} protocol flows${areas.length ? `, in ${areas.length} area(s): ${h(areas.map((a) => a.name).join(', '))}` : ''}.</p>`,
    );
    out.push(
      `<figure>${renderSiteSvg(project, s.id, { idPrefix: `s${i + 1}`, findings: byItem })}<figcaption>` +
        'Each device’s left edge shows its zone colour; the letter is its criticality. Solid grey lines are network links (dotted: serial, dashed: wireless); ' +
        'coloured dashed arrows are protocol flows. Red lines carry a high-severity security finding, and a number on a device counts its findings. ' +
        'Rounded dashed boxes on the right stand for devices on other sites. Areas are drawn open.' +
        stackCaption(project, s.id) +
        '</figcaption></figure>',
    );

    out.push('<h3>Devices</h3>');
    out.push(
      table(
        ['Name', 'Kind', 'Level', 'Zone', 'Area', 'IP', 'Vendor', 'Model', 'Firmware', 'Criticality', 'Tags'],
        devices.map((d) => [
          d.label,
          kindLabel(d.type, d.variant),
          levelLabel(d.purdueLevel),
          zoneName(d.zoneId),
          d.areaId ? (area.get(d.areaId) ?? '') : '',
          d.asset.ip,
          d.asset.vendor,
          d.asset.model,
          d.asset.firmware,
          d.criticality,
          d.tags.join(', '),
        ]),
      ),
    );
    if (project.fieldDefs.length && devices.length) {
      out.push('<h3>Custom fields</h3>');
      out.push(table(['Device', ...project.fieldDefs.map((f) => f.label)], devices.map((d) => [d.label, ...project.fieldDefs.map((f) => displayValue(f, d.fields[f.id]))])));
    }
    out.push('<h3>Network links</h3>');
    const network = new Map(project.networks.map((n) => [n.id, n]));
    out.push(
      table(
        ['From', 'To', 'Medium', 'VLANs', 'Network', 'Warnings'],
        links.map((l) => [
          end(l.source, l.sourcePort),
          end(l.target, l.targetPort),
          l.medium,
          l.vlans.join(', '),
          l.networkId ? (network.get(l.networkId)?.name ?? '') : '',
          (linkProblems.get(l.id) ?? []).join('; '),
        ]),
      ),
    );
    out.push('<h3>Protocol flows</h3>');
    out.push(
      table(
        ['From', 'To', 'Protocol', 'Port', 'Settings'],
        flows.map((f) => [end(f.source, ''), end(f.target, ''), getProtocol(f.protocol)?.label ?? f.protocol, f.port ?? 'n/a', flowLabel(f.protocol, f.settings)]),
      ),
    );
    for (const fw of devices.filter((d): d is Device & { firewall: NonNullable<Device['firewall']> } => !!d.firewall)) {
      out.push(`<h3>Firewall rules: ${h(fw.label)}</h3>`);
      out.push(
        table(
          ['#', 'Action', 'Source', 'Destination', 'Protocol', 'Port', 'Note'],
          fw.firewall.rules.map((r, n) => [n + 1, r.action, endpointName(project, r.src), endpointName(project, r.dst), r.protocol, r.port ?? 'any', r.note]),
        ),
      );
      out.push(`<p>Default action when no rule matches: <strong>${h(fw.firewall.defaultAction)}</strong>.</p>`);
    }
    if (notes.length) {
      out.push('<h3>Notes</h3><ul>', ...notes.map((n) => `<li class="note-text">${h(n.text.trim()).replace(/\n/g, '<br>')}</li>`), '</ul>');
    }
    out.push('</section>');
  });

  out.push('<section id="zones" aria-labelledby="zones-h"><h2 id="zones-h">Security zones and conduits</h2>');
  out.push(
    table(
      ['Zone', 'Trusted', 'Target SL', 'Devices'],
      project.zones.map((z) => [
        { html: `<span class="swatch" style="background:${h(z.color)}"></span>${h(z.name) || '—'}` },
        z.trusted ? 'yes' : 'no',
        `SL ${z.targetSL}`,
        project.devices.filter((d) => d.zoneId === z.id).length,
      ]),
    ),
  );
  out.push('<h3>Conduits</h3><p>Zone pairs joined directly by a network link or a protocol flow.</p>');
  out.push(table(['Between', 'Links', 'Flows'], deriveConduits(project).map((c) => [`${zoneName(c.zones[0])} ↔ ${zoneName(c.zones[1])}`, c.linkIds.length, c.flowIds.length])));
  out.push('</section>');

  out.push('<section id="networks" aria-labelledby="networks-h"><h2 id="networks-h">Networks and IP plan</h2>');
  out.push(
    table(
      ['Network', 'Subnet', 'VLAN', 'Zone', 'Site', 'Devices', 'Usable addresses', 'Problems'],
      networkSummaries(project, addresses).map((n) => [
        n.network.name,
        n.network.cidr,
        n.network.vlan ?? '',
        zoneName(n.network.zoneId),
        n.network.siteId ? (site.get(n.network.siteId) ?? '') : 'all sites',
        n.devices.length,
        n.cidr ? n.usable : '',
        [
          n.error ?? '',
          ...n.overlaps.map((o) => `overlaps ${o.name || o.cidr}`),
          ...n.vlanClashes.map((o) => `VLAN ${n.network.vlan} also used by ${o.name || o.cidr}`),
        ]
          .filter(Boolean)
          .join('; '),
      ]),
    ),
  );
  const issues = [...addresses.issues].flatMap(([id, list]) => list.map((i) => [label(id), site.get(device.get(id)?.siteId ?? '') ?? '', i.address, i.message]));
  out.push('<h3>Address warnings</h3>');
  out.push(table(['Device', 'Site', 'Address', 'Warning'], issues));
  out.push('</section>');

  out.push('<section id="findings" aria-labelledby="findings-h"><h2 id="findings-h">Security findings</h2>');
  out.push('<p>Design-time checks based on IEC 62443 zone and conduit principles, plus company policy rules. Not a compliance assessment.</p>');
  out.push(
    table(
      ['Severity', 'Finding', 'Detail', 'Reference', 'Suggested fix'],
      findings.map((f) => [severity(f.severity), f.headline, f.message, f.reference ?? '', f.fix]),
    ),
  );
  if (project.disabledChecks.length) {
    out.push(`<p>Checks switched off for this project: ${h(project.disabledChecks.map((id) => checkById(id)?.title ?? id).join(', '))}.</p>`);
  }
  if (project.policies.length) {
    out.push('<h3>Company policies</h3>');
    out.push(table(['Rule', 'Forbids', 'Severity', 'Enabled'], project.policies.map((r) => [r.name, describePolicy(r, project), severity(r.severity), r.enabled ? 'yes' : 'no'])));
  }
  out.push('</section>');

  const technique = (s: { tactic: IcsTacticName; technique: IcsTechniqueId }) => {
    const t = ICS_TECHNIQUES[s.technique];
    return `${h(ICS_TACTICS[s.tactic].name)} · ${link(t.url, s.technique).html} ${h(t.name)}`;
  };
  out.push('<section id="paths" aria-labelledby="paths-h"><h2 id="paths-h">Attack paths (MITRE ATT&amp;CK® for ICS)</h2>');
  out.push(
    `<p>Possible paths based on the design, from the default entry points to the default targets, honouring firewall rules. They are not predictions. ` +
      `Entry points and targets chosen in the Security panel are not saved in the project, so this report uses the defaults. ` +
      `Each step is labelled with a tactic and technique from MITRE ATT&amp;CK® for ICS (${h(ATTACK_ICS_RELEASE)}).` +
      `${paths.total > paths.paths.length ? ` The ${paths.paths.length} highest ranked of ${paths.total} paths are shown.` : ''}</p>`,
  );
  if (paths.paths.length === 0) out.push('<p class="none">No attack paths were found.</p>');
  paths.paths.forEach((p, i) => {
    const relies = pathFindings(project, p, findings);
    out.push(
      `<div class="path"><h3>${i + 1}. ${h(label(p.entryId))} → ${h(label(p.targetId))}</h3><ol>`,
      ...p.steps.map((s) => `<li><strong>${h(label(s.deviceId))}</strong>: ${technique(s)}</li>`),
      `<li><strong>Impact</strong>: ${technique(p.impact)}</li></ol>`,
      relies.length ? `<p>Relies on: ${h([...new Set(relies.map((f) => checkById(f.checkId)?.title ?? f.headline))].join('; '))}.</p>` : '',
      '</div>',
    );
  });
  out.push('</section>');

  if (project.revisions.length) {
    out.push('<section id="revisions" aria-labelledby="revisions-h"><h2 id="revisions-h">Revisions</h2>');
    out.push(table(['Revision', 'Saved'], project.revisions.map((r) => [r.name || 'Unnamed', r.createdAt.slice(0, 16).replace('T', ' ')])));
    out.push('</section>');
  }

  out.push(
    `<footer><p>Generated by ReSecArc on ${date} from the project “${h(project.name)}”. The diagrams and tables describe the design as drawn; ` +
      'the security findings and attack paths are design-time aids, not a compliance assessment. MITRE ATT&amp;CK® is a registered trademark of The MITRE Corporation.</p></footer>',
    '</body></html>',
  );
  return out.join('\n');
}
