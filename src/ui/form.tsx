import { useEffect, useState, type ReactNode } from 'react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
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

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel-section">
      <header className="panel-section__header">
        <h3>{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}
