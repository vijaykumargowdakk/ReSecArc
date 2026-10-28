// Whether the Security panel is open, which tab it shows, the attack path shown on the canvas, and
// changes to the default entry points and targets. Kept apart from the project store so none of it
// touches undo history or the project file.
import { create } from 'zustand';
import type { PathOverrides } from '../model/attack/paths';

export type SecurityTab = 'findings' | 'paths' | 'rules';

interface SecurityState {
  open: boolean;
  tab: SecurityTab;
  /** The attack path highlighted on the canvas, by its `entryId>targetId` id. */
  pathId: string | null;
  overrides: PathOverrides;
  show: (tab?: SecurityTab) => void;
  close: () => void;
  setTab: (tab: SecurityTab) => void;
  selectPath: (pathId: string | null) => void;
  /** `undefined` goes back to the default for that device. */
  setOverride: (kind: keyof PathOverrides, deviceId: string, value: boolean | undefined) => void;
}

export const useSecurity = create<SecurityState>((set) => ({
  open: false,
  tab: 'findings',
  pathId: null,
  overrides: { entries: {}, targets: {} },
  show: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
  close: () => set({ open: false, pathId: null }),
  setTab: (tab) => set({ tab }),
  selectPath: (pathId) => set({ pathId }),
  setOverride: (kind, deviceId, value) =>
    set((s) => {
      const { [deviceId]: _old, ...rest } = s.overrides[kind];
      return { overrides: { ...s.overrides, [kind]: value === undefined ? rest : { ...rest, [deviceId]: value } } };
    }),
}));
