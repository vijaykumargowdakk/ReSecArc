import { useEffect } from 'react';
import { announce } from '../store/announcer';
import { useProject } from '../store/useProject';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Global editing shortcuts. Ignored while typing in a field so text editing keeps its own undo/copy. */
export function useShortcuts(onSearch: () => void, onHelp: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      const key = e.key.toLowerCase();
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
  }, [onSearch, onHelp]);
}
