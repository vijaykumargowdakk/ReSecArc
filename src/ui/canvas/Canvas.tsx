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
import { useCallback, useEffect, useState, type DragEvent, type MouseEvent } from 'react';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, moveDevice, removeDevice, removeFlow, removeLink } from '../../model/ops';
import { getProtocol } from '../../model/protocols';
import { LANE_HEIGHT, LANE_WIDTH, laneTop, NODE_WIDTH, PURDUE_LANES } from '../../model/purdue';
import { variantInfo } from '../../model/catalog';
import { deviceTypeSchema, type DeviceType, type Project } from '../../model/schema';
import { NO_SELECTION, useProject, type Selection } from '../../store/useProject';
import { NodeMenu } from './NodeMenu';
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
function buildNodes(project: Project, selection: Selection, prev: CanvasNode[]): CanvasNode[] {
  const selected = new Set(selection.devices);
  const prevById = new Map(prev.map((n) => [n.id, n]));
  const zoneById = new Map(project.zones.map((z) => [z.id, z]));
  const devices: CanvasNode[] = project.devices.map((device) => {
    const old = prevById.get(device.id);
    return {
      ...(old?.type === 'device' ? old : {}),
      id: device.id,
      type: 'device',
      position: device.position,
      selected: selected.has(device.id),
      data: { device, zone: device.zoneId ? (zoneById.get(device.zoneId) ?? null) : null },
    };
  });
  return [...LANE_NODES, ...devices];
}

function buildEdges(project: Project, selection: Selection): CanvasEdge[] {
  const selected = new Set([...selection.links, ...selection.flows]);
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
  const selection = useProject((s) => s.selection);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const connectMode = useProject((s) => s.connectMode);
  const snapToGrid = useProject((s) => s.snapToGrid);
  const [menu, setMenu] = useState<{ deviceId: string; x: number; y: number } | null>(null);
  const siteId = project.sites[0].id;
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<CanvasNode[]>(() => buildNodes(project, selection, []));
  const [edges, setEdges] = useState<CanvasEdge[]>(() => buildEdges(project, selection));

  useEffect(() => {
    setNodes((prev) => buildNodes(project, selection, prev));
    setEdges(buildEdges(project, selection));
  }, [project, selection]);

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

  // One callback for nodes and edges together, so a multi-delete is a single undo step.
  const onDelete = useCallback(
    ({ nodes: delNodes, edges: delEdges }: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      apply((p) => {
        const afterEdges = delEdges.reduce((q, e) => (e.type === 'flow' ? removeFlow(q, e.id) : removeLink(q, e.id)), p);
        return delNodes.reduce((q, n) => (n.type === 'device' ? removeDevice(q, n.id) : q), afterEdges);
      });
      select(NO_SELECTION);
    },
    [apply, select],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      select({
        devices: selNodes.filter((n) => n.type === 'device').map((n) => n.id),
        links: selEdges.filter((e) => e.type === 'link').map((e) => e.id),
        flows: selEdges.filter((e) => e.type === 'flow').map((e) => e.id),
      });
    },
    [select],
  );

  const onNodeContextMenu = useCallback((event: MouseEvent, node: CanvasNode) => {
    if (node.type !== 'device') return;
    event.preventDefault();
    const bounds = (event.currentTarget as HTMLElement).closest('.canvas')?.getBoundingClientRect();
    setMenu({ deviceId: node.id, x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) });
  }, []);

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
        onDelete={onDelete}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => setMenu(null)}
        onMoveStart={() => setMenu(null)}
        snapToGrid={snapToGrid}
        snapGrid={[25, 25]}
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
      {menu && <NodeMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
