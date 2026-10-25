import { Cable, Download, Factory, FilePlus2, FolderOpen, Grid3x3, Redo2, Search, Undo2, Workflow } from 'lucide-react';
import { useRef, type ReactElement } from 'react';
import { parseProject, serializeProject } from '../model/io';
import { PROTOCOLS } from '../model/protocols';
import { emptyProject } from '../model/ops';
import { useAutosaveStatus } from '../store/autosave';
import { demoProject, useProject, type ConnectMode } from '../store/useProject';

const clock = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

function fileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'architecture'}.conduitot.json`;
}

export function Toolbar({ onErrors, onSearch }: { onErrors: (errors: string[]) => void; onSearch: () => void }) {
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

  const save = () => {
    const blob = new Blob([serializeProject(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(project.name);
    a.click();
    URL.revokeObjectURL(url);
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
        <button type="button" className="button" onClick={() => replace(emptyProject(), 'Start a new architecture and discard the current one?')}>
          <FilePlus2 size={16} />
          New
        </button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          <FolderOpen size={16} />
          Open
        </button>
        <button type="button" className="button" onClick={save}>
          <Download size={16} />
          Save
        </button>
        <button type="button" className="button" onClick={() => replace(demoProject(), 'Load the demo plant and discard the current architecture?')}>
          <Factory size={16} />
          Demo
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
