import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { DEVICE_CATALOG, kindLabel } from '../../model/catalog';
import { levelLabel, type PurdueLane } from '../../model/purdue';
import type { Device, Zone } from '../../model/schema';
import { DeviceIcon } from '../DeviceIcon';

export type DeviceNodeData = { device: Device; zone: Zone | null };
export type DeviceFlowNode = Node<DeviceNodeData, 'device'>;

export type LaneNodeData = { lane: PurdueLane };
export type LaneFlowNode = Node<LaneNodeData, 'lane'>;

export type CanvasNode = DeviceFlowNode | LaneFlowNode;

export function DeviceNode({ data, selected }: NodeProps<DeviceFlowNode>) {
  const { device, zone } = data;
  const style = { '--zone-color': zone?.color ?? 'var(--line-strong)' } as CSSProperties;
  return (
    <div className={`device-node${selected ? ' is-selected' : ''}`} style={style} title={DEVICE_CATALOG[device.type].description}>
      <Handle type="target" position={Position.Top} />
      <span className={`device-node__icon kind-${device.criticality}`}>
        <DeviceIcon type={device.type} />
      </span>
      <span className="device-node__text">
        <span className="device-node__label">{device.label || DEVICE_CATALOG[device.type].label}</span>
        <span className="device-node__meta">
          {kindLabel(device.type, device.variant)} · {levelLabel(device.purdueLevel)}
          {zone ? ` · ${zone.name}` : ''}
        </span>
      </span>
      <Handle type="source" position={Position.Bottom} />
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
