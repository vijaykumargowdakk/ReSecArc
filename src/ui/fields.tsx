import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { FieldDef } from '../model/schema';

/** Tags as removable chips plus an input with suggestions; Enter or comma adds, Backspace on empty removes the last. */
export function TagEditor({
  tags,
  suggestions,
  onChange,
}: {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const add = () => {
    if (!draft.trim()) return;
    onChange([...tags, draft]);
    setDraft('');
  };
  const lower = new Set(tags.map((t) => t.toLowerCase()));
  return (
    <div className="tag-editor">
      {tags.length > 0 && (
        <ul className="tag-list" aria-label="Tags">
          {tags.map((t) => (
            <li key={t} className="tag">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} title="Remove tag" onClick={() => onChange(tags.filter((x) => x !== t))}>
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="text"
        list={listId}
        value={draft}
        placeholder="Add a tag…"
        aria-label="Add a tag"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !lower.has(s.toLowerCase()))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}

/** The input for one custom field, by its kind. A choice no longer in the list stays selectable and is marked. */
export function FieldInput({
  def,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  def: FieldDef;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  if (def.kind === 'date') {
    return <input type="date" className={className} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (def.kind === 'select') {
    return (
      <select className={className} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {def.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {value && !def.options.includes(value) && <option value={value}>{value} (not in the list)</option>}
      </select>
    );
  }
  return <input type="text" className={className} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Comma-separated choices for a list field, applied when the input loses focus or Enter is pressed. */
export function OptionsInput({ options, onChange, ariaLabel }: { options: string[]; onChange: (options: string[]) => void; ariaLabel?: string }) {
  const text = options.join(', ');
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    const next = [...new Set(draft.split(',').map((o) => o.trim().slice(0, 60)).filter(Boolean))].slice(0, 100);
    if (next.join('|') !== options.join('|')) onChange(next);
    else setDraft(text);
  };
  return (
    <input
      type="text"
      value={draft}
      aria-label={ariaLabel}
      placeholder="e.g. OT team, IT team, Vendor"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

/** Text applied when the input loses focus or Enter is pressed; an empty value reverts, for names that must not be blank. */
export function NameInput({ value, onCommit, ariaLabel }: { value: string; onCommit: (value: string) => void; ariaLabel?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim().slice(0, 60);
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <input
      type="text"
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
