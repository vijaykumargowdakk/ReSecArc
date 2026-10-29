import { Plus, Trash2 } from 'lucide-react';
import { DEVICE_CATALOG, REMOTE_SERVICE_PORTS } from '../../model/catalog';
import { lazy, Suspense, useEffect, useId, useState } from 'react';
import {
  addFlow,
  addLink,
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
import { useComparison } from '../../store/compare';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { deleteDeviceAfterConfirm } from '../actions';
import { DevicePicker } from '../DevicePicker';
import { FieldInput, TagEditor } from '../fields';
import { setDeviceField, setTags, tagCounts } from '../../model/fields';
import { removeNote } from '../../model/notes';
import { moveDevicesToSite } from '../../model/structure';
import { AddressInfo } from './AddressInfo';
import { Field, IntInput, Section, Select, TextInput, Toggle, VlanInput } from '../form';
import { IssueList } from './AddressInfo';
import { useFindingsByItem, useLinkIssues } from '../../store/derived';
import { usePrefs } from '../../store/prefs';
import { useSecurity } from '../../store/security';
import { PanelEdge, PanelHeader } from '../PanelChrome';
import { ProjectPanel } from './ProjectPanel';

// Panels for less common selections load on first use, keeping them out of the startup bundle.
const AreaInspector = lazy(() => import('./AreaInspector').then((m) => ({ default: m.AreaInspector })));
const BulkInspector = lazy(() => import('./BulkInspector').then((m) => ({ default: m.BulkInspector })));
const ChangesPanel = lazy(() => import('./ChangesPanel').then((m) => ({ default: m.ChangesPanel })));
const FirewallRules = lazy(() => import('./FirewallRules').then((m) => ({ default: m.FirewallRules })));
const NoteInspector = lazy(() => import('./NoteInspector').then((m) => ({ default: m.NoteInspector })));
const SecurityPanel = lazy(() => import('../security/SecurityPanel').then((m) => ({ default: m.SecurityPanel })));

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

/** The security findings that concern one device, link or flow, as a section of its inspector. */
function SecurityFindings({ id }: { id: string }) {
  const findings = useFindingsByItem().get(id) ?? [];
  const show = useSecurity((s) => s.show);
  const select = useProject((s) => s.select);
  if (findings.length === 0) return null;
  return (
    <Section title={`Security findings (${findings.length})`}>
      <IssueList issues={findings.map((f) => `${f.headline}: ${f.message}${f.reference ? ` (${f.reference})` : ''}`)} />
      <button
        type="button"
        className="link-button"
        onClick={() => {
          show('findings');
          select(NO_SELECTION);
        }}
      >
        Show all findings
      </button>
    </Section>
  );
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
  const focusDevice = useProject((s) => s.focusDevice);
  const info = DEVICE_CATALOG[device.type];
  const patch = (p: Partial<Omit<Device, 'id' | 'type'>>) =>
    apply((q) => updateDevice(q, device.id, p), `device:${device.id}:${Object.keys(p).join(',')}`);
  const setServices = (services: RemoteService[]) => patch({ services });
  const setAsset = (p: Partial<Asset>) =>
    apply((q) => updateDevice(q, device.id, { asset: { ...device.asset, ...p } }), `device:${device.id}:asset:${Object.keys(p).join(',')}`);

  const remove = () => deleteDeviceAfterConfirm(device.id);

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
        {project.sites.length > 1 && (
          <Field label="Site">
            <Select
              value={device.siteId}
              options={project.sites.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(siteId) => {
                apply((q) => moveDevicesToSite(q, [device.id], siteId));
                focusDevice(device.id);
              }}
            />
          </Field>
        )}
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
        <Toggle label="Locked (cannot be moved)" checked={device.locked} onChange={(locked) => patch({ locked })} />
      </Section>

      <Section title="Asset details">
        <div className="asset-grid">
          {ASSET_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <TextInput value={device.asset[f.key]} placeholder={f.placeholder} onChange={(v) => setAsset({ [f.key]: v })} />
            </Field>
          ))}
        </div>
        <AddressInfo device={device} />
        <Field label="Notes">
          <textarea rows={3} value={device.asset.notes} onChange={(e) => setAsset({ notes: e.target.value })} />
        </Field>
      </Section>

      <Section title="Tags and custom fields">
        <TagEditor tags={device.tags} suggestions={tagCounts(project).map((t) => t.tag)} onChange={(tags) => apply((q) => setTags(q, device.id, tags))} />
        {project.fieldDefs.map((def) => (
          <Field key={def.id} label={def.label}>
            <FieldInput def={def} value={device.fields[def.id] ?? ''} onChange={(v) => apply((q) => setDeviceField(q, [device.id], def.id, v), `device:${device.id}:field:${def.id}`)} />
          </Field>
        ))}
        {project.fieldDefs.length === 0 && <p className="muted">Custom fields are defined in the project panel (click empty canvas).</p>}
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

      <ConnectSection device={device} />

      {device.firewall && <FirewallRules device={device} />}

      <SecurityFindings id={device.id} />
      <div className="panel-actions">
        <DeleteButton label="Delete device" onClick={remove} />
      </div>
    </>
  );
}

function ConnectSection({ device }: { device: Device }) {
  const apply = useProject((s) => s.apply);
  const flowProtocol = useProject((s) => s.flowProtocol);
  const [mode, setMode] = useState<'link' | 'flow' | null>(null);
  return (
    <Section title="Connect">
      <div className="button-row">
        <button type="button" className={`button${mode === 'link' ? ' is-active' : ''}`} aria-pressed={mode === 'link'} onClick={() => setMode(mode === 'link' ? null : 'link')}>
          Link to…
        </button>
        <button type="button" className={`button${mode === 'flow' ? ' is-active' : ''}`} aria-pressed={mode === 'flow'} onClick={() => setMode(mode === 'flow' ? null : 'flow')}>
          Flow to…
        </button>
      </div>
      {mode && (
        <DevicePicker
          excludeId={device.id}
          siteId={device.siteId}
          label={mode === 'link' ? `Link ${device.label} to` : `Flow from ${device.label} to`}
          onPick={(target) => {
            if (mode === 'link') apply((p) => addLink(p, device.id, target));
            else apply((p) => addFlow(p, defaultFlow(flowProtocol, device.id, target)));
            setMode(null);
          }}
        />
      )}
    </Section>
  );
}

/** "Straighten" for a link or flow that has bend points; drawn only when there are some. */
function BendPoints({ count, onStraighten }: { count: number; onStraighten: () => void }) {
  if (count === 0) return <p className="muted">Double-click the line on the canvas to add a bend point.</p>;
  return (
    <div className="button-row">
      <span className="muted">
        {count} bend point{count === 1 ? '' : 's'}
      </span>
      <button type="button" className="button" onClick={onStraighten}>
        Straighten
      </button>
    </div>
  );
}

function LinkInspector({ link }: { link: Link }) {
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const networks = useProject((s) => s.project.networks);
  const issues = useLinkIssues().get(link.id) ?? [];
  const name = useDeviceLabel();
  const patch = (p: Partial<Omit<Link, 'id' | 'source' | 'target'>>) =>
    apply((q) => updateLink(q, link.id, p), `link:${link.id}:${Object.keys(p).join(',')}`);
  return (
    <>
      <Section title="Network link">
        <p className="endpoints">
          {name(link.source)} <span aria-hidden="true">↔</span> {name(link.target)}
        </p>
        <Field label="Medium">
          <Select value={link.medium} options={MEDIUM} onChange={(medium) => patch({ medium })} />
        </Field>
        <BendPoints count={link.waypoints.length} onStraighten={() => patch({ waypoints: [] })} />
      </Section>
      <Section title="Interfaces">
        <div className="asset-grid">
          <Field label={`Port at ${name(link.source)}`}>
            <TextInput value={link.sourcePort} placeholder="e.g. Gi1/0/12" onChange={(sourcePort) => patch({ sourcePort })} />
          </Field>
          <Field label={`Port at ${name(link.target)}`}>
            <TextInput value={link.targetPort} placeholder="e.g. X1" onChange={(targetPort) => patch({ targetPort })} />
          </Field>
        </div>
        <Field label="VLANs" hint="One for an access port, several for a trunk.">
          <VlanInput value={link.vlans} onChange={(vlans) => patch({ vlans })} />
        </Field>
        <Field label="Network">
          <Select
            value={link.networkId ?? ''}
            options={[{ value: '', label: 'Not set' }, ...networks.map((n) => ({ value: n.id, label: `${n.name || n.cidr} (${n.cidr})` }))]}
            onChange={(v) => patch({ networkId: v || null })}
          />
        </Field>
        <IssueList issues={issues} />
      </Section>
      <SecurityFindings id={link.id} />
      <div className="panel-actions">
        <DeleteButton
          label="Delete link"
          onClick={() => {
            apply((p) => removeLink(p, link.id));
            select(NO_SELECTION);
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
  const set = (next: Flow, key?: string) => apply((p) => replaceFlow(p, next), key && `flow:${flow.id}:${key}`);

  const setSetting = (key: string, value: SettingValue) => {
    if (!def) return;
    const settings = { ...flow.settings, [key]: value };
    // Follow the protocol's default port (e.g. 502 → 802 for TLS) unless the user chose a custom one.
    const port = flow.port === defaultPortFor(def, flow.settings) ? defaultPortFor(def, settings) : flow.port;
    set({ ...flow, settings, port }, key);
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
        {def && (def.defaultPort !== null || def.portOptional) && (
          <Field label="Port" hint={def.portOptional ? 'Optional' : undefined}>
            <IntInput
              value={flow.port}
              min={1}
              max={65535}
              allowEmpty={def.portOptional}
              onChange={(port) => (port !== null || def.portOptional) && set({ ...flow, port }, 'port')}
            />
          </Field>
        )}
        {def && def.defaultPort === null && !def.portOptional && <p className="muted">{def.label} runs at layer 2 and has no port.</p>}
        {def?.fields.map((f) => (
          <SettingField key={f.key} field={f} value={flow.settings[f.key]} onChange={(v) => setSetting(f.key, v)} />
        ))}
        <BendPoints count={flow.waypoints.length} onStraighten={() => set({ ...flow, waypoints: [] })} />
      </Section>
      <SecurityFindings id={flow.id} />
      <div className="panel-actions">
        <DeleteButton
          label="Delete flow"
          onClick={() => {
            apply((p) => removeFlow(p, flow.id));
            select(NO_SELECTION);
          }}
        />
      </div>
    </>
  );
}

export function Inspector() {
  const project = useProject((s) => s.project);
  const selection = useProject((s) => s.selection);
  const select = useProject((s) => s.select);
  const apply = useProject((s) => s.apply);
  const count =
    selection.devices.length + selection.links.length + selection.flows.length + selection.areas.length + selection.notes.length;

  const comparison = useComparison();
  const securityOpen = useSecurity((s) => s.open);
  const bodyId = useId();
  // Opening the Security panel is a request to see it, so a folded properties panel opens too.
  useEffect(() => {
    if (securityOpen) usePrefs.getState().setPanelOpen('inspector', true);
  }, [securityOpen]);
  let body = securityOpen ? <SecurityPanel /> : comparison ? <ChangesPanel comparison={comparison} /> : <ProjectPanel />;
  if (selection.devices.length > 1) {
    body = <BulkInspector ids={selection.devices} />;
  } else if (count === 1) {
    const device = project.devices.find((d) => d.id === selection.devices[0]);
    const link = project.links.find((l) => l.id === selection.links[0]);
    const flow = project.flows.find((f) => f.id === selection.flows[0]);
    const area = project.areas.find((a) => a.id === selection.areas[0]);
    const note = project.notes.find((n) => n.id === selection.notes[0]);
    if (device) body = <DeviceInspector key={device.id} device={device} />;
    else if (area) body = <AreaInspector key={area.id} area={area} />;
    else if (link) body = <LinkInspector key={link.id} link={link} />;
    else if (flow) body = <FlowInspector key={flow.id} flow={flow} />;
    else if (note) body = <NoteInspector key={note.id} note={note} />;
  } else if (count > 1) {
    body = (
      <>
        <Section title={`${count} items selected`}>
          <p className="muted">Select a single item to edit it, or several devices to edit them together.</p>
        </Section>
        <div className="panel-actions">
          <DeleteButton
            label="Delete selected"
            onClick={() => {
              apply((p) => {
                const q = selection.flows.reduce(removeFlow, selection.links.reduce(removeLink, p));
                return selection.notes.reduce(removeNote, selection.devices.reduce(removeDevice, q));
              });
              select(NO_SELECTION);
            }}
          />
        </div>
      </>
    );
  }

  return (
    <aside className="inspector" aria-label="Properties">
      <PanelHeader panel="inspector" bodyId={bodyId} />
      <div id={bodyId} className="panel-body inspector__body">
        <Suspense fallback={<p className="muted inspector__loading">Loading…</p>}>{body}</Suspense>
      </div>
      <PanelEdge panel="inspector" />
    </aside>
  );
}
