import { useReactFlow } from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';
import { tidyLayout } from '../../model/layout';
import { announce } from '../../store/announcer';
import { useProject } from '../../store/useProject';

/** Lines the open site's devices up in their lanes and areas, as one undoable step. */
export function TidyButton() {
  const apply = useProject((s) => s.apply);
  const siteId = useProject((s) => s.activeSiteId);
  const { fitView } = useReactFlow();
  return (
    <button
      type="button"
      className="tidy-button"
      aria-label="Tidy layout"
      title="Line devices up in their lanes and areas, keeping connected devices close. Undo restores the previous positions."
      onClick={() => {
        apply((p) => tidyLayout(p, siteId));
        announce('Layout tidied. Undo restores the previous positions.');
        requestAnimationFrame(() => fitView({ padding: 0.1, duration: 250 }));
      }}
    >
      <LayoutGrid size={14} aria-hidden="true" /> Tidy
    </button>
  );
}
