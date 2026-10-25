import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const SHORTCUTS: [string, string][] = [
  ['Ctrl + K  or  /', 'Find a device on any site'],
  ['Ctrl + Z', 'Undo'],
  ['Ctrl + Shift + Z  or  Ctrl + Y', 'Redo'],
  ['Ctrl + C / Ctrl + V', 'Copy and paste selected devices'],
  ['Ctrl + D', 'Duplicate selected devices'],
  ['Ctrl + A', 'Select every device on this site'],
  ['Delete  or  Backspace', 'Delete the selection'],
  ['Tab', 'Move focus between devices on the canvas'],
  ['Enter  or  Space', 'Select the focused device'],
  ['Arrow keys', 'Move selected devices (hold Shift for bigger steps)'],
  ['Shift + drag', 'Select several devices with a box'],
  ['Ctrl + click', 'Add a device to the selection'],
  ['Right-click a device', 'Duplicate, delete, or connect it to another device'],
  ['Double-click a note', 'Edit it in place; Ctrl + Enter or clicking away finishes, Esc cancels'],
  ['?', 'Show this help'],
  ['Esc', 'Close dialogs and menus'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="gallery-dialog help-dialog" aria-labelledby="help-title" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <header>
        <h2 id="help-title">Keyboard shortcuts</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <p className="muted help-dialog__note">
        Everything on the canvas can also be done without a mouse: add devices from the palette with Enter, and connect them from the
        device panel with “Link to…” or “Flow to…”.
      </p>
    </dialog>
  );
}
