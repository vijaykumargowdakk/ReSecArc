import { useMemo, useState } from 'react';
import { kindLabel } from '../model/catalog';
import { useProject } from '../store/useProject';
import { DeviceIcon } from './icons';

/** Filterable device list for creating connections without dragging; same-site devices come first. */
export function DevicePicker({
  excludeId,
  siteId,
  onPick,
  label,
}: {
  excludeId: string;
  siteId: string;
  onPick: (deviceId: string) => void;
  label: string;
}) {
  const devices = useProject((s) => s.project.devices);
  const sites = useProject((s) => s.project.sites);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices
      .filter((d) => d.id !== excludeId)
      .filter((d) => !q || `${d.label} ${kindLabel(d.type, d.variant)} ${d.asset.ip}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.siteId !== siteId) - Number(b.siteId !== siteId) || a.label.localeCompare(b.label));
  }, [devices, excludeId, siteId, query]);

  return (
    <div className="device-picker">
      <input
        type="text"
        autoFocus
        value={query}
        placeholder="Filter devices…"
        aria-label={label}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) onPick(matches[0].id);
        }}
      />
      <ul role="listbox" aria-label={label}>
        {matches.map((d) => (
          <li key={d.id}>
            <button type="button" role="option" aria-selected="false" onClick={() => onPick(d.id)}>
              <DeviceIcon type={d.type} variant={d.variant} size={20} />
              <span>{d.label}</span>
              <span className="muted">{d.siteId === siteId ? kindLabel(d.type, d.variant) : `${siteName.get(d.siteId)} site`}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="muted device-picker__none">No matching devices</li>}
      </ul>
    </div>
  );
}
