
/**
 * Lumina Service Worker
 * Handles background notifications and PWA features
 */

// Install: Force the waiting service worker to become the active service worker.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: Claim all clients immediately so the app becomes "controlled" without a refresh.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear old caches if necessary in the future
    ])
  );
});

/**
 * MANDATORY FOR MOBILE PWA:
 * A fetch listener is required for the browser to recognize this as a valid PWA
 * and to set navigator.serviceWorker.controller to non-null.
 */
self.addEventListener('fetch', (event) => {
  // We can leave this empty for now or implement caching.
  // The mere presence of this listener unlocks SW 'active' status on Android/iOS.
});

// Allow immediate takeover via message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Lumina', body: 'Time for your growth ritual.' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = { title: 'Lumina', body: event.data.text() };
  }
  
  const options = {
    body: data.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/3237/3237472.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3237/3237472.png',
    vibrate: [200, 100, 200],
    tag: 'lumina-nudge',
    renotify: true,
    data: {
      url: self.registration.scope
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
