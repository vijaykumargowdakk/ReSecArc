// Per-browser display preferences. Like the theme, they live in localStorage when it is available
// and fall back to defaults otherwise; they are never part of the project file.
import { create } from 'zustand';

export interface Layers {
  links: boolean;
  flows: boolean;
  flowLabels: boolean;
  ports: boolean;
  notes: boolean;
  areas: boolean;
  /** Security findings: red links and flows, and finding counts on devices. */
  security: boolean;
}

export const ALL_LAYERS: Layers = { links: true, flows: true, flowLabels: true, ports: true, notes: true, areas: true, security: true };

export const LAYER_LABELS: Record<keyof Layers, string> = {
  links: 'Network links',
  flows: 'Protocol flows',
  flowLabels: 'Flow labels',
  ports: 'Port names',
  notes: 'Notes',
  areas: 'Area frames',
  security: 'Security findings',
};

export type PanelName = 'palette' | 'inspector';

export interface PanelState {
  open: boolean;
  /** Width in CSS pixels at the default text size, or null for the layout's own width. */
  width: number | null;
}

/** Widths a panel can be dragged to, in CSS pixels at the default text size. */
export const PANEL_LIMITS: Record<PanelName, { min: number; max: number }> = {
  palette: { min: 180, max: 420 },
  inspector: { min: 280, max: 600 },
};

/** Text sizes for the interface (toolbar, panels, tables and dialogs); the canvas has its own zoom. */
export const TEXT_SIZES = [
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
  { value: 1.5, label: 'Largest' },
] as const;

interface Prefs {
  layers: Layers;
  /** Whether the first-run tour has been shown (or skipped) in this browser. */
  tourSeen: boolean;
  panels: Record<PanelName, PanelState>;
  /** Keys of the panel sections the user has folded (see `sectionKey`). */
  collapsed: string[];
  textSize: number;
}

const KEY = 'conduitot:prefs';
const OPEN_PANEL: PanelState = { open: true, width: null };
const DEFAULTS: Prefs = { layers: ALL_LAYERS, tourSeen: false, panels: { palette: OPEN_PANEL, inspector: OPEN_PANEL }, collapsed: [], textSize: 1 };

const clampWidth = (panel: PanelName, width: number) => Math.round(Math.min(PANEL_LIMITS[panel].max, Math.max(PANEL_LIMITS[panel].min, width)));

function readPanel(panel: PanelName, raw: unknown): PanelState {
  const p = (raw ?? {}) as Partial<PanelState>;
  return { open: p.open !== false, width: typeof p.width === 'number' && Number.isFinite(p.width) ? clampWidth(panel, p.width) : null };
}

export function readPrefs(stored: string | null): Prefs {
  try {
    const raw = JSON.parse(stored ?? '{}') as Partial<Prefs>;
    const layers = { ...ALL_LAYERS };
    for (const key of Object.keys(ALL_LAYERS) as (keyof Layers)[]) {
      if (typeof raw.layers?.[key] === 'boolean') layers[key] = raw.layers[key];
    }
    return {
      layers,
      tourSeen: raw.tourSeen === true,
      panels: { palette: readPanel('palette', raw.panels?.palette), inspector: readPanel('inspector', raw.panels?.inspector) },
      collapsed: Array.isArray(raw.collapsed) ? raw.collapsed.filter((k): k is string => typeof k === 'string').slice(0, 200) : [],
      textSize: TEXT_SIZES.some((t) => t.value === raw.textSize) ? (raw.textSize as number) : 1,
    };
  } catch {
    return DEFAULTS;
  }
}

function read(): Prefs {
  try {
    return readPrefs(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

function write(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Preferences still apply for this visit.
  }
}

/** The interface scale is a CSS variable on the page, so styles can size the interface (but not the canvas) by it. */
function applyTextSize(size: number): void {
  if (typeof document === 'undefined') return; // unit tests run without a page
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(size));
  if (size === 1) delete root.dataset.textSize;
  else root.dataset.textSize = String(size);
}

/**
 * The key a section's folded state is stored under: its title with numbers replaced, so
 * "Devices (3)" and "Devices (4)" share one state.
 */
export function sectionKey(scope: string, title: string): string {
  return `${scope}:${title.replace(/\d+/g, '#')}`;
}

interface PrefActions {
  setLayer: (key: keyof Layers, on: boolean) => void;
  showAllLayers: () => void;
  setTourSeen: () => void;
  setPanelOpen: (panel: PanelName, open: boolean) => void;
  togglePanel: (panel: PanelName) => void;
  /** Sets a panel's width; null goes back to the layout's own width. */
  setPanelWidth: (panel: PanelName, width: number | null) => void;
  setSectionOpen: (key: string, open: boolean) => void;
  setTextSize: (size: number) => void;
}

export const usePrefs = create<Prefs & PrefActions>((set, get) => {
  const update = (patch: Partial<Prefs>) => {
    set(patch);
    const { layers, tourSeen, panels, collapsed, textSize } = get();
    write({ layers, tourSeen, panels, collapsed, textSize });
  };
  const patchPanel = (panel: PanelName, patch: Partial<PanelState>) => update({ panels: { ...get().panels, [panel]: { ...get().panels[panel], ...patch } } });
  const initial = read();
  applyTextSize(initial.textSize);
  return {
    ...initial,
    setLayer: (key, on) => update({ layers: { ...get().layers, [key]: on } }),
    showAllLayers: () => update({ layers: ALL_LAYERS }),
    setTourSeen: () => update({ tourSeen: true }),
    setPanelOpen: (panel, open) => {
      if (get().panels[panel].open !== open) patchPanel(panel, { open });
    },
    togglePanel: (panel) => patchPanel(panel, { open: !get().panels[panel].open }),
    setPanelWidth: (panel, width) => patchPanel(panel, { width: width === null ? null : clampWidth(panel, width) }),
    setSectionOpen: (key, open) => {
      const rest = get().collapsed.filter((k) => k !== key);
      update({ collapsed: open ? rest : [...rest, key] });
    },
    setTextSize: (size) => {
      applyTextSize(size);
      update({ textSize: size });
    },
  };
});
