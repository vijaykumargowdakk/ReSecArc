import { describe, expect, it } from 'vitest';
import { LANE_BUTTON_MAX_PX, LANE_BUTTON_MIN_SCREEN_PX, laneButtonSize } from './laneButtons';

describe('laneButtonSize', () => {
  it('keeps the stylesheet size at 100 % zoom and when zoomed in', () => {
    expect(laneButtonSize(1, 26)).toBe(26);
    expect(laneButtonSize(2, 26)).toBe(26);
    expect(laneButtonSize(1, 44)).toBe(44);
  });

  it('grows when zoomed out, so a button stays at least 24 px on screen while its lane can hold it', () => {
    for (const zoom of [0.9, 0.6, 0.4, 0.31]) {
      for (const base of [26, 44]) {
        const size = laneButtonSize(zoom, base);
        expect(size * zoom, `zoom ${zoom}, ${base} px`).toBeGreaterThanOrEqual(LANE_BUTTON_MIN_SCREEN_PX);
        expect(size).toBeGreaterThanOrEqual(base);
      }
    }
  });

  it('never grows beyond what the lane holds, and is never smaller than its stylesheet size', () => {
    for (let zoom = 1; zoom >= 0.05; zoom -= 0.01) {
      const size = laneButtonSize(zoom, 26);
      expect(size).toBeLessThanOrEqual(LANE_BUTTON_MAX_PX);
      expect(size).toBeGreaterThanOrEqual(26);
    }
    expect(laneButtonSize(0.05, 26)).toBe(LANE_BUTTON_MAX_PX);
  });
});
