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
}

export const ALL_LAYERS: Layers = { links: true, flows: true, flowLabels: true, ports: true, notes: true, areas: true };

export const LAYER_LABELS: Record<keyof Layers, string> = {
  links: 'Network links',
  flows: 'Protocol flows',
  flowLabels: 'Flow labels',
  ports: 'Port names',
  notes: 'Notes',
  areas: 'Area frames',
};

interface Prefs {
  layers: Layers;
}

const KEY = 'conduitot:prefs';
const DEFAULTS: Prefs = { layers: ALL_LAYERS };

function read(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    const layers = { ...ALL_LAYERS };
    for (const key of Object.keys(ALL_LAYERS) as (keyof Layers)[]) {
      if (typeof raw.layers?.[key] === 'boolean') layers[key] = raw.layers[key];
    }
    return { ...DEFAULTS, layers };
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

export const usePrefs = create<Prefs & { setLayer: (key: keyof Layers, on: boolean) => void; showAllLayers: () => void }>((set, get) => ({
  ...read(),
  setLayer: (key, on) => {
    set({ layers: { ...get().layers, [key]: on } });
    write({ layers: get().layers });
  },
  showAllLayers: () => {
    set({ layers: ALL_LAYERS });
    write({ layers: ALL_LAYERS });
  },
}));
