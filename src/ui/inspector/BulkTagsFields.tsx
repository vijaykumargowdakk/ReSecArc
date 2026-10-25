import { useId, useState } from 'react';
import { addTag, removeTag, setDeviceField, tagCounts } from '../../model/fields';
import { useProject } from '../../store/useProject';
import { FieldInput } from '../fields';
import { Field, Section } from '../form';

/** Adds or removes a tag, or sets one custom field, on every selected device at once. */
export function BulkTagsFields({ ids }: { ids: string[] }) {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const [tag, setTag] = useState('');
  const [fieldId, setFieldId] = useState(project.fieldDefs[0]?.id ?? '');
  const [value, setValue] = useState('');
  const listId = useId();
  const selected = project.devices.filter((d) => ids.includes(d.id));
  const tagsOnSelection = tagCounts({ devices: selected });
  // Falls back to the first field, so fields added while the panel is open are offered too.
  const def = project.fieldDefs.find((f) => f.id === fieldId) ?? project.fieldDefs[0];

  return (
    <Section title="Tags and custom fields">
      <Field label="Tag">
        <input type="text" list={listId} value={tag} placeholder="e.g. patch-pending" onChange={(e) => setTag(e.target.value)} />
      </Field>
      <datalist id={listId}>
        {tagCounts(project).map((t) => (
          <option key={t.tag} value={t.tag} />
        ))}
      </datalist>
      <div className="button-row">
        <button type="button" className="button" disabled={!tag.trim()} onClick={() => apply((p) => addTag(p, ids, tag))}>
          Add to all
        </button>
        <button type="button" className="button" disabled={!tag.trim()} onClick={() => apply((p) => removeTag(p, ids, tag))}>
          Remove from all
        </button>
      </div>
      {tagsOnSelection.length > 0 && (
        <p className="muted">On the selection: {tagsOnSelection.map((t) => `${t.tag} (${t.count})`).join(', ')}</p>
      )}
      {def && (
        <>
          <Field label="Custom field">
            <select value={def.id} onChange={(e) => setFieldId(e.target.value)}>
              {project.fieldDefs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value">
            <FieldInput def={def} value={value} onChange={setValue} />
          </Field>
          <button type="button" className="button" onClick={() => apply((p) => setDeviceField(p, ids, def.id, value))}>
            Set on all {ids.length}
          </button>
        </>
      )}
    </Section>
  );
}
