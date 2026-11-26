// The toolbar's "More" menu (issue #16): the less-used controls, so the toolbar keeps its labels at
// 1280–1440 px. Snap to grid, the edit history and the display settings each stay one click away
// inside it, and every action is still in the command palette.
import { ChevronDown, Grid3x3 } from 'lucide-react';
import { useProject } from '../store/useProject';
import { DisplayMenu } from './DisplayMenu';
import { HistoryMenu } from './HistoryMenu';

export function MoreMenu() {
  const snapToGrid = useProject((s) => s.snapToGrid);
  const toggleSnap = useProject((s) => s.toggleSnap);
  return (
    <details className="menu more-menu">
      <summary className="button" title="Snap to grid, edit history, theme and text size">
        More
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="menu__items more-menu__items">
        <button type="button" className="more-menu__row" aria-pressed={snapToGrid} onClick={toggleSnap}>
          <Grid3x3 size={16} aria-hidden="true" />
          Snap to grid
          <span className="more-menu__state" aria-hidden="true">
            {snapToGrid ? 'On' : 'Off'}
          </span>
        </button>
        <HistoryMenu />
        <DisplayMenu />
      </div>
    </details>
  );
}
