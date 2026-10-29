// The edit history list, loaded the first time the History menu opens.
import { useMemo } from 'react';
import { describeChange } from '../model/revisions';
import { announce } from '../store/announcer';
import { timeline } from '../store/history';
import { useProject } from '../store/useProject';

/** How many recent steps the menu lists; older ones can still be reached with repeated undo. */
const SHOWN = 40;

/** Names are worked out from the snapshots only while the menu is open, so editing never pays for them. */
export function HistoryMenuItems({ onDone }: { onDone: () => void }) {
  const history = useProject((s) => s.history);
  const jumpHistory = useProject((s) => s.jumpHistory);
  const { current } = timeline(history);
  const count = history.past.length + 1 + history.future.length;

  const steps = useMemo(() => {
    const { states } = timeline(history);
    const first = Math.max(0, states.length - SHOWN);
    return states
      .slice(first)
      .map((state, i) => {
        const index = first + i;
        return { index, label: index === 0 ? 'Start' : describeChange(states[index - 1], state) };
      })
      .reverse();
  }, [history]);

  return (
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
                onDone();
              }}
            >
              {step.label}
              {step.index === current && <span className="muted"> (now)</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
