import { Filter as FilterIcon, X } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { isFiltering, NO_FILTER } from '../model/filter';
import { useProject } from '../store/useProject';
import type { FilterKind } from './FilterOptions';

const FilterOptions = lazy(() => import('./FilterOptions').then((m) => ({ default: m.FilterOptions })));

/** A filter menu; its choices load and are listed only once it has been opened. */
function Dropdown({ label, kind, count }: { label: string; kind: FilterKind; count: number }) {
  const [opened, setOpened] = useState(false);
  return (
    <details className={`filter${count ? ' is-active' : ''}`} onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary>
        {label}
        {count > 0 && <span className="filter__count">{count}</span>}
      </summary>
      <div className="filter__menu">
        {opened && (
          <Suspense fallback={null}>
            <FilterOptions kind={kind} />
          </Suspense>
        )}
      </div>
    </details>
  );
}

/** Dims everything that does not match. */
export function FilterBar() {
  const filter = useProject((s) => s.filter);
  const setFilter = useProject((s) => s.setFilter);
  const hasTags = useProject((s) => s.project.devices.some((d) => d.tags.length > 0));

  return (
    <div className="filter-bar" role="group" aria-label="Filter">
      <FilterIcon size={14} aria-hidden="true" />
      <Dropdown label="Zone" kind="zone" count={filter.zones.length} />
      <Dropdown label="Type" kind="type" count={filter.types.length} />
      <Dropdown label="Level" kind="level" count={filter.levels.length} />
      <Dropdown label="Protocol" kind="protocol" count={filter.protocols.length} />
      {hasTags && <Dropdown label="Tag" kind="tag" count={filter.tags.length} />}
      {isFiltering(filter) && (
        <button type="button" className="filter__clear" onClick={() => setFilter(NO_FILTER)}>
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
