import { Filter as FilterIcon, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEVICE_CATALOG } from '../model/catalog';
import { isFiltering, NO_FILTER, type Filter } from '../model/filter';
import { getProtocol } from '../model/protocols';
import { levelLabel, PURDUE_LANES } from '../model/purdue';
import type { DeviceType, PurdueLevel } from '../model/schema';
import { useProject } from '../store/useProject';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Dropdown({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <details className={`filter${count ? ' is-active' : ''}`}>
      <summary>
        {label}
        {count > 0 && <span className="filter__count">{count}</span>}
      </summary>
      <div className="filter__menu">{children}</div>
    </details>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="filter__option">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

/** Dims everything that does not match; lists only values present in the project. */
export function FilterBar() {
  const project = useProject((s) => s.project);
  const filter = useProject((s) => s.filter);
  const setFilter = useProject((s) => s.setFilter);
  const set = (patch: Partial<Filter>) => setFilter({ ...filter, ...patch });

  const types = [...new Set(project.devices.map((d) => d.type))].sort() as DeviceType[];
  const levels = PURDUE_LANES.map((l) => l.level).filter((lvl) => project.devices.some((d) => d.purdueLevel === lvl));
  const protocols = [...new Set(project.flows.map((f) => f.protocol))].sort();

  return (
    <div className="filter-bar" role="group" aria-label="Filter">
      <FilterIcon size={14} aria-hidden="true" />
      <Dropdown label="Zone" count={filter.zones.length}>
        {project.zones.map((z) => (
          <Check key={z.id} checked={filter.zones.includes(z.id)} onChange={() => set({ zones: toggle(filter.zones, z.id) })}>
            <span className="swatch" style={{ background: z.color }} />
            {z.name}
          </Check>
        ))}
        <Check checked={filter.zones.includes('')} onChange={() => set({ zones: toggle(filter.zones, '') })}>
          No zone
        </Check>
      </Dropdown>
      <Dropdown label="Type" count={filter.types.length}>
        {types.map((t) => (
          <Check key={t} checked={filter.types.includes(t)} onChange={() => set({ types: toggle(filter.types, t) })}>
            {DEVICE_CATALOG[t].label}
          </Check>
        ))}
      </Dropdown>
      <Dropdown label="Level" count={filter.levels.length}>
        {levels.map((lvl) => (
          <Check key={lvl} checked={filter.levels.includes(lvl)} onChange={() => set({ levels: toggle<PurdueLevel>(filter.levels, lvl) })}>
            {levelLabel(lvl)}
          </Check>
        ))}
      </Dropdown>
      <Dropdown label="Protocol" count={filter.protocols.length}>
        {protocols.map((p) => (
          <Check key={p} checked={filter.protocols.includes(p)} onChange={() => set({ protocols: toggle(filter.protocols, p) })}>
            {getProtocol(p)?.label ?? p}
          </Check>
        ))}
      </Dropdown>
      {isFiltering(filter) && (
        <button type="button" className="filter__clear" onClick={() => setFilter(NO_FILTER)}>
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
