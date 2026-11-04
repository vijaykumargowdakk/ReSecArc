import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NODE_HEIGHT } from './purdue';

// Lane detection, areas and the level tab grid use NODE_HEIGHT; the canvas draws the box from CSS.
// If the two drift apart, lane detection shifts slightly and nothing else fails, so check it here.
describe('NODE_HEIGHT', () => {
  it('matches the height of the .device-node rule in styles.css', () => {
    const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
    // The base rule only: it starts a line, unlike the themed and state variants.
    const rule = /^\.device-node\s*\{([^}]*)\}/m.exec(css);
    expect(rule, 'a .device-node rule at the start of a line').not.toBeNull();
    const height = /(?:^|;|\s)height:\s*([^;]+);/.exec(rule![1]);
    expect(height, 'a height in the .device-node rule').not.toBeNull();
    expect(height![1].trim()).toBe(`${NODE_HEIGHT}px`);
  });
});
