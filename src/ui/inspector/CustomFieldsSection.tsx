import { Plus, Trash2 } from 'lucide-react';
import { addFieldDef, countFieldValues, createFieldDef, FIELD_KINDS, removeFieldDef, updateFieldDef } from '../../model/fields';
import type { FieldDef } from '../../model/schema';
import { useProject } from '../../store/useProject';
import { NameInput, OptionsInput } from '../fields';
import { Field, Section, Select } from '../form';

/** Defines the project's own device attributes, such as owner, cabinet or support end date. */
export function CustomFieldsSection() {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const patch = (id: string, p: Partial<Omit<FieldDef, 'id'>>) => apply((q) => updateFieldDef(q, id, p), `field:${id}:${Object.keys(p).join(',')}`);

  const remove = (def: FieldDef) => {
    const used = countFieldValues(project, def.id);
    if (used && !window.confirm(`Delete the field "${def.label}"? ${used} device(s) have a value for it, which will be removed.`)) return;
    apply((q) => removeFieldDef(q, def.id));
  };

  return (
    <Section
      title="Custom fields"
      actions={
        <button
          type="button"
          className="icon-button"
          title="Add custom field"
          aria-label="Add custom field"
          onClick={() => apply((q) => addFieldDef(q, createFieldDef(`Field ${q.fieldDefs.length + 1}`)))}
        >
          <Plus size={16} />
          <span>Field</span>
        </button>
      }
    >
      {project.fieldDefs.length === 0 && (
        <p className="empty">Add your own device attributes, such as owner, cabinet or support end date. They appear on every device and in the inventory.</p>
      )}
      <ul className="network-list">
        {project.fieldDefs.map((def) => (
          <li key={def.id} className="network">
            <div className="zone__row">
              <NameInput value={def.label} ariaLabel="Field name" onCommit={(label) => patch(def.id, { label })} />
              <button type="button" className="icon-button danger" aria-label={`Delete field ${def.label}`} title="Delete field" onClick={() => remove(def)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Kind">
              <Select value={def.kind} options={FIELD_KINDS} onChange={(kind) => patch(def.id, { kind })} />
            </Field>
            {def.kind === 'select' && (
              <Field label="Choices, separated by commas">
                <OptionsInput options={def.options} onChange={(options) => patch(def.id, { options })} />
              </Field>
            )}
            <p className="muted network__usage">{countFieldValues(project, def.id)} device(s) have a value</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
