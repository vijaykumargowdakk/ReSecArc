import { useReactFlow } from '@xyflow/react';
import { LayoutGrid, Undo2 } from 'lucide-react';
import { useProject } from '../../store/useProject';
import { canRestoreTidy, toggleTidy, useLastTidy } from '../actions';
import type { CanvasEdge } from './edges';
import type { CanvasNode } from './nodes';

/**
 * Lines the open site's devices up in their lanes and areas, as one undoable step. Straight after a
 * tidy the same button puts the previous layout back; once anything else changes it tidies again.
 */
export function TidyButton() {
  const rf = useReactFlow<CanvasNode, CanvasEdge>();
  const project = useProject((s) => s.project);
  const siteId = useProject((s) => s.activeSiteId);
  useLastTidy((s) => s.result);
  const restore = canRestoreTidy(project, siteId);
  return (
    <button
      type="button"
      className={`tidy-button${restore ? ' is-active' : ''}`}
      aria-label={restore ? 'Undo tidy' : 'Tidy layout'}
      title={
        restore
          ? 'Put back the layout from before the tidy.'
          : 'Line devices up in their lanes and areas, keeping connected devices close. Click again to put the previous layout back.'
      }
      onClick={() => toggleTidy(rf)}
    >
      {restore ? <Undo2 size={14} aria-hidden="true" /> : <LayoutGrid size={14} aria-hidden="true" />}{' '}
      <span className="toolbar-text">{restore ? 'Undo tidy' : 'Tidy'}</span>
    </button>
  );
}
