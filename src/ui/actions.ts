// Actions shared by the toolbar, the palette and the command palette, so each behaves the same
// wherever it is started from.
import type { ReactFlowInstance } from '@xyflow/react';
import { create } from 'zustand';
import { parseProject, serializeProject } from '../model/io';
import { tidyLayout } from '../model/layout';
import { addNote, createNote } from '../model/notes';
import { countRuleReferences, removeDevice } from '../model/ops';
import type { Project } from '../model/schema';
import { announce } from '../store/announcer';
import { hasEdits, NO_SELECTION, useProject } from '../store/useProject';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';
import { downloadText, slug } from './download';

type Flow = ReactFlowInstance<CanvasNode, CanvasEdge>;

/** The hidden file input in the toolbar; Open in any menu clicks it. */
export const PROJECT_FILE_INPUT_ID = 'project-file-input';

export function chooseProjectFile(): void {
  document.getElementById(PROJECT_FILE_INPUT_ID)?.click();
}

/** Reads a project file and loads it, asking first if the current design has been edited. */
export async function openProjectFile(file: File, onErrors: (errors: string[]) => void): Promise<void> {
  const result = parseProject(await file.text());
  if (!result.ok) {
    onErrors([`Could not open ${file.name}:`, ...result.errors]);
    return;
  }
  if (hasEdits() && !window.confirm('Open this file and discard the current architecture?')) return;
  onErrors([]);
  useProject.getState().load(result.project);
}

export function saveProjectFile(project: Project): void {
  downloadText(`${slug(project.name)}.conduitot.json`, serializeProject(project), 'application/json');
}

/** Adds a note in the middle of the visible canvas and selects it. */
export function addNoteInView(rf: Flow): void {
  const { activeSiteId, apply, select } = useProject.getState();
  const box = document.querySelector('.canvas')?.getBoundingClientRect();
  const at = box ? rf.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }) : { x: 240, y: 40 };
  const note = createNote(activeSiteId, { x: Math.round(at.x - 130), y: Math.round(at.y - 20) });
  apply((p) => addNote(p, note));
  select({ ...NO_SELECTION, notes: [note.id] });
  announce('Note added');
}

/** Deletes a device and its connections once the user confirms; returns whether it was deleted. */
export function deleteDeviceAfterConfirm(deviceId: string): boolean {
  const { project, apply, select } = useProject.getState();
  const device = project.devices.find((d) => d.id === deviceId);
  if (!device) return false;
  const refs = countRuleReferences(project, 'device', device.id);
  const warning = refs ? `\n\n${refs} firewall rule(s) refer to it and will also be removed.` : '';
  if (!window.confirm(`Delete "${device.label}" and its connections?${warning}`)) return false;
  apply((q) => removeDevice(q, device.id));
  select(NO_SELECTION);
  return true;
}

/**
 * The project as the last tidy left it, and the site it tidied. While the design is still exactly
 * that, a second Tidy puts the earlier layout back; any edit in between ends the offer.
 */
export const useLastTidy = create<{ siteId: string; result: Project } | { siteId: null; result: null }>(() => ({ siteId: null, result: null }));

/** True when the Tidy button would put back the layout from before the last tidy. */
export function canRestoreTidy(project: Project, siteId: string): boolean {
  const last = useLastTidy.getState();
  return last.result === project && last.siteId === siteId && useProject.getState().history.past.length > 0;
}

/** Lays out the open site in one undoable step and frames the result. */
export function tidyOpenSite(rf: Flow): void {
  const { apply, activeSiteId } = useProject.getState();
  const before = useProject.getState().project;
  apply((p) => tidyLayout(p, activeSiteId));
  const after = useProject.getState().project;
  if (after === before) {
    announce('Nothing to tidy on this site.');
    return;
  }
  useLastTidy.setState({ siteId: activeSiteId, result: after });
  announce('Layout tidied. Tidy again, or Undo, to put the previous layout back.');
  requestAnimationFrame(() => rf.fitView({ padding: 0.1, duration: 250 }));
}

/** The Tidy button: tidies, or, straight after a tidy with nothing changed since, undoes it. */
export function toggleTidy(rf: Flow): void {
  const { project, activeSiteId, undo } = useProject.getState();
  if (!canRestoreTidy(project, activeSiteId)) return tidyOpenSite(rf);
  undo();
  useLastTidy.setState({ siteId: null, result: null });
  announce('Previous layout put back.');
  requestAnimationFrame(() => rf.fitView({ padding: 0.1, duration: 250 }));
}
