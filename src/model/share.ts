// Share-by-link: the whole project, compressed, in the URL fragment (`#share=...`). Browsers never
// send the fragment to the server, so the design does not leave the sender's and receiver's machines
// except through the link itself. Uses the built-in CompressionStream; no dependency.
import { parseProject, serializeProject, type ParseResult } from './io';
import type { Project } from './schema';

const PREFIX = 'share=v1.';
/** Upper bound on the decompressed size, so a hostile link cannot exhaust memory. */
export const MAX_SHARED_BYTES = 8 * 1024 * 1024;
/** Above this many characters some chat and mail tools cut links short. */
export const LONG_LINK = 8000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('the shared project is too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const pipe = (bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream) =>
  new Blob([bytes]).stream().pipeThrough(transform as unknown as TransformStream<Uint8Array, Uint8Array>);

/** The fragment (without `#`) that carries `project`. Revisions are left out unless asked for. */
export async function encodeShare(project: Project, { includeRevisions = false } = {}): Promise<string> {
  const shared = includeRevisions ? project : { ...project, revisions: [] };
  const json = new TextEncoder().encode(serializeProject(shared));
  return PREFIX + toBase64Url(await readAll(pipe(json, new CompressionStream('deflate-raw')), Infinity));
}

/** True when a URL fragment looks like a shared project. */
export function isShareFragment(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(PREFIX);
}

/** Reads a shared project from a URL fragment and validates it like an opened file. */
export async function decodeShare(hash: string): Promise<ParseResult> {
  const body = hash.replace(/^#/, '');
  if (!body.startsWith(PREFIX)) return { ok: false, errors: ['This is not a ReSecArc share link.'] };
  try {
    const bytes = await readAll(pipe(fromBase64Url(body.slice(PREFIX.length)), new DecompressionStream('deflate-raw')), MAX_SHARED_BYTES);
    return parseProject(new TextDecoder().decode(bytes));
  } catch (err) {
    return { ok: false, errors: [`The link is damaged or incomplete (${(err as Error).message || 'unreadable data'}). Ask for the link again.`] };
  }
}
