import { Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { DEVICE_CATALOG } from '../../model/catalog';
import { BUILTIN_CHECKS, findingDevices, type Finding, type Severity } from '../../model/checks';
import { addPolicy, describePolicy, examplePolicy, newPolicy, removePolicy, setCheckEnabled, updatePolicy } from '../../model/policies';
import { PROTOCOLS } from '../../model/protocols';
import { levelLabel, PURDUE_LANES } from '../../model/purdue';
import type { DeviceType, PolicyRule, PolicySelector, Project } from '../../model/schema';
import { useFindings } from '../../store/derived';
import { useSecurity, type SecurityTab } from '../../store/security';
import { useProject } from '../../store/useProject';
import { Field, Section, Select, TextInput, Toggle } from '../form';

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const TABS: [SecurityTab, string][] = [
  ['findings', 'Findings'],
  ['rules', 'Rules'],
];
const tabId = (tab: SecurityTab) => `security-tab-${tab}`;

/** Findings from the built-in checks and company policies, and the rules that produce them. */
export function SecurityPanel() {
  const tab = useSecurity((s) => s.tab);
  const setTab = useSecurity((s) => s.setTab);
  const close = useSecurity((s) => s.close);
  const findings = useFindings();
  const tabs = useRef<HTMLDivElement>(null);

  // Tabs follow the WAI-ARIA pattern: one Tab stop, arrow keys move between tabs.
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = TABS[(TABS.findIndex(([id]) => id === tab) + 1) % TABS.length][0];
    setTab(next);
    tabs.current?.querySelector<HTMLButtonElement>(`#${tabId(next)}`)?.focus();
  };

  return (
    <>
      <Section
        title="Security"
        actions={
          <button type="button" className="icon-button" onClick={close} title="Close the security panel">
            <X size={16} />
            <span>Close</span>
          </button>
        }
      >
        <div className="segmented" role="tablist" aria-label="Security" ref={tabs} onKeyDown={onTabKey}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="security-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              className={tab === id ? 'is-active' : ''}
              onClick={() => setTab(id)}
            >
              {id === 'findings' ? `${label} (${findings.length})` : label}
            </button>
          ))}
        </div>
      </Section>
      <div id="security-tabpanel" role="tabpanel" aria-labelledby={tabId(tab)}>
        {tab === 'findings' ? <FindingsTab findings={findings} /> : <RulesTab />}
      </div>
      <p className="muted security-footer">Design-time checks based on IEC 62443 zone and conduit principles. Not a compliance assessment.</p>
    </>
  );
}

function FindingsTab({ findings }: { findings: Finding[] }) {
  const project = useProject((s) => s.project);
  const focusItems = useProject((s) => s.focusItems);
  const setTab = useSecurity((s) => s.setTab);
  if (findings.length === 0) {
    return (
      <Section title="No findings">
        <p className="empty">
          <ShieldCheck size={16} aria-hidden="true" /> No check or policy rule reports anything in this design.
        </p>
        <button type="button" className="link-button" onClick={() => setTab('rules')}>
          Review the rules
        </button>
      </Section>
    );
  }
  const headlines = [...new Set(findings.map((f) => f.headline))];
  return (
    <>
      {headlines.map((headline) => {
        const group = findings.filter((f) => f.headline === headline);
        return (
          <Section key={headline} title={`${headline} (${group.length})`}>
            <ul className="finding-list">
              {group.map((f) => (
                <li key={f.id} className={`finding finding--${f.severity}`}>
                  <span className={`severity-tag severity-tag--${f.severity}`}>{f.severity}</span>{' '}
                  <button
                    type="button"
                    className="link-button finding__message"
                    title="Select on the canvas"
                    onClick={() => focusItems(f.items, findingDevices(project, f))}
                  >
                    {f.message}
                  </button>
                  {f.reference && <p className="finding__reference">{f.reference}</p>}
                  <p className="finding__fix">{f.fix}</p>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}

function RulesTab() {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const disabled = new Set(project.disabledChecks);
  return (
    <>
      <Section title="Built-in checks">
        <ul className="check-list">
          {BUILTIN_CHECKS.map((c) => (
            <li key={c.id}>
              <Toggle label={c.title} checked={!disabled.has(c.id)} onChange={(on) => apply((p) => setCheckEnabled(p, c.id, on))} />
              <p className="muted">
                {c.rationale} <span className="finding__reference">{c.reference}</span>
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section
        title={`Company policies (${project.policies.length})`}
        actions={
          <button type="button" className="icon-button" onClick={() => apply((p) => addPolicy(p, newPolicy()))} title="Add a company policy rule">
            <Plus size={16} />
            <span>Add</span>
          </button>
        }
      >
        <p className="muted">Each rule forbids direct links or flows between two groups of devices. Links have no direction, so a rule matches them either way round.</p>
        {project.policies.length === 0 && (
          <button type="button" className="button" onClick={() => apply((p) => addPolicy(p, examplePolicy()))}>
            <Plus size={15} /> Add example: no direct IT → OT
          </button>
        )}
        <ul className="policy-list">
          {project.policies.map((rule) => (
            <PolicyEditor key={rule.id} rule={rule} project={project} />
          ))}
        </ul>
      </Section>
    </>
  );
}

function PolicyEditor({ rule, project }: { rule: PolicyRule; project: Project }) {
  const apply = useProject((s) => s.apply);
  const patch = (p: Partial<Omit<PolicyRule, 'id'>>) => apply((q) => updatePolicy(q, rule.id, p), `policy:${rule.id}:${Object.keys(p).join(',')}`);
  return (
    <li className={`policy${rule.enabled ? '' : ' is-disabled'}`}>
      <details>
        <summary>
          <strong>{rule.name || 'Unnamed rule'}</strong>
          {!rule.enabled && <span className="muted"> (off)</span>}
          <span className="muted policy__summary">{describePolicy(rule, project)}</span>
        </summary>
        <Toggle label="Enabled" checked={rule.enabled} onChange={(enabled) => patch({ enabled })} />
        <Field label="Name">
          <TextInput value={rule.name} onChange={(name) => patch({ name })} />
        </Field>
        <Field label="Severity">
          <Select value={rule.severity} options={SEVERITIES} onChange={(severity) => patch({ severity })} />
        </Field>
        <SelectorEditor legend="From" value={rule.from} project={project} onChange={(from) => patch({ from })} />
        <SelectorEditor legend="To" value={rule.to} project={project} onChange={(to) => patch({ to })} />
        <Toggle label="Both ways" checked={rule.bothWays} onChange={(bothWays) => patch({ bothWays })} />
        <Field label="Applies to">
          <Select
            value={rule.connection}
            options={[
              { value: 'any', label: 'Links and flows' },
              { value: 'link', label: 'Network links' },
              { value: 'flow', label: 'Protocol flows' },
            ]}
            onChange={(connection) => patch({ connection })}
          />
        </Field>
        {rule.connection !== 'link' && (
          <fieldset className="choice-grid">
            <legend>Only these protocols (none ticked: any)</legend>
            {PROTOCOLS.map((p) => (
              <Toggle
                key={p.id}
                label={p.label}
                checked={rule.protocols.includes(p.id)}
                onChange={(on) => patch({ protocols: on ? [...rule.protocols, p.id] : rule.protocols.filter((x) => x !== p.id) })}
              />
            ))}
          </fieldset>
        )}
        <div className="panel-actions">
          <button type="button" className="button danger" onClick={() => apply((p) => removePolicy(p, rule.id))}>
            <Trash2 size={16} /> Delete rule
          </button>
        </div>
      </details>
    </li>
  );
}

const DEVICE_TYPES = Object.keys(DEVICE_CATALOG) as DeviceType[];

function SelectorEditor({ legend, value, project, onChange }: { legend: string; value: PolicySelector; project: Project; onChange: (v: PolicySelector) => void }) {
  const toKind = (kind: PolicySelector['kind']): PolicySelector => {
    switch (kind) {
      case 'any':
        return { kind };
      case 'levels':
        return { kind, levels: [4, 5] };
      case 'zone':
        return { kind, id: project.zones[0]?.id ?? '' };
      case 'type':
        return { kind, types: ['plc'] };
      case 'tag':
        return { kind, tag: 'tag' };
    }
  };
  const kinds: { value: PolicySelector['kind']; label: string }[] = [
    { value: 'any', label: 'Any device' },
    { value: 'levels', label: 'Purdue levels' },
    ...(project.zones.length || value.kind === 'zone' ? [{ value: 'zone' as const, label: 'Zone' }] : []),
    { value: 'type', label: 'Device types' },
    { value: 'tag', label: 'Tag' },
  ];
  return (
    <fieldset className="selector">
      <legend>{legend}</legend>
      <Field label={`${legend}: which devices`}>
        <Select value={value.kind} options={kinds} onChange={(kind) => kind !== value.kind && onChange(toKind(kind))} />
      </Field>
      {value.kind === 'levels' && (
        <div className="choice-grid">
          {PURDUE_LANES.map(({ level }) => (
            <Toggle
              key={level}
              label={levelLabel(level)}
              checked={value.levels.includes(level)}
              onChange={(on) => {
                const levels = on ? [...value.levels, level] : value.levels.filter((l) => l !== level);
                // A selector needs at least one level; unticking the last one is ignored.
                if (levels.length) onChange({ kind: 'levels', levels });
              }}
            />
          ))}
        </div>
      )}
      {value.kind === 'zone' && (
        <Field label={`${legend} zone`}>
          <Select value={value.id} options={project.zones.map((z) => ({ value: z.id, label: z.name || z.id }))} onChange={(id) => onChange({ kind: 'zone', id })} />
        </Field>
      )}
      {value.kind === 'type' && (
        <div className="choice-grid">
          {DEVICE_TYPES.map((t) => (
            <Toggle
              key={t}
              label={DEVICE_CATALOG[t].label}
              checked={value.types.includes(t)}
              onChange={(on) => {
                const types = on ? [...value.types, t] : value.types.filter((x) => x !== t);
                if (types.length) onChange({ kind: 'type', types });
              }}
            />
          ))}
        </div>
      )}
      {value.kind === 'tag' && (
        <Field label={`${legend} tag`}>
          <TextInput value={value.tag} onChange={(tag) => tag.trim() && onChange({ kind: 'tag', tag })} />
        </Field>
      )}
    </fieldset>
  );
}
