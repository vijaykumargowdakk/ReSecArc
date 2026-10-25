// Undo/redo as pure functions over immutable snapshots, so the store stays thin and this is testable.
import type { Project } from '../model/schema';

export const HISTORY_LIMIT = 100;
/** Edits with the same key closer together than this collapse into one undo step. */
export const COALESCE_MS = 600;

export interface History {
  past: Project[];
  present: Project;
  future: Project[];
  last: { key: string; at: number } | null;
}

export function initHistory(present: Project): History {
  return { past: [], present, future: [], last: null };
}

/** Records `next` as the new present. A no-op change returns `h` unchanged. */
export function commit(h: History, next: Project, coalesceKey?: string, now = Date.now()): History {
  if (next === h.present) return h;
  const merge = coalesceKey !== undefined && h.last?.key === coalesceKey && now - h.last.at < COALESCE_MS;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], last: coalesceKey === undefined ? null : { key: coalesceKey, at: now } };
}

export function undo(h: History): History {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], last: null };
}

export function redo(h: History): History {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), last: null };
}
