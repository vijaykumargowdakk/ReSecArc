import { History } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';

const HistoryMenuItems = lazy(() => import('./HistoryMenuItems').then((m) => ({ default: m.HistoryMenuItems })));

/** Lists the undo history with readable names and jumps to any step; part of the More menu. The list loads on first open. */
export function HistoryMenu() {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <details className="menu history-menu" ref={menu} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="more-menu__row" title="Jump back to any step">
        <History size={16} aria-hidden="true" />
        Edit history
      </summary>
      {open && (
        <Suspense fallback={null}>
          <HistoryMenuItems onDone={() => menu.current?.removeAttribute('open')} />
        </Suspense>
      )}
    </details>
  );
}
