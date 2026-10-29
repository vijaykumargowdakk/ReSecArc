// The draggable inner edge of a side panel. Loaded on demand by PanelChrome.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { PANEL_LIMITS, usePrefs, type PanelName } from '../store/prefs';
import { PANEL_TITLES } from './PanelChrome';

const KEY_STEP = 10;

/** Current interface scale (the text size setting), read from the page. */
const uiScale = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;

/**
 * The inner edge of a panel. Dragging it, or the arrow keys while it has focus, change the width;
 * a double-click goes back to the default width. While dragging, only a CSS variable on the
 * workspace changes, so nothing re-renders until the drag ends.
 */
export function PanelEdge({ panel }: { panel: PanelName }) {
  const width = usePrefs((s) => s.panels[panel].width);
  const setWidth = usePrefs((s) => s.setPanelWidth);
  const drag = useRef<{ x: number; start: number; scale: number; last: number } | null>(null);
  const edge = useRef<HTMLDivElement>(null);
  const { min, max } = PANEL_LIMITS[panel];
  // The drawn width, kept current for the separator's value while dragging and when the layout changes.
  const [drawn, setDrawn] = useState(width ?? min);
  const title = PANEL_TITLES[panel].toLowerCase();
  // The palette's edge is on its right, so dragging right widens it; the inspector's is on its left.
  const sign = panel === 'palette' ? 1 : -1;
  const variable = panel === 'palette' ? '--palette-w' : '--inspector-w';

  useLayoutEffect(() => {
    const aside = edge.current?.parentElement;
    if (!aside) return;
    const measure = () => setDrawn(Math.round(aside.getBoundingClientRect().width / uiScale()));
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    return () => observer.disconnect();
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: drawn, scale: uiScale(), last: drawn };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.last = Math.round(Math.min(max, Math.max(min, d.start + (sign * (e.clientX - d.x)) / d.scale)));
    e.currentTarget.closest<HTMLElement>('.workspace')?.style.setProperty(variable, `${d.last}px`);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.last !== d.start) setWidth(panel, d.last);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const now = width ?? drawn;
    let next: number | null;
    if (e.key === 'ArrowLeft') next = now - sign * step;
    else if (e.key === 'ArrowRight') next = now + sign * step;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'Enter') next = null;
    else return;
    e.preventDefault();
    setWidth(panel, next);
  };

  return (
    <div
      ref={edge}
      role="separator"
      tabIndex={0}
      className={`panel-edge panel-edge--${panel}`}
      aria-orientation="vertical"
      aria-label={`Resize ${title}`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={drawn}
      title="Drag to resize. Double-click, or press Enter, for the default width."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setWidth(panel, null)}
      onKeyDown={onKeyDown}
    />
  );
}
