import { parseProject } from '../../model/io';
import type { Project } from '../../model/schema';
import waterTreatment from './water-treatment.json';

/**
 * The fictional plant shown on first start. Kept apart from the template list so the other
 * templates are only downloaded when the gallery opens.
 */
export function loadDemo(): Project {
  const result = parseProject(JSON.stringify(waterTreatment));
  if (!result.ok) throw new Error(`Demo template is invalid:\n${result.errors.join('\n')}`);
  return result.project;
}
