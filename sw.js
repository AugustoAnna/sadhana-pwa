/*
 * sw.js — service worker: makes the app installable and usable offline.
 *
 * Your own files are "network first": while online you always get the latest version of a screen
 * you just edited; offline you get the cached copy. The large vendor runtime and Google Fonts are
 * "cache first". Change VERSION to make every installed copy drop its old cache.
 */
const VERSION = 'sadhana-pwa-v2';
const NETWORK_TIMEOUT = 4000; // ms before falling back to the cache on a slow connection

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './lib/db.js',
  './lib/content.js',
  './lib/stats.js',
  './lib/pwa.css',
  './lib/dc-runtime.js',
  './screens/support.js',
  './screens/screens.json',
  './icons/favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    // Pre-cache every screen listed in screens.json so the whole app works offline right away.
    try {
      const res = await fetch('./screens/screens.json', { cache: 'no-cache' });
      const { screens } = await res.json();
      await cache.addAll(screens.map((s) => './screens/' + s.file));
    } catch (err) {
      console.warn('[sw] could not pre-cache screens', err);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(url.pathname.endsWith('/lib/dc-runtime.js') ? cacheFirst(req) : networkFirst(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req));
  }
});

// Screens are cached without their ?query, so PracticeDetail.dc.html?p=isha works offline too.
function cacheKey(req) {
  const url = new URL(req.url);
  url.search = '';
  url.hash = '';
  return url.href;
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const key = cacheKey(req);
  // 'no-cache' makes the browser check with the server every time (cheap 304s), so an edited
  // screen shows up on the next reload instead of a copy from the HTTP cache.
  const network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  });
  network.catch(() => {}); // if the timeout wins and the network later fails, don't log an unhandled rejection
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT)),
    ]);
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const home = await cache.match(new URL('./screens/Home.dc.html', self.registration.scope).href);
      if (home) return home;
    }
    return network; // nothing cached: keep waiting for the network (or fail)
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
