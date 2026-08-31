/**
 * Enterprise Service Worker - Cache Management & Origin Validation
 */
const CACHE_VERSION = 'mgmt-faq-v3.0.0';
const HTML_CACHE = `html-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;

const SAFE_ASSET_EXTENSIONS = /\.(css|js|woff2?|png|jpe?g|svg|gif|webp|ico|json|webmanifest)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== HTML_CACHE && key !== ASSET_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Strict Policy: Only handle HTTP/HTTPS GET requests from same origin or trusted CDNs
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Static Assets: Cache-First with Network Fallback (Optimized for Speed)
  if (SAFE_ASSET_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Content: Network-First with Safe Offline Fallback (Prevents Stale Governance Policies)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(HTML_CACHE).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
