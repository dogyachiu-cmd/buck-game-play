const VERSION = 'little-adventure-v0.4.0';
const BASE = self.registration.scope;
const CACHE_PREFIX = 'little-adventure:' + BASE + ':';
const CACHE = CACHE_PREFIX + VERSION;
const FILES = [
  './', 'index.html', 'src/', 'src/index.html', 'src/game.css',
  'src/game.js', 'src/state.js', 'src/icons.js', 'src/controls.js', 'src/catalog.js', 'src/journal.js', 'src/shop.js', 'manifest.webmanifest',
  'assets/backgrounds/land-storybook-v1.png', 'assets/backgrounds/sea-storybook-v1.png',
  'assets/ui/app-icon.svg', 'assets/ui/icon-192.png', 'assets/ui/icon-512.png',
  'vendor/three.module.js', 'vendor/loaders/GLTFLoader.js', 'vendor/utils/BufferGeometryUtils.js',
  'assets/models/cute_adventure.glb',
  'assets/concept/concept-01-ocean.png', 'assets/concept/concept-02-land.png', 'assets/concept/concept-03-world.png'
];
const ALLOWED = new Set(FILES.map(file => new URL(file, BASE).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...ALLOWED])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (!ALLOWED.has(url.href)) return;
  event.respondWith(serveGameFile(event.request, url.href));
});

async function serveGameFile(request, key) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) {
      // Storage quota failures must not prevent online play.
      await cache.put(key, response.clone()).catch(() => {});
      return response;
    }
    return (await cache.match(key)) || response;
  } catch {
    return (await cache.match(key)) || new Response('請連網後重新開啟', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } finally { clearTimeout(timer); }
}
