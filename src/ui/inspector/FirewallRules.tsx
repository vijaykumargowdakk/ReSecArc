import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PORTS } from '../../model/catalog';
import { addRule, moveRule, removeRule, setDefaultAction, updateRule } from '../../model/ops';
import type { Device, FirewallRule, Project, RuleEndpoint, RuleProtocol } from '../../model/schema';
import { useProject } from '../../store/useProject';
import { Field, IntInput, Section, Select, TextInput } from '../form';

const PROTOCOLS: { value: RuleProtocol; label: string }[] = [
  { value: 'any', label: 'Any protocol' },
  { value: 'modbus', label: 'Modbus' },
  { value: 'dnp3', label: 'DNP3' },
  { value: 'rdp', label: 'RDP' },
  { value: 'ssh', label: 'SSH' },
  { value: 'vnc', label: 'VNC' },
  { value: 'https', label: 'HTTPS' },
];

const ACTIONS = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
] as const;

function encode(ep: RuleEndpoint): string {
  return ep.kind === 'any' ? 'any' : `${ep.kind}:${ep.id}`;
}

function decode(value: string): RuleEndpoint {
  if (value === 'any') return { kind: 'any' };
  const [kind, ...rest] = value.split(':');
  return { kind: kind === 'zone' ? 'zone' : 'device', id: rest.join(':') };
}

function defaultPort(protocol: RuleProtocol): number | null {
  if (protocol === 'any') return null;
  if (protocol === 'modbus') return DEFAULT_PORTS.modbus.tcp;
  return DEFAULT_PORTS[protocol];
}

function EndpointSelect({ value, project, onChange }: { value: RuleEndpoint; project: Project; onChange: (ep: RuleEndpoint) => void }) {
  return (
    <select value={encode(value)} onChange={(e) => onChange(decode(e.target.value))}>
      <option value="any">Any</option>
      {project.zones.length > 0 && (
        <optgroup label="Zones">
          {project.zones.map((z) => (
            <option key={z.id} value={`zone:${z.id}`}>
              {z.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Devices">
        {project.devices.map((d) => (
          <option key={d.id} value={`device:${d.id}`}>
            {d.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function FirewallRules({ device }: { device: Device }) {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const firewall = device.firewall;
  if (!firewall) return null;

  const update = (rule: FirewallRule) => apply((p) => updateRule(p, device.id, rule));

  return (
    <Section
      title="Firewall rules"
      actions={
        <button type="button" className="icon-button" onClick={() => apply((p) => addRule(p, device.id))} title="Add rule">
          <Plus size={16} />
          <span>Rule</span>
        </button>
      }
    >
      <p className="muted">Rules are evaluated top to bottom; the first match applies.</p>
      {firewall.rules.length === 0 && <p className="empty">No rules yet.</p>}
      <ol className="rule-list">
        {firewall.rules.map((rule, index) => (
          <li key={rule.id} className={`rule rule--${rule.action}`}>
            <div className="rule__head">
              <span className="rule__index">#{index + 1}</span>
              <Select value={rule.action} options={ACTIONS} onChange={(action) => update({ ...rule, action })} />
              <span className="rule__tools">
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  onClick={() => apply((p) => moveRule(p, device.id, rule.id, -1))}
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === firewall.rules.length - 1}
                  onClick={() => apply((p) => moveRule(p, device.id, rule.id, 1))}
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => apply((p) => removeRule(p, device.id, rule.id))}
                  title="Delete rule"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
            <div className="rule__grid">
              <Field label="Source">
                <EndpointSelect value={rule.src} project={project} onChange={(src) => update({ ...rule, src })} />
              </Field>
              <Field label="Destination">
                <EndpointSelect value={rule.dst} project={project} onChange={(dst) => update({ ...rule, dst })} />
              </Field>
              <Field label="Protocol">
                <Select
                  value={rule.protocol}
                  options={PROTOCOLS}
                  onChange={(protocol) => update({ ...rule, protocol, port: defaultPort(protocol) })}
                />
              </Field>
              <Field label="Port">
                <IntInput
                  value={rule.port}
                  min={1}
                  max={65535}
                  allowEmpty
                  placeholder="any"
                  onChange={(port) => update({ ...rule, port })}
                />
              </Field>
            </div>
            <Field label="Note">
              <TextInput value={rule.note} placeholder="Why this rule exists" onChange={(note) => update({ ...rule, note })} />
            </Field>
          </li>
        ))}
      </ol>
      <Field label="When no rule matches">
        <Select value={firewall.defaultAction} options={ACTIONS} onChange={(a) => apply((p) => setDefaultAction(p, device.id, a))} />
      </Field>
    </Section>
  );
}
