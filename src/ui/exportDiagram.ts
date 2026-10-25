import { getViewportForBounds, type ReactFlowInstance } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';

const PADDING = 40;
const MAX_SIDE = 4000;

/** Renders the whole current site (not just the visible part) to an SVG or PNG data URL. */
export async function exportDiagram(rf: ReactFlowInstance<CanvasNode, CanvasEdge>, format: 'svg' | 'png'): Promise<string> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  const nodes = rf.getNodes();
  if (!viewport || nodes.length === 0) throw new Error('Nothing to export');
  const bounds = rf.getNodesBounds(nodes);
  const scale = Math.min(1, MAX_SIDE / Math.max(bounds.width, bounds.height));
  const width = Math.round(bounds.width * scale + 2 * PADDING);
  const height = Math.round(bounds.height * scale + 2 * PADDING);
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 0.1, 2, 0);
  const options = {
    backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#ffffff',
    width,
    height,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${zoom})` },
  };
  return format === 'svg' ? toSvg(viewport, options) : toPng(viewport, { ...options, pixelRatio: 2 });
}
