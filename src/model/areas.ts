import { NODE_HEIGHT, NODE_WIDTH } from './purdue';
import type { Area, Project } from './schema';

export type Rect = Area['rect'];

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** The area on `siteId` containing a device placed at `position` (by its centre); later areas win overlaps. */
export function areaAt(project: Pick<Project, 'areas'>, siteId: string, position: { x: number; y: number }): string | null {
  const cx = position.x + NODE_WIDTH / 2;
  const cy = position.y + NODE_HEIGHT / 2;
  for (let i = project.areas.length - 1; i >= 0; i--) {
    const a = project.areas[i];
    if (a.siteId === siteId && contains(a.rect, cx, cy)) return a.id;
  }
  return null;
}

/** Smallest rectangle around device nodes, plus padding. */
export function boundsOf(positions: { x: number; y: number }[], padding = 30): Rect {
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const x = Math.min(...xs) - padding;
  const y = Math.min(...ys) - padding - 14;
  return {
    x,
    y,
    width: Math.max(...xs) + NODE_WIDTH + padding - x,
    height: Math.max(...ys) + NODE_HEIGHT + padding - y,
  };
}
