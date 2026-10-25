import { getViewportForBounds, type ReactFlowInstance } from '@xyflow/react';
import { create } from 'zustand';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';

const PADDING = 40;

/** While true the canvas draws every node, so an export of a large site is complete. */
export const useRenderAll = create<{ all: boolean }>(() => ({ all: false }));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const MAX_SIDE = 4000;

/** Renders the whole current site (not just the visible part) to an SVG or PNG data URL. */
export async function exportDiagram(rf: ReactFlowInstance<CanvasNode, CanvasEdge>, format: 'svg' | 'png'): Promise<string> {
  useRenderAll.setState({ all: true });
  try {
    await nextFrame();
    return await render(rf, format);
  } finally {
    useRenderAll.setState({ all: false });
  }
}

async function render(rf: ReactFlowInstance<CanvasNode, CanvasEdge>, format: 'svg' | 'png'): Promise<string> {
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
  // Loaded on first export only, to keep it out of the startup bundle.
  const { toPng, toSvg } = await import('html-to-image');
  return format === 'svg' ? toSvg(viewport, options) : toPng(viewport, { ...options, pixelRatio: 2 });
}
