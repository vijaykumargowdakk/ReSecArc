// draw.io (diagrams.net) export: one page per site, with the Purdue lanes on a locked layer and
// areas, links, flows, devices and notes on layers of their own. Devices keep their icon and carry
// their asset details as shape data; stubs for devices on other sites link to that site's page.
import { kindLabel } from '../model/catalog';
import { flowLabel, getProtocol } from '../model/protocols';
import { LANE_HEIGHT, LANE_WIDTH, laneTop, levelLabel, NODE_HEIGHT, NODE_WIDTH, PURDUE_LANES } from '../model/purdue';
import type { Project } from '../model/schema';
import { mergeEdges, stacksOf } from '../model/stacks';
import { iconSvg } from './markup';
import { DIAGRAM_COLORS as C, noteHeight, siteStubs } from './siteSvg';

/** Escapes an attribute value; line breaks are kept as character references so XML does not fold them. */
const attr = (s: string | number) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;').replace(/\r/g, '');

/**
 * draw.io style strings separate entries with `;` and split each at its first `=`, so a value may
 * hold `=` (base64 padding does) but never `;`.
 */
const styleValue = (s: string) => s.replace(/;/g, ' ');
const style = (o: Record<string, string | number>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? styleValue(v) : v}`)
    .join(';') + ';';

/** `color` mixed with white, as the canvas tints notes and areas. */
function tint(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16);
  const mix = (c: number) => Math.round(255 + (c - 255) * amount);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
}

/** The icon as a data URI in draw.io's form: `data:image/svg+xml,` and base64 with no `;base64`. */
const iconUri = (type: Parameters<typeof iconSvg>[0], variant: string) =>
  `data:image/svg+xml,${btoa(iconSvg(type, variant, C.icon, 34))}`;

const geometry = (x: number, y: number, width: number, height: number) =>
  `<mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(width)}" height="${Math.round(height)}" as="geometry"/>`;

export const pageId = (index: number) => `page-${index + 1}`;

export function projectToDrawio(project: Project): string {
  const zone = new Map(project.zones.map((z) => [z.id, z]));
  const pages = project.sites.map((site, index) => {
    const cells: string[] = [];
    const layer = (id: string, name: string, locked = false) =>
      cells.push(`<mxCell id="${id}" value="${attr(name)}" style="${locked ? 'locked=1;' : ''}" parent="0"/>`);
    const devices = project.devices.filter((d) => d.siteId === site.id);
    const onSite = new Set(devices.map((d) => d.id));
    const stubs = siteStubs(project, site.id);
    const areas = project.areas.filter((a) => a.siteId === site.id);
    const notes = project.notes.filter((n) => n.siteId === site.id);
    const links = project.links.filter((l) => onSite.has(l.source) || onSite.has(l.target));
    const flows = project.flows.filter((f) => onSite.has(f.source) || onSite.has(f.target));
    // A stack is one device cell, at its first member; its members' links and flows merge onto it.
    const { stackOf } = stacksOf(project, site.id);
    const lead = (deviceId: string) => stackOf.get(deviceId)?.members[0].id ?? deviceId;
    // Project ids are prefixed by kind so none can clash with a layer, a lane or each other.
    const cellOf = (deviceId: string) => (onSite.has(deviceId) ? `x-${deviceId}` : `s-${deviceId}`);

    const xs = [0, LANE_WIDTH, ...devices.map((d) => d.position.x), ...devices.map((d) => d.position.x + NODE_WIDTH)];
    for (const s of stubs.values()) xs.push(s.x + 180);
    for (const a of areas) xs.push(a.rect.x, a.rect.x + a.rect.width);
    for (const n of notes) xs.push(n.position.x, n.position.x + n.width);
    const left = Math.min(...xs) - 40;
    const width = Math.max(...xs) + 40 - left;

    cells.push('<mxCell id="0"/>');
    layer('lanes', 'Purdue levels', true);
    PURDUE_LANES.forEach((lane, i) => {
      const fill = lane.level === 3.5 ? C.dmz : i % 2 ? C.laneB : C.laneA;
      cells.push(
        `<mxCell id="lane-${i}" value="${attr(`${levelLabel(lane.level)}\n${lane.name}`)}" style="${style({
          rounded: 0,
          whiteSpace: 'wrap',
          html: 0,
          fillColor: fill,
          strokeColor: C.line,
          dashed: 1,
          align: 'left',
          verticalAlign: 'middle',
          spacingLeft: 16,
          fontColor: C.faint,
          fontSize: 12,
        })}" vertex="1" parent="lanes">${geometry(left, laneTop(lane.level), width, LANE_HEIGHT)}</mxCell>`,
      );
    });

    layer('areas', 'Areas');
    for (const a of areas) {
      cells.push(
        `<mxCell id="${attr(`x-${a.id}`)}" value="${attr(a.name)}" style="${style({
          rounded: 1,
          arcSize: 6,
          absoluteArcSize: 1,
          whiteSpace: 'wrap',
          html: 0,
          dashed: 1,
          dashPattern: '6 4',
          strokeWidth: 2,
          strokeColor: a.color,
          fillColor: tint(a.color, 0.06),
          align: 'left',
          verticalAlign: 'top',
          spacingLeft: 10,
          spacingTop: 4,
          fontStyle: 1,
          fontColor: a.color,
        })}" vertex="1" parent="areas">${geometry(a.rect.x, a.rect.y, a.rect.width, a.rect.height)}</mxCell>`,
      );
    }

    layer('links', 'Network links');
    for (const { edge: l, source, target, count } of mergeEdges(links, lead)) {
      const pattern = l.medium === 'serial' ? '2 4' : l.medium === 'wireless' ? '8 5' : null;
      const dash: Record<string, string | number> = pattern ? { dashed: 1, dashPattern: pattern } : {};
      // A merged link is drawn straight, with a count instead of port names.
      const points = count > 1 ? '' : l.waypoints.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
      const counted: Record<string, string | number> = count > 1 ? { fontSize: 10, fontStyle: 1, fontColor: C.ink, labelBackgroundColor: '#ffffff', labelBorderColor: C.line } : {};
      cells.push(
        `<mxCell id="${attr(`x-${l.id}`)}" value="${count > 1 ? `×${count}` : ''}" style="${style({ endArrow: 'none', html: 0, rounded: 0, strokeColor: C.link, strokeWidth: 2, ...dash, ...counted })}" edge="1" parent="links" ` +
          `source="${attr(cellOf(source))}" target="${attr(cellOf(target))}"><mxGeometry relative="1" as="geometry">${points ? `<Array as="points">${points}</Array>` : ''}</mxGeometry></mxCell>`,
      );
      if (count > 1) continue;
      // Port names sit near their own end of the link.
      for (const [port, at, suffix] of [
        [l.sourcePort, -0.75, 'src'],
        [l.targetPort, 0.75, 'dst'],
      ] as const) {
        if (!port) continue;
        cells.push(
          `<mxCell id="${attr(`p-${l.id}-${suffix}`)}" value="${attr(port)}" style="${style({
            edgeLabel: 1,
            html: 0,
            resizable: 0,
            fontSize: 9,
            fontFamily: 'Courier New',
            labelBackgroundColor: '#ffffff',
            labelBorderColor: C.line,
          })}" vertex="1" connectable="0" parent="${attr(`x-${l.id}`)}"><mxGeometry x="${at}" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>`,
        );
      }
    }

    layer('flows', 'Protocol flows');
    for (const { edge: f, source, target, count } of mergeEdges(flows, lead)) {
      const def = getProtocol(f.protocol);
      const color = def?.color ?? C.faint;
      const points = count > 1 ? '' : f.waypoints.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
      cells.push(
        `<mxCell id="${attr(`x-${f.id}`)}" value="${attr(`${flowLabel(f.protocol, f.settings)}${count > 1 ? ` ×${count}` : ''}`)}" style="${style({
          endArrow: 'block',
          endFill: 1,
          html: 0,
          rounded: 0,
          strokeColor: color,
          strokeWidth: 2,
          dashed: 1,
          dashPattern: def?.dash ?? '6 4',
          fontSize: 10,
          fontStyle: 1,
          fontColor: C.ink,
          labelBackgroundColor: '#ffffff',
          labelBorderColor: color,
        })}" edge="1" parent="flows" source="${attr(cellOf(source))}" target="${attr(cellOf(target))}"><mxGeometry relative="1" as="geometry">${
          points ? `<Array as="points">${points}</Array>` : ''
        }</mxGeometry></mxCell>`,
      );
    }

    layer('devices', 'Devices');
    for (const d of devices) {
      const stack = stackOf.get(d.id);
      if (stack && stack.members[0] !== d) continue;
      const z = d.zoneId ? zone.get(d.zoneId) : undefined;
      const kind = kindLabel(d.type, d.variant);
      // A stack's shape data lists its members; asset details differ per member, so they are left out.
      const data = stack
        ? { kind, level: levelLabel(d.purdueLevel), zone: z?.name ?? '', members: stack.members.map((m) => m.label).join(', '), count: stack.members.length }
        : {
            kind,
            level: levelLabel(d.purdueLevel),
            zone: z?.name ?? '',
            criticality: d.criticality,
            ip: d.asset.ip,
            vendor: d.asset.vendor,
            model: d.asset.model,
            firmware: d.asset.firmware,
            serial: d.asset.serial,
            tags: d.tags.join(', '),
          };
      const label = stack
        ? `${kind} ×${stack.members.length}\n${stack.members.length} devices · ${levelLabel(d.purdueLevel)}${z ? ` · ${z.name}` : ''}`
        : `${d.label || kind}\n${kind} · ${levelLabel(d.purdueLevel)}${z ? ` · ${z.name}` : ''}`;
      // Two cards peek out behind a stack, as on the canvas.
      for (const offset of stack ? [10, 5] : []) {
        cells.push(
          `<mxCell id="${attr(`b-${d.id}-${offset}`)}" value="" style="${style({ rounded: 1, arcSize: 8, absoluteArcSize: 1, html: 0, fillColor: '#ffffff', strokeColor: z?.color ?? C.line, strokeWidth: 1 })}" ` +
            `vertex="1" connectable="0" parent="devices">${geometry(d.position.x + offset, d.position.y + offset, NODE_WIDTH, NODE_HEIGHT)}</mxCell>`,
        );
      }
      cells.push(
        `<UserObject id="${attr(`x-${d.id}`)}" label="${attr(label)}"${Object.entries(data)
          .map(([k, v]) => ` ${k}="${attr(v)}"`)
          .join('')}><mxCell style="${style({
          shape: 'label',
          rounded: 1,
          arcSize: 8,
          absoluteArcSize: 1,
          whiteSpace: 'wrap',
          html: 0,
          fillColor: '#ffffff',
          strokeColor: z?.color ?? C.line,
          strokeWidth: 2,
          align: 'left',
          verticalAlign: 'middle',
          spacingLeft: 50,
          fontColor: C.ink,
          fontSize: 11,
          image: iconUri(d.type, d.variant),
          imageWidth: 34,
          imageHeight: 34,
          imageAlign: 'left',
          imageVerticalAlign: 'middle',
        })}" vertex="1" parent="devices">${geometry(d.position.x, d.position.y, NODE_WIDTH, NODE_HEIGHT)}</mxCell></UserObject>`,
      );
    }
    for (const s of stubs.values()) {
      const target = project.sites.findIndex((t) => t.id === s.device.siteId);
      cells.push(
        `<UserObject id="${attr(`s-${s.device.id}`)}" label="${attr(`${s.device.label}\n↗ site ${s.siteName}`)}" link="data:page/id,${pageId(target)}" ` +
          `tooltip="${attr(`On site ${s.siteName}. Click to go to that page.`)}"><mxCell style="${style({
            rounded: 1,
            arcSize: 50,
            whiteSpace: 'wrap',
            html: 0,
            dashed: 1,
            fillColor: C.laneA,
            strokeColor: C.line,
            fontColor: C.ink,
            fontSize: 11,
          })}" vertex="1" parent="devices">${geometry(s.x, s.y, 180, 40)}</mxCell></UserObject>`,
      );
    }

    layer('notes', 'Notes');
    for (const n of notes) {
      cells.push(
        `<mxCell id="${attr(`x-${n.id}`)}" value="${attr(n.text)}" style="${style({
          shape: 'note',
          size: 12,
          whiteSpace: 'wrap',
          html: 0,
          align: 'left',
          verticalAlign: 'top',
          spacing: 8,
          fillColor: tint(n.color, 0.12),
          strokeColor: n.color,
          fontColor: C.ink,
          fontSize: 12,
        })}" vertex="1" parent="notes">${geometry(n.position.x, n.position.y, n.width, noteHeight(n))}</mxCell>`,
      );
    }

    return (
      `<diagram id="${pageId(index)}" name="${attr(site.name)}"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">` +
      `<root>${cells.join('')}</root></mxGraphModel></diagram>`
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="ReSecArc">${pages.join('')}</mxfile>\n`;
}
