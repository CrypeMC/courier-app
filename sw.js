self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('courier-log-store').then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/style.css',
      '/app.js',
      '/manifest.json'
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});