import { X } from 'lucide-react';
import { levelLabel, PURDUE_LANES } from '../model/purdue';
import type { PurdueLevel } from '../model/schema';
import { useProject } from '../store/useProject';

/** Closes a level tab; if it was showing, the tab before it (or the overview) shows instead. */
export function closeLevelTab(level: PurdueLevel): void {
  const { levelTabs, activeLevel } = useProject.getState();
  const index = levelTabs.indexOf(level);
  const rest = levelTabs.filter((l) => l !== level);
  useProject.setState({ levelTabs: rest, ...(activeLevel === level && { activeLevel: rest[Math.max(0, index - 1)] ?? null }) });
}

/**
 * The overview and the level tabs opened for the open site. It shows only while a level tab is
 * open, so it loads on demand. The current tab is marked with aria-current, as the site tabs are.
 */
export function LevelTabs() {
  const tabs = useProject((s) => s.levelTabs);
  const active = useProject((s) => s.activeLevel);
  const openLevel = useProject((s) => s.openLevel);
  const project = useProject((s) => s.project);
  const siteId = useProject((s) => s.activeSiteId);
  const count = (level: PurdueLevel) => project.devices.filter((d) => d.siteId === siteId && d.purdueLevel === level).length;
  return (
    <nav className="level-tabs" aria-label="Levels">
      <button type="button" className={`level-tab__button${active === null ? ' is-active' : ''}`} aria-current={active === null ? 'page' : undefined} onClick={() => openLevel(null)}>
        Overview
      </button>
      {tabs.map((level) => {
        const lane = PURDUE_LANES.find((l) => l.level === level)!;
        const label = levelLabel(level);
        return (
          <div key={level} className={`level-tab${active === level ? ' is-active' : ''}`}>
            <button type="button" className="level-tab__button" aria-current={active === level ? 'page' : undefined} onClick={() => openLevel(level)}>
              <span className="level-tab__level">{label}</span> {lane.name}
              <span className="site-tab__count">{count(level)}</span>
            </button>
            <button type="button" className="level-tab__close" aria-label={`Close the ${label} tab`} title="Close this tab" onClick={() => closeLevelTab(level)}>
              <X size={13} />
            </button>
          </div>
        );
      })}
    </nav>
  );
}
