import type { PurdueLevel } from './schema';

export interface PurdueLane {
  level: PurdueLevel;
  name: string;
}

/** Lanes from top of the canvas to the bottom. */
export const PURDUE_LANES: PurdueLane[] = [
  { level: 5, name: 'Enterprise network' },
  { level: 4, name: 'Business planning & logistics' },
  { level: 3.5, name: 'Industrial DMZ' },
  { level: 3, name: 'Site operations' },
  { level: 2, name: 'Supervisory control' },
  { level: 1, name: 'Basic control' },
  { level: 0, name: 'Physical process' },
];

export const LANE_HEIGHT = 150;
export const LANE_WIDTH = 1500;
/** Rendered device node size (must match .device-node in styles.css); used to place nodes by their centre. */
export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 64;

export function laneIndex(level: PurdueLevel): number {
  return PURDUE_LANES.findIndex((lane) => lane.level === level);
}

export function laneTop(level: PurdueLevel): number {
  return laneIndex(level) * LANE_HEIGHT;
}

/** The Purdue level whose lane contains a node placed at `y` (top edge). */
export function levelAtY(y: number): PurdueLevel {
  const centre = y + NODE_HEIGHT / 2;
  const index = Math.min(PURDUE_LANES.length - 1, Math.max(0, Math.floor(centre / LANE_HEIGHT)));
  return PURDUE_LANES[index].level;
}

export function levelLabel(level: PurdueLevel): string {
  return level === 3.5 ? 'L3.5' : `L${level}`;
}
