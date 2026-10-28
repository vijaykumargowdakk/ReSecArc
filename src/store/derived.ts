// Values computed from the project that several components need. Each is cached per project
// object, so it is computed once per change however many panels read it.
import { findingsByItem, runChecks, type Finding } from '../model/checks';
import { deriveConduits, type Conduit } from '../model/conduits';
import { addressReport, linkIssues, type AddressReport } from '../model/ipam';
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
export const linkIssuesOf = cached((p) => linkIssues(p, addressReportOf(p)));
export const findingsOf = cached(runChecks);
export const findingsByItemOf = cached((p) => findingsByItem(p, findingsOf(p)));

export function useAddressReport(): AddressReport {
  return addressReportOf(useProject((s) => s.project));
}

export function useLinkIssues(): Map<string, string[]> {
  return linkIssuesOf(useProject((s) => s.project));
}

export function useConduits(): Conduit[] {
  return conduitsOf(useProject((s) => s.project));
}

export function useFindings(): Finding[] {
  return findingsOf(useProject((s) => s.project));
}

/** Findings per device, link and flow id. */
export function useFindingsByItem(): Map<string, Finding[]> {
  return findingsByItemOf(useProject((s) => s.project));
}
