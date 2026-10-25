import { Plus, Trash2 } from 'lucide-react';
import { DEVICE_CATALOG, REMOTE_SERVICE_PORTS } from '../../model/catalog';
import {
  countRuleReferences,
  defaultFlow,
  removeDevice,
  removeFlow,
  removeLink,
  replaceFlow,
  updateDevice,
  updateLink,
} from '../../model/ops';
import { defaultPortFor, getProtocol, PROTOCOLS, type FieldDef, type SettingValue } from '../../model/protocols';
import { laneTop, levelLabel, PURDUE_LANES } from '../../model/purdue';
import type { Asset, Device, Flow, Link, PurdueLevel, RemoteService } from '../../model/schema';
import { useProject } from '../../store/useProject';
import { Field, IntInput, Section, Select, TextInput, Toggle } from '../form';
import { FirewallRules } from './FirewallRules';
import { ProjectPanel } from './ProjectPanel';

const LEVEL_OPTIONS = PURDUE_LANES.map((l) => ({ value: String(l.level), label: `${levelLabel(l.level)} · ${l.name}` }));
const CRITICALITY = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;
const SERVICE_OPTIONS = [
  { value: 'rdp', label: 'RDP' },
  { value: 'ssh', label: 'SSH' },
  { value: 'vnc', label: 'VNC' },
  { value: 'https', label: 'HTTPS' },
] as const;
const MEDIUM = [
  { value: 'ethernet', label: 'Ethernet' },
  { value: 'serial', label: 'Serial' },
  { value: 'wireless', label: 'Wireless' },
] as const;
const PROTOCOL_OPTIONS = PROTOCOLS.map((p) => ({ value: p.id, label: p.label }));
const ASSET_FIELDS: { key: Exclude<keyof Asset, 'notes'>; label: string; placeholder: string }[] = [
  { key: 'vendor', label: 'Vendor', placeholder: 'Manufacturer' },
  { key: 'model', label: 'Model', placeholder: 'Model or part number' },
  { key: 'firmware', label: 'Firmware', placeholder: 'Version' },
  { key: 'serial', label: 'Serial number', placeholder: '' },
  { key: 'ip', label: 'IP address', placeholder: 'e.g. 10.0.0.10' },
];

function useDeviceLabel() {
  const devices = useProject((s) => s.project.devices);
  return (id: string) => devices.find((d) => d.id === id)?.label ?? id;
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="button danger" onClick={onClick}>
      <Trash2 size={16} />
      {label}
    </button>
  );
}

function DeviceInspector({ device }: { device: Device }) {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const info = DEVICE_CATALOG[device.type];
  const patch = (p: Partial<Omit<Device, 'id' | 'type'>>) => apply((q) => updateDevice(q, device.id, p));
  const setServices = (services: RemoteService[]) => patch({ services });
  const setAsset = (p: Partial<Asset>) => patch({ asset: { ...device.asset, ...p } });

  const remove = () => {
    const refs = countRuleReferences(project, 'device', device.id);
    const warning = refs ? `\n\n${refs} firewall rule(s) refer to it and will also be removed.` : '';
    if (!window.confirm(`Delete "${device.label}" and its connections?${warning}`)) return;
    apply((q) => removeDevice(q, device.id));
    select(null);
  };

  return (
    <>
      <Section title={info.label}>
        <p className="muted">{info.variants.find((v) => v.id === device.variant)?.description ?? info.description}</p>
        <Field label="Name">
          <TextInput value={device.label} onChange={(label) => patch({ label })} />
        </Field>
        <Field label="Kind">
          <Select
            value={device.variant}
            options={info.variants.map((v) => ({ value: v.id, label: v.label }))}
            onChange={(variant) => patch({ variant })}
          />
        </Field>
        <Field label="Purdue level" hint="Changing the level moves the device into that lane.">
          <Select
            value={String(device.purdueLevel)}
            options={LEVEL_OPTIONS}
            onChange={(v) => {
              const purdueLevel = Number(v) as PurdueLevel;
              patch({ purdueLevel, position: { x: device.position.x, y: laneTop(purdueLevel) + 37 } });
            }}
          />
        </Field>
        <Field label="Security zone">
          <Select
            value={device.zoneId ?? ''}
            options={[{ value: '', label: 'No zone' }, ...project.zones.map((z) => ({ value: z.id, label: z.name }))]}
            onChange={(v) => patch({ zoneId: v === '' ? null : v })}
          />
        </Field>
        <Field label="Criticality">
          <Select value={device.criticality} options={CRITICALITY} onChange={(criticality) => patch({ criticality })} />
        </Field>
      </Section>

      <Section title="Asset details">
        <div className="asset-grid">
          {ASSET_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <TextInput value={device.asset[f.key]} placeholder={f.placeholder} onChange={(v) => setAsset({ [f.key]: v })} />
            </Field>
          ))}
        </div>
        <Field label="Notes">
          <textarea rows={3} value={device.asset.notes} onChange={(e) => setAsset({ notes: e.target.value })} />
        </Field>
      </Section>

      <Section
        title="Remote-access services"
        actions={
          <button
            type="button"
            className="icon-button"
            title="Add service"
            onClick={() => setServices([...device.services, { protocol: 'rdp', port: REMOTE_SERVICE_PORTS.rdp }])}
          >
            <Plus size={16} />
            <span>Service</span>
          </button>
        }
      >
        {device.services.length === 0 && <p className="empty">No listening remote-access services.</p>}
        <ul className="service-list">
          {device.services.map((svc, i) => (
            <li key={i}>
              <Select
                value={svc.protocol}
                options={SERVICE_OPTIONS}
                onChange={(protocol) =>
                  setServices(device.services.map((s, j) => (j === i ? { protocol, port: REMOTE_SERVICE_PORTS[protocol] } : s)))
                }
              />
              <IntInput
                value={svc.port}
                min={1}
                max={65535}
                onChange={(port) => port !== null && setServices(device.services.map((s, j) => (j === i ? { ...s, port } : s)))}
              />
              <button
                type="button"
                className="icon-button danger"
                title="Remove service"
                onClick={() => setServices(device.services.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {device.firewall && <FirewallRules device={device} />}

      <div className="panel-actions">
        <DeleteButton label="Delete device" onClick={remove} />
      </div>
    </>
  );
}

function LinkInspector({ link }: { link: Link }) {
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const name = useDeviceLabel();
  return (
    <>
      <Section title="Network link">
        <p className="endpoints">
          {name(link.source)} <span aria-hidden="true">↔</span> {name(link.target)}
        </p>
        <Field label="Medium">
          <Select value={link.medium} options={MEDIUM} onChange={(medium) => apply((p) => updateLink(p, link.id, { medium }))} />
        </Field>
      </Section>
      <div className="panel-actions">
        <DeleteButton
          label="Delete link"
          onClick={() => {
            apply((p) => removeLink(p, link.id));
            select(null);
          }}
        />
      </div>
    </>
  );
}

function SettingField({ field, value, onChange }: { field: FieldDef; value: SettingValue | undefined; onChange: (v: SettingValue) => void }) {
  if (field.kind === 'bool') return <Toggle label={field.label} checked={value === true} onChange={onChange} />;
  if (field.kind === 'enum') {
    return (
      <Field label={field.label}>
        <Select value={String(value ?? field.default)} options={field.options} onChange={onChange} />
      </Field>
    );
  }
  return (
    <Field label={field.label}>
      <TextInput value={String(value ?? '')} onChange={onChange} />
    </Field>
  );
}

function FlowInspector({ flow }: { flow: Flow }) {
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const name = useDeviceLabel();
  const def = getProtocol(flow.protocol);
  const set = (next: Flow) => apply((p) => replaceFlow(p, next));

  const setSetting = (key: string, value: SettingValue) => {
    if (!def) return;
    const settings = { ...flow.settings, [key]: value };
    // Follow the protocol's default port (e.g. 502 → 802 for TLS) unless the user chose a custom one.
    const port = flow.port === defaultPortFor(def, flow.settings) ? defaultPortFor(def, settings) : flow.port;
    set({ ...flow, settings, port });
  };

  return (
    <>
      <Section title="Protocol flow">
        <dl className="roles">
          <dt>{def?.roles.source ?? 'Source'}</dt>
          <dd>{name(flow.source)}</dd>
          <dt>{def?.roles.target ?? 'Target'}</dt>
          <dd>{name(flow.target)}</dd>
        </dl>
        <Field label="Protocol">
          <Select
            value={flow.protocol}
            options={PROTOCOL_OPTIONS}
            onChange={(protocol) => protocol !== flow.protocol && set(defaultFlow(protocol, flow.source, flow.target, flow.id))}
          />
        </Field>
        {def && def.defaultPort !== null && (
          <Field label="Port">
            <IntInput value={flow.port} min={1} max={65535} onChange={(port) => port !== null && set({ ...flow, port })} />
          </Field>
        )}
        {def?.defaultPort === null && <p className="muted">{def.label} runs at layer 2 and has no port.</p>}
        {def?.fields.map((f) => (
          <SettingField key={f.key} field={f} value={flow.settings[f.key]} onChange={(v) => setSetting(f.key, v)} />
        ))}
      </Section>
      <div className="panel-actions">
        <DeleteButton
          label="Delete flow"
          onClick={() => {
            apply((p) => removeFlow(p, flow.id));
            select(null);
          }}
        />
      </div>
    </>
  );
}

export function Inspector() {
  const project = useProject((s) => s.project);
  const selection = useProject((s) => s.selection);

  let body = <ProjectPanel />;
  if (selection?.kind === 'device') {
    const device = project.devices.find((d) => d.id === selection.id);
    if (device) body = <DeviceInspector key={device.id} device={device} />;
  } else if (selection?.kind === 'link') {
    const link = project.links.find((l) => l.id === selection.id);
    if (link) body = <LinkInspector key={link.id} link={link} />;
  } else if (selection?.kind === 'flow') {
    const flow = project.flows.find((f) => f.id === selection.id);
    if (flow) body = <FlowInspector key={flow.id} flow={flow} />;
  }

  return (
    <aside className="inspector" aria-label="Properties">
      {body}
    </aside>
  );
}
