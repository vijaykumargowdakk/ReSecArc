// Fails the build when the startup bundle grows past its budget. Views and dialogs that load on
// demand are not counted. Run after `vite build`.
//
// The startup bundle is the entry script plus every chunk index.html preloads with
// <link rel="modulepreload">: the bundler splits shared code into separate files, but the browser
// fetches all of them before the app starts.
import { statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_KB = 575;
const html = readFileSync('dist/index.html', 'utf8');
const entry = /<script[^>]*type="module"[^>]*src="\.?\/?([^"]+\.js)"/.exec(html)?.[1];
if (!entry) {
  console.error('check-bundle: no entry script found in dist/index.html');
  process.exit(1);
}
const preloaded = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="\.?\/?([^"]+\.js)"/g)].map((m) => m[1]);
const files = [entry, ...preloaded.filter((f) => f !== entry)];
const kb = files.reduce((sum, f) => sum + statSync(join('dist', f)).size, 0) / 1024;
const entryKb = statSync(join('dist', entry)).size / 1024;
console.log(
  `check-bundle: startup is ${kb.toFixed(1)} kB in ${files.length} file(s) (entry ${entry.replace('assets/', '')} ${entryKb.toFixed(1)} kB; budget ${BUDGET_KB} kB)`,
);
if (kb > BUDGET_KB) {
  console.error('check-bundle: the startup bundle is over budget. Load new features on demand with import().');
  process.exit(1);
}
