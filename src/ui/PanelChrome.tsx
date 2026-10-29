// The frame of the two side panels: a header that folds the panel into a thin strip, as in code
// editors, and an edge that resizes it. Folding and resizing apply on wide screens only; below
// 900px the panels are slide-over drawers opened from the toolbar.
import { PanelLeft, PanelRight } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { usePrefs, type PanelName } from '../store/prefs';

// The resize edge is invisible until hovered, so its code loads just after the first paint.
const ResizeEdge = lazy(() => import('./PanelEdge').then((m) => ({ default: m.PanelEdge })));

export const PANEL_TITLES: Record<PanelName, string> = { palette: 'Device palette', inspector: 'Properties' };
export const PANEL_SHORTCUTS: Record<PanelName, string> = { palette: 'Ctrl+B', inspector: 'Ctrl+Alt+B' };

/** The panel's title and its fold button; when folded, only the button is left, as a strip. */
export function PanelHeader({ panel, bodyId }: { panel: PanelName; bodyId: string }) {
  const open = usePrefs((s) => s.panels[panel].open);
  const toggle = usePrefs((s) => s.togglePanel);
  const title = PANEL_TITLES[panel];
  const left = panel === 'palette';
  const Icon = left ? PanelLeft : PanelRight;
  return (
    <div className="panel-head">
      <span className="panel-head__title">{title}</span>
      <button
        type="button"
        className="icon-button panel-head__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={`${open ? 'Hide' : 'Show'} ${title.toLowerCase()}`}
        title={`${open ? 'Hide' : 'Show'} ${title.toLowerCase()} (${PANEL_SHORTCUTS[panel]})`}
        onClick={() => toggle(panel)}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function PanelEdge({ panel }: { panel: PanelName }) {
  return (
    <Suspense fallback={null}>
      <ResizeEdge panel={panel} />
    </Suspense>
  );
}
