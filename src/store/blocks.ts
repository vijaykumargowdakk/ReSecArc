// Reusable groups of devices ("blocks") saved per browser. Storage may be unavailable, so reads
// and writes are guarded and the palette simply shows no blocks in that case.
import { z } from 'zod';
import { create } from 'zustand';
import { newId, type Fragment } from '../model/ops';
import { deviceSchema, flowSchema, linkSchema } from '../model/schema';

const KEY = 'conduitot:blocks';

export interface Block {
  id: string;
  name: string;
  savedAt: number;
  fragment: Fragment;
}

const blockSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  savedAt: z.number(),
  fragment: z.object({ devices: z.array(deviceSchema).min(1), links: z.array(linkSchema), flows: z.array(flowSchema) }),
});

function read(): Block[] {
  try {
    const parsed = z.array(blockSchema).safeParse(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
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
  /** Returns false when the browser would not store it. */
  save: (name: string, fragment: Fragment) => boolean;
  remove: (id: string) => void;
}

export const useBlocks = create<BlocksState>((set, get) => ({
  blocks: read(),
  save: (name, fragment) => {
    const blocks = [...get().blocks, { id: newId('block'), name, savedAt: Date.now(), fragment }];
    if (!write(blocks)) return false;
    set({ blocks });
    return true;
  },
  remove: (id) => {
    const blocks = get().blocks.filter((b) => b.id !== id);
    write(blocks);
    set({ blocks });
  },
}));
