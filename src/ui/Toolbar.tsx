import { Cable, FilePlus2, FolderOpen, Download, Workflow, Factory } from 'lucide-react';
import { useRef, type ReactElement } from 'react';
import { parseProject, serializeProject } from '../model/io';
import { emptyProject } from '../model/ops';
import { demoProject, useProject, type ConnectMode } from '../store/useProject';

function fileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'architecture'}.conduitot.json`;
}

export function Toolbar({ onErrors }: { onErrors: (errors: string[]) => void }) {
  const project = useProject((s) => s.project);
  const load = useProject((s) => s.load);
  const connectMode = useProject((s) => s.connectMode);
  const setConnectMode = useProject((s) => s.setConnectMode);
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
