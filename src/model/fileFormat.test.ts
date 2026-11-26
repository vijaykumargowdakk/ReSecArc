import { describe, expect, it } from 'vitest';
import { fileTooLarge, MAX_PROJECT_FILE_BYTES } from './fileFormat';

describe('fileTooLarge', () => {
  it('accepts files up to the limit and refuses larger ones with a readable reason (issue #60)', () => {
    expect(fileTooLarge({ name: 'plant.json', size: 1024 })).toBeNull();
    expect(fileTooLarge({ name: 'plant.json', size: MAX_PROJECT_FILE_BYTES })).toBeNull();
    expect(fileTooLarge({ name: 'huge.json', size: MAX_PROJECT_FILE_BYTES + 1 })).toBe('huge.json is 50 MB, larger than the 50 MB a project file can be.');
    expect(fileTooLarge({ name: 'huge.json', size: 80 * 1024 * 1024 })).toBe('huge.json is 80 MB, larger than the 50 MB a project file can be.');
  });
});
