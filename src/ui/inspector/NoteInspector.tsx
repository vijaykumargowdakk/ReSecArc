import { Trash2 } from 'lucide-react';
import { NOTE_COLORS, NOTE_WIDTHS, removeNote, updateNote } from '../../model/notes';
import type { Note } from '../../model/schema';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { Field, Section, Select } from '../form';

export function NoteInspector({ note }: { note: Note }) {
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const patch = (p: Partial<Omit<Note, 'id' | 'siteId'>>) =>
    apply((q) => updateNote(q, note.id, p), `note:${note.id}:${Object.keys(p).join(',')}`);
  const widths: { value: string; label: string }[] = NOTE_WIDTHS.map((w) => ({ value: String(w.value), label: w.label }));
  if (!widths.some((w) => w.value === String(note.width))) widths.push({ value: String(note.width), label: `${note.width}px` });

  return (
    <>
      <Section title="Note">
        <p className="muted">Free text on the canvas, for legends, remarks or open questions. Double-click a note to edit it in place.</p>
        <Field label="Text">
          <textarea rows={6} value={note.text} onChange={(e) => patch({ text: e.target.value })} />
        </Field>
        <Field label="Width">
          <Select value={String(note.width)} options={widths} onChange={(v) => patch({ width: Number(v) })} />
        </Field>
        <fieldset className="color-choices">
          <legend className="field__label">Colour</legend>
          {NOTE_COLORS.map((c) => (
            <label key={c.value} className="color-choice" style={{ background: c.value }} title={c.label}>
              <input
                type="radio"
                name={`note-color-${note.id}`}
                checked={note.color === c.value}
                onChange={() => patch({ color: c.value })}
                aria-label={c.label}
              />
            </label>
          ))}
        </fieldset>
      </Section>
      <div className="panel-actions">
        <button
          type="button"
          className="button danger"
          onClick={() => {
            apply((p) => removeNote(p, note.id));
            select(NO_SELECTION);
          }}
        >
          <Trash2 size={16} />
          Delete note
        </button>
      </div>
    </>
  );
}
