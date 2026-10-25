import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useCallback, useEffect, useState, type DragEvent } from 'react';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, moveDevice, removeDevice, removeFlow, removeLink } from '../../model/ops';
import { getProtocol } from '../../model/protocols';
import { LANE_HEIGHT, LANE_WIDTH, laneTop, PURDUE_LANES } from '../../model/purdue';
import { variantInfo } from '../../model/catalog';
import { deviceTypeSchema, type DeviceType, type Project } from '../../model/schema';
import { useProject } from '../../store/useProject';
import { FlowEdge, LinkEdge, type CanvasEdge } from './edges';
import { DeviceNode, LaneNode, type CanvasNode, type LaneFlowNode } from './nodes';

export const DEVICE_DND_MIME = 'application/x-conduitot-device';

/** Drag payload `type` or `type:variant`, validated against the catalog. */
export function parseDeviceKind(payload: string): { type: DeviceType; variant: string } | null {
  const [rawType, variant = 'generic'] = payload.split(':');
  const type = deviceTypeSchema.safeParse(rawType);
  if (!type.success || !variantInfo(type.data, variant)) return null;
  return { type: type.data, variant };
}
const NODE_WIDTH = 190;
const DROP_OFFSET = { x: NODE_WIDTH / 2, y: 32 };

const nodeTypes = { device: DeviceNode, lane: LaneNode };
const edgeTypes = { link: LinkEdge, flow: FlowEdge };

const LANE_NODES: LaneFlowNode[] = PURDUE_LANES.map((lane) => ({
  id: `lane-${lane.level}`,
  type: 'lane',
  position: { x: 0, y: laneTop(lane.level) },
  data: { lane },
  width: LANE_WIDTH,
  height: LANE_HEIGHT,
  draggable: false,
  selectable: false,
  deletable: false,
  focusable: false,
  connectable: false,
  zIndex: -1,
}));

/** Rebuilds canvas nodes from the project, keeping React Flow's own state (size, selection). */
function buildNodes(project: Project, prev: CanvasNode[]): CanvasNode[] {
  const prevById = new Map(prev.map((n) => [n.id, n]));
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const devices: CanvasNode[] = project.devices.map((device) => {
    const old = prevById.get(device.id);
    return {
      ...(old?.type === 'device' ? old : {}),
      id: device.id,
      type: 'device',
      position: device.position,
      data: { device, zone: device.zoneId ? (zoneById.get(device.zoneId) ?? null) : null },
    };
  });
  return [...LANE_NODES, ...devices];
}

function buildEdges(project: Project, prev: CanvasEdge[]): CanvasEdge[] {
  const selected = new Set(prev.filter((e) => e.selected).map((e) => e.id));
  const links: CanvasEdge[] = project.links.map((link) => ({
    id: link.id,
    type: 'link',
    source: link.source,
    target: link.target,
    data: { link },
    selected: selected.has(link.id),
  }));
  const flows: CanvasEdge[] = project.flows.map((flow) => ({
    id: flow.id,
    type: 'flow',
    source: flow.source,
    target: flow.target,
    data: { flow },
    selected: selected.has(flow.id),
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: getProtocol(flow.protocol)?.color },
  }));
  return [...links, ...flows];
}

export function Canvas() {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const connectMode = useProject((s) => s.connectMode);
  const siteId = project.sites[0].id;
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<CanvasNode[]>(() => buildNodes(project, []));
  const [edges, setEdges] = useState<CanvasEdge[]>(() => buildEdges(project, []));

  useEffect(() => {
    setNodes((prev) => buildNodes(project, prev));
    setEdges((prev) => buildEdges(project, prev));
  }, [project]);

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<CanvasEdge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: CanvasNode, dragged: CanvasNode[]) => {
      apply((p) => dragged.reduce((q, n) => (n.type === 'device' ? moveDevice(q, n.id, n.position) : q), p));
    },
    [apply],
  );

  const onNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      apply((p) => deleted.reduce((q, n) => (n.type === 'device' ? removeDevice(q, n.id) : q), p));
      select(null);
    },
    [apply, select],
  );

  const onEdgesDelete = useCallback(
    (deleted: CanvasEdge[]) => {
      apply((p) => deleted.reduce((q, e) => (e.type === 'flow' ? removeFlow(q, e.id) : removeLink(q, e.id)), p));
      select(null);
    },
    [apply, select],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const device = selNodes.find((n) => n.type === 'device');
      if (device) return select({ kind: 'device', id: device.id });
      const edge = selEdges[0];
      select(edge ? { kind: edge.type === 'flow' ? 'flow' : 'link', id: edge.id } : null);
    },
    [select],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (connectMode === 'link') apply((p) => addLink(p, c.source, c.target));
      else apply((p) => addFlow(p, defaultFlow('modbus', c.source, c.target)));
    },
    [apply, connectMode],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DEVICE_DND_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const kind = parseDeviceKind(event.dataTransfer.getData(DEVICE_DND_MIME));
      if (!kind) return;
      event.preventDefault();
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const device = createDevice(kind.type, { x: at.x - DROP_OFFSET.x, y: at.y - DROP_OFFSET.y }, { siteId, variant: kind.variant });
      apply((p) => addDevice(p, device));
    },
    [apply, screenToFlowPosition, siteId],
  );

  return (
    <div className={`canvas connect-${connectMode}`} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<CanvasNode, CanvasEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        isValidConnection={(c) => c.source !== c.target}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Delete', 'Backspace']}
        minZoom={0.2}
        fitView
        fitViewOptions={{ padding: 0.1, nodes: project.devices.length ? project.devices.map((d) => ({ id: d.id })) : undefined }}
      >
        <Background gap={25} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const node = n as CanvasNode;
            return node.type === 'device' ? (node.data.zone?.color ?? '#94a3b8') : 'transparent';
          }}
          nodeStrokeColor={(n) => (n.type === 'lane' ? '#cbd5e1' : 'transparent')}
        />
      </ReactFlow>
    </div>
  );
}
