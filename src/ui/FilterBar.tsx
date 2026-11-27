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

const KINDS: { label: string; kind: FilterKind; key: 'zones' | 'types' | 'levels' | 'protocols' | 'tags' }[] = [
  { label: 'Zone', kind: 'zone', key: 'zones' },
  { label: 'Type', kind: 'type', key: 'types' },
  { label: 'Level', kind: 'level', key: 'levels' },
  { label: 'Protocol', kind: 'protocol', key: 'protocols' },
  { label: 'Tag', kind: 'tag', key: 'tags' },
];

/**
 * Below 1440 px the filter chips give way to this one menu with a section per kind, so the canvas
 * bar keeps room for the site tabs (issue #66). The sections load the first time it opens.
 */
function FilterMenu({ kinds, count }: { kinds: typeof KINDS; count: number }) {
  const [opened, setOpened] = useState(false);
  return (
    <details className={`filter filter-all${count ? ' is-active' : ''}`} onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary>
        <FilterIcon size={13} aria-hidden="true" />
        Filter
        {count > 0 && <span className="filter__count">{count}</span>}
      </summary>
      <div className="filter__menu filter-all__menu">
        {opened && (
          <Suspense fallback={null}>
            {kinds.map((k) => (
              <fieldset key={k.kind}>
                <legend>{k.label}</legend>
                <FilterOptions kind={k.kind} />
              </fieldset>
            ))}
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

  const kinds = KINDS.filter((k) => k.kind !== 'tag' || hasTags);
  const total = kinds.reduce((n, k) => n + filter[k.key].length, 0);

  return (
    <div className="filter-bar" role="group" aria-label="Filter">
      <span className="filter-chips">
        <FilterIcon size={14} aria-hidden="true" />
        {kinds.map((k) => (
          <Dropdown key={k.kind} label={k.label} kind={k.kind} count={filter[k.key].length} />
        ))}
      </span>
      <FilterMenu kinds={kinds} count={total} />
      {isFiltering(filter) && (
        <button type="button" className="filter__clear" onClick={() => setFilter(NO_FILTER)}>
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
