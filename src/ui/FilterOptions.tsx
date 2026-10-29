// The choices inside the filter menus, loaded the first time one of them opens.
import type { ReactNode } from 'react';
import { DEVICE_CATALOG } from '../model/catalog';
import { tagCounts } from '../model/fields';
import type { Filter } from '../model/filter';
import { getProtocol } from '../model/protocols';
import { levelLabel, PURDUE_LANES } from '../model/purdue';
import type { DeviceType, PurdueLevel } from '../model/schema';
import { useProject } from '../store/useProject';

export type FilterKind = 'zone' | 'type' | 'level' | 'protocol' | 'tag';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="filter__option">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

/** Lists only values present in the project. */
export function FilterOptions({ kind }: { kind: FilterKind }) {
  const project = useProject((s) => s.project);
  const filter = useProject((s) => s.filter);
  const setFilter = useProject((s) => s.setFilter);
  const set = (patch: Partial<Filter>) => setFilter({ ...filter, ...patch });

  if (kind === 'zone') {
    return (
      <>
        {project.zones.map((z) => (
          <Check key={z.id} checked={filter.zones.includes(z.id)} onChange={() => set({ zones: toggle(filter.zones, z.id) })}>
            <span className="swatch" style={{ background: z.color }} />
            {z.name}
          </Check>
        ))}
        <Check checked={filter.zones.includes('')} onChange={() => set({ zones: toggle(filter.zones, '') })}>
          No zone
        </Check>
      </>
    );
  }
  if (kind === 'type') {
    const types = [...new Set(project.devices.map((d) => d.type))].sort() as DeviceType[];
    return types.map((t) => (
      <Check key={t} checked={filter.types.includes(t)} onChange={() => set({ types: toggle(filter.types, t) })}>
        {DEVICE_CATALOG[t].label}
      </Check>
    ));
  }
  if (kind === 'level') {
    const levels = PURDUE_LANES.map((l) => l.level).filter((lvl) => project.devices.some((d) => d.purdueLevel === lvl));
    return levels.map((lvl) => (
      <Check key={lvl} checked={filter.levels.includes(lvl)} onChange={() => set({ levels: toggle<PurdueLevel>(filter.levels, lvl) })}>
        {levelLabel(lvl)}
      </Check>
    ));
  }
  if (kind === 'protocol') {
    const protocols = [...new Set(project.flows.map((f) => f.protocol))].sort();
    return protocols.map((p) => (
      <Check key={p} checked={filter.protocols.includes(p)} onChange={() => set({ protocols: toggle(filter.protocols, p) })}>
        {getProtocol(p)?.label ?? p}
      </Check>
    ));
  }
  return tagCounts(project).map(({ tag, count }) => (
    <Check key={tag} checked={filter.tags.includes(tag)} onChange={() => set({ tags: toggle(filter.tags, tag) })}>
      {tag} <span className="muted">({count})</span>
    </Check>
  ));
}
