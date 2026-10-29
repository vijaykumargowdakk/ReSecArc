import { Combine, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { newId } from '../model/ops';
import { addSite, canRemoveSite, removeSite, renameSite } from '../model/structure';
import { useProject } from '../store/useProject';

/** One tab per site; double-click a tab to rename it. The current site is marked with aria-current. */
export function SiteTabs({ onMerge }: { onMerge: () => void }) {
  const project = useProject((s) => s.project);
  const activeSiteId = useProject((s) => s.activeSiteId);
  const setActiveSite = useProject((s) => s.setActiveSite);
  const apply = useProject((s) => s.apply);
  const [editing, setEditing] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const d of project.devices) counts.set(d.siteId, (counts.get(d.siteId) ?? 0) + 1);

  const create = () => {
    const id = newId('site');
    apply((p) => addSite(p, `Site ${p.sites.length + 1}`, id));
    setActiveSite(id);
    setEditing(id);
  };

  return (
    <nav className="site-tabs" aria-label="Sites">
      {/* Only the tabs scroll, so adding and merging sites stay in reach however many there are. */}
      <div className="site-tabs__list">
        {project.sites.map((site) => {
          const active = site.id === activeSiteId;
          return (
            <div key={site.id} className={`site-tab${active ? ' is-active' : ''}`}>
              {editing === site.id ? (
                <input
                  className="site-tab__input"
                  autoFocus
                  defaultValue={site.name}
                  aria-label="Site name"
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== site.name) apply((p) => renameSite(p, site.id, name));
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="site-tab__button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveSite(site.id)}
                  onDoubleClick={() => setEditing(site.id)}
                  title="Double-click to rename"
                >
                  {site.name}
                  <span className="site-tab__count">{counts.get(site.id) ?? 0}</span>
                </button>
              )}
              {active && canRemoveSite(project, site.id) && editing !== site.id && (
                <button
                  type="button"
                  className="site-tab__close"
                  aria-label={`Delete empty site ${site.name}`}
                  title="Delete this empty site"
                  onClick={() => apply((p) => removeSite(p, site.id))}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="site-tabs__add" onClick={create} title="Add site" aria-label="Add site">
        <Plus size={15} />
      </button>
      <button type="button" className="site-tabs__add" onClick={onMerge} title="Merge sites from another project" aria-label="Merge sites from another project">
        <Combine size={15} />
      </button>
    </nav>
  );
}
