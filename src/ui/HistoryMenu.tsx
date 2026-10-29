import { History } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';

const HistoryMenuItems = lazy(() => import('./HistoryMenuItems').then((m) => ({ default: m.HistoryMenuItems })));

/** Lists the undo history with readable names and jumps to any step. The list loads on first open. */
export function HistoryMenu() {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <details className="menu history-menu" ref={menu} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="button icon-only" aria-label="Edit history" title="Edit history: jump back to any step">
        <History size={16} />
      </summary>
      {open && (
        <Suspense fallback={null}>
          <HistoryMenuItems onDone={() => menu.current?.removeAttribute('open')} />
        </Suspense>
      )}
    </details>
  );
}
