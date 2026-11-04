import { migrate } from '../../model/migrate';
import type { Project } from '../../model/schema';
import waterTreatment from './water-treatment.json';

/**
 * The fictional plant shown on first start. Kept apart from the template list so the other
 * templates are only downloaded when the gallery opens.
 *
 * It is the store's first state, so it can't wait for the validator, which loads on demand. The
 * file ships with the app and `demo.test.ts` checks that this gives the same project as
 * validating it with `parseProject`.
 */
export function loadDemo(): Project {
  return migrate(structuredClone(waterTreatment)) as Project;
}
