// Validation for stored blocks. It uses the project schema, so it loads on demand (see blocks.ts).
import { z } from 'zod';
import { deviceSchema, flowSchema, linkSchema } from '../model/schema';
import type { Block } from './blocks';

const blockSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  savedAt: z.number(),
  fragment: z.object({ devices: z.array(deviceSchema).min(1), links: z.array(linkSchema), flows: z.array(flowSchema) }),
});

/** The valid blocks in stored JSON, or none if the list as a whole doesn't match. */
export function parseBlocks(raw: unknown): Block[] {
  const parsed = z.array(blockSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}
