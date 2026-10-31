import { FolderOpen, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseProject } from '../model/io';
import { mergeSites, type MergeSummary } from '../model/merge';
import type { Project } from '../model/schema';
import { announce } from '../store/announcer';
import { useProject } from '../store/useProject';

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const list = (names: string[]) => names.join(', ');

/** What a merge will add and what it leaves out, in plain sentences. */
function SummaryText({ summary }: { summary: MergeSummary }) {
  // Sites are always named; other counts only when there are some.
  const added = [
    plural(summary.sites, 'site'),
    ...(
      [
        [summary.devices, 'device'],
        [summary.links, 'link'],
        [summary.flows, 'flow'],
        [summary.areas, 'area'],
        [summary.notes, 'note'],
        [summary.networks, 'network'],
      ] as const
    )
      .filter(([n]) => n > 0)
      .map(([n, noun]) => plural(n, noun)),
  ];
  const dropped = summary.connectionsDropped;
  const left = [
    dropped > 0 && `${dropped} ${dropped === 1 ? 'link or flow' : 'links and flows'} to sites you did not choose`,
    summary.rulesDropped > 0 && `${plural(summary.rulesDropped, 'firewall rule')} naming devices on those sites (rules are left out, never widened)`,
    summary.fieldValuesDropped > 0 && `${plural(summary.fieldValuesDropped, 'custom field value')}: this project already has the most custom fields allowed`,
  ].filter((s): s is string => !!s);
  return (
    <div className="merge-summary" role="status">
      <p>Adds {added.length > 1 ? `${added.slice(0, -1).join(', ')} and ${added[added.length - 1]}` : added[0]}.</p>
      {summary.zonesMatched.length > 0 && <p>Uses this project’s zones {list(summary.zonesMatched)}, keeping their settings.</p>}
      {summary.zonesAdded.length > 0 && <p>Adds the zones {list(summary.zonesAdded)}.</p>}
      {summary.fieldsMatched.length > 0 && <p>Uses this project’s custom fields {list(summary.fieldsMatched)}.</p>}
      {summary.fieldsAdded.length > 0 && <p>Adds the custom fields {list(summary.fieldsAdded)}.</p>}
      {summary.renamed.map((r) => (
        <p key={r.from}>
          “{r.from}” is added as “{r.to}”, because this project already has a site of that name.
        </p>
      ))}
      {left.length > 0 && (
        <>
          <p>Left out:</p>
          <ul>
            {left.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Copies chosen sites from another project file into this one, as one undoable step. */
export function MergeDialog({ onClose }: { onClose: () => void }) {
  const project = useProject((s) => s.project);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{ file: string; project: Project } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // A preview against the current design; the merge itself runs again inside the store update.
  const preview = useMemo(() => (source && chosen.length ? mergeSites(project, source.project, chosen).summary : null), [project, source, chosen]);

  const read = async (file: File) => {
    const result = parseProject(await file.text());
    if (!result.ok) {
      setSource(null);
      setErrors([`Could not read ${file.name}:`, ...result.errors.slice(0, 20)]);
      return;
    }
    setErrors([]);
    setSource({ file: file.name, project: result.project });
    setChosen(result.project.sites.map((s) => s.id));
  };

  const merge = () => {
    if (!source || chosen.length === 0) return;
    const { apply, setActiveSite } = useProject.getState();
    let first: string | undefined;
    apply((p) => {
      const result = mergeSites(p, source.project, chosen);
      first = result.siteIds[0];
      return result.project;
    });
    if (first) setActiveSite(first);
    announce(`Merged ${plural(chosen.length, 'site')} from ${source.project.name || source.file}. Undo removes them again.`);
    onClose();
  };

  const counts = new Map<string, number>();
  for (const d of source?.project.devices ?? []) counts.set(d.siteId, (counts.get(d.siteId) ?? 0) + 1);

  return (
    <dialog ref={dialog} className="gallery-dialog import-dialog" aria-labelledby="merge-title" onClose={onClose}>
      <header>
        <h2 id="merge-title">Merge sites from another project</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <div className="import-dialog__body">
        <p className="muted">
          Choose a ReSecArc project file, then the sites to copy into this design. Zones and custom fields are matched by name, and networks that
          span every site by subnet; anything without a match is added. Company policies, switched-off checks and revisions of the other project
          are not merged.
        </p>
        <button type="button" className="button file-button" onClick={() => input.current?.click()}>
          <FolderOpen size={16} />
          {source ? source.file : 'Choose a project file…'}
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void read(file);
          }}
        />
        {errors.length > 0 && (
          <ul className="import-errors" role="alert">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {source && (
          <fieldset className="merge-sites">
            <legend>Sites in “{source.project.name || source.file}”</legend>
            {source.project.sites.map((s) => (
              <label key={s.id} className="toggle">
                <input
                  type="checkbox"
                  checked={chosen.includes(s.id)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? source.project.sites.filter((x) => x.id === s.id || c.includes(x.id)).map((x) => x.id) : c.filter((id) => id !== s.id)))}
                />
                <span>
                  {s.name} <span className="muted">({plural(counts.get(s.id) ?? 0, 'device')})</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {preview && <SummaryText summary={preview} />}
      </div>
      <footer className="import-dialog__footer">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button button--primary" disabled={!preview} onClick={merge}>
          Merge {plural(chosen.length, 'site')}
        </button>
      </footer>
    </dialog>
  );
}
