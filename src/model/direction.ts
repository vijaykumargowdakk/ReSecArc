export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Spot {
  id: string;
  x: number;
  y: number;
}

/** Arrow keys as directions; anything else gives null. */
export function arrowDirection(key: string): Direction | null {
  const map: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  return map[key] ?? null;
}

/**
 * The candidate nearest to `from` in a direction, for moving a highlight between devices with the arrow
 * keys. Points (centres) within 45° of the direction win over those further off it; among them the
 * score is the distance along the direction plus twice the sideways offset, so a device level with
 * `from` beats a slightly closer one off to the side. Ties go to the earlier candidate. Null when
 * nothing lies that way.
 */
export function nearestInDirection(from: { x: number; y: number }, candidates: readonly Spot[], dir: Direction): string | null {
  let best: { id: string; inCone: boolean; score: number } | null = null;
  for (const c of candidates) {
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const across = Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
    if (along <= 0) continue;
    const inCone = across <= along;
    const score = along + 2 * across;
    if (!best || (inCone && !best.inCone) || (inCone === best.inCone && score < best.score)) best = { id: c.id, inCone, score };
  }
  return best?.id ?? null;
}
