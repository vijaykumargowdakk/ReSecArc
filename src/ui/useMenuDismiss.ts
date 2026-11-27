// Closes the toolbar and canvas bar menus (`<details class="menu">` and `<details class="filter">`)
// the way menus are expected to close (issue #69): Escape closes the innermost open one and returns
// focus to its button, and a press anywhere outside an open menu closes it (sections inside a menu
// close with Escape or with their menu).
import { useEffect } from 'react';

const MENUS = 'details.menu[open], details.filter[open]';

/** Open menus, innermost first (a section inside the More menu comes before More itself). */
function openMenus(): HTMLDetailsElement[] {
  return [...document.querySelectorAll<HTMLDetailsElement>(MENUS)].reverse();
}

export function useMenuDismiss() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const menus = openMenus();
      if (menus.length === 0) return;
      // The menu holding the focus, or else the innermost open one.
      const active = document.activeElement;
      const menu = menus.find((m) => active instanceof Node && m.contains(active)) ?? menus[0];
      menu.open = false;
      menu.querySelector<HTMLElement>(':scope > summary')?.focus();
      // This Escape was for the menu; it must not also clear the selection or cancel anything else.
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target;
      for (const menu of openMenus()) {
        // A section inside another menu (Edit history in More) is left alone: closing it on the press
        // would move what was pressed before the click lands. It closes with its menu.
        if (menu.parentElement?.closest('details[open]')) continue;
        if (!(target instanceof Node) || !menu.contains(target)) menu.open = false;
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);
}
