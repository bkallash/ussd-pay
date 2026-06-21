/* ============================================
   USSD Quick Pay - Service Worker
   Cache-first strategy for offline support
   ============================================ */

const CACHE_VERSION = 'quickpay-v11';

const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './images/jawwal-logo.png',
    './images/palpay-logo.png',
    './images/icon-192.png',
    './images/icon-512.png',
];

const FONT_CACHE = 'quickpay-fonts-v1';

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION && key !== FONT_CACHE)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: cache-first for static, network-first for fonts
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle Google Fonts separately (cache on first use)
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.open(FONT_CACHE).then((cache) =>
                cache.match(event.request).then((cached) => {
                    if (cached) return cached;
                    return fetch(event.request).then((response) => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                })
            )
        );
        return;
    }

    // Cache-first for everything else
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Don't cache non-GET or bad responses
                if (event.request.method !== 'GET' || !response.ok) {
                    return response;
                }
                // Cache the new resource
                const responseClone = response.clone();
                caches.open(CACHE_VERSION).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            });
        }).catch(() => {
            // Fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
