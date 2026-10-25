import { Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEVICE_COLUMNS, importDevices, parseDeviceCsv, type ImportRow } from '../model/csv';
import { useProject } from '../store/useProject';

/** Reads devices from a CSV file, shows which rows are valid, and imports those. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const project = useProject((s) => s.project);
  const siteId = useProject((s) => s.activeSiteId);
  const apply = useProject((s) => s.apply);
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const valid = rows?.filter((r) => r.device) ?? [];
  const invalid = rows?.filter((r) => !r.device) ?? [];

  return (
    <dialog ref={dialog} className="gallery-dialog import-dialog" aria-labelledby="import-title" onClose={onClose}>
      <header>
        <h2 id="import-title">Import devices from CSV</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <div className="import-dialog__body">
        <p className="muted">
          One device per row with a header line. Only <code>name</code> and <code>type</code> are required. Recognised columns:{' '}
          <code>{DEVICE_COLUMNS.filter((c) => c !== 'area').join(', ')}</code>. Types and kinds may be ids or labels; zones and sites are
          matched by name. Devices without a site go to the site that is open now.
        </p>
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
              setRows(parseDeviceCsv(project, await file.text(), siteId));
            }}
          />
        </label>
        {rows && (
          <>
            <p role="status">
              <strong>{valid.length}</strong> device(s) ready to import
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
            apply((p) => importDevices(p, valid));
            onClose();
          }}
        >
          Import {valid.length} device(s)
        </button>
      </footer>
    </dialog>
  );
}
