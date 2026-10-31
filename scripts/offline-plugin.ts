// Writes dist/sw.js after a build: the service worker in src/offline/sw.js, preceded by the list of
// every built file to keep for offline use and a version taken from their contents. Any change to
// the build changes the version, which is how browsers find out that an update is available.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

const SOURCE = 'src/offline/sw.js';
/** Files the app never needs offline. */
const SKIP = new Set(['sw.js', 'robots.txt']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

export function offline(): Plugin {
  let root = '';
  let outDir = '';
  return {
    name: 'resecarc-offline',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    // After every file, including those copied from public/, has been written.
    closeBundle() {
      const files = walk(outDir)
        .map((path) => relative(outDir, path).split('\\').join('/'))
        .filter((file) => !SKIP.has(file))
        .sort();
      if (!files.includes('index.html')) throw new Error('offline: dist/index.html is missing');
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      const version = hash.digest('hex').slice(0, 16);
      const source = readFileSync(resolve(root, SOURCE), 'utf8');
      const head = `const VERSION = ${JSON.stringify(version)};\nconst FILES = ${JSON.stringify(files)};\n`;
      writeFileSync(join(outDir, 'sw.js'), head + source);
    },
  };
}
