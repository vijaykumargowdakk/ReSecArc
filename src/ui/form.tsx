import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { parseVlans } from '../model/ipam';
import { sectionKey, usePrefs } from '../store/prefs';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Needed when the input is not wrapped in a Field label. */
  ariaLabel?: string;
}) {
  return <input type="text" value={value} placeholder={placeholder} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * Integer input that only reports values within [min, max]; an empty field reports `null` when allowed.
 * Keeps a local draft so partial input can be typed, and reverts to the last valid value on blur.
 */
export function IntInput({
  value,
  onChange,
  min,
  max,
  allowEmpty = false,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);
  const valid = (raw: string) => {
    if (raw === '') return allowEmpty;
    const n = Number(raw);
    return Number.isInteger(n) && n >= min && n <= max;
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      placeholder={placeholder}
      aria-invalid={!valid(draft.trim())}
      onChange={(e) => {
        const raw = e.target.value.trim();
        setDraft(e.target.value);
        if (valid(raw)) onChange(raw === '' ? null : Number(raw));
      }}
      onBlur={() => setDraft(value === null ? '' : String(value))}
    />
  );
}

/** VLAN list such as "10 20" or "30-32"; reports parsed, sorted ids only when the text is valid. */
export function VlanInput({
  value,
  onChange,
  ariaLabel,
  className,
  placeholder = 'e.g. 10 or 20-22',
}: {
  value: number[];
  onChange: (v: number[]) => void;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
}) {
  const text = value.join(' ');
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const parsed = parseVlans(draft);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={parsed === null}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = parseVlans(e.target.value);
        if (next) onChange(next);
      }}
      onBlur={() => setDraft(text)}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** The button inside a section heading that folds the section away or opens it again. */
export function FoldButton({ title, open, controls, onToggle }: { title: string; open: boolean; controls: string; onToggle: () => void }) {
  return (
    <button type="button" className="fold-button" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <ChevronRight size={14} aria-hidden="true" className="fold-button__chevron" />
      {title}
    </button>
  );
}

/** Whether a folding section is open, remembered in this browser under `sectionKey(scope, title)`. */
export function useSectionOpen(scope: string, title: string): [boolean, () => void] {
  const key = sectionKey(scope, title);
  const open = usePrefs((s) => !s.collapsed.includes(key));
  return [open, () => usePrefs.getState().setSectionOpen(key, !open)];
}

/** A titled block of a side panel. The title folds it away; actions stay in reach while it is folded. */
export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const [open, toggle] = useSectionOpen('section', title);
  const body = useId();
  return (
    <section className={`panel-section${open ? '' : ' is-folded'}`}>
      <header className="panel-section__header">
        <h3>
          <FoldButton title={title} open={open} controls={body} onToggle={toggle} />
        </h3>
        {actions}
      </header>
      <div id={body} className="panel-section__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
