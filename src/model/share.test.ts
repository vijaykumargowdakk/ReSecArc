import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { saveRevision } from './revisions';
import { decodeShare, encodeShare, isShareFragment } from './share';

describe('share links', () => {
  it('round-trips a project through the URL fragment, without revisions by default', async () => {
    const project = saveRevision(loadTemplate('pipeline'), 'Baseline', new Date('2026-01-01T00:00:00Z'), 'rev-1');
    const fragment = await encodeShare(project);
    expect(isShareFragment(`#${fragment}`)).toBe(true);
    expect(fragment).toMatch(/^share=v1\.[A-Za-z0-9_-]+$/);
    const result = await decodeShare(`#${fragment}`);
    expect(result.ok && result.project).toEqual({ ...project, revisions: [] });

    const withRevisions = await decodeShare(await encodeShare(project, { includeRevisions: true }));
    expect(withRevisions.ok && withRevisions.project.revisions).toHaveLength(1);
  });

  it('compresses a template to a link short enough to paste', async () => {
    const fragment = await encodeShare(loadTemplate('water-treatment'));
    expect(fragment.length).toBeLessThan(8000);
  });

  it('rejects damaged and foreign fragments with a readable message', async () => {
    const fragment = await encodeShare(loadTemplate('building'));
    const damaged = await decodeShare(fragment.slice(0, -40));
    expect(damaged.ok).toBe(false);
    if (!damaged.ok) expect(damaged.errors[0]).toMatch(/damaged or incomplete/);
    const foreign = await decodeShare('#section-2');
    expect(foreign).toEqual({ ok: false, errors: ['This is not a ConduitOT share link.'] });
  });
});
