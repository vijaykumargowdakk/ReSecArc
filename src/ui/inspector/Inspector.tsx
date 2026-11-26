import { Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useId } from 'react';
import { removeDevice, removeFlow, removeLink } from '../../model/ops';
import { useComparison } from '../../store/compare';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { removeNote } from '../../model/notes';
import { Section } from '../form';
import { usePrefs } from '../../store/prefs';
import { useSecurity } from '../../store/security';
import { PanelEdge, PanelHeader } from '../PanelChrome';
import { ProjectPanel } from './ProjectPanel';

// Panels for selections load on first use, keeping them out of the startup bundle. The device, link
// and flow editors moved here too with React 19 (issue #36), whose react-dom is about 70 kB larger.
const AreaInspector = lazy(() => import('./AreaInspector').then((m) => ({ default: m.AreaInspector })));
const BulkInspector = lazy(() => import('./BulkInspector').then((m) => ({ default: m.BulkInspector })));
const ChangesPanel = lazy(() => import('./ChangesPanel').then((m) => ({ default: m.ChangesPanel })));
const NoteInspector = lazy(() => import('./NoteInspector').then((m) => ({ default: m.NoteInspector })));
const SecurityPanel = lazy(() => import('../security/SecurityPanel').then((m) => ({ default: m.SecurityPanel })));
const DeviceInspector = lazy(() => import('./ItemInspectors').then((m) => ({ default: m.DeviceInspector })));
const LinkInspector = lazy(() => import('./ItemInspectors').then((m) => ({ default: m.LinkInspector })));
const FlowInspector = lazy(() => import('./ItemInspectors').then((m) => ({ default: m.FlowInspector })));

export function Inspector() {
  const project = useProject((s) => s.project);
  const selection = useProject((s) => s.selection);
  const select = useProject((s) => s.select);
  const apply = useProject((s) => s.apply);
  const count =
    selection.devices.length + selection.links.length + selection.flows.length + selection.areas.length + selection.notes.length;

  const comparison = useComparison();
  const securityOpen = useSecurity((s) => s.open);
  const bodyId = useId();
  // Opening the Security panel is a request to see it, so a folded properties panel opens too.
  useEffect(() => {
    if (securityOpen) usePrefs.getState().setPanelOpen('inspector', true);
  }, [securityOpen]);
  let body = securityOpen ? <SecurityPanel /> : comparison ? <ChangesPanel comparison={comparison} /> : <ProjectPanel />;
  if (selection.devices.length > 1) {
    body = <BulkInspector ids={selection.devices} />;
  } else if (count === 1) {
    const device = project.devices.find((d) => d.id === selection.devices[0]);
    const link = project.links.find((l) => l.id === selection.links[0]);
    const flow = project.flows.find((f) => f.id === selection.flows[0]);
    const area = project.areas.find((a) => a.id === selection.areas[0]);
    const note = project.notes.find((n) => n.id === selection.notes[0]);
    if (device) body = <DeviceInspector key={device.id} device={device} />;
    else if (area) body = <AreaInspector key={area.id} area={area} />;
    else if (link) body = <LinkInspector key={link.id} link={link} />;
    else if (flow) body = <FlowInspector key={flow.id} flow={flow} />;
    else if (note) body = <NoteInspector key={note.id} note={note} />;
  } else if (count > 1) {
    body = (
      <>
        <Section title={`${count} items selected`}>
          <p className="muted">Select a single item to edit it, or several devices to edit them together.</p>
        </Section>
        <div className="panel-actions">
          <button
            type="button"
            className="button danger"
            onClick={() => {
              apply((p) => {
                const q = selection.flows.reduce(removeFlow, selection.links.reduce(removeLink, p));
                return selection.notes.reduce(removeNote, selection.devices.reduce(removeDevice, q));
              });
              select(NO_SELECTION);
            }}
          >
            <Trash2 size={16} />
            Delete selected
          </button>
        </div>
      </>
    );
  }

  return (
    <aside className="inspector" aria-label="Properties">
      <PanelHeader panel="inspector" bodyId={bodyId} />
      <div id={bodyId} className="panel-body inspector__body">
        <Suspense fallback={<p className="muted inspector__loading">Loading…</p>}>{body}</Suspense>
      </div>
      <PanelEdge panel="inspector" />
    </aside>
  );
}
