import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const SHORTCUTS: [string, string][] = [
  ['Ctrl + Shift + P  or  Alt + P', 'Run any command by name'],
  ['Ctrl + K  or  /', 'Find a device on any site'],
  ['Ctrl + S', 'Save the project file'],
  ['Ctrl + Z', 'Undo'],
  ['Ctrl + Shift + Z  or  Ctrl + Y', 'Redo'],
  ['Ctrl + C / Ctrl + V', 'Copy and paste selected devices'],
  ['Ctrl + D', 'Duplicate selected devices'],
  ['Ctrl + A', 'Select every device on this site'],
  ['Ctrl + B', 'Hide or show the device palette'],
  ['Ctrl + Alt + B', 'Hide or show the properties panel'],
  ['Delete  or  Backspace', 'Delete the selection'],
  ['Tab', 'Move focus between devices on the canvas'],
  ['Enter  or  Space', 'Select the focused device'],
  ['Arrow keys', 'Move selected devices (hold Shift for bigger steps)'],
  ['L  or  F', 'Start a link or a protocol flow from the focused or selected device'],
  ['Arrow keys, then Enter', 'While connecting: choose the nearest device in that direction, then connect to it (Esc cancels)'],
  ['Shift + drag', 'Select several devices with a box'],
  ['Ctrl + click', 'Add a device to the selection'],
  ['Right-click a device  or  long-press it', 'Duplicate, delete, or connect it to another device'],
  ['A panel edge: drag  or  arrow keys', 'Resize the panel; double-click or Enter for its default width'],
  ['Double-click a note', 'Edit it in place; Ctrl + Enter or clicking away finishes, Esc cancels'],
  ['Outline: arrow keys, Home, End', 'Move through the outline; Right opens an item, Left closes it or goes to its parent'],
  ['Outline: Enter  or  Space', 'Show the item in the properties panel (Enter also moves focus there)'],
  ['Outline: L, F, Delete', 'Link the focused device, add a flow from it, or delete it'],
  ['Outline: a letter', 'Jump to the next item starting with it'],
  ['?', 'Show this help'],
  ['Esc', 'Close dialogs and menus'],
];

export function HelpDialog({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
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
      <div className="help-dialog__note">
        <button type="button" className="button" onClick={onTour}>
          Take the tour
        </button>
      </div>
      <p className="muted help-dialog__note">
        Everything on the canvas can also be done without a mouse: add devices from the palette with Enter, connect them with L or F, or
        use “Link to…” and “Flow to…” in the device panel. The Outline view lists the whole design as a tree.
      </p>
    </dialog>
  );
}
