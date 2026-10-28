import { BaseEdge, EdgeLabelRenderer, useInternalNode, useReactFlow, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';
import { useState, type CSSProperties, type PointerEvent } from 'react';
import { replaceFlow, updateLink } from '../../model/ops';
import { flowLabel, getProtocol } from '../../model/protocols';
import { along, midpoint, moveWaypoint, removeWaypoint, routeBetween, FLOW_OFFSET, type Box, type Point } from '../../model/routing';
import { useProject } from '../../store/useProject';
import type { FlowEdgeData, LinkEdgeData } from './view';

export type LinkFlowEdge = Edge<LinkEdgeData, 'link'>;
export type ProtocolFlowEdge = Edge<FlowEdgeData, 'flow'>;
export type CanvasEdge = LinkFlowEdge | ProtocolFlowEdge;

/** Distance of a port name from the device it belongs to, along the edge. */
const PORT_LABEL_DISTANCE = 30;

function box(node: InternalNode): Box {
  const { x, y } = node.internals.positionAbsolute;
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  return { cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2 };
}

const route = (source: InternalNode, target: InternalNode, offset: number, waypoints: readonly Point[]) => routeBetween(box(source), box(target), offset, waypoints);

const toPath = (points: readonly Point[]) => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

function edgeState(selected: boolean | undefined, data: LinkEdgeData | FlowEdgeData): string {
  return `${selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}${data.aggregated ? ' is-aggregated' : ''}${data.diff ? ` diff-${data.diff}` : ''}${data.violation ? ' sec-violation' : ''}${data.onPath ? ' sec-path' : ''}`;
}

const at = (p: Point): CSSProperties => ({ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)` });

/**
 * Handles for the bend points of the selected edge: drag to move, double-click to remove. Moves are
 * shown live and committed once on release, so a drag is a single undo step.
 */
function WaypointHandles({ waypoints, onChange }: { waypoints: readonly Point[]; onChange: (next: Point[]) => void }) {
  const { screenToFlowPosition } = useReactFlow();
  const [drag, setDrag] = useState<{ index: number; at: Point } | null>(null);
  const shown = drag ? moveWaypoint(waypoints, drag.index, drag.at) : waypoints;
  const position = (e: PointerEvent) => screenToFlowPosition({ x: e.clientX, y: e.clientY });
  return (
    <EdgeLabelRenderer>
      {shown.map((p, index) => (
        <div
          key={index}
          className="waypoint nodrag nopan"
          style={at(p)}
          title="Drag to move this bend; double-click to remove it"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ index, at: position(e) });
          }}
          onPointerMove={(e) => drag && setDrag({ index: drag.index, at: position(e) })}
          onPointerUp={(e) => {
            if (!drag) return;
            onChange(moveWaypoint(waypoints, drag.index, position(e)));
            setDrag(null);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onChange(removeWaypoint(waypoints, index));
          }}
        />
      ))}
    </EdgeLabelRenderer>
  );
}

export function LinkEdge({ id, source, target, data, selected }: EdgeProps<LinkFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const apply = useProject((st) => st.apply);
  if (!s || !t || !data) return null;
  const { link } = data;
  const waypoints = data.aggregated ? [] : link.waypoints;
  const points = route(s, t, 0, waypoints);
  const state = edgeState(selected, data);
  // Each port name sits near its own device; the stored source may be drawn at either end.
  const sourceEnd = source === link.source || source.startsWith(`portal:${link.source}`);
  const nearSource = along(points[0], points[1], PORT_LABEL_DISTANCE);
  const nearTarget = along(points[points.length - 1], points[points.length - 2], PORT_LABEL_DISTANCE);
  const ports = data.showPorts && !data.aggregated && (link.sourcePort || link.targetPort);
  return (
    <>
      <BaseEdge id={id} path={toPath(points)} className={`link-edge medium-${link.medium}${state}`} />
      {ports && (
        <EdgeLabelRenderer>
          {[
            [link.sourcePort, sourceEnd ? nearSource : nearTarget],
            [link.targetPort, sourceEnd ? nearTarget : nearSource],
          ].map(([name, p], i) =>
            name ? (
              <div key={i} className={`port-label${state}`} style={at(p as Point)}>
                {name as string}
              </div>
            ) : null,
          )}
        </EdgeLabelRenderer>
      )}
      {selected && !data.aggregated && link.waypoints.length > 0 && (
        <WaypointHandles waypoints={link.waypoints} onChange={(next) => apply((p) => updateLink(p, link.id, { waypoints: next }))} />
      )}
    </>
  );
}

export function FlowEdge({ id, source, target, data, selected, markerEnd }: EdgeProps<ProtocolFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const apply = useProject((st) => st.apply);
  if (!s || !t || !data) return null;
  const { flow } = data;
  const waypoints = data.aggregated ? [] : flow.waypoints;
  const points = route(s, t, FLOW_OFFSET, waypoints);
  const def = getProtocol(flow.protocol);
  const color = def?.color ?? 'var(--ink-soft)';
  const state = edgeState(selected, data);
  return (
    <>
      <BaseEdge
        id={id}
        path={toPath(points)}
        markerEnd={markerEnd}
        className={`flow-edge${state}`}
        style={{ stroke: color, strokeDasharray: def?.dash ?? '6 4' }}
      />
      {data.showLabel && (
        <EdgeLabelRenderer>
          <div className={`flow-label${state}`} style={{ '--protocol-color': color, ...at(midpoint(points)) } as CSSProperties}>
            {flowLabel(flow.protocol, flow.settings)}
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && !data.aggregated && flow.waypoints.length > 0 && (
        <WaypointHandles waypoints={flow.waypoints} onChange={(next) => apply((p) => replaceFlow(p, { ...flow, waypoints: next }))} />
      )}
    </>
  );
}
