import { Cable, CircleHelp, Download, FileOutput, FilePlus2, PanelLeft, PanelRight, FolderOpen, Grid3x3, Redo2, Search, Undo2, Workflow } from 'lucide-react';
import { useRef, type ReactElement } from 'react';
import { useReactFlow } from '@xyflow/react';
import { devicesToCsv, flowsToCsv, rulesToCsv } from '../model/csv';
import { projectToMarkdown } from '../model/exportDoc';
import { parseProject, serializeProject } from '../model/io';
import { PROTOCOLS } from '../model/protocols';
import { useAutosaveStatus } from '../store/autosave';
import { useTheme, type Theme } from '../store/theme';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';
import { downloadText, downloadUrl, slug } from './download';
import { exportDiagram } from './exportDiagram';
import { useProject, type ConnectMode } from '../store/useProject';

const clock = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

export function Toolbar({
  onErrors,
  onSearch,
  onNew,
  onHelp,
  diagramVisible,
  drawer,
  onDrawer,
}: {
  onErrors: (errors: string[]) => void;
  onSearch: () => void;
  onNew: () => void;
  onHelp: () => void;
  diagramVisible: boolean;
  drawer: 'palette' | 'inspector' | null;
  onDrawer: (drawer: 'palette' | 'inspector') => void;
}) {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const project = useProject((s) => s.project);
  const load = useProject((s) => s.load);
  const connectMode = useProject((s) => s.connectMode);
  const setConnectMode = useProject((s) => s.setConnectMode);
  const flowProtocol = useProject((s) => s.flowProtocol);
  const setFlowProtocol = useProject((s) => s.setFlowProtocol);
  const canUndo = useProject((s) => s.history.past.length > 0);
  const canRedo = useProject((s) => s.history.future.length > 0);
  const undo = useProject((s) => s.undo);
  const redo = useProject((s) => s.redo);
  const snapToGrid = useProject((s) => s.snapToGrid);
  const toggleSnap = useProject((s) => s.toggleSnap);
  const autosave = useAutosaveStatus();
  const fileInput = useRef<HTMLInputElement>(null);

  const replace = (next: typeof project, message: string) => {
    if (project.devices.length > 0 && !window.confirm(message)) return;
    onErrors([]);
    load(next);
  };

  const save = () => downloadText(`${slug(project.name)}.conduitot.json`, serializeProject(project), 'application/json');

  const closeMenu = () => exportMenu.current?.removeAttribute('open');
  const exportAs = async (format: 'svg' | 'png') => {
    closeMenu();
    try {
      downloadUrl(`${slug(project.name)}.${format}`, await exportDiagram(reactFlow, format));
    } catch (err) {
      onErrors([`Could not export the diagram: ${(err as Error).message}`]);
    }
  };
  const exportFile = (suffix: string, text: string, mime: string) => {
    closeMenu();
    downloadText(`${slug(project.name)}${suffix}`, text, mime);
  };

  const open = async (file: File) => {
    const result = parseProject(await file.text());
    if (!result.ok) {
      onErrors([`Could not open ${file.name}:`, ...result.errors]);
      return;
    }
    replace(result.project, 'Open this file and discard the current architecture?');
  };

  const modes: { value: ConnectMode; label: string; icon: ReactElement }[] = [
    { value: 'link', label: 'Network link', icon: <Cable size={16} /> },
    { value: 'flow', label: 'Protocol flow', icon: <Workflow size={16} /> },
  ];

  return (
    <header className="toolbar">
      <div className="brand">
        <img src="./favicon.svg" alt="" width={26} height={26} />
        <span className="brand__name">ConduitOT</span>
        <span className="brand__project" title={project.name}>
          {project.name}
        </span>
      </div>

      <div className="toolbar__group narrow-only" role="group" aria-label="Panels">
        <button type="button" className={`button icon-only${drawer === 'palette' ? ' is-active' : ''}`} aria-pressed={drawer === 'palette'} onClick={() => onDrawer('palette')} aria-label="Device palette" title="Device palette">
          <PanelLeft size={16} />
        </button>
        <button type="button" className={`button icon-only${drawer === 'inspector' ? ' is-active' : ''}`} aria-pressed={drawer === 'inspector'} onClick={() => onDrawer('inspector')} aria-label="Properties panel" title="Properties panel">
          <PanelRight size={16} />
        </button>
      </div>

      <button type="button" className="button search-trigger" onClick={onSearch} title="Find a device (Ctrl+K or /)">
        <Search size={16} />
        Find
        <kbd>Ctrl K</kbd>
      </button>

      <div className="toolbar__group" role="group" aria-label="Edit">
        <button type="button" className="button icon-only" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Undo2 size={16} />
        </button>
        <button type="button" className="button icon-only" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          className={`segment icon-only${snapToGrid ? ' is-active' : ''}`}
          aria-pressed={snapToGrid}
          onClick={toggleSnap}
          title="Snap to grid"
          aria-label="Snap to grid"
        >
          <Grid3x3 size={16} />
        </button>
      </div>

      <div className="toolbar__group" role="group" aria-label="Connection type">
        <span className="toolbar__label">Connect as</span>
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            className={`segment${connectMode === m.value ? ' is-active' : ''}`}
            aria-pressed={connectMode === m.value}
            onClick={() => setConnectMode(m.value)}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
        <select
          className="toolbar__select"
          value={flowProtocol}
          onChange={(e) => setFlowProtocol(e.target.value)}
          aria-label="Protocol for new flows"
          title="Protocol for new flows"
        >
          {PROTOCOLS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar__group">
        <button type="button" className="button" onClick={onNew} title="Start from a template or a blank canvas">
          <FilePlus2 size={16} />
          New
        </button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          <FolderOpen size={16} />
          Open
        </button>
        <button type="button" className="button" onClick={save} title="Download the project as a JSON file">
          <Download size={16} />
          Save
        </button>
        <details className="menu" ref={exportMenu}>
          <summary className="button">
            <FileOutput size={16} />
            Export
          </summary>
          <div className="menu__items" role="menu">
            <button type="button" role="menuitem" disabled={!diagramVisible} onClick={() => exportAs('svg')} title={diagramVisible ? undefined : 'Switch to the diagram view first'}>
              Diagram as SVG
            </button>
            <button type="button" role="menuitem" disabled={!diagramVisible} onClick={() => exportAs('png')} title={diagramVisible ? undefined : 'Switch to the diagram view first'}>
              Diagram as PNG
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!diagramVisible}
              onClick={() => {
                closeMenu();
                window.print();
              }}
            >
              Print / save as PDF…
            </button>
            <hr />
            <button type="button" role="menuitem" onClick={() => exportFile('.md', projectToMarkdown(project), 'text/markdown')}>
              Architecture document (Markdown)
            </button>
            <button type="button" role="menuitem" onClick={() => exportFile('-devices.csv', devicesToCsv(project), 'text/csv')}>
              Devices (CSV)
            </button>
            <button type="button" role="menuitem" onClick={() => exportFile('-flows.csv', flowsToCsv(project), 'text/csv')}>
              Protocol flows (CSV)
            </button>
            <button type="button" role="menuitem" onClick={() => exportFile('-firewall-rules.csv', rulesToCsv(project), 'text/csv')}>
              Firewall rules (CSV)
            </button>
          </div>
        </details>
        <select className="toolbar__select" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Colour theme" title="Colour theme">
          <option value="system">Theme: system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="contrast">High contrast</option>
        </select>
        <button type="button" className="button icon-only" onClick={onHelp} aria-label="Keyboard shortcuts and help" title="Keyboard shortcuts (?)">
          <CircleHelp size={16} />
        </button>
        <span className={`autosave${autosave.failed ? ' is-failed' : ''}`} aria-live="polite">
          {autosave.failed ? 'Not saved in browser' : autosave.savedAt ? `Saved in browser ${clock.format(autosave.savedAt)}` : ''}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void open(file);
          }}
        />
      </div>
    </header>
  );
}
