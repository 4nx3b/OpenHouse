/* ============================================================
   Openhouse — service worker
   Cache-first for the app shell (instant loads, offline support);
   network-first for the Supabase API so data stays fresh.
   ============================================================ */
const VERSION = 'openhouse-v9';
const SHELL = [
  '/',
  '/style.css',
  '/js/config.js',
  '/js/db.js',
  '/js/particles.js',
  '/js/main.js',
  '/js/categories.js',
  '/img/story-1.jpg',
  '/img/story-2.jpg',
  '/img/story-3.jpg',
  '/img/story-4.jpg',
  '/img/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // API/data requests: network first, fall back to cache when offline
  if (url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // navigations: network first, cached shell as offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }

  // everything else (shell, fonts, images): cache first, then network
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        // cache same-origin + font/CDN responses opportunistically
        if (res.ok && (url.origin === location.origin || /fonts|cdnjs|unpkg/.test(url.hostname))) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
