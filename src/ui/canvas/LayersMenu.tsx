import { Layers as LayersIcon } from 'lucide-react';
import { LAYER_LABELS, usePrefs, type Layers } from '../../store/prefs';

/** Shows or hides kinds of item on the canvas. The choice is remembered in this browser. */
export function LayersMenu() {
  const layers = usePrefs((s) => s.layers);
  const setLayer = usePrefs((s) => s.setLayer);
  const showAll = usePrefs((s) => s.showAllLayers);
  const hidden = (Object.keys(layers) as (keyof Layers)[]).filter((k) => !layers[k]).length;
  return (
    <details className={`filter layers-menu${hidden ? ' is-active' : ''}`}>
      <summary title="Show or hide kinds of item on the canvas">
        <LayersIcon size={14} aria-hidden="true" /> <span className="toolbar-text">View</span>
        {hidden > 0 && <span className="filter__count" aria-label={`${hidden} hidden`}>{hidden}</span>}
      </summary>
      <div className="filter__menu" role="group" aria-label="Show on the canvas">
        {(Object.keys(LAYER_LABELS) as (keyof Layers)[]).map((key) => (
          <label key={key} className="filter__option">
            <input type="checkbox" checked={layers[key]} onChange={(e) => setLayer(key, e.target.checked)} />
            {LAYER_LABELS[key]}
          </label>
        ))}
        {hidden > 0 && (
          <button type="button" className="filter__clear" onClick={showAll}>
            Show everything
          </button>
        )}
      </div>
    </details>
  );
}
