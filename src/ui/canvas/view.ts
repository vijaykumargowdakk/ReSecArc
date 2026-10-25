// Turns the project into what the canvas shows for one site: visible devices, area frames,
// collapsed areas standing in for their members, and stubs for devices on other sites.
import { MarkerType } from '@xyflow/react';
import { kindLabel } from '../../model/catalog';
import { levelLabel, NODE_WIDTH } from '../../model/purdue';
import { getProtocol } from '../../model/protocols';
import type { Area, Device, Flow, Link, Project, Zone } from '../../model/schema';
import type { Selection } from '../../store/useProject';
import type { CanvasEdge } from './edges';
import type { CanvasNode } from './nodes';

export const COLLAPSED_AREA = { width: 210, height: 72 };
const PORTAL_GAP = 60;

export type DeviceNodeData = { device: Device; zone: Zone | null; dimmed: boolean };
export type AreaNodeData = { area: Area; members: Device[] };
export type PortalNodeData = { device: Device; siteName: string };
export type LinkEdgeData = { link: Link; dimmed: boolean; aggregated: boolean };
export type FlowEdgeData = { flow: Flow; dimmed: boolean; aggregated: boolean };

export const portalId = (deviceId: string) => `portal:${deviceId}`;

export function buildView(
  project: Project,
  siteId: string,
  selection: Selection,
  dimmed: Set<string>,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const onSite = new Set(project.devices.filter((d) => d.siteId === siteId).map((d) => d.id));
  const areas = project.areas.filter((a) => a.siteId === siteId);
  const collapsed = new Set(areas.filter((a) => a.collapsed).map((a) => a.id));
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const siteName = new Map(project.sites.map((s) => [s.id, s.name]));
  const deviceById = new Map(project.devices.map((d) => [d.id, d]));
  const sel = {
    devices: new Set(selection.devices),
    areas: new Set(selection.areas),
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
    const members = project.devices.filter((d) => d.areaId === area.id);
    const size = area.collapsed ? COLLAPSED_AREA : { width: area.rect.width, height: area.rect.height };
    nodes.push({
      id: area.id,
      type: 'area',
      position: { x: area.rect.x, y: area.rect.y },
      data: { area, members },
      selected: sel.areas.has(area.id),
      zIndex: area.collapsed ? 0 : -1,
      ...size,
    });
    anchorPos.set(area.id, { x: area.rect.x, y: area.rect.y });
  }

  for (const d of project.devices) {
    if (!onSite.has(d.id) || anchor(d.id) !== d.id) continue;
    nodes.push({
      id: d.id,
      type: 'device',
      position: d.position,
      data: { device: d, zone: d.zoneId ? (zoneById.get(d.zoneId) ?? null) : null, dimmed: dimmed.has(d.id) },
      selected: sel.devices.has(d.id),
      className: dimmed.has(d.id) ? 'is-dimmed' : undefined,
      ariaLabel: [
        `${d.label}, ${kindLabel(d.type, d.variant)}`,
        `level ${levelLabel(d.purdueLevel).slice(1)}`,
        d.zoneId ? `zone ${zoneById.get(d.zoneId)?.name ?? ''}` : 'no zone',
        `${d.criticality} criticality`,
      ].join(', '),
    });
    anchorPos.set(d.id, d.position);
  }

  const portals = new Map<string, CanvasNode>();
  const portalFor = (remoteId: string, localAnchor: string): string => {
    const id = portalId(remoteId);
    if (!portals.has(id)) {
      const device = deviceById.get(remoteId)!;
      const near = anchorPos.get(localAnchor) ?? { x: 0, y: 0 };
      const stacked = [...portals.values()].filter((p) => p.position.x === near.x + NODE_WIDTH + PORTAL_GAP).length;
      portals.set(id, {
        id,
        type: 'portal',
        position: { x: near.x + NODE_WIDTH + PORTAL_GAP, y: near.y + stacked * 48 },
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

  for (const link of project.links) {
    const r = ends(link, (s, t) => `link|${[s, t].sort().join('|')}`);
    if (!r) continue;
    edges.push({
      id: r.id,
      type: 'link',
      source: r.source,
      target: r.target,
      data: { link, dimmed: dimmed.has(link.id), aggregated: r.aggregated },
      selected: !r.aggregated && sel.edges.has(link.id),
      selectable: !r.aggregated,
    });
  }
  for (const flow of project.flows) {
    const r = ends(flow, (s, t) => `flow|${flow.protocol}|${s}|${t}`);
    if (!r) continue;
    edges.push({
      id: r.id,
      type: 'flow',
      source: r.source,
      target: r.target,
      data: { flow, dimmed: dimmed.has(flow.id), aggregated: r.aggregated },
      selected: !r.aggregated && sel.edges.has(flow.id),
      selectable: !r.aggregated,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: getProtocol(flow.protocol)?.color },
    });
  }

  return { nodes: [...nodes, ...portals.values()], edges };
}
