// Every action that can be run by name from the command palette. Each command reads the current
// state when it runs, so the list can be built once when the palette opens.
import type { ReactFlowInstance } from '@xyflow/react';
import { addPolicy, newPolicy } from '../model/policies';
import { levelLabel, PURDUE_LANES } from '../model/purdue';
import { isStacked, setLevelStacked } from '../model/stacks';
import { PROTOCOLS } from '../model/protocols';
import { saveRevision } from '../model/revisions';
import { announce } from '../store/announcer';
import { installApp, useInstall } from '../store/install';
import { LAYER_LABELS, TEXT_SIZES, usePrefs, type Layers } from '../store/prefs';
import { useSecurity, type SecurityTab } from '../store/security';
import { useTheme, type Theme } from '../store/theme';
import { NO_SELECTION, useProject } from '../store/useProject';
import { addNoteInView, canRestoreTidy, chooseProjectFile, saveProjectFile, tidyOpenSite, toggleTidy } from './actions';
import { exportAttackFlow, exportImage, exportText, printReport } from './exports';
import type { CanvasEdge } from './canvas/edges';
import { startKeyboardConnect } from './canvas/useKeyboardConnect';
import { PANEL_SHORTCUTS, PANEL_TITLES } from './PanelChrome';
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

export type ViewName = 'diagram' | 'inventory' | 'outline';

export interface CommandContext {
  view: ViewName;
  setView: (view: ViewName) => void;
  openSearch: () => void;
  openHelp: () => void;
  openShare: () => void;
  openMerge: () => void;
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
  const prefs = usePrefs.getState();
  const layers = prefs.layers;
  const list: Command[] = [];
  const add = (group: string, id: string, label: string, run: () => void, opts: Partial<Pick<Command, 'shortcut' | 'keywords' | 'enabled'>> = {}) =>
    list.push({ group, id, label, run, enabled: opts.enabled ?? true, shortcut: opts.shortcut, keywords: opts.keywords });

  add('File', 'new', 'New architecture from a template…', ctx.openNew, { keywords: 'blank start create' });
  add('File', 'open', 'Open a project file…', chooseProjectFile, { keywords: 'load json' });
  add('File', 'save', 'Save the project file', () => saveProjectFile(useProject.getState().project), { shortcut: 'Ctrl+S', keywords: 'download json' });
  add('File', 'share', 'Share the design as a link…', ctx.openShare, { keywords: 'url copy send' });
  add('File', 'merge', 'Merge sites from another project…', ctx.openMerge, { keywords: 'import combine join file' });
  if (useInstall.getState().offer) add('File', 'install', 'Install ReSecArc as an app…', installApp, { keywords: 'offline desktop pwa' });

  add('Export', 'svg', 'Export the diagram as SVG', () => void exportImage(rf, project, 'svg', ctx.onErrors), { enabled: diagram, keywords: 'image picture' });
  add('Export', 'png', 'Export the diagram as PNG', () => void exportImage(rf, project, 'png', ctx.onErrors), { enabled: diagram, keywords: 'image picture' });
  add('Export', 'print', 'Print the diagram or save it as PDF…', () => window.print(), { enabled: diagram });
  add('Export', 'report', 'Export the full report (HTML)', () => void exportText(project, 'report'), { keywords: 'document every site findings attack paths' });
  add('Export', 'print-report', 'Print the full report or save it as PDF…', () => void printReport(project), { keywords: 'document pdf' });
  add('Export', 'drawio', 'Export all sites for draw.io', () => void exportText(project, 'drawio'), { keywords: 'diagrams.net visio diagram' });
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
  add('Edit', 'tidy', `Tidy the layout of this ${state.activeLevel === null ? 'site' : 'level'}`, () => void tidyOpenSite(rf), { enabled: diagram, keywords: 'arrange auto layout' });
  add('Edit', 'untidy', 'Undo tidy: put back the layout from before it', () => toggleTidy(rf), {
    enabled: diagram && canRestoreTidy(project, state.activeSiteId),
    keywords: 'arrange auto layout restore previous',
  });
  add('Edit', 'snap', `${state.snapToGrid ? 'Turn off' : 'Turn on'} snap to grid`, () => useProject.getState().toggleSnap());
  add('Edit', 'revision', 'Save a revision of the design', () => {
    useProject.getState().apply((p) => saveRevision(p, ''));
    announce('Revision saved');
  }, { keywords: 'snapshot baseline version' });

  add('View', 'diagram', 'Show the diagram', () => ctx.setView('diagram'), { enabled: !diagram });
  add('View', 'inventory', 'Show the inventory', () => ctx.setView('inventory'), { enabled: ctx.view !== 'inventory', keywords: 'table spreadsheet' });
  add('View', 'outline', 'Show the outline', () => ctx.setView('outline'), { enabled: ctx.view !== 'outline', keywords: 'tree list keyboard screen reader' });
  add('View', 'find', 'Find a device…', ctx.openSearch, { shortcut: 'Ctrl+K', keywords: 'search' });
  add('View', 'fit', 'Fit the diagram to the screen', () => rf.fitView({ padding: 0.1, duration: 250 }), { enabled: diagram, keywords: 'zoom' });
  for (const key of Object.keys(LAYER_LABELS) as (keyof Layers)[]) {
    const on = layers[key];
    add('View', `layer-${key}`, `${on ? 'Hide' : 'Show'} ${LAYER_LABELS[key].toLowerCase()}`, () => usePrefs.getState().setLayer(key, !on), { keywords: 'layer' });
  }
  for (const t of THEMES) {
    add('View', `theme-${t.value}`, `Theme: ${t.label}`, () => useTheme.getState().setTheme(t.value), { keywords: 'colour color dark light contrast' });
  }
  for (const t of TEXT_SIZES) {
    add('View', `text-${t.value}`, `Text size: ${t.label} (${Math.round(t.value * 100)}%)`, () => usePrefs.getState().setTextSize(t.value), {
      enabled: prefs.textSize !== t.value,
      keywords: 'font bigger smaller zoom scale read',
    });
  }
  for (const panel of ['palette', 'inspector'] as const) {
    const open = prefs.panels[panel].open;
    add('View', `panel-${panel}`, `${open ? 'Hide' : 'Show'} the ${PANEL_TITLES[panel].toLowerCase()}${panel === 'inspector' ? ' panel' : ''}`, () => usePrefs.getState().togglePanel(panel), {
      shortcut: PANEL_SHORTCUTS[panel],
      keywords: 'sidebar side panel fold collapse',
    });
    add('View', `panel-width-${panel}`, `Reset the width of the ${PANEL_TITLES[panel].toLowerCase()}${panel === 'inspector' ? ' panel' : ''}`, () => usePrefs.getState().setPanelWidth(panel, null), {
      enabled: prefs.panels[panel].width !== null,
      keywords: 'sidebar resize default',
    });
  }

  const showSecurity = (tab: SecurityTab) => {
    useSecurity.getState().show(tab);
    useProject.getState().select(NO_SELECTION);
  };
  add('Security', 'security-findings', 'Show security findings', () => showSecurity('findings'), { keywords: 'iec 62443 checks violations policy' });
  add('Security', 'attack-paths', 'Show attack paths', () => showSecurity('paths'), { keywords: 'mitre att&ck ics attack flow reachability' });
  add('Security', 'attack-flow', 'Export attack paths (MITRE Attack Flow)', () => {
    void exportAttackFlow(useProject.getState().project, useSecurity.getState().overrides);
  }, { keywords: 'stix json mitre att&ck download' });
  add('Security', 'security-policy', 'Add a company policy rule', () => {
    useProject.getState().apply((p) => addPolicy(p, newPolicy()));
    showSecurity('rules');
    announce('Policy rule added. Edit it in the Rules tab of the Security panel.');
  }, { keywords: 'security rule iec 62443' });

  const one = selection.devices.length === 1 ? selection.devices[0] : null;
  add('Connect', 'key-link', 'Link the selected device to another (arrow keys choose)', () => one && startKeyboardConnect('link', one), {
    shortcut: 'L',
    enabled: diagram && one !== null,
    keywords: 'keyboard connect',
  });
  add('Connect', 'key-flow', 'Add a flow from the selected device (arrow keys choose)', () => one && startKeyboardConnect('flow', one), {
    shortcut: 'F',
    enabled: diagram && one !== null,
    keywords: 'keyboard connect protocol',
  });
  add('Connect', 'mode-link', 'Draw new connections as network links', () => useProject.getState().setConnectMode('link'));
  add('Connect', 'mode-flow', 'Draw new connections as protocol flows', () => useProject.getState().setConnectMode('flow'));
  for (const p of PROTOCOLS) {
    add('Connect', `protocol-${p.id}`, `Use ${p.label} for new protocol flows`, () => useProject.getState().setFlowProtocol(p.id), { keywords: 'protocol' });
  }

  // Levels of the open site that have devices, plus the open level tab even if it is now empty.
  const site = project.sites.find((s) => s.id === state.activeSiteId);
  const showLevel = (level: (typeof PURDUE_LANES)[number]['level'] | null) => {
    ctx.setView('diagram');
    useProject.getState().openLevel(level);
  };
  add('Levels', 'overview', 'Show the overview of this site', () => showLevel(null), { enabled: state.activeLevel !== null, keywords: 'level tab all levels' });
  for (const lane of PURDUE_LANES) {
    const label = levelLabel(lane.level);
    const used = project.devices.some((d) => d.siteId === state.activeSiteId && d.purdueLevel === lane.level);
    if (!used && state.activeLevel !== lane.level) continue;
    add('Levels', `level-${lane.level}`, `Open ${label} ${lane.name} in its own tab`, () => showLevel(lane.level), {
      enabled: state.activeLevel !== lane.level || !diagram,
      keywords: 'level tab purdue lane',
    });
    if (state.levelTabs.includes(lane.level)) {
      add('Levels', `close-level-${lane.level}`, `Close the ${label} tab`, () => void import('./LevelTabs').then((m) => m.closeLevelTab(lane.level)), { keywords: 'level tab' });
    }
    const on = isStacked(site, lane.level);
    add('Levels', `stack-${lane.level}`, `${on ? 'Stop stacking' : 'Stack similar'} devices on ${label}`, () => {
      useProject.getState().apply((p) => setLevelStacked(p, state.activeSiteId, lane.level, !on));
      announce(on ? `Stacking off for ${label}` : `Similar devices on ${label} are drawn as stacks`);
    }, { enabled: used, keywords: 'stack group collapse similar devices overview level' });
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
