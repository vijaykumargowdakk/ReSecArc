import { create } from 'zustand';

/** Messages for the screen-reader live region; a counter makes repeats announce again. */
export const useAnnouncer = create<{ message: string; seq: number }>(() => ({ message: '', seq: 0 }));

export function announce(message: string): void {
  useAnnouncer.setState((s) => ({ message, seq: s.seq + 1 }));
}
