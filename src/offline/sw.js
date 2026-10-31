// The service worker that lets ReSecArc open and run without a network. The build writes it to
// dist/sw.js with VERSION and FILES (every built file) defined above this code; see
// scripts/offline-plugin.ts. Plain JavaScript because it runs in the service worker scope.
/* global VERSION, FILES */

// Cache names keep the prefix from before the product was renamed, so old caches are still cleaned up.
const PREFIX = 'conduitot-';
const CACHE = PREFIX + VERSION;
// Servers may answer with `Vary: Origin`, and module scripts are requested with an Origin header the
// stored copies were fetched without. A version's files never change, so the header does not matter.
const MATCH = { ignoreVary: true };

// Everything is fetched into a cache of its own per version, bypassing the HTTP cache so a stale
// copy of a file cannot end up in the new version.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))));
});

// The first version takes over the open page at once, so it works offline without a reload. A new
// version waits until the user chooses to reload (the page posts 'skip-waiting').
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

// Old versions are deleted, except the one just replaced: a tab still running it may need one of
// its on-demand files before it reloads.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const old = keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE);
        return Promise.all(old.slice(0, -1).map((key) => caches.delete(key)));
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  // Opening the app (with any ?query or #share link) gets this version's page.
  if (request.mode === 'navigate' && (url.pathname === scope || url.pathname === scope + 'index.html')) {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match('index.html', MATCH))
        .then((page) => page || fetch(request)),
    );
    return;
  }
  // Built files have content hashes in their names, so a cached copy is always the right one.
  event.respondWith(caches.match(request, MATCH).then((cached) => cached || fetch(request)));
});
