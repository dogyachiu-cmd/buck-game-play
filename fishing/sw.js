const CACHE_NAME = 'buck-fishing-v0.1.0';
const FILES = ['./', './index.html', './style.css', './app.js', './art.js', './catalog.js', './state.js', './fishing.js', './manifest.webmanifest', './assets/icon.svg', './assets/lake.png'];
const ALLOWED = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...ALLOWED])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('buck-fishing-v') && name !== CACHE_NAME).map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (event.request.method !== 'GET' || !ALLOWED.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.href);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(event.request, { signal: controller.signal });
      if (response.ok) {
        // Quota failures must not hide a successful online response.
        await cache.put(url.href, response.clone()).catch(() => {});
        return response;
      }
      return cached || response;
    } catch {
      if (cached) return cached;
      return new Response('請連線後再開啟釣魚遊戲', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } finally { clearTimeout(timeout); }
  })());
});
