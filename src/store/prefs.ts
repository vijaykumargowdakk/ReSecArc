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

interface Prefs {
  layers: Layers;
  /** Whether the first-run tour has been shown (or skipped) in this browser. */
  tourSeen: boolean;
}

const KEY = 'conduitot:prefs';
const DEFAULTS: Prefs = { layers: ALL_LAYERS, tourSeen: false };

function read(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    const layers = { ...ALL_LAYERS };
    for (const key of Object.keys(ALL_LAYERS) as (keyof Layers)[]) {
      if (typeof raw.layers?.[key] === 'boolean') layers[key] = raw.layers[key];
    }
    return { ...DEFAULTS, layers, tourSeen: raw.tourSeen === true };
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

interface PrefActions {
  setLayer: (key: keyof Layers, on: boolean) => void;
  showAllLayers: () => void;
  setTourSeen: () => void;
}

export const usePrefs = create<Prefs & PrefActions>((set, get) => {
  const update = (patch: Partial<Prefs>) => {
    set(patch);
    const { layers, tourSeen } = get();
    write({ layers, tourSeen });
  };
  return {
    ...read(),
    setLayer: (key, on) => update({ layers: { ...get().layers, [key]: on } }),
    showAllLayers: () => update({ layers: ALL_LAYERS }),
    setTourSeen: () => update({ tourSeen: true }),
  };
});
