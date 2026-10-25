import { DEVICE_CATALOG, PALETTE_GROUPS } from '../model/catalog';
import { addDevice, createDevice } from '../model/ops';
import { laneTop } from '../model/purdue';
import type { DeviceType } from '../model/schema';
import { useProject } from '../store/useProject';
import { DEVICE_DND_MIME } from './canvas/Canvas';
import { DeviceIcon } from './DeviceIcon';

export function Palette() {
  const apply = useProject((s) => s.apply);
  const count = useProject((s) => s.project.devices.length);

  // Keyboard and click alternative to dragging: drop into the type's default lane.
  const addToDefaultLane = (type: DeviceType) => {
    const level = DEVICE_CATALOG[type].defaultLevel;
    const device = createDevice(type, { x: 240 + (count % 8) * 45, y: laneTop(level) + 37 });
    apply((p) => addDevice(p, device));
  };

  return (
    <aside className="palette" aria-label="Device palette">
      <p className="palette__hint">Drag a device onto a Purdue level, or click to add it to its usual level.</p>
      {PALETTE_GROUPS.map((group) => (
        <div key={group.title} className="palette__group">
          <h3>{group.title}</h3>
          <ul>
            {group.types.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  className="palette__item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DEVICE_DND_MIME, type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => addToDefaultLane(type)}
                  title={DEVICE_CATALOG[type].description}
                >
                  <DeviceIcon type={type} size={20} />
                  <span>{DEVICE_CATALOG[type].label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
