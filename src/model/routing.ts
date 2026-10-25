// Bend points on links and flows. Edges run from the source device through each waypoint to the
// target device; these helpers keep that list in a sensible order as points are added and removed.
import { MAX_COORDINATE } from './schema';

export interface Point {
  x: number;
  y: number;
}

const clamp = (v: number) => Math.round(Math.min(MAX_COORDINATE, Math.max(-MAX_COORDINATE, v)));

/** Squared distance from `p` to the segment a–b. */
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  const x = a.x + t * dx - p.x;
  const y = a.y + t * dy - p.y;
  return x * x + y * y;
}

/**
 * Inserts `point` into the segment of the route (source centre → waypoints → target centre) that it
 * is closest to, so double-clicking anywhere on an edge bends it at that spot.
 */
export function insertWaypoint(waypoints: readonly Point[], from: Point, to: Point, point: Point): Point[] {
  const route = [from, ...waypoints, to];
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = segmentDistance(point, route[i], route[i + 1]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  const next = [...waypoints];
  next.splice(best, 0, { x: clamp(point.x), y: clamp(point.y) });
  return next;
}

export function moveWaypoint(waypoints: readonly Point[], index: number, to: Point): Point[] {
  return waypoints.map((p, i) => (i === index ? { x: clamp(to.x), y: clamp(to.y) } : p));
}

export function removeWaypoint(waypoints: readonly Point[], index: number): Point[] {
  return waypoints.filter((_, i) => i !== index);
}

/** The point halfway along a polyline, for placing a label. */
export function midpoint(points: readonly Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] === 0 ? 0 : remaining / lengths[i];
      return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1] ?? { x: 0, y: 0 };
}

/** A point `distance` along the segment from `a` towards `b`, for labels near an edge's end. */
export function along(a: Point, b: Point, distance: number): Point {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const t = Math.min(1, distance / len);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
