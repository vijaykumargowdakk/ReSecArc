import { FileDown, X } from 'lucide-react';
import { changesToMarkdown, ITEM_ORDER, itemTitle, type Change } from '../../model/revisions';
import { useCompare, type Comparison } from '../../store/compare';
import { useProject } from '../../store/useProject';
import { downloadText, slug } from '../download';
import { Section, Toggle } from '../form';
import { revisionTime } from './format';

/** The change list between the compared revision and the live design. */
export function ChangesPanel({ comparison }: { comparison: Comparison }) {
  const projectName = useProject((s) => s.project.name);
  const devices = useProject((s) => s.project.devices);
  const focusDevice = useProject((s) => s.focusDevice);
  const hideMoves = useCompare((s) => s.hideMoves);
  const setHideMoves = useCompare((s) => s.setHideMoves);
  const compareWith = useCompare((s) => s.compareWith);
  const { revision, changes, all } = comparison;
  const count = (kind: Change['change']) => changes.filter((c) => c.change === kind).length;
  const moves = all.length - changes.length;
  const deviceIds = new Set(devices.map((d) => d.id));

  return (
    <>
      <Section
        title="Changes"
        actions={
          <button type="button" className="icon-button" onClick={() => compareWith(null)} title="Stop comparing">
            <X size={16} />
            <span>Stop</span>
          </button>
        }
      >
        <p className="muted">
          Since <strong>{revision.name}</strong>, saved {revisionTime.format(new Date(revision.createdAt))}.
        </p>
        <p className="change-summary">
          <span className="change-tag change-tag--added">{count('added')} added</span>
          <span className="change-tag change-tag--changed">{count('changed')} changed</span>
          <span className="change-tag change-tag--removed">{count('removed')} removed</span>
        </p>
        <Toggle label={`Hide moves on the canvas${moves && hideMoves ? ` (${moves} hidden)` : ''}`} checked={hideMoves} onChange={setHideMoves} />
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() =>
              downloadText(`${slug(projectName)}-changes.md`, changesToMarkdown(changes, revision.name, `${projectName} (current)`), 'text/markdown')
            }
          >
            <FileDown size={15} /> Change record (Markdown)
          </button>
        </div>
        {changes.length === 0 && <p className="empty">The design matches this revision.</p>}
      </Section>
      {ITEM_ORDER.map((kind) => {
        const group = changes.filter((c) => c.item === kind);
        if (group.length === 0) return null;
        return (
          <Section key={kind} title={`${itemTitle(kind)} (${group.length})`}>
            <ul className="change-list">
              {group.map((c) => (
                <li key={`${c.item}|${c.id}|${c.change}`}>
                  <span className={`change-tag change-tag--${c.change}`}>{c.change}</span>{' '}
                  {c.item === 'device' && c.change !== 'removed' && deviceIds.has(c.id) ? (
                    <button type="button" className="link-button" onClick={() => focusDevice(c.id)}>
                      {c.label}
                    </button>
                  ) : (
                    c.label
                  )}
                  {c.details.length > 0 && (
                    <ul>
                      {c.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}
