import { Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEVICE_COLUMNS, importDevices, parseDeviceCsv } from '../model/csv';
import { FLOW_COLUMNS, importFlows, importRules, parseFlowCsv, parseRuleCsv, RULE_COLUMNS } from '../model/csvImport';
import type { Project } from '../model/schema';
import { useProject } from '../store/useProject';

export type ImportKind = 'devices' | 'flows' | 'rules';

interface Row {
  line: number;
  name: string;
  ok: boolean;
  errors: string[];
}

interface Parsed {
  rows: Row[];
  apply: (project: Project, replaceRules: boolean) => Project;
}

const TEXT: Record<ImportKind, { title: string; noun: string; help: ReactNode }> = {
  devices: {
    title: 'Import devices from CSV',
    noun: 'device',
    help: (
      <>
        One device per row with a header line. Only <code>name</code> and <code>type</code> are required. Recognised columns:{' '}
        <code>{DEVICE_COLUMNS.filter((c) => c !== 'area').join(', ')}</code>. Types and kinds may be ids or labels; zones and sites are matched
        by name. Devices without a site go to the site that is open now.
      </>
    ),
  },
  flows: {
    title: 'Import protocol flows from CSV',
    noun: 'flow',
    help: (
      <>
        One flow per row with a header line: <code>{FLOW_COLUMNS.join(', ')}</code>. Source and target are device names. The protocol may be an
        id or a label. Settings are written as <code>name=value; name=value</code>, as in the flows export; unlisted settings and an empty
        port take the protocol's defaults.
      </>
    ),
  },
  rules: {
    title: 'Import firewall rules from CSV',
    noun: 'rule',
    help: (
      <>
        One rule per row with a header line: <code>{RULE_COLUMNS.join(', ')}</code>, as in the firewall rules export. Source and destination
        are <code>any</code>, <code>zone: Name</code> or a device name. Rules are added in <code>order</code> for each firewall.
      </>
    ),
  },
};

function parse(kind: ImportKind, project: Project, text: string, siteId: string): Parsed {
  if (kind === 'devices') {
    const rows = parseDeviceCsv(project, text, siteId);
    return { rows: rows.map((r) => ({ ...r, ok: r.device !== null })), apply: (p) => importDevices(p, rows) };
  }
  if (kind === 'flows') {
    const rows = parseFlowCsv(project, text);
    return { rows: rows.map((r) => ({ ...r, ok: r.value !== null })), apply: (p) => importFlows(p, rows) };
  }
  const rows = parseRuleCsv(project, text);
  return { rows: rows.map((r) => ({ ...r, ok: r.value !== null })), apply: (p, replace) => importRules(p, rows, replace) };
}

/** Reads devices, flows or firewall rules from a CSV file, shows which rows are valid, and imports those. */
export function ImportDialog({ kind, onClose }: { kind: ImportKind; onClose: () => void }) {
  const project = useProject((s) => s.project);
  const siteId = useProject((s) => s.activeSiteId);
  const apply = useProject((s) => s.apply);
  const dialog = useRef<HTMLDialogElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState('');
  const [replaceRules, setReplaceRules] = useState(true);
  const text = TEXT[kind];

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const valid = parsed?.rows.filter((r) => r.ok) ?? [];
  const invalid = parsed?.rows.filter((r) => !r.ok) ?? [];
  const plural = (n: number) => `${n} ${text.noun}${n === 1 ? '' : 's'}`;

  return (
    <dialog ref={dialog} className="gallery-dialog import-dialog" aria-labelledby="import-title" onClose={onClose}>
      <header>
        <h2 id="import-title">{text.title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <div className="import-dialog__body">
        <p className="muted">{text.help}</p>
        <label className="button file-button">
          <Upload size={16} />
          {fileName || 'Choose a CSV file…'}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              setParsed(parse(kind, project, await file.text(), siteId));
            }}
          />
        </label>
        {kind === 'rules' && (
          <label className="toggle">
            <input type="checkbox" checked={replaceRules} onChange={(e) => setReplaceRules(e.target.checked)} />
            <span>Replace the existing rules of each firewall named in the file (otherwise add after them)</span>
          </label>
        )}
        {parsed && (
          <>
            <p role="status">
              <strong>{plural(valid.length)}</strong> ready to import
              {invalid.length > 0 && (
                <>
                  , <strong className="text-danger">{invalid.length}</strong> row(s) will be skipped:
                </>
              )}
            </p>
            {invalid.length > 0 && (
              <ul className="import-errors">
                {invalid.map((r) => (
                  <li key={r.line}>
                    Line {r.line}
                    {r.name ? ` (${r.name})` : ''}: {r.errors.join('; ')}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <footer className="import-dialog__footer">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={valid.length === 0}
          onClick={() => {
            if (parsed) apply((p) => parsed.apply(p, replaceRules));
            onClose();
          }}
        >
          Import {plural(valid.length)}
        </button>
      </footer>
    </dialog>
  );
}
