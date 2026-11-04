import { describe, expect, it } from 'vitest';
import { parseProject } from '../../model/io';
import { loadDemo } from './demo';
import waterTreatment from './water-treatment.json';

// loadDemo skips the validator so that it stays out of the startup bundle. This keeps it honest:
// the demo must be a valid project, and validating it must not change it (zod drops unknown keys).
describe('loadDemo', () => {
  it('gives the same project as validating the file', () => {
    const validated = parseProject(JSON.stringify(waterTreatment));
    if (!validated.ok) throw new Error(validated.errors.join('\n'));
    expect(loadDemo()).toStrictEqual(validated.project);
  });

  it('returns a fresh copy each time, so edits never reach the bundled file', () => {
    const a = loadDemo();
    a.devices.length = 0;
    expect(loadDemo().devices.length).toBeGreaterThan(0);
  });
});
