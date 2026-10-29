import { create } from 'zustand';
import { loadDemo } from '../examples/templates/demo';
import { NO_FILTER, type Filter } from '../model/filter';
import { extractFragment, pasteFragment, type Fragment } from '../model/ops';
import type { Project, PurdueLevel } from '../model/schema';
import { commit, initHistory, jump, redo, undo, type History } from './history';

export interface Selection {
  devices: string[];
  links: string[];
  flows: string[];
  areas: string[];
  notes: string[];
}
export const NO_SELECTION: Selection = { devices: [], links: [], flows: [], areas: [], notes: [] };
export type ConnectMode = 'link' | 'flow';
/** A connection being made from the keyboard: the source device and the currently highlighted target. */
export interface PendingConnect {
  mode: ConnectMode;
  sourceId: string;
  targetId: string | null;
}

const PASTE_OFFSET = { x: 40, y: 40 };

interface ProjectState {
  project: Project;
  history: History;
  selection: Selection;
  connectMode: ConnectMode;
  /** Protocol given to newly drawn flows. */
  flowProtocol: string;
  snapToGrid: boolean;
  clipboard: Fragment | null;
  /** The site shown on the canvas. */
  activeSiteId: string;
  /** The level tab shown, or null for the site's overview. */
  activeLevel: PurdueLevel | null;
  /** Level tabs open beside the overview, top level first; they close when the site changes. */
  levelTabs: PurdueLevel[];
  filter: Filter;
  /** Increases each time a project is loaded, so the canvas can frame the new design. */
  loadCount: number;
  /** Devices the canvas should centre on (one) or frame (several) once they are rendered. */
  focus: { deviceIds: string[]; nonce: number } | null;
  pendingConnect: PendingConnect | null;
  /** Applies a pure operation from model/ops. Edits sharing a `coalesceKey` in quick succession undo as one step. */
  apply: (op: (project: Project) => Project, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  /** Jumps several undo steps at once: negative goes back, positive forward. */
  jumpHistory: (delta: number) => void;
  /** Replaces the project and clears undo history. */
  load: (project: Project) => void;
  select: (selection: Selection) => void;
  selectAll: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  /** Inserts a saved block onto the active site. */
  insertFragment: (fragment: Fragment) => void;
  setActiveSite: (siteId: string) => void;
  /** Shows a level of the open site in its own tab, opening the tab if needed; null shows the overview. */
  openLevel: (level: PurdueLevel | null) => void;
  /** Switches to the device's site, selects it and centres the canvas on it. */
  focusDevice: (deviceId: string) => void;
  /** Selects items and frames the given devices, on the first device's site. */
  focusItems: (selection: Partial<Selection>, deviceIds: string[]) => void;
  clearFocus: () => void;
  setFilter: (filter: Filter) => void;
  setConnectMode: (mode: ConnectMode) => void;
  setFlowProtocol: (protocol: string) => void;
  setPendingConnect: (pending: PendingConnect | null) => void;
  toggleSnap: () => void;
}

/** True once the user has changed the loaded project; replacing it should then be confirmed. */
export function hasEdits(): boolean {
  return useProject.getState().history.past.length > 0;
}

export function demoProject(): Project {
  return loadDemo();
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const sameSelection = (a: Selection, b: Selection) =>
  sameIds(a.devices, b.devices) && sameIds(a.links, b.links) && sameIds(a.flows, b.flows) && sameIds(a.areas, b.areas) && sameIds(a.notes, b.notes);

/** Drops ids that no longer exist, e.g. after undo removes a selected device. */
function pruneSelection(selection: Selection, project: Project): Selection {
  const has = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const d = has(project.devices);
  const l = has(project.links);
  const f = has(project.flows);
  const a = has(project.areas);
  const n = has(project.notes);
  const next = {
    devices: selection.devices.filter((id) => d.has(id)),
    links: selection.links.filter((id) => l.has(id)),
    flows: selection.flows.filter((id) => f.has(id)),
    areas: selection.areas.filter((id) => a.has(id)),
    notes: selection.notes.filter((id) => n.has(id)),
  };
  return sameSelection(next, selection) ? selection : next;
}

const validSite = (project: Project, siteId: string) =>
  project.sites.some((s) => s.id === siteId) ? siteId : project.sites[0].id;

const initial = demoProject();

export const useProject = create<ProjectState>((set, get) => {
  const setHistory = (history: History) =>
    set((s) => ({
      history,
      project: history.present,
      selection: pruneSelection(s.selection, history.present),
      activeSiteId: validSite(history.present, s.activeSiteId),
    }));

  const pasteInto = (fragment: Fragment) => {
    const { project, history } = get();
    if (fragment.devices.length === 0) return;
    const result = pasteFragment(project, fragment, PASTE_OFFSET, get().activeSiteId);
    setHistory(commit(history, result.project));
    set({ selection: { ...NO_SELECTION, devices: result.deviceIds } });
  };

  return {
    project: initial,
    history: initHistory(initial),
    selection: NO_SELECTION,
    connectMode: 'link',
    flowProtocol: 'modbus',
    snapToGrid: false,
    clipboard: null,
    activeSiteId: initial.sites[0].id,
    activeLevel: null,
    levelTabs: [],
    filter: NO_FILTER,
    loadCount: 0,
    focus: null,
    pendingConnect: null,
    apply: (op, coalesceKey) => {
      const { history } = get();
      const next = commit(history, op(history.present), coalesceKey);
      if (next !== history) setHistory(next);
    },
    undo: () => setHistory(undo(get().history)),
    redo: () => setHistory(redo(get().history)),
    jumpHistory: (delta) => setHistory(jump(get().history, delta)),
    load: (project) =>
      set((s) => ({
        project,
        history: initHistory(project),
        selection: NO_SELECTION,
        activeSiteId: project.sites[0].id,
        activeLevel: null,
        levelTabs: [],
        filter: NO_FILTER,
        loadCount: s.loadCount + 1,
        pendingConnect: null,
      })),
    select: (selection) => {
      if (!sameSelection(selection, get().selection)) set({ selection });
    },
    selectAll: () =>
      set((s) => ({ selection: { ...NO_SELECTION, devices: s.project.devices.filter((d) => d.siteId === s.activeSiteId).map((d) => d.id) } })),
    setActiveSite: (siteId) => {
      if (siteId !== get().activeSiteId) set({ activeSiteId: validSite(get().project, siteId), activeLevel: null, levelTabs: [], selection: NO_SELECTION, pendingConnect: null });
    },
    openLevel: (level) => {
      const tabs = get().levelTabs;
      set({ activeLevel: level, levelTabs: level === null || tabs.includes(level) ? tabs : [...tabs, level].sort((a, b) => b - a), pendingConnect: null });
    },
    focusDevice: (deviceId) => {
      const device = get().project.devices.find((d) => d.id === deviceId);
      if (!device) return;
      // From a level tab the device is shown in its own level's tab; from the overview, in the overview.
      const { activeLevel, activeSiteId } = get();
      if (device.siteId !== activeSiteId) set({ activeLevel: null, levelTabs: [] });
      else if (activeLevel !== null) get().openLevel(device.purdueLevel);
      set({ activeSiteId: device.siteId, selection: { ...NO_SELECTION, devices: [deviceId] }, focus: { deviceIds: [deviceId], nonce: Date.now() } });
    },
    focusItems: (selection, deviceIds) => {
      const devices = get().project.devices;
      const first = devices.find((d) => d.id === deviceIds[0]);
      if (!first) return;
      const onSite = deviceIds.filter((id) => devices.find((d) => d.id === id)?.siteId === first.siteId);
      // Findings and attack paths can span levels, so they are shown in the overview.
      set({ activeLevel: null, ...(first.siteId !== get().activeSiteId && { levelTabs: [] }), activeSiteId: first.siteId, selection: { ...NO_SELECTION, ...selection }, focus: { deviceIds: onSite, nonce: Date.now() }, pendingConnect: null });
    },
    clearFocus: () => set({ focus: null }),
    setFilter: (filter) => set({ filter }),
    copy: () => {
      const { project, selection } = get();
      if (selection.devices.length) set({ clipboard: extractFragment(project, selection.devices) });
    },
    paste: () => {
      const { clipboard } = get();
      if (clipboard) pasteInto(clipboard);
    },
    duplicate: () => {
      const { project, selection } = get();
      if (selection.devices.length) pasteInto(extractFragment(project, selection.devices));
    },
    insertFragment: (fragment) => pasteInto(fragment),
    setConnectMode: (connectMode) => set({ connectMode }),
    setFlowProtocol: (flowProtocol) => set({ flowProtocol, connectMode: 'flow' }),
    setPendingConnect: (pendingConnect) => set({ pendingConnect }),
    toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  };
});
