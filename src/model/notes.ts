// Free text notes placed on a site's canvas: annotations, legends, change remarks.
import { newId } from './ops';
import type { Note, Project } from './schema';

export const NOTE_COLORS = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#0ea5e9', label: 'Blue' },
  { value: '#16a34a', label: 'Green' },
  { value: '#db2777', label: 'Pink' },
  { value: '#64748b', label: 'Grey' },
] as const;
export const NOTE_WIDTHS = [
  { value: 180, label: 'Narrow' },
  { value: 260, label: 'Medium' },
  { value: 360, label: 'Wide' },
] as const;

export function createNote(siteId: string, position: { x: number; y: number }, id = newId('note')): Note {
  return { id, siteId, text: 'New note', position, width: NOTE_WIDTHS[1].value, color: NOTE_COLORS[0].value, locked: false };
}

export function addNote(project: Project, note: Note): Project {
  return { ...project, notes: [...project.notes, note] };
}

export function updateNote(project: Project, id: string, patch: Partial<Omit<Note, 'id' | 'siteId'>>): Project {
  return { ...project, notes: project.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function moveNote(project: Project, id: string, position: { x: number; y: number }): Project {
  const note = project.notes.find((n) => n.id === id);
  if (!note || (note.position.x === position.x && note.position.y === position.y)) return project;
  return updateNote(project, id, { position });
}

export function removeNote(project: Project, id: string): Project {
  return { ...project, notes: project.notes.filter((n) => n.id !== id) };
}
