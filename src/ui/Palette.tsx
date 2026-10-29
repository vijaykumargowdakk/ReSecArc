import { useReactFlow } from '@xyflow/react';
import { Boxes, ChevronRight, StickyNote, Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { DEVICE_CATALOG, PALETTE_GROUPS } from '../model/catalog';
import { freeSpotInLane } from '../model/layout';
import { addDevice, createDevice } from '../model/ops';
import type { DeviceType } from '../model/schema';
import { announce } from '../store/announcer';
import { useBlocks } from '../store/blocks';
import { useProject } from '../store/useProject';
import { addNoteInView } from './actions';
import { DEVICE_DND_MIME, NOTE_DND_MIME } from './canvas/Canvas';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';
import { FoldButton, useSectionOpen } from './form';
import { DeviceIcon } from './icons';
import { PanelEdge, PanelHeader } from './PanelChrome';

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

/** A palette group whose heading folds it away; the choice is remembered in this browser. */
function PaletteGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, toggle] = useSectionOpen('palette', title);
  const body = useId();
  return (
    <div className={`palette__group${open ? '' : ' is-folded'}`}>
      <h3>
        <FoldButton title={title} open={open} controls={body} onToggle={toggle} />
      </h3>
      <div id={body} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

export function Palette() {
  const bodyId = useId();
  const apply = useProject((s) => s.apply);
  const siteId = useProject((s) => s.activeSiteId);
  const [open, setOpen] = useState<Set<DeviceType>>(() => new Set());
  const blocks = useBlocks((s) => s.blocks);
  const removeBlock = useBlocks((s) => s.remove);
  const insertFragment = useProject((s) => s.insertFragment);
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();

  // Keyboard and click alternative to dragging: drop into the type's default lane.
  const addToDefaultLane = (type: DeviceType, variant: string) => {
    const level = DEVICE_CATALOG[type].defaultLevel;
    const at = freeSpotInLane(useProject.getState().project, siteId, level);
    const device = createDevice(type, at, { siteId, variant });
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
      <PanelHeader panel="palette" bodyId={bodyId} />
      <div id={bodyId} className="panel-body palette__body">
        <p className="palette__hint">Drag a device onto a Purdue level, or click to add it. Open the arrow for specific kinds.</p>
        {PALETTE_GROUPS.map((group) => (
          <PaletteGroup key={group.title} title={group.title}>
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
          </PaletteGroup>
        ))}
        <PaletteGroup title="Annotate">
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
                onClick={() => addNoteInView(reactFlow)}
                title="A free text note on the canvas"
              >
                <StickyNote size={22} />
                <span>Text note</span>
              </button>
            </li>
          </ul>
        </PaletteGroup>
        <PaletteGroup title="Your blocks">
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
        </PaletteGroup>
      </div>
      <PanelEdge panel="palette" />
    </aside>
  );
}
