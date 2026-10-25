import { FilePlus2, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { loadTemplate, TEMPLATES } from '../examples/templates';
import { emptyProject } from '../model/ops';
import { getProtocol } from '../model/protocols';
import type { Project } from '../model/schema';
import { useProject } from '../store/useProject';

/** Tiny map of the first site: one dot per device, coloured by zone. */
function Preview({ project }: { project: Project }) {
  const site = project.sites[0].id;
  const devices = project.devices.filter((d) => d.siteId === site);
  const zoneColor = new Map(project.zones.map((z) => [z.id, z.color]));
  if (devices.length === 0) {
    return (
      <div className="template__preview template__preview--blank">
        <FilePlus2 size={28} />
      </div>
    );
  }
  const xs = devices.map((d) => d.position.x);
  const ys = devices.map((d) => d.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 190;
  const h = Math.max(...ys) - minY + 64;
  return (
    <svg className="template__preview" viewBox={`${minX - 20} ${minY - 20} ${w + 40} ${h + 40}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {devices.map((d) => (
        <rect key={d.id} x={d.position.x} y={d.position.y} width={190} height={64} rx={10} fill={d.zoneId ? zoneColor.get(d.zoneId) : '#94a3b8'} opacity={0.85} />
      ))}
    </svg>
  );
}

export function TemplateGallery({ onClose }: { onClose: () => void }) {
  const current = useProject((s) => s.project);
  const load = useProject((s) => s.load);
  const dialog = useRef<HTMLDialogElement>(null);
  const templates = useMemo(() => TEMPLATES.map((t) => ({ ...t, project: loadTemplate(t.id) })), []);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const start = (project: Project) => {
    if (current.devices.length > 0 && !window.confirm('Replace the current architecture? Unsaved changes will be lost.')) return;
    load(project);
    onClose();
  };

  return (
    <dialog ref={dialog} className="gallery-dialog" aria-labelledby="gallery-title" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <header>
        <h2 id="gallery-title">Start a new architecture</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <ul className="template-grid">
        <li>
          <button type="button" className="template" onClick={() => start(emptyProject())}>
            <Preview project={emptyProject()} />
            <strong>Blank</strong>
            <span className="muted">An empty canvas with Purdue lanes.</span>
          </button>
        </li>
        {templates.map((t) => {
          const protocols = [...new Set(t.project.flows.map((f) => getProtocol(f.protocol)?.label ?? f.protocol))];
          return (
            <li key={t.id}>
              <button type="button" className="template" onClick={() => start(t.project)}>
                <Preview project={t.project} />
                <strong>{t.title}</strong>
                <span className="muted">{t.description}</span>
                <span className="template__meta">
                  {t.project.devices.length} devices
                  {t.project.sites.length > 1 ? ` · ${t.project.sites.length} sites` : ''} · {protocols.join(', ')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted gallery-dialog__note">All templates are fictional examples.</p>
    </dialog>
  );
}
