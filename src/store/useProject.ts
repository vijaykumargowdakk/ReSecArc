import { create } from 'zustand';
import demo from '../examples/demo-water-treatment.json';
import { parseProject } from '../model/io';
import type { Project } from '../model/schema';

export type Selection = { kind: 'device' | 'link' | 'flow'; id: string } | null;
export type ConnectMode = 'link' | 'flow';

interface ProjectState {
  project: Project;
  selection: Selection;
  connectMode: ConnectMode;
  /** Applies a pure operation from model/ops to the current project. */
  apply: (op: (project: Project) => Project) => void;
  load: (project: Project) => void;
  select: (selection: Selection) => void;
  setConnectMode: (mode: ConnectMode) => void;
}

export function demoProject(): Project {
  const result = parseProject(JSON.stringify(demo));
  if (!result.ok) throw new Error(`Bundled demo project is invalid:\n${result.errors.join('\n')}`);
  return result.project;
}

export const useProject = create<ProjectState>((set) => ({
  project: demoProject(),
  selection: null,
  connectMode: 'link',
  apply: (op) => set((s) => ({ project: op(s.project) })),
  load: (project) => set({ project, selection: null }),
  select: (selection) => set({ selection }),
  setConnectMode: (connectMode) => set({ connectMode }),
}));

