import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronsDownUp, ChevronsUpDown, ExternalLink } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { DEVICE_CATALOG, kindLabel } from '../../model/catalog';
import { levelLabel, type PurdueLane } from '../../model/purdue';
import { updateNote } from '../../model/notes';
import { updateArea } from '../../model/structure';
import { useProject } from '../../store/useProject';
import { DeviceIcon } from '../icons';
import type { AreaNodeData, DeviceNodeData, NoteNodeData, PortalNodeData } from './view';

export type DeviceFlowNode = Node<DeviceNodeData, 'device'>;
export type AreaFlowNode = Node<AreaNodeData, 'area'>;
export type PortalFlowNode = Node<PortalNodeData, 'portal'>;
export type NoteFlowNode = Node<NoteNodeData, 'note'>;
export type LaneNodeData = { lane: PurdueLane };
export type LaneFlowNode = Node<LaneNodeData, 'lane'>;

export type CanvasNode = DeviceFlowNode | AreaFlowNode | PortalFlowNode | NoteFlowNode | LaneFlowNode;

const MIN_AREA = { width: 240, height: 120 };

export function DeviceNode({ data, selected }: NodeProps<DeviceFlowNode>) {
  const { device, zone } = data;
  const kind = kindLabel(device.type, device.variant);
  const style = { '--zone-color': zone?.color ?? 'var(--line-strong)' } as CSSProperties;
  return (
    <div
      className={`device-node${selected ? ' is-selected' : ''}`}
      style={style}
      title={DEVICE_CATALOG[device.type].description}
      aria-label={`${kind}, ${device.label}, level ${levelLabel(device.purdueLevel).slice(1)}${zone ? `, zone ${zone.name}` : ''}, ${device.criticality} criticality`}
    >
      <Handle type="target" position={Position.Top} />
      <span className="device-node__icon">
        <DeviceIcon type={device.type} variant={device.variant} size={34} />
      </span>
      <span className="device-node__text">
        <span className="device-node__label">{device.label || kind}</span>
        <span className="device-node__meta">
          {kind} · {levelLabel(device.purdueLevel)}
          {zone ? ` · ${zone.name}` : ''}
        </span>
      </span>
      {data.diff && (
        <span className={`diff-badge diff-badge--${data.diff}`} aria-hidden="true">
          {data.diff === 'added' ? 'New' : 'Changed'}
        </span>
      )}
      <span className={`criticality criticality--${device.criticality}`} title={`${device.criticality} criticality`} aria-hidden="true">
        {device.criticality[0].toUpperCase()}
      </span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function AreaNode({ id, data, selected }: NodeProps<AreaFlowNode>) {
  const apply = useProject((s) => s.apply);
  const { area, members } = data;
  // Both forms carry (hidden) handles so merged edges can attach the moment an area collapses.
  const handles = (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className="area__handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="area__handle" />
    </>
  );
  const toggle = (
    <button
      type="button"
      className="area__toggle nodrag"
      onClick={() => apply((p) => updateArea(p, id, { collapsed: !area.collapsed }))}
      aria-label={area.collapsed ? `Expand ${area.name}` : `Collapse ${area.name}`}
      title={area.collapsed ? 'Expand area' : 'Collapse area'}
    >
      {area.collapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
    </button>
  );

  if (area.collapsed) {
    return (
      <div className={`area area--collapsed${selected ? ' is-selected' : ''}`} style={{ '--area-color': area.color } as CSSProperties}>
        {handles}
        <div className="area__head">
          <span className="area__name">{area.name}</span>
          {toggle}
        </div>
        <div className="area__members" aria-label={`${members.length} devices`}>
          {members.slice(0, 7).map((d) => (
            <DeviceIcon key={d.id} type={d.type} variant={d.variant} size={20} />
          ))}
          <span className="muted">{members.length} devices</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_AREA.width}
        minHeight={MIN_AREA.height}
        lineClassName="area__resize-line"
        handleClassName="area__resize-handle"
        onResizeEnd={(_e, r) => apply((p) => updateArea(p, id, { rect: { x: r.x, y: r.y, width: r.width, height: r.height } }))}
      />
      <div className={`area${selected ? ' is-selected' : ''}`} style={{ '--area-color': area.color } as CSSProperties}>
        {handles}
        <div className="area__head">
          <span className="area__name">{area.name}</span>
          <span className="area__count">{members.length}</span>
          {toggle}
        </div>
      </div>
    </>
  );
}

export function PortalNode({ data }: NodeProps<PortalFlowNode>) {
  return (
    <div className="portal" title={`On site “${data.siteName}”. Click to go there.`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <DeviceIcon type={data.device.type} variant={data.device.variant} size={22} />
      <span className="portal__text">
        <span className="portal__label">{data.device.label}</span>
        <span className="portal__site">
          <ExternalLink size={11} aria-hidden="true" /> {data.siteName}
        </span>
      </span>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

/** A text note. Double-click to edit it in place; keyboard users edit it in the properties panel. */
export function NoteNode({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const apply = useProject((s) => s.apply);
  const [editing, setEditing] = useState(false);
  const { note } = data;
  const style = { '--note-color': note.color } as CSSProperties;
  if (editing) {
    return (
      <div className="note is-editing" style={style}>
        <textarea
          className="note__editor nodrag nowheel"
          aria-label="Note text"
          autoFocus
          defaultValue={note.text}
          rows={Math.max(2, note.text.split('\n').length)}
          onBlur={(e) => {
            const text = e.target.value;
            if (text !== note.text) apply((p) => updateNote(p, id, { text }));
            setEditing(false);
          }}
          onKeyDown={(e) => {
            // Keep Delete/Backspace and arrows inside the editor instead of acting on the canvas.
            e.stopPropagation();
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur();
          }}
        />
      </div>
    );
  }
  return (
    <div
      className={`note${selected ? ' is-selected' : ''}`}
      style={style}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
    >
      {note.text || <span className="muted">Empty note</span>}
    </div>
  );
}

export function LaneNode({ data }: NodeProps<LaneFlowNode>) {
  return (
    <div className={`lane lane--${String(data.lane.level).replace('.', '-')}`}>
      <span className="lane__level">{levelLabel(data.lane.level)}</span>
      <span className="lane__name">{data.lane.name}</span>
    </div>
  );
}
