import { create } from 'zustand';
import demo from '../examples/demo-water-treatment.json';
import { parseProject } from '../model/io';
import { extractFragment, pasteFragment, type Fragment } from '../model/ops';
import type { Project } from '../model/schema';
import { commit, initHistory, redo, undo, type History } from './history';

export interface Selection {
  devices: string[];
  links: string[];
  flows: string[];
}
export const NO_SELECTION: Selection = { devices: [], links: [], flows: [] };
export type ConnectMode = 'link' | 'flow';

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
  /** Applies a pure operation from model/ops. Edits sharing a `coalesceKey` in quick succession undo as one step. */
  apply: (op: (project: Project) => Project, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the project and clears undo history. */
  load: (project: Project) => void;
  select: (selection: Selection) => void;
  selectAll: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  setConnectMode: (mode: ConnectMode) => void;
  setFlowProtocol: (protocol: string) => void;
  toggleSnap: () => void;
}

export function demoProject(): Project {
  const result = parseProject(JSON.stringify(demo));
  if (!result.ok) throw new Error(`Bundled demo project is invalid:\n${result.errors.join('\n')}`);
  return result.project;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const sameSelection = (a: Selection, b: Selection) =>
  sameIds(a.devices, b.devices) && sameIds(a.links, b.links) && sameIds(a.flows, b.flows);

/** Drops ids that no longer exist, e.g. after undo removes a selected device. */
function pruneSelection(selection: Selection, project: Project): Selection {
  const has = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const d = has(project.devices);
  const l = has(project.links);
  const f = has(project.flows);
  const next = {
    devices: selection.devices.filter((id) => d.has(id)),
    links: selection.links.filter((id) => l.has(id)),
    flows: selection.flows.filter((id) => f.has(id)),
  };
  return sameSelection(next, selection) ? selection : next;
}

const initial = demoProject();

export const useProject = create<ProjectState>((set, get) => {
  const setHistory = (history: History) =>
    set((s) => ({ history, project: history.present, selection: pruneSelection(s.selection, history.present) }));

  const pasteInto = (fragment: Fragment) => {
    const { project, history } = get();
    if (fragment.devices.length === 0) return;
    const siteId = fragment.devices[0].siteId;
    const result = pasteFragment(project, fragment, PASTE_OFFSET, project.sites.some((s) => s.id === siteId) ? siteId : project.sites[0].id);
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
    apply: (op, coalesceKey) => {
      const { history } = get();
      const next = commit(history, op(history.present), coalesceKey);
      if (next !== history) setHistory(next);
    },
    undo: () => setHistory(undo(get().history)),
    redo: () => setHistory(redo(get().history)),
    load: (project) => set({ project, history: initHistory(project), selection: NO_SELECTION }),
    select: (selection) => {
      if (!sameSelection(selection, get().selection)) set({ selection });
    },
    selectAll: () => set((s) => ({ selection: { ...NO_SELECTION, devices: s.project.devices.map((d) => d.id) } })),
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
    setConnectMode: (connectMode) => set({ connectMode }),
    setFlowProtocol: (flowProtocol) => set({ flowProtocol, connectMode: 'flow' }),
    toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  };
});
