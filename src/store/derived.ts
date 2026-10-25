// Values computed from the project that several components need. Each is cached per project
// object, so it is computed once per change however many panels read it.
import { deriveConduits, type Conduit } from '../model/conduits';
import { addressReport, type AddressReport } from '../model/ipam';
import type { Project } from '../model/schema';
import { useProject } from './useProject';

function cached<T>(compute: (p: Project) => T): (p: Project) => T {
  const cache = new WeakMap<Project, T>();
  return (p) => {
    let value = cache.get(p);
    if (value === undefined) {
      value = compute(p);
      cache.set(p, value);
    }
    return value;
  };
}

export const addressReportOf = cached(addressReport);
export const conduitsOf = cached(deriveConduits);

export function useAddressReport(): AddressReport {
  return addressReportOf(useProject((s) => s.project));
}

export function useConduits(): Conduit[] {
  return conduitsOf(useProject((s) => s.project));
}
