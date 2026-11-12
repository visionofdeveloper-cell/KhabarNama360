// 360Khabarnama Service Worker - Web Push & Notifications
const CACHE_NAME = '360kn-static-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event Listener
self.addEventListener('push', (event) => {
  let data = {
    title: '360Khabarnama Alert',
    body: 'New update from 360Khabarnama',
    url: '/',
    icon: '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
    badge: '/assets/aistudio/fav_8df1a0eb.png',
    tag: '360kn-general',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
    badge: data.badge || '/assets/aistudio/fav_8df1a0eb.png',
    data: {
      url: data.url || '/',
      timestamp: data.timestamp || Date.now(),
    },
    tag: data.tag || '360kn-alert',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.topic === 'breakingNews' || data.topic === 'cricketScores',
    actions: [
      {
        action: 'open_url',
        title: 'Open 360Khabarnama',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If an existing window is open, focus and navigate it
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Push Subscription Change Event
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((subscription) => {
        return fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh'))))),
              auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth'))))),
            },
          }),
        });
      })
      .catch((err) => {
        console.warn('[ServiceWorker] Subscription change error:', err);
      })
  );
});
