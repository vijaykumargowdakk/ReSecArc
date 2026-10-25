import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { flowLabel, getProtocol } from '../../model/protocols';
import type { FlowEdgeData, LinkEdgeData } from './view';

export type LinkFlowEdge = Edge<LinkEdgeData, 'link'>;
export type ProtocolFlowEdge = Edge<FlowEdgeData, 'flow'>;
export type CanvasEdge = LinkFlowEdge | ProtocolFlowEdge;

interface Point {
  x: number;
  y: number;
}

/** Offset of a protocol flow from the link it usually runs alongside. */
const FLOW_OFFSET = 9;

function box(node: InternalNode) {
  const { x, y } = node.internals.positionAbsolute;
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  return { cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2 };
}

/** Where the ray from a box's centre towards `to` leaves the box. */
function exitPoint(b: ReturnType<typeof box>, from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return from;
  const sx = dx === 0 ? Infinity : b.hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : b.hh / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: from.x + dx * s, y: from.y + dy * s };
}

/** Straight segment between two nodes' borders, optionally shifted sideways. */
function floatingSegment(source: InternalNode, target: InternalNode, offset: number) {
  const a = box(source);
  const b = box(target);
  const len = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
  const nx = (-(b.cy - a.cy) / len) * offset;
  const ny = ((b.cx - a.cx) / len) * offset;
  const from = { x: a.cx + nx, y: a.cy + ny };
  const to = { x: b.cx + nx, y: b.cy + ny };
  const start = exitPoint(a, from, to);
  const end = exitPoint(b, to, from);
  return { start, end, path: `M ${start.x},${start.y} L ${end.x},${end.y}` };
}

export function LinkEdge({ id, source, target, data, selected }: EdgeProps<LinkFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const { path } = floatingSegment(s, t, 0);
  const state = `${selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}${data.aggregated ? ' is-aggregated' : ''}`;
  return <BaseEdge id={id} path={path} className={`link-edge medium-${data.link.medium}${state}`} />;
}

export function FlowEdge({ id, source, target, data, selected, markerEnd }: EdgeProps<ProtocolFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const { start, end, path } = floatingSegment(s, t, FLOW_OFFSET);
  const def = getProtocol(data.flow.protocol);
  const color = def?.color ?? 'var(--ink-soft)';
  const state = `${selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}${data.aggregated ? ' is-aggregated' : ''}`;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={`flow-edge${state}`}
        style={{ stroke: color, strokeDasharray: def?.dash ?? '6 4' }}
      />
      <EdgeLabelRenderer>
        <div
          className={`flow-label${state}`}
          style={{
            '--protocol-color': color,
            transform: `translate(-50%, -50%) translate(${(start.x + end.x) / 2}px, ${(start.y + end.y) / 2}px)`,
          } as CSSProperties}
        >
          {flowLabel(data.flow.protocol, data.flow.settings)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
