import { GitCompareArrows, History, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { removeRevision, renameRevision, restoreRevision, saveRevision } from '../../model/revisions';
import { announce } from '../../store/announcer';
import { useCompare } from '../../store/compare';
import { useProject } from '../../store/useProject';
import { Section, TextInput } from '../form';

export const revisionTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Named snapshots of the design, stored in the project file, that the live design can be compared with or restored to. */
export function RevisionsSection() {
  const revisions = useProject((s) => s.project.revisions);
  const apply = useProject((s) => s.apply);
  const comparingId = useCompare((s) => s.revisionId);
  const compareWith = useCompare((s) => s.compareWith);
  const [name, setName] = useState('');

  const save = () => {
    apply((p) => saveRevision(p, name));
    announce(`Revision ${name.trim() || 'saved'}`);
    setName('');
  };

  return (
    <Section title="Revisions">
      <p className="muted">Save the design as it is now, then compare later changes with it. Revisions are saved inside the project file.</p>
      <form
        className="revision__save"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input type="text" value={name} placeholder={`Revision ${revisions.length + 1}`} aria-label="Revision name" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="button">
          <Save size={15} /> Save revision
        </button>
      </form>
      {revisions.length === 0 && <p className="empty">No revisions yet.</p>}
      <ul className="revision-list">
        {[...revisions].reverse().map((r) => {
          const comparing = r.id === comparingId;
          return (
            <li key={r.id} className={`revision${comparing ? ' is-comparing' : ''}`}>
              <TextInput value={r.name} ariaLabel="Revision name" onChange={(v) => apply((p) => renameRevision(p, r.id, v), `revision:${r.id}:name`)} />
              <p className="muted revision__date">Saved {revisionTime.format(new Date(r.createdAt))}</p>
              <div className="button-row">
                <button type="button" className={`button${comparing ? ' is-active' : ''}`} aria-pressed={comparing} onClick={() => compareWith(comparing ? null : r.id)}>
                  <GitCompareArrows size={15} /> {comparing ? 'Stop comparing' : 'Compare'}
                </button>
                <button
                  type="button"
                  className="button"
                  title="Replace the current design with this revision. Undo reverses it."
                  onClick={() => {
                    if (!window.confirm(`Replace the current design with “${r.name}”? You can undo this.`)) return;
                    apply((p) => restoreRevision(p, r.id));
                    announce(`Restored ${r.name}`);
                  }}
                >
                  <History size={15} /> Restore
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Delete revision ${r.name}`}
                  title="Delete revision"
                  onClick={() => {
                    if (!window.confirm(`Delete the revision “${r.name}”?`)) return;
                    if (comparing) compareWith(null);
                    apply((p) => removeRevision(p, r.id));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
