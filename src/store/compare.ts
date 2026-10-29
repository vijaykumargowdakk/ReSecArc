// Which saved revision the live design is being compared with. Kept apart from the project store so
// comparing never touches undo history; a revision that no longer exists simply ends the comparison.
// The diff engine loads only once a comparison starts, so it stays out of the startup bundle.
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import type { Change } from '../model/revisions';
import type { Revision } from '../model/schema';
import { useProject } from './useProject';

type RevisionsModule = typeof import('../model/revisions');
let loaded: RevisionsModule | null = null;

export const useCompare = create<{ revisionId: string | null; hideMoves: boolean; compareWith: (id: string | null) => void; setHideMoves: (v: boolean) => void }>(
  (set) => ({
    revisionId: null,
    hideMoves: true,
    compareWith: (revisionId) => set({ revisionId }),
    setHideMoves: (hideMoves) => set({ hideMoves }),
  }),
);

export interface Comparison {
  revision: Revision;
  /** Every change, including pure moves. */
  all: Change[];
  /** The changes to show, honouring "hide moves". */
  changes: Change[];
  /** Canvas items to highlight: device, link, flow, note and area ids. Firewalls with rule changes count as changed. */
  marks: Map<string, 'added' | 'changed'>;
}

export function useComparison(): Comparison | null {
  const project = useProject((s) => s.project);
  const revisionId = useCompare((s) => s.revisionId);
  const hideMoves = useCompare((s) => s.hideMoves);
  const [diff, setDiff] = useState(loaded);
  useEffect(() => {
    if (revisionId && !diff) {
      void import('../model/revisions').then((m) => {
        loaded = m;
        setDiff(m);
      });
    }
  }, [revisionId, diff]);
  return useMemo(() => {
    const revision = project.revisions.find((r) => r.id === revisionId);
    if (!revision || !diff) return null;
    const all = diff.diffDesigns(revision.design, diff.designOf(project));
    const changes = hideMoves ? all.filter((c) => !c.moveOnly) : all;
    const marks = new Map<string, 'added' | 'changed'>();
    for (const c of changes) {
      if (c.change === 'removed') continue;
      if (c.item === 'rule') {
        const fw = project.devices.find((d) => d.firewall?.rules.some((r) => r.id === c.id));
        if (fw && !marks.has(fw.id)) marks.set(fw.id, 'changed');
      } else {
        marks.set(c.id, c.change);
      }
    }
    return { revision, all, changes, marks };
  }, [project, revisionId, hideMoves, diff]);
}
