import { Check, Copy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { encodeShare, LONG_LINK } from '../model/share';
import { useProject } from '../store/useProject';

/** Builds a link that carries the whole design in its #fragment, for sharing without a server. */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const project = useProject((s) => s.project);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [includeRevisions, setIncludeRevisions] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCopied(false);
    encodeShare(project, { includeRevisions })
      .then((fragment) => {
        if (!cancelled) setLink(`${location.origin}${location.pathname}#${fragment}`);
      })
      .catch((err: Error) => !cancelled && setError(`This browser cannot build share links: ${err.message}`));
    return () => {
      cancelled = true;
    };
  }, [project, includeRevisions]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; leave the link selected so it can be copied by hand.
      input.current?.select();
    }
  };

  return (
    <dialog ref={dialog} className="gallery-dialog share-dialog" aria-labelledby="share-title" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <header>
        <h2 id="share-title">Share this design as a link</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <div className="import-dialog__body">
        <p>
          The whole design is packed into the link itself. Opening it shows a copy of the design and asks before replacing anything. Later edits
          on either side are not synchronised.
        </p>
        <p className="muted">
          The design is after the <code>#</code>, which browsers never send to the website’s server. Anyone you give the link to can read the
          full design, including IP addresses and firewall rules, so share it only through channels you would use for the project file.
        </p>
        {project.revisions.length > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={includeRevisions} onChange={(e) => setIncludeRevisions(e.target.checked)} />
            <span>Include the {project.revisions.length} saved revision(s) (makes the link longer)</span>
          </label>
        )}
        {error ? (
          <p className="text-danger" role="alert">
            {error}
          </p>
        ) : (
          <>
            <div className="share-dialog__link">
              <input ref={input} type="text" readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
              <button type="button" className="button button--primary" onClick={copy} disabled={!link}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="muted" role="status">
              {link ? `${link.length.toLocaleString()} characters.` : 'Building the link…'}
              {link.length > LONG_LINK && ' Some chat and mail tools shorten very long links; if it does not open, send the project file instead.'}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
