import { Download, Plus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { ATTACK_ICS_RELEASE, ICS_TACTICS, ICS_TECHNIQUES } from '../../model/attack/icsTechniques';
import { attackPathsOf, isDefaultEntry, isDefaultTarget, isHost, pathFindings, type AttackPath, type PathOverrides, type PathReport } from '../../model/attack/paths';
import { DEVICE_CATALOG } from '../../model/catalog';
import { BUILTIN_CHECKS, findingDevices, type Finding, type Severity } from '../../model/checks';
import { addPolicy, describePolicy, examplePolicy, newPolicy, removePolicy, setCheckEnabled, updatePolicy } from '../../model/policies';
import { PROTOCOLS } from '../../model/protocols';
import { levelLabel, PURDUE_LANES } from '../../model/purdue';
import type { Device, DeviceType, PolicyRule, PolicySelector, Project } from '../../model/schema';
import { useFindings } from '../../store/derived';
import { useSecurity, type SecurityTab } from '../../store/security';
import { useProject } from '../../store/useProject';
import { exportAttackFlow } from '../actions';
import { Field, Section, Select, TextInput, Toggle } from '../form';

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const TABS: [SecurityTab, string][] = [
  ['findings', 'Findings'],
  ['paths', 'Attack paths'],
  ['rules', 'Rules'],
];
const tabId = (tab: SecurityTab) => `security-tab-${tab}`;

/** Findings from the built-in checks and company policies, and the rules that produce them. */
export function SecurityPanel() {
  const tab = useSecurity((s) => s.tab);
  const setTab = useSecurity((s) => s.setTab);
  const close = useSecurity((s) => s.close);
  const findings = useFindings();
  const project = useProject((s) => s.project);
  const overrides = useSecurity((s) => s.overrides);
  const report = attackPathsOf(project, overrides);
  const tabs = useRef<HTMLDivElement>(null);
  const counts: Partial<Record<SecurityTab, number>> = { findings: findings.length, paths: report.total };

  // Tabs follow the WAI-ARIA pattern: one Tab stop, arrow keys move between tabs.
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : TABS.length - 1;
    const next = TABS[(TABS.findIndex(([id]) => id === tab) + step) % TABS.length][0];
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
              {counts[id] === undefined ? label : `${label} (${counts[id]})`}
            </button>
          ))}
        </div>
      </Section>
      <div id="security-tabpanel" role="tabpanel" aria-labelledby={tabId(tab)}>
        {tab === 'findings' && <FindingsTab findings={findings} />}
        {tab === 'paths' && <PathsTab report={report} overrides={overrides} />}
        {tab === 'rules' && <RulesTab />}
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

const deviceName = (d: Device | undefined) => d?.label || (d ? DEVICE_CATALOG[d.type].label : 'Unknown device');

function PathsTab({ report, overrides }: { report: PathReport; overrides: PathOverrides }) {
  const project = useProject((s) => s.project);
  const focusItems = useProject((s) => s.focusItems);
  const findings = useFindings();
  const pathId = useSecurity((s) => s.pathId);
  const selectPath = useSecurity((s) => s.selectPath);
  const device = new Map(project.devices.map((d) => [d.id, d]));
  const { paths, total } = report;
  const choose = (path: AttackPath) => {
    if (pathId === path.id) return selectPath(null);
    selectPath(path.id);
    // Frames the path without selecting anything, so this panel stays open.
    focusItems({}, path.steps.map((s) => s.deviceId));
  };
  return (
    <>
      <Section
        title="MITRE ATT&CK® for ICS — possible attack paths"
        actions={
          paths.length > 0 && (
            <button
              type="button"
              className="icon-button"
              onClick={() => void exportAttackFlow(project, overrides)}
              title="Export the paths shown as a MITRE Attack Flow file (STIX 2.1)"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
          )
        }
      >
        <p className="muted">
          Possible paths based on the design, from entry points to critical devices, honouring firewall rules. They are not predictions. Each step is labelled with an ATT&CK
          for ICS tactic and technique ({ATTACK_ICS_RELEASE}).
        </p>
        {paths.length === 0 ? (
          <p className="empty">
            <ShieldCheck size={16} aria-hidden="true" /> No possible path from an entry point to a target.
          </p>
        ) : (
          <p>
            {total > paths.length ? `Showing ${paths.length} of ${total} paths` : `${total} path${total === 1 ? '' : 's'}`}, most critical targets first. Choose one to
            highlight it on the canvas.
          </p>
        )}
        <ol className="path-list">
          {paths.map((path) => {
            const relied = pathFindings(project, path, findings);
            const selected = pathId === path.id;
            return (
              <li key={path.id} className={`path${selected ? ' is-selected' : ''}`}>
                <button type="button" className="link-button path__title" aria-pressed={selected} onClick={() => choose(path)}>
                  {deviceName(device.get(path.entryId))} → {deviceName(device.get(path.targetId))}
                </button>
                <span className="muted">
                  {' '}
                  {path.steps.length - 1} {path.steps.length === 2 ? 'hop' : 'hops'}
                </span>
                <ol className="attack-chain" aria-label="Steps">
                  {[...path.steps, { ...path.impact, deviceId: path.targetId }].map((step, i) => {
                    const technique = ICS_TECHNIQUES[step.technique];
                    return (
                      <li key={i} className="attack-chip">
                        <span className="attack-chip__device">{deviceName(device.get(step.deviceId))}</span>
                        <span className="attack-chip__label">
                          {ICS_TACTICS[step.tactic].name} ·{' '}
                          <a href={technique.url} target="_blank" rel="noreferrer" title={`${technique.name} on attack.mitre.org`}>
                            {technique.id}
                          </a>
                        </span>
                        <span className="attack-chip__name">{technique.name}</span>
                      </li>
                    );
                  })}
                </ol>
                {relied.length > 0 && (
                  <p className="path__relies">Relies on: {relied.map((f) => `${f.message} (${f.source === 'policy' ? f.headline : f.checkId})`).join('; ')}</p>
                )}
                {selected && (
                  <button type="button" className="link-button" onClick={() => void exportAttackFlow(project, overrides, path.id)}>
                    Export this path (Attack Flow)
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </Section>
      <EndpointList kind="entries" title="Entry points" ids={report.entryIds} isDefault={isDefaultEntry} overrides={overrides} />
      <EndpointList kind="targets" title="Targets" ids={report.targetIds} isDefault={isDefaultTarget} overrides={overrides} />
    </>
  );
}

/** The entry points or targets in use, with controls to change them for this visit. */
function EndpointList({
  kind,
  title,
  ids,
  isDefault,
  overrides,
}: {
  kind: keyof PathOverrides;
  title: string;
  ids: string[];
  isDefault: (d: Device) => boolean;
  overrides: PathOverrides;
}) {
  const devices = useProject((s) => s.project.devices);
  const setOverride = useSecurity((s) => s.setOverride);
  const device = new Map(devices.map((d) => [d.id, d]));
  const inUse = new Set(ids);
  const changed = Object.keys(overrides[kind]).filter((id) => device.has(id));
  // Setting a device back to its default drops the override instead of storing it.
  const set = (d: Device, on: boolean) => setOverride(kind, d.id, on === isDefault(d) ? undefined : on);
  const addable = devices.filter((d) => isHost(d) && !inUse.has(d.id));
  const lower = title.toLowerCase();
  return (
    <Section
      title={`${title} (${ids.length})`}
      actions={
        changed.length > 0 && (
          <button type="button" className="icon-button" onClick={() => changed.forEach((id) => setOverride(kind, id, undefined))} title={`Go back to the default ${lower}`}>
            <RotateCcw size={16} />
            <span>Defaults</span>
          </button>
        )
      }
    >
      <details>
        <summary>{kind === 'entries' ? 'Where an attacker could start' : 'What an attacker could aim for'}</summary>
        <p className="muted">
          {kind === 'entries'
            ? 'By default: internet connections, wireless access points, jump hosts, every L4–L5 host, and hosts at L3.5 or above that offer a remote service.'
            : 'By default: safety systems, PLCs, RTUs, and other high-criticality devices at L1–L2.'}{' '}
          Changes here last for this visit and are not saved in the project file.
        </p>
        <ul className="endpoint-list">
          {ids.map((id) => {
            const d = device.get(id)!;
            return (
              <li key={id}>
                <span>
                  {deviceName(d)}
                  {overrides[kind][id] === true && <span className="muted"> (added)</span>}
                </span>
                <button type="button" className="icon-button" onClick={() => set(d, false)} aria-label={`Remove ${deviceName(d)} from the ${lower}`} title="Remove">
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
        {addable.length > 0 && (
          <Field label={kind === 'entries' ? 'Add an entry point' : 'Add a target'}>
            <Select
              value=""
              options={[{ value: '', label: 'Choose a device…' }, ...addable.map((d) => ({ value: d.id, label: deviceName(d) }))]}
              onChange={(id) => id && set(device.get(id)!, true)}
            />
          </Field>
        )}
      </details>
    </Section>
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
