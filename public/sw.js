/*
 * Service worker — self-destruct mode.
 *
 * We are iterating against the Vite dev server over the LAN (phone at
 * http://<lan-ip>:5173). A previously-installed SW cached old JS/CSS modules
 * cache-first, so the phone kept running stale code even after hard refresh
 * (pure black screen after login).
 *
 * This version intentionally:
 *   1. clears every cache (including the old friday-app-v2),
 *   2. unregisters itself,
 *   3. reloads all controlled clients so they fetch fresh modules.
 *
 * After this runs once there is no SW and no cache, so development behaves
 * like a plain static host. To re-enable PWA caching for a production build,
 * replace this file with a real runtime-caching strategy.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => {
        if ('navigate' in client) client.navigate(client.url)
      })
    })(),
  )
})

// Never intercept anything — let the network (and Vite) own every request.
self.addEventListener('fetch', () => {})
