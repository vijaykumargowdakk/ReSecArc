import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DEVICE_CATALOG, PALETTE_GROUPS } from '../model/catalog';
import { addDevice, createDevice } from '../model/ops';
import { laneTop } from '../model/purdue';
import type { DeviceType } from '../model/schema';
import { useProject } from '../store/useProject';
import { DEVICE_DND_MIME } from './canvas/Canvas';
import { DeviceIcon } from './icons';

function PaletteItem({
  type,
  variant,
  label,
  description,
  onAdd,
  small = false,
}: {
  type: DeviceType;
  variant: string;
  label: string;
  description: string;
  onAdd: (type: DeviceType, variant: string) => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`palette__item${small ? ' palette__item--variant' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DEVICE_DND_MIME, `${type}:${variant}`);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onAdd(type, variant)}
      title={description}
    >
      <DeviceIcon type={type} variant={variant} size={small ? 22 : 26} />
      <span>{label}</span>
    </button>
  );
}

export function Palette() {
  const apply = useProject((s) => s.apply);
  const count = useProject((s) => s.project.devices.length);
  const siteId = useProject((s) => s.project.sites[0].id);
  const [open, setOpen] = useState<Set<DeviceType>>(() => new Set());

  // Keyboard and click alternative to dragging: drop into the type's default lane.
  const addToDefaultLane = (type: DeviceType, variant: string) => {
    const level = DEVICE_CATALOG[type].defaultLevel;
    const device = createDevice(type, { x: 240 + (count % 8) * 45, y: laneTop(level) + 37 }, { siteId, variant });
    apply((p) => addDevice(p, device));
  };

  const toggle = (type: DeviceType) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <aside className="palette" aria-label="Device palette">
      <p className="palette__hint">Drag a device onto a Purdue level, or click to add it. Open the arrow for specific kinds.</p>
      {PALETTE_GROUPS.map((group) => (
        <div key={group.title} className="palette__group">
          <h3>{group.title}</h3>
          <ul>
            {group.types.map((type) => {
              const info = DEVICE_CATALOG[type];
              const expanded = open.has(type);
              return (
                <li key={type}>
                  <div className="palette__row">
                    <PaletteItem type={type} variant="generic" label={info.label} description={info.description} onAdd={addToDefaultLane} />
                    <button
                      type="button"
                      className={`palette__toggle${expanded ? ' is-open' : ''}`}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Hide' : 'Show'} kinds of ${info.label}`}
                      onClick={() => toggle(type)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  {expanded && (
                    <ul className="palette__variants">
                      {info.variants.slice(1).map((v) => (
                        <li key={v.id}>
                          <PaletteItem
                            type={type}
                            variant={v.id}
                            label={v.label}
                            description={v.description}
                            onAdd={addToDefaultLane}
                            small
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
