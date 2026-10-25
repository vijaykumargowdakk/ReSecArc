import { useReactFlow } from '@xyflow/react';
import { Boxes, ChevronRight, StickyNote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DEVICE_CATALOG, PALETTE_GROUPS } from '../model/catalog';
import { addNote, createNote } from '../model/notes';
import { addDevice, createDevice } from '../model/ops';
import { laneTop } from '../model/purdue';
import type { DeviceType } from '../model/schema';
import { announce } from '../store/announcer';
import { useBlocks } from '../store/blocks';
import { useProject } from '../store/useProject';
import { NO_SELECTION } from '../store/useProject';
import { DEVICE_DND_MIME, NOTE_DND_MIME } from './canvas/Canvas';
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
  const siteId = useProject((s) => s.activeSiteId);
  const [open, setOpen] = useState<Set<DeviceType>>(() => new Set());
  const blocks = useBlocks((s) => s.blocks);
  const removeBlock = useBlocks((s) => s.remove);
  const insertFragment = useProject((s) => s.insertFragment);
  const select = useProject((s) => s.select);
  const { screenToFlowPosition } = useReactFlow();

  // Click alternative to dragging a note: place it in the middle of the visible canvas.
  const addNoteInView = () => {
    const box = document.querySelector('.canvas')?.getBoundingClientRect();
    const at = box ? screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }) : { x: 240, y: 40 };
    const note = createNote(siteId, { x: Math.round(at.x - 130), y: Math.round(at.y - 20) });
    apply((p) => addNote(p, note));
    select({ ...NO_SELECTION, notes: [note.id] });
    announce('Note added');
  };

  // Keyboard and click alternative to dragging: drop into the type's default lane.
  const addToDefaultLane = (type: DeviceType, variant: string) => {
    const level = DEVICE_CATALOG[type].defaultLevel;
    const device = createDevice(type, { x: 240 + (count % 8) * 45, y: laneTop(level) + 37 }, { siteId, variant });
    apply((p) => addDevice(p, device));
    announce(`${device.label} added`);
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
      <div className="palette__group">
        <h3>Annotate</h3>
        <ul>
          <li>
            <button
              type="button"
              className="palette__item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(NOTE_DND_MIME, 'note');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={addNoteInView}
              title="A free text note on the canvas"
            >
              <StickyNote size={22} />
              <span>Text note</span>
            </button>
          </li>
        </ul>
      </div>
      <div className="palette__group">
        <h3>Your blocks</h3>
        {blocks.length === 0 ? (
          <p className="palette__hint">Select several devices and choose “Save as reusable block” to reuse them here.</p>
        ) : (
          <ul>
            {blocks.map((b) => (
              <li key={b.id} className="palette__row">
                <button type="button" className="palette__item" onClick={() => insertFragment(b.fragment)} title={`Insert ${b.fragment.devices.length} devices`}>
                  <Boxes size={22} />
                  <span>{b.name}</span>
                </button>
                <button
                  type="button"
                  className="palette__toggle"
                  aria-label={`Delete block ${b.name}`}
                  title="Delete block"
                  onClick={() => window.confirm(`Delete the block “${b.name}”?`) && removeBlock(b.id)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
