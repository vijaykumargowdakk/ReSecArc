import { ArrowDownUp, Crosshair, Download, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEVICE_CATALOG, kindLabel } from '../model/catalog';
import { addressesToCsv, addressRows, devicesToCsv, endpointName, flowsToCsv, rulesToCsv } from '../model/csv';
import { addressReport, addressSortKey, deviceAddresses } from '../model/ipam';
import { removeDevice, updateDevice } from '../model/ops';
import { flowLabel, getProtocol } from '../model/protocols';
import { laneTop, levelLabel, PURDUE_LANES } from '../model/purdue';
import type { Asset, Device, PurdueLevel } from '../model/schema';
import { NO_SELECTION, useProject } from '../store/useProject';
import { downloadText, slug } from './download';
import { DeviceIcon } from './icons';
import { ImportDialog } from './ImportDialog';

type Tab = 'devices' | 'flows' | 'rules' | 'addresses';
type SortKey = 'name' | 'kind' | 'level' | 'zone' | 'site' | 'ip' | 'vendor' | 'model' | 'firmware' | 'criticality';

const CRITICALITY = ['low', 'medium', 'high'] as const;

function Cell({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="text" className="cell-input" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

export function Inventory({ onShowDevice, onShowFlow }: { onShowDevice: (id: string) => void; onShowFlow: (id: string) => void }) {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const [tab, setTab] = useState<Tab>('devices');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'level', dir: -1 });
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [importing, setImporting] = useState(false);

  const zoneName = useMemo(() => new Map(project.zones.map((z) => [z.id, z.name])), [project.zones]);
  const siteName = useMemo(() => new Map(project.sites.map((s) => [s.id, s.name])), [project.sites]);
  const deviceName = useMemo(() => new Map(project.devices.map((d) => [d.id, d.label])), [project.devices]);
  const report = useMemo(() => addressReport(project), [project]);
  const addresses = useMemo(() => (tab === 'addresses' ? addressRows(project) : []), [project, tab]);

  const devices = useMemo(() => {
    const sortValue = (d: Device, key: SortKey): string | number => {
      switch (key) {
      case 'name':
        return d.label.toLowerCase();
      case 'kind':
        return kindLabel(d.type, d.variant);
      case 'level':
        return d.purdueLevel;
      case 'zone':
        return d.zoneId ? (zoneName.get(d.zoneId) ?? '') : '';
      case 'site':
        return siteName.get(d.siteId) ?? '';
      case 'criticality':
        return CRITICALITY.indexOf(d.criticality);
      case 'ip':
        return addressSortKey(deviceAddresses(d)[0] ?? '');
        default:
          return d.asset[key].toLowerCase();
      }
    };
    const q = query.trim().toLowerCase();
    return project.devices
      .filter((d) => !q || [d.label, kindLabel(d.type, d.variant), d.asset.ip, d.asset.vendor, d.asset.model].join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        const x = sortValue(a, sort.key);
        const y = sortValue(b, sort.key);
        return (x < y ? -1 : x > y ? 1 : a.label.localeCompare(b.label)) * sort.dir;
      });
  }, [project.devices, query, sort, zoneName, siteName]);

  const patch = (d: Device, p: Partial<Omit<Device, 'id' | 'type'>>, field: string) =>
    apply((q) => updateDevice(q, d.id, p), `device:${d.id}:${field}`);
  const setAsset = (d: Device, key: keyof Asset, value: string) => patch(d, { asset: { ...d.asset, [key]: value } }, `asset:${key}`);

  const header = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label}
        {sort.key === key && <ArrowDownUp size={12} aria-hidden="true" />}
      </button>
    </th>
  );

  const exportCsv = () => {
    const name = slug(project.name);
    if (tab === 'devices') downloadText(`${name}-devices.csv`, devicesToCsv(project), 'text/csv');
    else if (tab === 'flows') downloadText(`${name}-flows.csv`, flowsToCsv(project), 'text/csv');
    else if (tab === 'addresses') downloadText(`${name}-ip-plan.csv`, addressesToCsv(project), 'text/csv');
    else downloadText(`${name}-firewall-rules.csv`, rulesToCsv(project), 'text/csv');
  };

  const rules = project.devices.flatMap((fw) => (fw.firewall?.rules ?? []).map((r, i) => ({ fw, r, i })));

  return (
    <section className="inventory" aria-label="Inventory">
      <div className="inventory__bar">
        <div className="segmented" role="tablist" aria-label="Inventory tables">
          {(
            [
              ['devices', `Devices (${project.devices.length})`],
              ['flows', `Flows (${project.flows.length})`],
              ['rules', `Firewall rules (${rules.length})`],
              ['addresses', 'IP plan'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'devices' && (
          <input type="search" className="inventory__search" placeholder="Filter devices…" aria-label="Filter devices" value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        <span className="inventory__spacer" />
        {tab === 'devices' && checked.size > 0 && (
          <button
            type="button"
            className="button danger"
            onClick={() => {
              if (!window.confirm(`Delete ${checked.size} device(s) and their connections?`)) return;
              apply((p) => [...checked].reduce(removeDevice, p));
              setChecked(new Set());
              select(NO_SELECTION);
            }}
          >
            <Trash2 size={15} /> Delete {checked.size}
          </button>
        )}
        {tab !== 'addresses' && (
          <button type="button" className="button" onClick={() => setImporting(true)}>
            <Upload size={15} /> Import CSV
          </button>
        )}
        <button type="button" className="button" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="inventory__table-wrap">
        {tab === 'devices' && (
          <table className="inventory__table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    aria-label="Select all devices"
                    checked={devices.length > 0 && devices.every((d) => checked.has(d.id))}
                    onChange={(e) => setChecked(e.target.checked ? new Set(devices.map((d) => d.id)) : new Set())}
                  />
                </th>
                {header('name', 'Name')}
                {header('kind', 'Kind')}
                {header('level', 'Level')}
                {header('zone', 'Zone')}
                {project.sites.length > 1 && header('site', 'Site')}
                {header('ip', 'IP')}
                {header('vendor', 'Vendor')}
                {header('model', 'Model')}
                {header('firmware', 'Firmware')}
                {header('criticality', 'Criticality')}
                <th>
                  <span className="sr-only">Show</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className={checked.has(d.id) ? 'is-checked' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${d.label}`}
                      checked={checked.has(d.id)}
                      onChange={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.id)) next.delete(d.id);
                          else next.add(d.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="col-name">
                    <DeviceIcon type={d.type} variant={d.variant} size={22} />
                    <Cell value={d.label} label="Name" onChange={(label) => patch(d, { label }, 'label')} />
                  </td>
                  <td>
                    <select value={d.variant} aria-label="Kind" onChange={(e) => patch(d, { variant: e.target.value }, 'variant')}>
                      {DEVICE_CATALOG[d.type].variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.id === 'generic' ? DEVICE_CATALOG[d.type].label : v.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={String(d.purdueLevel)}
                      aria-label="Purdue level"
                      onChange={(e) => {
                        const purdueLevel = Number(e.target.value) as PurdueLevel;
                        patch(d, { purdueLevel, position: { x: d.position.x, y: laneTop(purdueLevel) + 37 } }, 'level');
                      }}
                    >
                      {PURDUE_LANES.map((l) => (
                        <option key={l.level} value={l.level}>
                          {levelLabel(l.level)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={d.zoneId ?? ''} aria-label="Zone" onChange={(e) => patch(d, { zoneId: e.target.value || null }, 'zone')}>
                      <option value="">—</option>
                      {project.zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  {project.sites.length > 1 && <td>{siteName.get(d.siteId)}</td>}
                  <td>
                    <span className="cell-with-flag">
                      <Cell value={d.asset.ip} label="IP address" onChange={(v) => setAsset(d, 'ip', v)} />
                      {report.issues.has(d.id) && (
                        <span className="cell-flag" title={report.issues.get(d.id)!.map((i) => i.message).join('\n')}>
                          <TriangleAlert size={13} aria-hidden="true" />
                          <span className="sr-only">{report.issues.get(d.id)!.map((i) => i.message).join('. ')}</span>
                        </span>
                      )}
                    </span>
                  </td>
                  <td>
                    <Cell value={d.asset.vendor} label="Vendor" onChange={(v) => setAsset(d, 'vendor', v)} />
                  </td>
                  <td>
                    <Cell value={d.asset.model} label="Model" onChange={(v) => setAsset(d, 'model', v)} />
                  </td>
                  <td>
                    <Cell value={d.asset.firmware} label="Firmware" onChange={(v) => setAsset(d, 'firmware', v)} />
                  </td>
                  <td>
                    <select value={d.criticality} aria-label="Criticality" onChange={(e) => patch(d, { criticality: e.target.value as Device['criticality'] }, 'criticality')}>
                      {CRITICALITY.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="icon-button" title="Show on diagram" aria-label={`Show ${d.label} on diagram`} onClick={() => onShowDevice(d.id)}>
                      <Crosshair size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'flows' && (
          <table className="inventory__table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Settings</th>
                <th>
                  <span className="sr-only">Show</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {project.flows.map((f) => (
                <tr key={f.id}>
                  <td>{deviceName.get(f.source)}</td>
                  <td>{deviceName.get(f.target)}</td>
                  <td>
                    <span className="protocol-dot" style={{ background: getProtocol(f.protocol)?.color }} />
                    {getProtocol(f.protocol)?.label ?? f.protocol}
                  </td>
                  <td>{f.port ?? 'n/a'}</td>
                  <td>{flowLabel(f.protocol, f.settings)}</td>
                  <td>
                    <button type="button" className="icon-button" title="Show on diagram" aria-label="Show flow on diagram" onClick={() => onShowFlow(f.id)}>
                      <Crosshair size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'rules' && (
          <table className="inventory__table">
            <thead>
              <tr>
                <th>Firewall</th>
                <th>#</th>
                <th>Action</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(({ fw, r, i }) => (
                <tr key={r.id}>
                  <td>
                    <button type="button" className="link-button" onClick={() => onShowDevice(fw.id)}>
                      {fw.label}
                    </button>
                  </td>
                  <td>{i + 1}</td>
                  <td>
                    <span className={`action action--${r.action}`}>{r.action}</span>
                  </td>
                  <td>{endpointName(project, r.src)}</td>
                  <td>{endpointName(project, r.dst)}</td>
                  <td>{r.protocol}</td>
                  <td>{r.port ?? 'any'}</td>
                  <td>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'addresses' && addresses.length > 0 && (
          <table className="inventory__table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Device</th>
                {project.sites.length > 1 && <th>Site</th>}
                <th>Network</th>
                <th>VLAN</th>
                <th>Device zone</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((r) => (
                <tr key={`${r.deviceId}|${r.address}`}>
                  <td className="mono">{r.address}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => onShowDevice(r.deviceId)}>
                      {r.device}
                    </button>
                  </td>
                  {project.sites.length > 1 && <td>{r.site}</td>}
                  <td>
                    {r.network}
                    {r.subnet && <span className="muted mono"> {r.subnet}</span>}
                  </td>
                  <td>{r.vlan}</td>
                  <td>{r.zone}</td>
                  <td className="issues-cell">{r.warnings.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'devices' && devices.length === 0 && <p className="empty inventory__empty">No devices{query ? ' match the filter' : ''}.</p>}
        {tab === 'flows' && project.flows.length === 0 && <p className="empty inventory__empty">No protocol flows yet.</p>}
        {tab === 'rules' && rules.length === 0 && <p className="empty inventory__empty">No firewall rules yet.</p>}
        {tab === 'addresses' && addresses.length === 0 && (
          <p className="empty inventory__empty">No device has an IP address yet. Add addresses in the Devices tab or in a device's properties.</p>
        )}
      </div>
      {importing && tab !== 'addresses' && <ImportDialog kind={tab} onClose={() => setImporting(false)} />}
    </section>
  );
}
