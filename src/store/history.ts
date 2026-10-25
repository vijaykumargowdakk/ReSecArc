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

/** Moves `delta` steps back (negative) or forward (positive) in one go, stopping at either end. */
export function jump(h: History, delta: number): History {
  let next = h;
  for (let i = 0; i < Math.abs(delta); i++) next = delta < 0 ? undo(next) : redo(next);
  return next;
}

/** Every snapshot from oldest to newest, and the index of the one on screen. */
export function timeline(h: History): { states: Project[]; current: number } {
  return { states: [...h.past, h.present, ...h.future], current: h.past.length };
}

export function redo(h: History): History {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), last: null };
}
