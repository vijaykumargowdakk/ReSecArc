// Touch screens have no right-click, so holding a finger still on a device opens its menu instead.
// Mouse presses are left to the normal right-click menu. The canvas loads this only on devices
// with a touch screen.

export const LONG_PRESS_MS = 500;
/** How far a finger may wander, in pixels, before the press counts as a drag or pan instead. */
const SLOP = 10;

/** Listens on `el` for long presses on device nodes; returns a function that stops listening. */
export function attachLongPress(el: HTMLElement, onLongPress: (deviceId: string, clientX: number, clientY: number) => void): () => void {
  let press: { timer: number; x: number; y: number } | null = null;
  const cancel = () => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };
  const down = (e: PointerEvent) => {
    cancel();
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    const id = (e.target as Element).closest<HTMLElement>('.react-flow__node-device')?.dataset.id;
    if (!id) return;
    const { clientX: x, clientY: y } = e;
    const timer = window.setTimeout(() => {
      press = null;
      // The finger is lifted over the menu that just opened; that lift must not choose an item.
      const swallow = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 700);
      onLongPress(id, x, y);
    }, LONG_PRESS_MS);
    press = { timer, x, y };
  };
  const move = (e: PointerEvent) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) cancel();
  };
  // Capture, so React Flow's own handlers cannot hide the press from us.
  const options = { capture: true, passive: true };
  el.addEventListener('pointerdown', down, options);
  el.addEventListener('pointermove', move, options);
  el.addEventListener('pointerup', cancel, options);
  el.addEventListener('pointercancel', cancel, options);
  return () => {
    cancel();
    el.removeEventListener('pointerdown', down, options);
    el.removeEventListener('pointermove', move, options);
    el.removeEventListener('pointerup', cancel, options);
    el.removeEventListener('pointercancel', cancel, options);
  };
}
