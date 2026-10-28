// Turns the project into what the canvas shows for one site: visible devices, area frames,
// collapsed areas standing in for their members, and stubs for devices on other sites.
import { MarkerType } from '@xyflow/react';
import { kindLabel } from '../../model/catalog';
import type { Finding, Severity } from '../../model/checks';
import { levelLabel, NODE_WIDTH } from '../../model/purdue';
import { getProtocol } from '../../model/protocols';
import type { Area, Device, Flow, Link, Note, Project, Zone } from '../../model/schema';
import { ALL_LAYERS, type Layers } from '../../store/prefs';
import type { Selection } from '../../store/useProject';
import type { CanvasEdge } from './edges';
import type { CanvasNode } from './nodes';

export const COLLAPSED_AREA = { width: 210, height: 72 };
const PORTAL_GAP = 80;
const PORTAL_ROW = 48;

export type DiffMark = 'added' | 'changed';
/** How many security findings concern an item, and the worst severity among them. */
export type SecurityMark = { count: number; severity: Severity };
export type DeviceNodeData = { device: Device; zone: Zone | null; dimmed: boolean; diff?: DiffMark; security?: SecurityMark };
export type AreaNodeData = { area: Area; members: Device[] };
export type PortalNodeData = { device: Device; siteName: string };
export type NoteNodeData = { note: Note };
export type LinkEdgeData = { link: Link; dimmed: boolean; aggregated: boolean; diff?: DiffMark; showPorts: boolean; violation: boolean };
export type FlowEdgeData = { flow: Flow; dimmed: boolean; aggregated: boolean; diff?: DiffMark; showLabel: boolean; violation: boolean };

export const portalId = (deviceId: string) => `portal:${deviceId}`;

export function buildView(
  project: Project,
  siteId: string,
  selection: Selection,
  dimmed: Set<string>,
  /** Items added or changed since the revision being compared with. */
  marks: ReadonlyMap<string, DiffMark> = new Map(),
  /** Which kinds of item are shown; hidden ones are left out entirely. */
  layers: Layers = ALL_LAYERS,
  /** A connection being made from the keyboard; its source and target devices are highlighted. */
  connect: { sourceId: string; targetId: string | null } | null = null,
  /** Security findings per device, link and flow id; empty when the security layer is off. */
  findings: ReadonlyMap<string, Finding[]> = new Map(),
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ') || undefined;
  const diffClass = (id: string) => (marks.has(id) ? `diff-${marks.get(id)}` : undefined);
  const securityOf = (id: string): SecurityMark | undefined => {
    const list = findings.get(id);
    if (!list?.length) return undefined;
    const severity = list.some((f) => f.severity === 'high') ? 'high' : list.some((f) => f.severity === 'medium') ? 'medium' : 'low';
    return { count: list.length, severity };
  };
  /** Links and flows in a high-severity finding are drawn red. */
  const violation = (id: string) => findings.get(id)?.some((f) => f.severity === 'high') === true;
  const onSite = new Set(project.devices.filter((d) => d.siteId === siteId).map((d) => d.id));
  const areas = project.areas.filter((a) => a.siteId === siteId);
  const collapsed = new Set(areas.filter((a) => a.collapsed).map((a) => a.id));
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const siteName = new Map(project.sites.map((s) => [s.id, s.name]));
  const deviceById = new Map(project.devices.map((d) => [d.id, d]));
  const sel = {
    devices: new Set(selection.devices),
    areas: new Set(selection.areas),
    notes: new Set(selection.notes),
    edges: new Set([...selection.links, ...selection.flows]),
  };

  /** The node an edge endpoint attaches to on this site, or null for a device elsewhere. */
  const anchor = (deviceId: string): string | null => {
    if (!onSite.has(deviceId)) return null;
    const areaId = deviceById.get(deviceId)?.areaId;
    return areaId && collapsed.has(areaId) ? areaId : deviceId;
  };

  const nodes: CanvasNode[] = [];
  const anchorPos = new Map<string, { x: number; y: number }>();

  for (const area of areas) {
    // A collapsed area stands in for its devices, so it stays even when area frames are hidden.
    if (!layers.areas && !area.collapsed) continue;
    const members = project.devices.filter((d) => d.areaId === area.id);
    const size = area.collapsed ? COLLAPSED_AREA : { width: area.rect.width, height: area.rect.height };
    nodes.push({
      id: area.id,
      type: 'area',
      position: { x: area.rect.x, y: area.rect.y },
      data: { area, members },
      selected: sel.areas.has(area.id),
      draggable: !area.locked,
      className: classes(diffClass(area.id), area.locked && 'is-locked'),
      zIndex: area.collapsed ? 0 : -1,
      ...size,
    });
    anchorPos.set(area.id, { x: area.rect.x, y: area.rect.y });
  }

  for (const d of project.devices) {
    if (!onSite.has(d.id) || anchor(d.id) !== d.id) continue;
    const security = securityOf(d.id);
    nodes.push({
      id: d.id,
      type: 'device',
      position: d.position,
      data: { device: d, zone: d.zoneId ? (zoneById.get(d.zoneId) ?? null) : null, dimmed: dimmed.has(d.id), diff: marks.get(d.id), security },
      selected: sel.devices.has(d.id),
      draggable: !d.locked,
      className: classes(
        dimmed.has(d.id) && 'is-dimmed',
        diffClass(d.id),
        d.locked && 'is-locked',
        connect?.sourceId === d.id && 'is-connect-source',
        connect?.targetId === d.id && 'is-connect-target',
      ),
      ariaLabel: [
        `${d.label}, ${kindLabel(d.type, d.variant)}`,
        `level ${levelLabel(d.purdueLevel).slice(1)}`,
        d.zoneId ? `zone ${zoneById.get(d.zoneId)?.name ?? ''}` : 'no zone',
        `${d.criticality} criticality`,
        ...(d.locked ? ['locked'] : []),
        ...(marks.has(d.id) ? [`${marks.get(d.id)} since the compared revision`] : []),
        ...(security ? [`${security.count} security finding${security.count === 1 ? '' : 's'}`] : []),
      ].join(', '),
    });
    anchorPos.set(d.id, d.position);
  }

  for (const note of project.notes) {
    if (note.siteId !== siteId || !layers.notes) continue;
    nodes.push({
      id: note.id,
      type: 'note',
      position: note.position,
      data: { note },
      selected: sel.notes.has(note.id),
      draggable: !note.locked,
      className: classes(diffClass(note.id), note.locked && 'is-locked'),
      width: note.width,
      connectable: false,
      ariaLabel: `Note: ${note.text}`,
    });
  }

  // Stubs for devices on other sites go in a column right of everything on this site, level with
  // the local end of their connection, so they never sit on top of a device or an area.
  const rightEdge = Math.max(0, ...nodes.map((n) => n.position.x + (n.width ?? NODE_WIDTH)));
  const portalX = rightEdge + PORTAL_GAP;
  const portals = new Map<string, CanvasNode>();
  const portalFor = (remoteId: string, localAnchor: string): string => {
    const id = portalId(remoteId);
    if (!portals.has(id)) {
      const device = deviceById.get(remoteId)!;
      const near = anchorPos.get(localAnchor) ?? { x: 0, y: 0 };
      // Each existing stub can push the new one down at most twice, so this always ends.
      let y = near.y;
      for (let step = 0; step <= 2 * portals.size && [...portals.values()].some((p) => Math.abs(p.position.y - y) < PORTAL_ROW); step++) {
        y += PORTAL_ROW;
      }
      portals.set(id, {
        id,
        type: 'portal',
        position: { x: portalX, y },
        data: { device, siteName: siteName.get(device.siteId) ?? '' },
        selectable: false,
        ariaLabel: `${device.label} on site ${siteName.get(device.siteId) ?? ''}. Activate to go there.`,
      });
    }
    return id;
  };

  const edges: CanvasEdge[] = [];
  const seenAggregate = new Set<string>();
  /** Resolves an edge's ends on this site; null when it should not be drawn. */
  const ends = (e: Link | Flow, dedupeKey: (s: string, t: string) => string) => {
    const a = anchor(e.source);
    const b = anchor(e.target);
    if (a === null && b === null) return null;
    const source = a ?? portalFor(e.source, b!);
    const target = b ?? portalFor(e.target, a!);
    if (source === target) return null;
    // Collapsed areas stand in for their members; several member edges may merge into one.
    const aggregated = (a !== null && a !== e.source) || (b !== null && b !== e.target);
    if (aggregated) {
      const key = dedupeKey(source, target);
      if (seenAggregate.has(key)) return null;
      seenAggregate.add(key);
    }
    return { source, target, aggregated, id: aggregated ? `agg:${e.id}` : e.id };
  };

  for (const link of layers.links ? project.links : []) {
    const r = ends(link, (s, t) => `link|${[s, t].sort().join('|')}`);
    if (!r) continue;
    edges.push({
      id: r.id,
      type: 'link',
      source: r.source,
      target: r.target,
      data: {
        link,
        dimmed: dimmed.has(link.id),
        aggregated: r.aggregated,
        diff: r.aggregated ? undefined : marks.get(link.id),
        showPorts: layers.ports,
        violation: !r.aggregated && violation(link.id),
      },
      selected: !r.aggregated && sel.edges.has(link.id),
      selectable: !r.aggregated,
    });
  }
  for (const flow of layers.flows ? project.flows : []) {
    const r = ends(flow, (s, t) => `flow|${flow.protocol}|${s}|${t}`);
    if (!r) continue;
    edges.push({
      id: r.id,
      type: 'flow',
      source: r.source,
      target: r.target,
      data: {
        flow,
        dimmed: dimmed.has(flow.id),
        aggregated: r.aggregated,
        diff: r.aggregated ? undefined : marks.get(flow.id),
        showLabel: layers.flowLabels,
        violation: !r.aggregated && violation(flow.id),
      },
      selected: !r.aggregated && sel.edges.has(flow.id),
      selectable: !r.aggregated,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: getProtocol(flow.protocol)?.color },
    });
  }

  return { nodes: [...nodes, ...portals.values()], edges };
}
