const CACHE_NAME = 'watchguard-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/watchguard-icon.svg',
  '/camera-active.svg',
  '/favicon.ico',
];

const FACE_API_MODELS = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/ssd_mobilenetv1_model-weights_manifest.json',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model-weights_manifest.json',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-weights_manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle face-api model requests - cache first
  if (url.href.includes('face-api') || url.href.includes('@vladmandic')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Handle API requests to LAN server - network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Network unavailable', offline: true }),
          { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Handle static assets - stale while revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Sync pending data when online
  console.log('[SW] Syncing offline data...');
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'WatchGuard Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/watchguard-icon.svg',
    badge: '/watchguard-icon.svg',
    vibrate: [100, 50, 100],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
