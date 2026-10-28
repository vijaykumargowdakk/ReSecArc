// Whether the Security panel is open and which tab it shows. Kept apart from the project store so
// opening it never touches undo history.
import { create } from 'zustand';

export type SecurityTab = 'findings' | 'rules';

export const useSecurity = create<{ open: boolean; tab: SecurityTab; show: (tab?: SecurityTab) => void; close: () => void; setTab: (tab: SecurityTab) => void }>(
  (set) => ({
    open: false,
    tab: 'findings',
    show: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
    close: () => set({ open: false }),
    setTab: (tab) => set({ tab }),
  }),
);
