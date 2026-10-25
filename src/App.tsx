import { ReactFlowProvider } from '@xyflow/react';
import { Network, Table2, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { decodeShare, isShareFragment } from './model/share';
import type { Project } from './model/schema';
import { useAnnouncer } from './store/announcer';
import { clearAutosave, readAutosave, startAutosave, type Snapshot } from './store/autosave';
import { useCompare, useComparison } from './store/compare';
import { hasEdits, NO_SELECTION, useProject } from './store/useProject';
import { Canvas } from './ui/canvas/Canvas';
import { LayersMenu } from './ui/canvas/LayersMenu';
import { TidyButton } from './ui/canvas/TidyButton';
import { Inspector } from './ui/inspector/Inspector';
import { FilterBar } from './ui/FilterBar';
import { Palette } from './ui/Palette';
import { SiteTabs } from './ui/SiteTabs';
import { Toolbar } from './ui/Toolbar';
import { useShortcuts } from './ui/useShortcuts';

// Views and dialogs that are not needed on first paint load on demand.
const Inventory = lazy(() => import('./ui/Inventory').then((m) => ({ default: m.Inventory })));
const HelpDialog = lazy(() => import('./ui/HelpDialog').then((m) => ({ default: m.HelpDialog })));
const SearchDialog = lazy(() => import('./ui/SearchDialog').then((m) => ({ default: m.SearchDialog })));
const ShareDialog = lazy(() => import('./ui/ShareDialog').then((m) => ({ default: m.ShareDialog })));
const TemplateGallery = lazy(() => import('./ui/TemplateGallery').then((m) => ({ default: m.TemplateGallery })));

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Removes a share fragment from the address bar so a reload does not offer the same project again. */
const clearShareFragment = () => history.replaceState(null, '', location.pathname + location.search);

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
  const [helping, setHelping] = useState(false);
  const openHelp = useCallback(() => setHelping(true), []);
  const [drawer, setDrawer] = useState<'palette' | 'inspector' | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState<{ ok: true; project: Project } | { ok: false; errors: string[] } | null>(null);
  const comparison = useComparison();
  const compareWith = useCompare((s) => s.compareWith);
  const announcement = useAnnouncer((s) => s.message);
  const seq = useAnnouncer((s) => s.seq);
  useShortcuts(openSearch, openHelp);

  useEffect(() => (pending ? undefined : startAutosave()), [pending]);

  // A shared link carries a whole project in its #fragment; offer it rather than replacing work silently.
  useEffect(() => {
    const check = () => {
      if (isShareFragment(location.hash)) void decodeShare(location.hash).then(setShared);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const openShared = (project: Project) => {
    if (hasEdits() && !window.confirm(`Open “${project.name}” from the link and replace the design you are working on?`)) return;
    load(project);
    setShared(null);
    clearShareFragment();
  };

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar
          onErrors={setErrors}
          onSearch={openSearch}
          onNew={() => setChoosingTemplate(true)}
          onHelp={openHelp}
          onShare={() => setSharing(true)}
          diagramVisible={view === 'diagram'}
          drawer={drawer}
          onDrawer={(d) => setDrawer((current) => (current === d ? null : d))}
        />
        {shared?.ok && (
          <div className="notice notice--info" role="status">
            <p>
              This link contains the design <strong>“{shared.project.name}”</strong> ({shared.project.devices.length} devices,{' '}
              {shared.project.sites.length} site{shared.project.sites.length === 1 ? '' : 's'}).
            </p>
            <button type="button" className="button" onClick={() => openShared(shared.project)}>
              Open it
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setShared(null);
                clearShareFragment();
              }}
            >
              Ignore
            </button>
          </div>
        )}
        {shared && !shared.ok && (
          <div className="notice" role="alert">
            <ul>
              <li>This share link could not be opened:</li>
              {shared.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setShared(null);
                clearShareFragment();
              }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}
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
        {comparison && (
          <div className="notice notice--info" role="status">
            <p>
              Comparing with <strong>“{comparison.revision.name}”</strong>: {comparison.changes.length} change
              {comparison.changes.length === 1 ? '' : 's'}. Added items have a solid green outline and a “New” tag; changed items a dashed amber
              outline and a “Changed” tag. Removed items are listed in the Changes panel.
            </p>
            <button type="button" className="button" onClick={() => select(NO_SELECTION)}>
              Show changes
            </button>
            <button type="button" className="button" onClick={() => compareWith(null)}>
              Stop comparing
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
        <main className={`workspace${drawer ? ` drawer-${drawer}` : ''}`}>
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
              {view === 'diagram' && <TidyButton />}
              {view === 'diagram' && <LayersMenu />}
              {view === 'diagram' && <FilterBar />}
            </div>
            {view === 'diagram' ? (
              <Canvas />
            ) : (
              <Suspense fallback={<p className="muted inventory__loading">Loading inventory…</p>}>
                <Inventory
                  onShowDevice={(id) => {
                    setView('diagram');
                    focusDevice(id);
                  }}
                  onShowEdge={(kind, id) => {
                    const { project } = useProject.getState();
                    const edge = kind === 'link' ? project.links.find((l) => l.id === id) : project.flows.find((f) => f.id === id);
                    if (!edge) return;
                    setView('diagram');
                    focusDevice(edge.source);
                    select({ ...NO_SELECTION, [kind === 'link' ? 'links' : 'flows']: [id] });
                  }}
                />
              </Suspense>
            )}
          </section>
          <Inspector />
        </main>
        <Suspense fallback={null}>
          {searching && <SearchDialog onClose={() => setSearching(false)} />}
          {choosingTemplate && <TemplateGallery onClose={() => setChoosingTemplate(false)} />}
          {helping && <HelpDialog onClose={() => setHelping(false)} />}
          {sharing && <ShareDialog onClose={() => setSharing(false)} />}
        </Suspense>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          <span key={seq}>{announcement}</span>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
