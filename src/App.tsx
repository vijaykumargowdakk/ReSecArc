import { ReactFlowProvider } from '@xyflow/react';
import { ListTree, Network, Table2, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { decodeShare, isShareFragment } from './model/share';
import type { Project } from './model/schema';
import { useAnnouncer } from './store/announcer';
import { clearAutosave, readAutosave, startAutosave, takeResume, type Snapshot } from './store/autosave';
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
import { usePrefs } from './store/prefs';
import type { CommandContext, ViewName } from './ui/commands';
import { useShortcuts } from './ui/useShortcuts';

// Views and dialogs that are not needed on first paint load on demand.
const Inventory = lazy(() => import('./ui/Inventory').then((m) => ({ default: m.Inventory })));
const Outline = lazy(() => import('./ui/Outline').then((m) => ({ default: m.Outline })));
const HelpDialog = lazy(() => import('./ui/HelpDialog').then((m) => ({ default: m.HelpDialog })));
const SearchDialog = lazy(() => import('./ui/SearchDialog').then((m) => ({ default: m.SearchDialog })));
const ShareDialog = lazy(() => import('./ui/ShareDialog').then((m) => ({ default: m.ShareDialog })));
const CommandPalette = lazy(() => import('./ui/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const Tour = lazy(() => import('./ui/Tour').then((m) => ({ default: m.Tour })));
const TemplateGallery = lazy(() => import('./ui/TemplateGallery').then((m) => ({ default: m.TemplateGallery })));
const MergeDialog = lazy(() => import('./ui/MergeDialog').then((m) => ({ default: m.MergeDialog })));
const LevelTabs = lazy(() => import('./ui/LevelTabs').then((m) => ({ default: m.LevelTabs })));
const OfflineNotices = lazy(() => import('./offline/OfflineNotices').then((m) => ({ default: m.OfflineNotices })));

const VIEW_NAMES: Record<ViewName, string> = { diagram: 'Diagram', inventory: 'Inventory', outline: 'Outline' };

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Removes a share fragment from the address bar so a reload does not offer the same project again. */
const clearShareFragment = () => history.replaceState(null, '', location.pathname + location.search);

// After reloading to start a new version of the app, the work in progress opens again without asking.
const resumed = takeResume();
if (resumed) useProject.getState().load(resumed.project);

export function App() {
  const [errors, setErrors] = useState<string[]>([]);
  // Read once: a pending snapshot must be restored or discarded before autosave may overwrite it.
  const [pending, setPending] = useState<Snapshot | null>(() => (resumed ? null : readAutosave()));
  const load = useProject((s) => s.load);
  const [searching, setSearching] = useState(false);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const [view, setView] = useState<ViewName>('diagram');
  const focusDevice = useProject((s) => s.focusDevice);
  const select = useProject((s) => s.select);
  const openSearch = useCallback(() => setSearching(true), []);
  const [helping, setHelping] = useState(false);
  const openHelp = useCallback(() => setHelping(true), []);
  const [drawer, setDrawer] = useState<'palette' | 'inspector' | null>(null);
  const [sharing, setSharing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [shared, setShared] = useState<{ ok: true; project: Project } | { ok: false; errors: string[] } | null>(null);
  const comparison = useComparison();
  const compareWith = useCompare((s) => s.compareWith);
  const announcement = useAnnouncer((s) => s.message);
  const seq = useAnnouncer((s) => s.seq);
  const [commanding, setCommanding] = useState(false);
  const openCommands = useCallback(() => setCommanding(true), []);
  // The tour starts on a first visit on screens wide enough to show the palette and properties side by side.
  const [touring, setTouring] = useState(() => !usePrefs.getState().tourSeen && window.innerWidth >= 900);
  const endTour = useCallback(() => {
    setTouring(false);
    usePrefs.getState().setTourSeen();
  }, []);
  const panels = usePrefs((s) => s.panels);
  const levelTabs = useProject((s) => s.levelTabs.length > 0);
  useShortcuts({ onSearch: openSearch, onHelp: openHelp, onCommands: openCommands });
  const commandContext = useMemo<CommandContext>(
    () => ({
      view,
      setView,
      openSearch,
      openHelp,
      openShare: () => setSharing(true),
      openMerge: () => setMerging(true),
      openNew: () => setChoosingTemplate(true),
      openTour: () => setTouring(true),
      onErrors: setErrors,
    }),
    [view, openSearch, openHelp],
  );

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
          onCommands={openCommands}
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
            <button
              type="button"
              className="button"
              onClick={() => {
                select(NO_SELECTION);
                usePrefs.getState().setPanelOpen('inspector', true);
              }}
            >
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
        <main
          className={`workspace${drawer ? ` drawer-${drawer}` : ''}${panels.palette.open ? '' : ' palette-folded'}${panels.inspector.open ? '' : ' inspector-folded'}`}
          // Widths the user dragged to; without them the stylesheet's widths for the screen size apply.
          style={
            {
              ...(panels.palette.width !== null && { '--palette-w': `${panels.palette.width}px` }),
              ...(panels.inspector.width !== null && { '--inspector-w': `${panels.inspector.width}px` }),
            } as CSSProperties
          }
        >
          <Palette />
          <section className="canvas-column" aria-label={VIEW_NAMES[view]}>
            <div className="canvas-bar">
              <div className="segmented view-switch" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={view === 'diagram'} className={view === 'diagram' ? 'is-active' : ''} onClick={() => setView('diagram')}>
                  <Network size={15} /> Diagram
                </button>
                <button type="button" role="tab" aria-selected={view === 'inventory'} className={view === 'inventory' ? 'is-active' : ''} onClick={() => setView('inventory')}>
                  <Table2 size={15} /> Inventory
                </button>
                <button type="button" role="tab" aria-selected={view === 'outline'} className={view === 'outline' ? 'is-active' : ''} onClick={() => setView('outline')}>
                  <ListTree size={15} /> Outline
                </button>
              </div>
              {view === 'diagram' && <SiteTabs onMerge={() => setMerging(true)} />}
              {view === 'diagram' && <TidyButton />}
              {view === 'diagram' && <LayersMenu />}
              {view !== 'inventory' && <FilterBar />}
            </div>
            {view === 'diagram' && levelTabs && (
              <Suspense fallback={null}>
                <LevelTabs />
              </Suspense>
            )}
            {view === 'diagram' && <Canvas />}
            {view === 'outline' && (
              <Suspense fallback={<p className="muted inventory__loading">Loading outline…</p>}>
                <Outline />
              </Suspense>
            )}
            {view === 'inventory' && (
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
          {helping && (
            <HelpDialog
              onClose={() => setHelping(false)}
              onTour={() => {
                setHelping(false);
                setTouring(true);
              }}
            />
          )}
          {commanding && <CommandPalette ctx={commandContext} onClose={() => setCommanding(false)} />}
          {touring && !pending && !shared && <Tour onClose={endTour} />}
          {sharing && <ShareDialog onClose={() => setSharing(false)} />}
          {merging && <MergeDialog onClose={() => setMerging(false)} />}
        </Suspense>
        {/* Offline use needs the built files, so the development server goes without it. */}
        {import.meta.env.PROD && 'serviceWorker' in navigator && (
          <Suspense fallback={null}>
            <OfflineNotices />
          </Suspense>
        )}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          <span key={seq}>{announcement}</span>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
