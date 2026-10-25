import { History } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { describeChange } from '../model/revisions';
import { announce } from '../store/announcer';
import { timeline } from '../store/history';
import { useProject } from '../store/useProject';

/** How many recent steps the menu lists; older ones can still be reached with repeated undo. */
const SHOWN = 40;

/**
 * Lists the undo history with readable names and jumps to any step. Names are worked out from the
 * snapshots only while the menu is open, so editing never pays for them.
 */
export function HistoryMenu() {
  const history = useProject((s) => s.history);
  const jumpHistory = useProject((s) => s.jumpHistory);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const { current } = timeline(history);
  const count = history.past.length + 1 + history.future.length;

  const steps = useMemo(() => {
    if (!open) return [];
    const { states } = timeline(history);
    const first = Math.max(0, states.length - SHOWN);
    return states
      .slice(first)
      .map((state, i) => {
        const index = first + i;
        return { index, label: index === 0 ? 'Start' : describeChange(states[index - 1], state) };
      })
      .reverse();
  }, [open, history]);

  return (
    <details className="menu history-menu" ref={menu} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="button icon-only" aria-label="Edit history" title="Edit history: jump back to any step">
        <History size={16} />
      </summary>
      {open && (
        <div className="menu__items history-menu__items">
          <p className="history-menu__title">Edit history</p>
          {count === 1 && <p className="muted history-menu__empty">No changes yet.</p>}
          <ol aria-label="Edit history, newest first">
            {steps.map((step) => (
              <li key={step.index}>
                <button
                  type="button"
                  aria-current={step.index === current ? 'step' : undefined}
                  className={step.index > current ? 'is-undone' : undefined}
                  onClick={() => {
                    jumpHistory(step.index - current);
                    announce(step.index < current ? `Went back to: ${step.label}` : `Went forward to: ${step.label}`);
                    menu.current?.removeAttribute('open');
                  }}
                >
                  {step.label}
                  {step.index === current && <span className="muted"> (now)</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </details>
  );
}
