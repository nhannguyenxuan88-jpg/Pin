// Service Worker with automatic cache invalidation
// Version is based on build timestamp to ensure fresh content
const CACHE_VERSION = 'pincorp-v' + new Date().getTime();
const CACHE_NAME = CACHE_VERSION;

// Assets to cache (excluding HTML to ensure fresh content)
const urlsToCache = [
    './manifest.json',
    './nhan-lam-logo.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker version:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete all caches except the current one
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // NEVER cache API requests (Supabase, REST endpoints)
    if (url.hostname.includes('supabase') ||
        url.pathname.includes('/rest/') ||
        url.pathname.includes('/api/') ||
        url.pathname.includes('/auth/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Network-first strategy for HTML files (always get fresh content)
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone the response before caching
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache-first strategy for other assets
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then((response) => {
                    // Don't cache if not a valid response
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                });
            })
    );
});

