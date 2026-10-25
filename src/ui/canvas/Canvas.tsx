import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react';
import { variantInfo } from '../../model/catalog';
import { dimmedIds } from '../../model/filter';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, moveDevice, removeDevice, removeFlow, removeLink } from '../../model/ops';
import { LANE_HEIGHT, LANE_WIDTH, laneTop, NODE_HEIGHT, NODE_WIDTH, PURDUE_LANES } from '../../model/purdue';
import { deviceTypeSchema, type DeviceType } from '../../model/schema';
import { moveArea, removeArea } from '../../model/structure';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { FlowEdge, LinkEdge, type CanvasEdge } from './edges';
import { Legend } from './Legend';
import { NodeMenu } from './NodeMenu';
import { AreaNode, DeviceNode, LaneNode, PortalNode, type CanvasNode, type LaneFlowNode } from './nodes';
import { buildView } from './view';

export const DEVICE_DND_MIME = 'application/x-conduitot-device';

/** Drag payload `type` or `type:variant`, validated against the catalog. */
export function parseDeviceKind(payload: string): { type: DeviceType; variant: string } | null {
  const [rawType, variant = 'generic'] = payload.split(':');
  const type = deviceTypeSchema.safeParse(rawType);
  if (!type.success || !variantInfo(type.data, variant)) return null;
  return { type: type.data, variant };
}

const DROP_OFFSET = { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 };

const nodeTypes = { device: DeviceNode, lane: LaneNode, area: AreaNode, portal: PortalNode };
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
  zIndex: -2,
}));

/** Keeps React Flow's own per-node state (measured size, drag state) across rebuilds. */
function mergeNodes(next: CanvasNode[], prev: CanvasNode[]): CanvasNode[] {
  const prevById = new Map(prev.map((n) => [n.id, n]));
  return next.map((n) => {
    const old = prevById.get(n.id);
    return old && old.type === n.type ? ({ ...old, ...n } as CanvasNode) : n;
  });
}

export function Canvas() {
  const project = useProject((s) => s.project);
  const selection = useProject((s) => s.selection);
  const siteId = useProject((s) => s.activeSiteId);
  const filter = useProject((s) => s.filter);
  const focus = useProject((s) => s.focus);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const focusDevice = useProject((s) => s.focusDevice);
  const clearFocus = useProject((s) => s.clearFocus);
  const connectMode = useProject((s) => s.connectMode);
  const snapToGrid = useProject((s) => s.snapToGrid);
  const flowProtocol = useProject((s) => s.flowProtocol);
  const [menu, setMenu] = useState<{ deviceId: string; x: number; y: number } | null>(null);
  const { screenToFlowPosition, setCenter, fitView } = useReactFlow();

  const dimmed = useMemo(() => dimmedIds(project, filter), [project, filter]);
  const view = useMemo(() => buildView(project, siteId, selection, dimmed), [project, siteId, selection, dimmed]);

  const [nodes, setNodes] = useState<CanvasNode[]>(() => [...LANE_NODES, ...view.nodes]);
  const [edges, setEdges] = useState<CanvasEdge[]>(view.edges);

  useEffect(() => {
    setNodes((prev) => mergeNodes([...LANE_NODES, ...view.nodes], prev));
    setEdges(view.edges);
  }, [view]);

  // Frame the newly shown site, unless a search result is about to be centred instead.
  useEffect(() => {
    if (useProject.getState().focus) return;
    const ids = useProject.getState().project.devices.filter((d) => d.siteId === siteId).map((d) => ({ id: d.id }));
    const frame = requestAnimationFrame(() => fitView({ padding: 0.1, nodes: ids.length ? ids : undefined, duration: 250 }));
    return () => cancelAnimationFrame(frame);
  }, [siteId, fitView]);

  useEffect(() => {
    if (!focus) return;
    const node = nodes.find((n) => n.id === focus.deviceId);
    if (!node?.measured) return;
    setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1.2, duration: 400 });
    clearFocus();
  }, [focus, nodes, setCenter, clearFocus]);

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<CanvasEdge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // While an area is dragged, carry its member devices along so the frame never leaves them behind.
  const onNodeDrag = useCallback((_event: unknown, node: CanvasNode) => {
    if (node.type !== 'area') return;
    const { area, members } = node.data;
    const dx = node.position.x - area.rect.x;
    const dy = node.position.y - area.rect.y;
    const start = new Map(members.map((d) => [d.id, d.position]));
    setNodes((nds) =>
      nds.map((n) => {
        const p = start.get(n.id);
        return p ? { ...n, position: { x: p.x + dx, y: p.y + dy } } : n;
      }),
    );
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: CanvasNode, dragged: CanvasNode[]) => {
      apply((p) => {
        const areas = dragged.filter((n) => n.type === 'area');
        const carried = new Set(areas.flatMap((n) => (n.type === 'area' ? n.data.members.map((d) => d.id) : [])));
        const afterAreas = areas.reduce((q, n) => moveArea(q, n.id, n.position), p);
        return dragged.reduce((q, n) => (n.type === 'device' && !carried.has(n.id) ? moveDevice(q, n.id, n.position) : q), afterAreas);
      });
    },
    [apply],
  );

  // One callback for nodes and edges together, so a multi-delete is a single undo step.
  const onDelete = useCallback(
    ({ nodes: delNodes, edges: delEdges }: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      apply((p) => {
        const afterEdges = delEdges.reduce((q, e) => (e.type === 'flow' ? removeFlow(q, e.id) : removeLink(q, e.id)), p);
        return delNodes.reduce((q, n) => {
          if (n.type === 'device') return removeDevice(q, n.id);
          if (n.type === 'area') return removeArea(q, n.id);
          return q;
        }, afterEdges);
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
        areas: selNodes.filter((n) => n.type === 'area').map((n) => n.id),
      });
    },
    [select],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: CanvasNode) => {
      if (node.type === 'portal') focusDevice(node.data.device.id);
    },
    [focusDevice],
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
      else apply((p) => addFlow(p, defaultFlow(flowProtocol, c.source, c.target)));
    },
    [apply, connectMode, flowProtocol],
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
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onDelete={onDelete}
        onNodeClick={onNodeClick}
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
      >
        <Background gap={25} size={1} />
        <Controls showInteractive={false} />
        <Legend />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const node = n as CanvasNode;
            if (node.type === 'device') return node.data.zone?.color ?? '#94a3b8';
            if (node.type === 'area') return node.data.area.collapsed ? node.data.area.color : 'transparent';
            return 'transparent';
          }}
          nodeStrokeColor={(n) => (n.type === 'lane' ? '#cbd5e1' : 'transparent')}
        />
      </ReactFlow>
      {menu && <NodeMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
