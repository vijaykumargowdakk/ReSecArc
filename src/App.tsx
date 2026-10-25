import { ReactFlowProvider } from '@xyflow/react';
import { Network, Table2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { clearAutosave, readAutosave, startAutosave, type Snapshot } from './store/autosave';
import { NO_SELECTION, useProject } from './store/useProject';
import { Canvas } from './ui/canvas/Canvas';
import { Inspector } from './ui/inspector/Inspector';
import { Inventory } from './ui/Inventory';
import { FilterBar } from './ui/FilterBar';
import { Palette } from './ui/Palette';
import { SearchDialog } from './ui/SearchDialog';
import { SiteTabs } from './ui/SiteTabs';
import { TemplateGallery } from './ui/TemplateGallery';
import { Toolbar } from './ui/Toolbar';
import { useShortcuts } from './ui/useShortcuts';

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function App() {
  const [errors, setErrors] = useState<string[]>([]);
  // Read once: a pending snapshot must be restored or discarded before autosave may overwrite it.
  const [pending, setPending] = useState<Snapshot | null>(readAutosave);
  const load = useProject((s) => s.load);
  const [searching, setSearching] = useState(false);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const [view, setView] = useState<'diagram' | 'inventory'>('diagram');
  const focusDevice = useProject((s) => s.focusDevice);
  const select = useProject((s) => s.select);
  const openSearch = useCallback(() => setSearching(true), []);
  useShortcuts(openSearch);

  useEffect(() => (pending ? undefined : startAutosave()), [pending]);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar onErrors={setErrors} onSearch={openSearch} onNew={() => setChoosingTemplate(true)} diagramVisible={view === 'diagram'} />
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
          <section className="canvas-column" aria-label={view === 'diagram' ? 'Diagram' : 'Inventory'}>
            <div className="canvas-bar">
              <div className="segmented view-switch" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={view === 'diagram'} className={view === 'diagram' ? 'is-active' : ''} onClick={() => setView('diagram')}>
                  <Network size={15} /> Diagram
                </button>
                <button type="button" role="tab" aria-selected={view === 'inventory'} className={view === 'inventory' ? 'is-active' : ''} onClick={() => setView('inventory')}>
                  <Table2 size={15} /> Inventory
                </button>
              </div>
              {view === 'diagram' && <SiteTabs />}
              {view === 'diagram' && <FilterBar />}
            </div>
            {view === 'diagram' ? (
              <Canvas />
            ) : (
              <Inventory
                onShowDevice={(id) => {
                  setView('diagram');
                  focusDevice(id);
                }}
                onShowFlow={(id) => {
                  const flow = useProject.getState().project.flows.find((f) => f.id === id);
                  if (!flow) return;
                  setView('diagram');
                  focusDevice(flow.source);
                  select({ ...NO_SELECTION, flows: [id] });
                }}
              />
            )}
          </section>
          <Inspector />
        </main>
        {searching && <SearchDialog onClose={() => setSearching(false)} />}
        {choosingTemplate && <TemplateGallery onClose={() => setChoosingTemplate(false)} />}
      </div>
    </ReactFlowProvider>
  );
}
