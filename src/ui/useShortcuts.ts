import { useEffect } from 'react';
import { announce } from '../store/announcer';
import { useProject } from '../store/useProject';
import { saveProjectFile } from './actions';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Global shortcuts. The command palette and save work everywhere; the rest are ignored while typing
 * in a field so text editing keeps its own undo and copy.
 */
export function useShortcuts({ onSearch, onHelp, onCommands }: { onSearch: () => void; onHelp: () => void; onCommands: () => void }): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Ctrl+Shift+P as in code editors; Alt+P as well, because some browsers keep Ctrl+Shift+P for themselves.
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'p') || (e.altKey && !e.ctrlKey && !e.metaKey && key === 'p')) {
        e.preventDefault();
        onCommands();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 's') {
        e.preventDefault();
        saveProjectFile(useProject.getState().project);
        announce('Project file saved');
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onSearch();
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onHelp();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const s = useProject.getState();
      let handled = true;
      if (key === 'z' && !e.shiftKey) {
        if (s.history.past.length) announce('Undone');
        s.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (s.history.future.length) announce('Redone');
        s.redo();
      }
      else if (key === 'c' && s.selection.devices.length) s.copy();
      else if (key === 'v' && s.clipboard) s.paste();
      else if (key === 'd') s.duplicate();
      else if (key === 'a') s.selectAll();
      else if (key === 'k') onSearch();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSearch, onHelp, onCommands]);
}
