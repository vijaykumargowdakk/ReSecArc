import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { kindLabel } from '../model/catalog';
import { searchDevices } from '../model/search';
import { useProject } from '../store/useProject';
import { DeviceIcon } from './icons';

/** Ctrl+K / "/" device search across all sites; Enter jumps to the device. */
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const project = useProject((s) => s.project);
  const focusDevice = useProject((s) => s.focusDevice);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const hits = useMemo(() => searchDevices(project, query), [project, query]);
  const multiSite = project.sites.length > 1;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const pick = (deviceId: string) => {
    focusDevice(deviceId);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="search"
      aria-label="Find a device"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="search__box">
        <Search size={16} aria-hidden="true" />
        <input
          autoFocus
          value={query}
          placeholder="Find by name, kind, IP, vendor or model…"
          aria-label="Search devices"
          aria-controls="search-results"
          aria-activedescendant={hits[active] ? `hit-${hits[active].device.id}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, hits.length - 1));
            else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
            else if (e.key === 'Enter' && hits[active]) pick(hits[active].device.id);
            else return;
            e.preventDefault();
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <ul id="search-results" role="listbox" className="search__results">
        {hits.map((h, i) => (
          <li
            key={h.device.id}
            id={`hit-${h.device.id}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'is-active' : ''}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(h.device.id)}
          >
            <DeviceIcon type={h.device.type} variant={h.device.variant} size={24} />
            <span className="search__label">{h.device.label}</span>
            <span className="muted">
              {kindLabel(h.device.type, h.device.variant)}
              {h.device.asset.ip ? ` · ${h.device.asset.ip}` : ''}
              {multiSite ? ` · ${h.siteName}` : ''}
            </span>
          </li>
        ))}
        {query && hits.length === 0 && <li className="search__none muted">No devices match “{query}”.</li>}
      </ul>
    </dialog>
  );
}
