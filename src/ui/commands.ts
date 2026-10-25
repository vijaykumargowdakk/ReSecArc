// Every action that can be run by name from the command palette. Each command reads the current
// state when it runs, so the list can be built once when the palette opens.
import type { ReactFlowInstance } from '@xyflow/react';
import { PROTOCOLS } from '../model/protocols';
import { saveRevision } from '../model/revisions';
import { announce } from '../store/announcer';
import { LAYER_LABELS, usePrefs, type Layers } from '../store/prefs';
import { useTheme, type Theme } from '../store/theme';
import { useProject } from '../store/useProject';
import { addNoteInView, chooseProjectFile, exportImage, exportText, saveProjectFile, tidyOpenSite } from './actions';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';

export interface Command {
  id: string;
  group: string;
  label: string;
  /** Shown beside the command; the key handling itself lives in useShortcuts. */
  shortcut?: string;
  /** Extra words that should find this command. */
  keywords?: string;
  enabled: boolean;
  run: () => void;
}

export interface CommandContext {
  view: 'diagram' | 'inventory';
  setView: (view: 'diagram' | 'inventory') => void;
  openSearch: () => void;
  openHelp: () => void;
  openShare: () => void;
  openNew: () => void;
  openTour: () => void;
  onErrors: (errors: string[]) => void;
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Follow the system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'High contrast' },
];

export function buildCommands(ctx: CommandContext, rf: ReactFlowInstance<CanvasNode, CanvasEdge>): Command[] {
  const state = useProject.getState();
  const { project, history, selection } = state;
  const diagram = ctx.view === 'diagram';
  const layers = usePrefs.getState().layers;
  const list: Command[] = [];
  const add = (group: string, id: string, label: string, run: () => void, opts: Partial<Pick<Command, 'shortcut' | 'keywords' | 'enabled'>> = {}) =>
    list.push({ group, id, label, run, enabled: opts.enabled ?? true, shortcut: opts.shortcut, keywords: opts.keywords });

  add('File', 'new', 'New architecture from a template…', ctx.openNew, { keywords: 'blank start create' });
  add('File', 'open', 'Open a project file…', chooseProjectFile, { keywords: 'load json' });
  add('File', 'save', 'Save the project file', () => saveProjectFile(useProject.getState().project), { shortcut: 'Ctrl+S', keywords: 'download json' });
  add('File', 'share', 'Share the design as a link…', ctx.openShare, { keywords: 'url copy send' });

  add('Export', 'svg', 'Export the diagram as SVG', () => void exportImage(rf, project, 'svg', ctx.onErrors), { enabled: diagram, keywords: 'image picture' });
  add('Export', 'png', 'Export the diagram as PNG', () => void exportImage(rf, project, 'png', ctx.onErrors), { enabled: diagram, keywords: 'image picture' });
  add('Export', 'print', 'Print the diagram or save it as PDF…', () => window.print(), { enabled: diagram });
  add('Export', 'md', 'Export the architecture record (Markdown)', () => void exportText(project, 'md'), { keywords: 'document report' });
  add('Export', 'devices-csv', 'Export devices (CSV)', () => void exportText(project, 'devices'), { keywords: 'spreadsheet inventory' });
  add('Export', 'links-csv', 'Export network links (CSV)', () => void exportText(project, 'links'), { keywords: 'spreadsheet ports' });
  add('Export', 'flows-csv', 'Export protocol flows (CSV)', () => void exportText(project, 'flows'), { keywords: 'spreadsheet' });
  add('Export', 'rules-csv', 'Export firewall rules (CSV)', () => void exportText(project, 'rules'), { keywords: 'spreadsheet' });

  add('Edit', 'undo', 'Undo', () => useProject.getState().undo(), { shortcut: 'Ctrl+Z', enabled: history.past.length > 0 });
  add('Edit', 'redo', 'Redo', () => useProject.getState().redo(), { shortcut: 'Ctrl+Shift+Z', enabled: history.future.length > 0 });
  add('Edit', 'history', 'Show the edit history…', () => document.querySelector<HTMLElement>('.history-menu summary')?.click(), { keywords: 'undo steps' });
  add('Edit', 'select-all', 'Select every device on this site', () => useProject.getState().selectAll(), { shortcut: 'Ctrl+A', enabled: diagram });
  add('Edit', 'duplicate', 'Duplicate the selected devices', () => useProject.getState().duplicate(), { shortcut: 'Ctrl+D', enabled: selection.devices.length > 0 });
  add('Edit', 'note', 'Add a text note', () => addNoteInView(rf), { enabled: diagram, keywords: 'annotation comment' });
  add('Edit', 'tidy', 'Tidy the layout of this site', () => tidyOpenSite(rf), { enabled: diagram, keywords: 'arrange auto layout' });
  add('Edit', 'snap', `${state.snapToGrid ? 'Turn off' : 'Turn on'} snap to grid`, () => useProject.getState().toggleSnap());
  add('Edit', 'revision', 'Save a revision of the design', () => {
    useProject.getState().apply((p) => saveRevision(p, ''));
    announce('Revision saved');
  }, { keywords: 'snapshot baseline version' });

  add('View', 'diagram', 'Show the diagram', () => ctx.setView('diagram'), { enabled: !diagram });
  add('View', 'inventory', 'Show the inventory', () => ctx.setView('inventory'), { enabled: diagram, keywords: 'table spreadsheet' });
  add('View', 'find', 'Find a device…', ctx.openSearch, { shortcut: 'Ctrl+K', keywords: 'search' });
  add('View', 'fit', 'Fit the diagram to the screen', () => rf.fitView({ padding: 0.1, duration: 250 }), { enabled: diagram, keywords: 'zoom' });
  for (const key of Object.keys(LAYER_LABELS) as (keyof Layers)[]) {
    const on = layers[key];
    add('View', `layer-${key}`, `${on ? 'Hide' : 'Show'} ${LAYER_LABELS[key].toLowerCase()}`, () => usePrefs.getState().setLayer(key, !on), { keywords: 'layer' });
  }
  for (const t of THEMES) {
    add('View', `theme-${t.value}`, `Theme: ${t.label}`, () => useTheme.getState().setTheme(t.value), { keywords: 'colour color dark light contrast' });
  }

  add('Connect', 'mode-link', 'Draw new connections as network links', () => useProject.getState().setConnectMode('link'));
  add('Connect', 'mode-flow', 'Draw new connections as protocol flows', () => useProject.getState().setConnectMode('flow'));
  for (const p of PROTOCOLS) {
    add('Connect', `protocol-${p.id}`, `Use ${p.label} for new protocol flows`, () => useProject.getState().setFlowProtocol(p.id), { keywords: 'protocol' });
  }

  if (project.sites.length > 1) {
    for (const site of project.sites) {
      add('Sites', `site-${site.id}`, `Go to site ${site.name}`, () => {
        ctx.setView('diagram');
        useProject.getState().setActiveSite(site.id);
      }, { enabled: site.id !== state.activeSiteId });
    }
  }

  add('Help', 'shortcuts', 'Keyboard shortcuts', ctx.openHelp, { shortcut: '?' });
  add('Help', 'tour', 'Take the tour', ctx.openTour, { keywords: 'introduction guide help' });
  return list;
}

/** Commands whose group, label or keywords contain every typed word, best matches first. */
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const usable = commands.filter((c) => c.enabled);
  if (words.length === 0) return usable;
  return usable
    .map((c) => {
      const label = c.label.toLowerCase();
      const hay = `${label} ${c.group.toLowerCase()} ${c.keywords ?? ''}`;
      if (!words.every((w) => hay.includes(w))) return null;
      const score = words.reduce((n, w) => n + (label.startsWith(w) ? 3 : label.includes(w) ? 2 : 1), 0);
      return { c, score };
    })
    .filter((x): x is { c: Command; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}
