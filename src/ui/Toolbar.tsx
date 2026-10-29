import { Cable, CircleHelp, Command, Download, FileOutput, FilePlus2, PanelLeft, PanelRight, FolderOpen, Grid3x3, Redo2, Search, ShieldAlert, Undo2, Workflow } from 'lucide-react';
import { lazy, Suspense, useRef, useState, type ReactElement } from 'react';
import { PROTOCOLS } from '../model/protocols';
import { useAutosaveStatus } from '../store/autosave';
import { useFindings } from '../store/derived';
import { useSecurity } from '../store/security';
import { useTheme, type Theme } from '../store/theme';
import { chooseProjectFile, openProjectFile, PROJECT_FILE_INPUT_ID, saveProjectFile } from './actions';
import { HistoryMenu } from './HistoryMenu';
import { NO_SELECTION, useProject, type ConnectMode } from '../store/useProject';

const ExportMenuItems = lazy(() => import('./ExportMenuItems').then((m) => ({ default: m.ExportMenuItems })));

const clock = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

export function Toolbar({
  onErrors,
  onSearch,
  onNew,
  onHelp,
  onShare,
  onCommands,
  diagramVisible,
  drawer,
  onDrawer,
}: {
  onErrors: (errors: string[]) => void;
  onSearch: () => void;
  onNew: () => void;
  onHelp: () => void;
  onShare: () => void;
  onCommands: () => void;
  diagramVisible: boolean;
  drawer: 'palette' | 'inspector' | null;
  onDrawer: (drawer: 'palette' | 'inspector') => void;
}) {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const project = useProject((s) => s.project);
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
  const findings = useFindings();
  const securityOpen = useSecurity((s) => s.open);
  const select = useProject((s) => s.select);
  const showSecurity = () => {
    if (securityOpen) return useSecurity.getState().close();
    useSecurity.getState().show('findings');
    select(NO_SELECTION);
    if (drawer !== 'inspector') onDrawer('inspector');
  };

  const closeMenu = () => exportMenu.current?.removeAttribute('open');
  // The menu's items, and the export code behind them, load the first time it opens.
  const [exportLoaded, setExportLoaded] = useState(false);

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
        <span className="toolbar-text">Find</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button type="button" className="button icon-only" onClick={onCommands} title="Run a command (Ctrl+Shift+P)" aria-label="Command palette">
        <Command size={16} />
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
        <HistoryMenu />
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

      <button
        type="button"
        className={`button security-trigger${securityOpen ? ' is-active' : ''}`}
        aria-pressed={securityOpen}
        onClick={showSecurity}
        title="Security checks based on IEC 62443, and company policies"
      >
        <ShieldAlert size={16} />
        <span className="toolbar-text">Security</span>{' '}
        <span className={`count-badge${findings.some((f) => f.severity === 'high') ? ' count-badge--high' : ''}`}>
          {findings.length}
          <span className="sr-only"> finding{findings.length === 1 ? '' : 's'}</span>
        </span>
      </button>

      <div className="toolbar__group">
        <button type="button" className="button" onClick={onNew} title="Start from a template or a blank canvas">
          <FilePlus2 size={16} />
          New
        </button>
        <button type="button" className="button" onClick={chooseProjectFile}>
          <FolderOpen size={16} />
          Open
        </button>
        <button type="button" className="button" onClick={() => saveProjectFile(project)} title="Download the project as a JSON file (Ctrl+S)">
          <Download size={16} />
          Save
        </button>
        <details className="menu export-menu" ref={exportMenu} onToggle={(e) => e.currentTarget.open && setExportLoaded(true)}>
          <summary className="button">
            <FileOutput size={16} />
            Export
          </summary>
          {exportLoaded && (
            <Suspense fallback={null}>
              <ExportMenuItems diagramVisible={diagramVisible} onShare={onShare} onErrors={onErrors} closeMenu={closeMenu} />
            </Suspense>
          )}
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
        <span
          className={`autosave${autosave.failed ? ' is-failed' : ''}`}
          aria-live="polite"
          title={autosave.failed ? 'This browser did not allow saving. Save the project file to keep your work.' : 'Your work is saved in this browser as you go'}
        >
          {autosave.failed ? 'Not saved' : autosave.savedAt ? <>Saved <span className="sr-only">in this browser at </span>{clock.format(autosave.savedAt)}</> : ''}
        </span>
        <input
          id={PROJECT_FILE_INPUT_ID}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void openProjectFile(file, onErrors);
          }}
        />
      </div>
    </header>
  );
}
