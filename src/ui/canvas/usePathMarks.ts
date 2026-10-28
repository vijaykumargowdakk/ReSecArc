// The attack path chosen in the Security panel, as canvas marks. The path finder loads only once a
// path has been chosen, so it stays out of the startup bundle.
import { useEffect, useMemo, useState } from 'react';
import { useSecurity } from '../../store/security';
import { useProject } from '../../store/useProject';
import type { PathMark } from './view';

type PathsModule = typeof import('../../model/attack/paths');

export function usePathMarks(): ReadonlyMap<string, PathMark> | undefined {
  const pathId = useSecurity((s) => s.pathId);
  const overrides = useSecurity((s) => s.overrides);
  const project = useProject((s) => s.project);
  const [paths, setPaths] = useState<PathsModule | null>(null);
  useEffect(() => {
    if (pathId && !paths) void import('../../model/attack/paths').then(setPaths);
  }, [pathId, paths]);
  return useMemo(() => {
    if (!pathId || !paths) return undefined;
    // The path may be gone after an edit (a new deny rule, say); then nothing is highlighted.
    const path = paths.attackPathsOf(project, overrides).paths.find((p) => p.id === pathId);
    return path ? paths.pathMarks(path) : undefined;
  }, [pathId, paths, project, overrides]);
}
