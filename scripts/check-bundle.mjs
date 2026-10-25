// Fails the build when the startup bundle grows past its budget. Views and dialogs that load on
// demand are not counted. Run after `vite build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_KB = 575;
const dir = 'dist/assets';
const html = readFileSync('dist/index.html', 'utf8');
const entry = readdirSync(dir).find((f) => f.endsWith('.js') && html.includes(f));
if (!entry) {
  console.error('check-bundle: no entry script found in dist/index.html');
  process.exit(1);
}
const kb = statSync(join(dir, entry)).size / 1024;
console.log(`check-bundle: ${entry} is ${kb.toFixed(1)} kB (budget ${BUDGET_KB} kB)`);
if (kb > BUDGET_KB) {
  console.error('check-bundle: the startup bundle is over budget. Load new features on demand with import().');
  process.exit(1);
}
