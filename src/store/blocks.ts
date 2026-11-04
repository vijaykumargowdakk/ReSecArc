// Reusable groups of devices ("blocks") saved per browser. Storage may be unavailable, so reads
// and writes are guarded and the palette simply shows no blocks in that case.
import { create } from 'zustand';
import { newId, type Fragment } from '../model/ops';

const KEY = 'conduitot:blocks';

export interface Block {
  id: string;
  name: string;
  savedAt: number;
  fragment: Fragment;
}

/** The stored blocks, validated. The validator loads on demand, and only if any blocks are stored. */
async function read(): Promise<Block[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
  if (Array.isArray(raw) && raw.length === 0) return [];
  const { parseBlocks } = await import('./blockSchema');
  return parseBlocks(raw);
}

function write(blocks: Block[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(blocks));
    return true;
  } catch {
    return false;
  }
}

interface BlocksState {
  blocks: Block[];
  /** False until the stored blocks have been read; saving waits for it so none are overwritten. */
  ready: boolean;
  /** Returns false when the browser would not store it. */
  save: (name: string, fragment: Fragment) => boolean;
  remove: (id: string) => void;
}

export const useBlocks = create<BlocksState>((set, get) => ({
  blocks: [],
  ready: false,
  save: (name, fragment) => {
    if (!get().ready) return false;
    const blocks = [...get().blocks, { id: newId('block'), name, savedAt: Date.now(), fragment }];
    if (!write(blocks)) return false;
    set({ blocks });
    return true;
  },
  remove: (id) => {
    if (!get().ready) return;
    const blocks = get().blocks.filter((b) => b.id !== id);
    write(blocks);
    set({ blocks });
  },
}));

void read().then(
  (blocks) => useBlocks.setState({ blocks, ready: true }),
  // If the validator can't load, stored blocks stay untouched: saving keeps returning false.
  () => undefined,
);
