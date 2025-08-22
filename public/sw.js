// Service Worker for CotonAI Konva - Smart Caching
const CACHE_NAME = 'cotonai-konva-v1';
const STATIC_CACHE = 'cotonai-static-v1';
const DYNAMIC_CACHE = 'cotonai-dynamic-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/CotonAI_Logo.svg',
  '/CotonAI_Logo2.svg',
  '/Placeholder_Image.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_FILES);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - network first, cache fallback
    event.respondWith(networkFirst(request));
  } else if (url.pathname.includes('board-images')) {
    // Board images - cache first, network fallback
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.includes('.js') || url.pathname.includes('.css')) {
    // Static assets - cache first, network fallback
    event.respondWith(cacheFirst(request));
  } else {
    // Other requests - network first, cache fallback
    event.respondWith(networkFirst(request));
  }
});

// Cache First Strategy - for static assets and images
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return a placeholder if both cache and network fail
    if (request.url.includes('board-images')) {
      return new Response('', { status: 404 });
    }
    throw error;
  }
}

// Network First Strategy - for API calls and dynamic content
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle any pending offline operations
  console.log('Background sync triggered');
}
