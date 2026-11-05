import { LANE_HEIGHT } from '../../model/purdue';

/**
 * Lane buttons are drawn on the canvas, so they shrink with it (issue #19). Below 100 % zoom they are
 * drawn larger in canvas pixels, so on screen they stay at least 24 px (WCAG 2.5.8), and never smaller
 * than their stylesheet size (44 px on touch screens). The label column is centred in its lane and
 * re-flows around them. They never grow beyond what the lane holds with its level and name, so when
 * zoomed out further (below about 30 %) they shrink again, but stay much larger than before and never
 * spill into the next lane; the command palette has the same actions.
 */
const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** The stylesheet size of a lane button, in canvas pixels. */
export const LANE_BUTTON_PX = COARSE_POINTER ? 44 : 26;
/** The smallest a lane button should be on screen. */
export const LANE_BUTTON_MIN_SCREEN_PX = 24;
/**
 * The level and name above the buttons, the 6 px gap above the buttons and a margin inside the lane.
 * The label is 40 px (`.lane__level` and `.lane__name` in styles.css, as measured in the browser),
 * or 55 px when the name wraps onto two lines, as L4's "Business planning & logistics" does.
 */
const LANE_LABEL_PX = 55 + 6 + 8;
/** The largest a lane button can be, in canvas pixels, and still fit in its lane. */
export const LANE_BUTTON_MAX_PX = LANE_HEIGHT - LANE_LABEL_PX;

/** The lane buttons' size in canvas pixels at a zoom. */
export function laneButtonSize(zoom: number, buttonPx = LANE_BUTTON_PX): number {
  // Rounded up, so a button is never a fraction of a pixel under the minimum on screen.
  const wanted = Math.ceil(LANE_BUTTON_MIN_SCREEN_PX / zoom);
  return Math.max(buttonPx, Math.min(wanted, LANE_BUTTON_MAX_PX));
}
