importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDeUCJf9UCJOlrLzDhb10EgDJdc-C68Avs",
  authDomain: "appulei.firebaseapp.com",
  projectId: "appulei",
  storageBucket: "appulei.firebasestorage.app",
  messagingSenderId: "113329898258",
  appId: "1:113329898258:web:bbeb4f2bfa8cfc234b69cb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '🐝 Детский клуб «Улей»';
  const options = {
    body: payload.notification?.body || '',
    icon: './icon.jpg',
    badge: './icon.jpg',
    vibrate: [200, 100, 200]
  };
  self.registration.showNotification(title, options);
});

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
  // Игнорируем запросы к внешним API (Telegram, JSONBin, Firebase)
  if (
    event.request.url.includes('api.telegram.org') ||
    event.request.url.includes('api.jsonbin.io') ||
    event.request.url.includes('googleapis.com')
  ) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
