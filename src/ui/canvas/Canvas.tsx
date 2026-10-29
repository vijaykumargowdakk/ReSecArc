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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { variantInfo } from '../../model/catalog';
import { dimmedIds } from '../../model/filter';
import { addNote, createNote, moveNote, removeNote } from '../../model/notes';
import { addDevice, addFlow, addLink, createDevice, defaultFlow, moveDevice, removeDevice, removeFlow, removeLink, replaceFlow, updateLink } from '../../model/ops';
import { insertWaypoint } from '../../model/routing';
import { LANE_HEIGHT, LANE_WIDTH, laneTop, NODE_HEIGHT, NODE_WIDTH, PURDUE_LANES } from '../../model/purdue';
import { deviceTypeSchema, type Device, type DeviceType, type Project } from '../../model/schema';
import { moveArea, removeArea } from '../../model/structure';
import { announce } from '../../store/announcer';
import { useComparison } from '../../store/compare';
import { useFindingsByItem } from '../../store/derived';
import { usePrefs } from '../../store/prefs';
import { flowColorMode, useTheme } from '../../store/theme';
import { useRenderAll } from '../exportDiagram';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { FlowEdge, LinkEdge, type CanvasEdge } from './edges';
import { Legend } from './Legend';
import { AreaNode, DeviceNode, LaneNode, NoteNode, PortalNode, type CanvasNode, type LaneFlowNode } from './nodes';
import { setDrawnDevices, useKeyboardConnect } from './useKeyboardConnect';
import { usePathMarks } from './usePathMarks';
import { buildView } from './view';

// The device menu opens only on a right-click or long-press, so its code loads then.
const NodeMenu = lazy(() => import('./NodeMenu').then((m) => ({ default: m.NodeMenu })));

// Level tabs and stacks are drawn by a module that loads once either is in use on the open site.
type Modes = typeof import('./levelView');
let modesLoaded: Modes | null = null;
function useModes(on: boolean): Modes | null {
  const [modes, setModes] = useState(modesLoaded);
  useEffect(() => {
    if (on && !modes) void import('./levelView').then((m) => setModes((modesLoaded = m)));
  }, [on, modes]);
  return modes;
}

/** The devices a node stands for: a stack's members, or the device itself. */
const deviceIdsOf = (n: CanvasNode) => (n.type === 'device' && n.data.stack) || [n.id];

export const DEVICE_DND_MIME = 'application/x-conduitot-device';
export const NOTE_DND_MIME = 'application/x-conduitot-note';

/** Drag payload `type` or `type:variant`, validated against the catalog. */
export function parseDeviceKind(payload: string): { type: DeviceType; variant: string } | null {
  const [rawType, variant = 'generic'] = payload.split(':');
  const type = deviceTypeSchema.safeParse(rawType);
  if (!type.success || !variantInfo(type.data, variant)) return null;
  return { type: type.data, variant };
}

/** Above this many nodes, only the visible part of the site is drawn. */
const VIRTUALIZE_ABOVE = 300;

const DROP_OFFSET = { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 };
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const nodeTypes = { device: DeviceNode, lane: LaneNode, area: AreaNode, portal: PortalNode, note: NoteNode };
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
  const loadCount = useProject((s) => s.loadCount);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const focusDevice = useProject((s) => s.focusDevice);
  const clearFocus = useProject((s) => s.clearFocus);
  const connectMode = useProject((s) => s.connectMode);
  const snapToGrid = useProject((s) => s.snapToGrid);
  const flowProtocol = useProject((s) => s.flowProtocol);
  const pendingConnect = useProject((s) => s.pendingConnect);
  const level = useProject((s) => s.activeLevel);
  const stacked = useProject((s) => !!s.project.sites.find((x) => x.id === s.activeSiteId)?.stackedLevels?.length);
  const modes = useModes(level !== null || stacked);
  const [menu, setMenu] = useState<{ deviceId: string; x: number; y: number } | null>(null);
  const { screenToFlowPosition, setCenter, fitView, fitBounds, getInternalNode, getViewport } = useReactFlow();
  const theme = useTheme((s) => s.theme);
  const renderAll = useRenderAll((s) => s.all);
  const dragging = useRef(false);
  const [coarsePointer] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const container = useRef<HTMLDivElement>(null);

  const dimmed = useMemo(() => dimmedIds(project, filter), [project, filter]);
  const comparison = useComparison();
  const marks = comparison?.marks;
  const layers = usePrefs((s) => s.layers);
  const findings = useFindingsByItem();
  const path = usePathMarks();
  const view = useMemo(() => {
    const args = [project, siteId, selection, dimmed, marks, layers, pendingConnect, layers.security ? findings : undefined, path] as const;
    if (level !== null) return modes ? modes.levelView(level, ...args) : { nodes: [], edges: [] };
    return modes && stacked ? modes.stackView(buildView(...args), ...args) : buildView(...args);
  }, [project, siteId, selection, dimmed, marks, layers, pendingConnect, findings, path, level, modes, stacked]);

  const [nodes, setNodes] = useState<CanvasNode[]>(() => [...LANE_NODES, ...view.nodes]);
  const [edges, setEdges] = useState<CanvasEdge[]>(view.edges);

  useEffect(() => {
    // A level tab draws its own band instead of the lanes.
    setNodes((prev) => mergeNodes([...(level === null ? LANE_NODES : []), ...view.nodes], prev));
    setEdges(view.edges);
    setDrawnDevices(view.drawn);
  }, [view, level]);
  useEffect(() => () => setDrawnDevices(undefined), []);

  /** Moves a device or a stack, or in a level tab a device's place in that tab. */
  const moveTo = useCallback(
    (p: Project, id: string, position: { x: number; y: number }) => (modes ? modes.moveNode(p, id, position, level) : moveDevice(p, id, position)),
    [modes, level],
  );

  // Frame the newly shown site or newly loaded project (devices, areas, notes and stubs), unless a search
  // result is about to be centred instead.
  const latestView = useRef(view);
  latestView.current = view;
  // Bounds come from known node sizes rather than measured ones: when only visible nodes are drawn,
  // most of a newly opened site has not been measured yet.
  useEffect(() => {
    if (useProject.getState().focus) return;
    const nodes = latestView.current.nodes;
    const frame = requestAnimationFrame(() => {
      if (nodes.length === 0) {
        fitView({ padding: 0.1, duration: reducedMotion() ? 0 : 250 });
        return;
      }
      // The lane labels at the left edge stay in view, with their buttons.
      const xs = [0, ...nodes.flatMap((n) => [n.position.x, n.position.x + (n.width ?? NODE_WIDTH)])];
      const ys = nodes.flatMap((n) => [n.position.y, n.position.y + (n.height ?? NODE_HEIGHT)]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      fitBounds({ x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }, { padding: 0.1, duration: reducedMotion() ? 0 : 250 });
    });
    return () => cancelAnimationFrame(frame);
  }, [siteId, level, loadCount, fitView, fitBounds]);

  useEffect(() => {
    if (!focus) return;
    const targets = nodes.filter((n) => deviceIdsOf(n).some((id) => focus.deviceIds.includes(id)));
    if (targets.length === 0 || !targets.every((n) => n.measured)) return;
    const duration = reducedMotion() ? 0 : 400;
    if (targets.length === 1) {
      setCenter(targets[0].position.x + NODE_WIDTH / 2, targets[0].position.y + NODE_HEIGHT / 2, { zoom: 1.2, duration });
    } else {
      const x = Math.min(...targets.map((n) => n.position.x));
      const y = Math.min(...targets.map((n) => n.position.y));
      const width = Math.max(...targets.map((n) => n.position.x + NODE_WIDTH)) - x;
      const height = Math.max(...targets.map((n) => n.position.y + NODE_HEIGHT)) - y;
      fitBounds({ x, y, width, height }, { padding: 0.3, duration });
    }
    clearFocus();
  }, [focus, nodes, setCenter, fitBounds, clearFocus]);

  // Pans just enough to show a device highlighted from the keyboard, keeping the zoom.
  const reveal = useCallback(
    (device: Device) => {
      const box = container.current?.getBoundingClientRect();
      if (!box) return;
      const { x, y, zoom } = getViewport();
      const left = device.position.x * zoom + x;
      const top = device.position.y * zoom + y;
      if (left >= 0 && top >= 0 && left + NODE_WIDTH * zoom <= box.width && top + NODE_HEIGHT * zoom <= box.height) return;
      setCenter(device.position.x + NODE_WIDTH / 2, device.position.y + NODE_HEIGHT / 2, { zoom, duration: reducedMotion() ? 0 : 200 });
    },
    [getViewport, setCenter],
  );
  useKeyboardConnect(reveal);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      // Arrow-key moves arrive as non-drag position changes; mouse drags are committed on drag stop.
      if (dragging.current) return;
      const moved = changes.flatMap((c) => (c.type === 'position' && c.position && c.dragging === false ? [{ id: c.id, position: c.position }] : []));
      if (moved.length === 0) return;
      const { areas, notes } = useProject.getState().project;
      const areaIds = new Set(areas.map((a) => a.id));
      const noteIds = new Set(notes.map((n) => n.id));
      const move = (q: Project, m: (typeof moved)[number]) => {
        if (areaIds.has(m.id)) return moveArea(q, m.id, m.position);
        if (noteIds.has(m.id)) return moveNote(q, m.id, m.position);
        return moveTo(q, m.id, m.position);
      };
      apply(
        (p) => moved.reduce(move, p),
        `nudge:${moved.map((m) => m.id).join(',')}`,
      );
    },
    [apply, moveTo],
  );

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
      dragging.current = false;
      apply((p) => {
        const areas = dragged.filter((n) => n.type === 'area');
        const carried = new Set(areas.flatMap((n) => (n.type === 'area' ? n.data.members.map((d) => d.id) : [])));
        const afterAreas = areas.reduce((q, n) => moveArea(q, n.id, n.position), p);
        return dragged.reduce((q, n) => {
          if (n.type === 'note') return moveNote(q, n.id, n.position);
          return n.type === 'device' && !carried.has(n.id) ? moveTo(q, n.id, n.position) : q;
        }, afterAreas);
      });
    },
    [apply, moveTo],
  );

  // One callback for nodes and edges together, so a multi-delete is a single undo step.
  const onDelete = useCallback(
    ({ nodes: delNodes, edges: delEdges }: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      apply((p) => {
        const afterEdges = delEdges.reduce((q, e) => (e.type === 'flow' ? removeFlow(q, e.id) : removeLink(q, e.id)), p);
        return delNodes.reduce((q, n) => {
          if (n.type === 'device') return deviceIdsOf(n).reduce(removeDevice, q);
          if (n.type === 'area') return removeArea(q, n.id);
          if (n.type === 'note') return removeNote(q, n.id);
          return q;
        }, afterEdges);
      });
      select(NO_SELECTION);
      const count = delNodes.reduce((sum, n) => sum + (n.type === 'device' ? deviceIdsOf(n).length : 0), 0);
      announce(count ? `Deleted ${count} device${count === 1 ? '' : 's'}` : 'Deleted selection');
    },
    [apply, select],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      select({
        devices: selNodes.filter((n) => n.type === 'device').flatMap((n) => deviceIdsOf(n as CanvasNode)),
        links: selEdges.filter((e) => e.type === 'link').map((e) => e.id),
        flows: selEdges.filter((e) => e.type === 'flow').map((e) => e.id),
        areas: selNodes.filter((n) => n.type === 'area').map((n) => n.id),
        notes: selNodes.filter((n) => n.type === 'note').map((n) => n.id),
      });
    },
    [select],
  );

  // Double-clicking a link or flow bends it at that point; the new bend can then be dragged.
  const onEdgeDoubleClick = useCallback(
    (event: MouseEvent, edge: CanvasEdge) => {
      if (edge.data?.aggregated) return;
      event.preventDefault();
      const centre = (id: string) => {
        const n = getInternalNode(id);
        if (!n) return null;
        return { x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2, y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2 };
      };
      const from = centre(edge.source);
      const to = centre(edge.target);
      if (!from || !to) return;
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (edge.type === 'link' && edge.data) {
        const link = edge.data.link;
        apply((p) => updateLink(p, link.id, { waypoints: insertWaypoint(link.waypoints, from, to, at) }));
      } else if (edge.type === 'flow' && edge.data) {
        const flow = edge.data.flow;
        apply((p) => replaceFlow(p, { ...flow, waypoints: insertWaypoint(flow.waypoints, from, to, at) }));
      }
      select({ ...NO_SELECTION, [edge.type === 'link' ? 'links' : 'flows']: [edge.id] });
      announce('Bend point added. Drag it to move, double-click it to remove.');
    },
    [apply, getInternalNode, screenToFlowPosition, select],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: CanvasNode) => {
      if (node.type === 'portal') focusDevice(node.data.device.id);
    },
    [focusDevice],
  );

  // Double-clicking a stack opens its level in a tab of its own, where every member is drawn.
  const onNodeDoubleClick = useCallback((_event: MouseEvent, node: CanvasNode) => {
    if (node.type === 'device' && node.data.stack) useProject.getState().openLevel(node.data.device.purdueLevel);
  }, []);

  const openMenu = useCallback((deviceId: string, clientX: number, clientY: number) => {
    const bounds = container.current?.getBoundingClientRect();
    setMenu({ deviceId, x: clientX - (bounds?.left ?? 0), y: clientY - (bounds?.top ?? 0) });
  }, []);

  const onNodeContextMenu = useCallback(
    (event: MouseEvent, node: CanvasNode) => {
      if (node.type !== 'device' || node.data.stack) return;
      event.preventDefault();
      openMenu(node.id, event.clientX, event.clientY);
    },
    [openMenu],
  );
  // Touch screens get a long-press menu; its code loads only on devices that have one.
  useEffect(() => {
    const el = container.current;
    if (!el || !(coarsePointer || matchMedia('(any-pointer: coarse)').matches)) return;
    let detach: (() => void) | undefined;
    let live = true;
    void import('./longPress').then((m) => {
      if (live) detach = m.attachLongPress(el, openMenu);
    });
    return () => {
      live = false;
      detach?.();
    };
  }, [coarsePointer, openMenu]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (connectMode === 'link') apply((p) => addLink(p, c.source, c.target));
      else apply((p) => addFlow(p, defaultFlow(flowProtocol, c.source, c.target)));
      announce(`${connectMode === 'link' ? 'Link' : 'Flow'} added`);
    },
    [apply, connectMode, flowProtocol],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    const types = event.dataTransfer.types;
    if (!types.includes(DEVICE_DND_MIME) && !types.includes(NOTE_DND_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (event.dataTransfer.types.includes(NOTE_DND_MIME)) {
        event.preventDefault();
        // Notes belong to the overview; a level tab shows only devices.
        if (level !== null) return announce('Notes are added in the overview.');
        const note = createNote(siteId, { x: at.x - 20, y: at.y - 20 });
        apply((p) => addNote(p, note));
        select({ ...NO_SELECTION, notes: [note.id] });
        announce('Note added');
        return;
      }
      const kind = parseDeviceKind(event.dataTransfer.getData(DEVICE_DND_MIME));
      if (!kind) return;
      event.preventDefault();
      const device = createDevice(kind.type, { x: at.x - DROP_OFFSET.x, y: at.y - DROP_OFFSET.y }, { siteId, variant: kind.variant });
      apply((p) => (level !== null && modes ? modes.addToLevel(p, device, level, device.position) : addDevice(p, device)));
      announce(`${device.label} added`);
    },
    [apply, screenToFlowPosition, siteId, select, level, modes],
  );

  return (
    <div
      ref={container}
      className={`canvas connect-${connectMode}${pendingConnect ? ' is-connecting' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<CanvasNode, CanvasEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={() => {
          dragging.current = true;
        }}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onDelete={onDelete}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => setMenu(null)}
        onMoveStart={() => setMenu(null)}
        onlyRenderVisibleElements={!renderAll && nodes.length > VIRTUALIZE_ABOVE}
        // A finger wobbles a little, so on touch screens a device moves only once it is clearly dragged.
        nodeDragThreshold={coarsePointer ? 8 : 1}
        snapToGrid={snapToGrid}
        snapGrid={[25, 25]}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        isValidConnection={(c) => c.source !== c.target}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Delete', 'Backspace']}
        minZoom={0.05}
        colorMode={flowColorMode(theme)}
        ariaLabelConfig={{ 'node.a11yDescription.default':
            'Press Enter or Space to select. Use arrow keys to move the selection. Press Delete to remove it. On a device, press L to link it or F to add a flow to another device.' }}
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
            if (node.type === 'note') return node.data.note.color;
            return 'transparent';
          }}
          nodeStrokeColor={(n) => (n.type === 'lane' ? '#cbd5e1' : 'transparent')}
        />
      </ReactFlow>
      {menu && (
        <Suspense fallback={null}>
          <NodeMenu {...menu} onClose={() => setMenu(null)} />
        </Suspense>
      )}
      {view.nodes.length === 0 && (level === null || modes) && (
        <div className="canvas-empty" role="note">
          <p>{level === null ? 'This site is empty.' : 'This level of the site is empty.'}</p>
          <p className="muted">Drag a device here from the palette, or press Ctrl + Shift + P to run any command, such as “New architecture from a template”.</p>
        </div>
      )}
    </div>
  );
}
