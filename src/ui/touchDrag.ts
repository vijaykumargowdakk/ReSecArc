// Dragging palette items with a finger or a pen (issue #17). HTML5 drag and drop needs a mouse, so on
// touch screens the item follows the finger once it moves sideways, and on release over the canvas
// it is dropped there with an ordinary `drop` event carrying the same data a mouse drag would. The
// canvas handles it exactly as a mouse drop: same level, area and level-tab rules. A vertical swipe
// still scrolls the palette, and a tap still adds the item, as before.
import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** How far a finger moves before a sideways movement becomes a drag rather than a tap. */
const DRAG_START_PX = 12;

/** Set on <body> while a finger drags a palette item; below 900 px it slides the palette drawer away (#51). */
const DRAGGING_CLASS = 'touch-dragging';

/** Sent on `window` after a finger drag drops an item on the canvas, so the app can close the drawer. */
export const PALETTE_DROP_EVENT = 'resecarc:palette-drop';

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  ghost: HTMLElement | null;
}

/** Pointer handlers for a palette item that carries `payload` under `mime`, as its HTML5 drag does. */
export function useTouchDrag(mime: string, payload: string) {
  const drag = useRef<Drag | null>(null);
  // A drag ends with a pointerup, which the browser may follow with a click; that click must not add
  // the item a second time.
  const justDropped = useRef(false);

  const end = () => {
    drag.current?.ghost?.remove();
    drag.current = null;
    document.body.classList.remove(DRAGGING_CLASS);
  };

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, ghost: null };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      if (!d.ghost) {
        const dx = Math.abs(e.clientX - d.startX);
        const dy = Math.abs(e.clientY - d.startY);
        if (Math.max(dx, dy) < DRAG_START_PX) return;
        // Mostly up or down: the palette is being scrolled, so leave it to the browser.
        if (dy >= dx) return end();
        e.currentTarget.setPointerCapture(e.pointerId);
        d.ghost = ghostOf(e.currentTarget);
        document.body.classList.add(DRAGGING_CLASS);
      }
      d.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dragged = d.ghost !== null;
      // Found before the drag ends: ending it slides the palette drawer back over the canvas.
      const target = dragged ? document.elementFromPoint(e.clientX, e.clientY) : null;
      end();
      if (!dragged) return;
      justDropped.current = true;
      setTimeout(() => (justDropped.current = false), 400);
      if (!target?.closest('.canvas')) return;
      const data = new DataTransfer();
      data.setData(mime, payload);
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, dataTransfer: data }));
      window.dispatchEvent(new Event(PALETTE_DROP_EVENT));
    },
    onPointerCancel: end,
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (!justDropped.current) return;
      justDropped.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

/** A copy of the item that follows the finger, drawn above everything and ignored by hit testing. */
function ghostOf(item: HTMLElement): HTMLElement {
  const ghost = item.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('touch-drag-ghost');
  ghost.style.width = `${item.offsetWidth}px`;
  document.body.append(ghost);
  return ghost;
}
