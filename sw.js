const CACHE_NAME = 'uley-pwa-v7';
const ASSETS = ['./', './index.html', './app.js', './manifest.json', './icon.jpg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Игнорируем запросы к внешним API (Telegram, JSONBin)
  if (event.request.url.includes('api.telegram.org') || event.request.url.includes('api.jsonbin.io')) {
    return; // Браузер выполнит запрос напрямую, в обход Service Worker'а
  }
  
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
