import { ReactFlowProvider } from '@xyflow/react';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clearAutosave, readAutosave, startAutosave, type Snapshot } from './store/autosave';
import { useProject } from './store/useProject';
import { Canvas } from './ui/canvas/Canvas';
import { Inspector } from './ui/inspector/Inspector';
import { Palette } from './ui/Palette';
import { Toolbar } from './ui/Toolbar';
import { useShortcuts } from './ui/useShortcuts';

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function App() {
  const [errors, setErrors] = useState<string[]>([]);
  // Read once: a pending snapshot must be restored or discarded before autosave may overwrite it.
  const [pending, setPending] = useState<Snapshot | null>(readAutosave);
  const load = useProject((s) => s.load);
  useShortcuts();

  useEffect(() => (pending ? undefined : startAutosave()), [pending]);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar onErrors={setErrors} />
        {pending && (
          <div className="notice notice--info" role="status">
            <p>
              Unsaved work from <strong>{timeFormat.format(pending.savedAt)}</strong> (“{pending.project.name}”) was found in this
              browser.
            </p>
            <button
              type="button"
              className="button"
              onClick={() => {
                load(pending.project);
                setPending(null);
              }}
            >
              Restore
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                clearAutosave();
                setPending(null);
              }}
            >
              Discard
            </button>
          </div>
        )}
        {errors.length > 0 && (
          <div className="notice" role="alert">
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <button type="button" className="icon-button" onClick={() => setErrors([])} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        <main className="workspace">
          <Palette />
          <Canvas />
          <Inspector />
        </main>
      </div>
    </ReactFlowProvider>
  );
}
