// Per-browser autosave of the working project. Storage can be unavailable (private mode, blocked
// site data), so every access is guarded and the editor keeps working without it.
import { create } from 'zustand';
import { parseProject, serializeProject } from '../model/io';
import type { Project } from '../model/schema';
import { useProject } from './useProject';

const KEY = 'conduitot:autosave';
const DEBOUNCE_MS = 1000;

export interface Snapshot {
  savedAt: number;
  project: Project;
}

export const useAutosaveStatus = create<{ savedAt: number | null; failed: boolean }>(() => ({ savedAt: null, failed: false }));

export function readAutosave(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { savedAt, project } = JSON.parse(raw) as { savedAt: unknown; project: unknown };
    const parsed = parseProject(JSON.stringify(project));
    return typeof savedAt === 'number' && parsed.ok ? { savedAt, project: parsed.project } : null;
  } catch {
    return null;
  }
}

function write(project: Project): void {
  const savedAt = Date.now();
  try {
    localStorage.setItem(KEY, `{"savedAt":${savedAt},"project":${serializeProject(project)}}`);
    useAutosaveStatus.setState({ savedAt, failed: false });
  } catch {
    useAutosaveStatus.setState({ failed: true });
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** Set while autosave runs; it is not running while a found snapshot waits to be restored or discarded. */
let flush: (() => boolean) | null = null;

/** Saves the project one second after the last change. Returns an unsubscribe function. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = useProject.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(() => write(state.project), DEBOUNCE_MS);
  });
  flush = () => {
    clearTimeout(timer);
    write(useProject.getState().project);
    return !useAutosaveStatus.getState().failed;
  };
  return () => {
    clearTimeout(timer);
    flush = null;
    unsubscribe();
  };
}

const RESUME_KEY = 'conduitot:resume';

/**
 * Saves the project now and marks it to open again straight away after the page reloads, as it
 * does to start a new version of the app. Does nothing while a found snapshot is still on offer.
 */
export function saveForReload(): void {
  if (!flush?.()) return;
  try {
    sessionStorage.setItem(RESUME_KEY, '1');
  } catch {
    // The snapshot is still offered after the reload.
  }
}

/** The snapshot saved by saveForReload, once; null on any other page load. */
export function takeResume(): Snapshot | null {
  try {
    if (!sessionStorage.getItem(RESUME_KEY)) return null;
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    return null;
  }
  return readAutosave();
}
