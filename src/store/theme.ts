// Per-viewer theme choice. "system" follows the OS setting; storage failures fall back to it.
import { create } from 'zustand';

export type Theme = 'system' | 'light' | 'dark' | 'contrast';
const KEY = 'conduitot:theme';
const THEMES: Theme[] = ['system', 'light', 'dark', 'contrast'];

function read(): Theme {
  try {
    const stored = localStorage.getItem(KEY) as Theme | null;
    return stored && THEMES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyToDocument(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export const useTheme = create<{ theme: Theme; setTheme: (theme: Theme) => void }>((set) => {
  const initial = read();
  applyToDocument(initial);
  return {
    theme: initial,
    setTheme: (theme) => {
      applyToDocument(theme);
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        // The choice still applies for this visit.
      }
      set({ theme });
    },
  };
});

/** React Flow's own colour mode for its controls, minimap and background. */
export function flowColorMode(theme: Theme): 'light' | 'dark' | 'system' {
  if (theme === 'dark') return 'dark';
  if (theme === 'system') return 'system';
  return 'light';
}
