import { useReactFlow } from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';
import { tidyOpenSite } from '../actions';
import type { CanvasEdge } from './edges';
import type { CanvasNode } from './nodes';

/** Lines the open site's devices up in their lanes and areas, as one undoable step. */
export function TidyButton() {
  const rf = useReactFlow<CanvasNode, CanvasEdge>();
  return (
    <button
      type="button"
      className="tidy-button"
      aria-label="Tidy layout"
      title="Line devices up in their lanes and areas, keeping connected devices close. Undo restores the previous positions."
      onClick={() => tidyOpenSite(rf)}
    >
      <LayoutGrid size={14} aria-hidden="true" /> Tidy
    </button>
  );
}
