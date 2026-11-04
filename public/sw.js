// Service worker de MessOff: la app abre sin red y los avisos llegan como notificaciones.
// No guarda nada de /api: los datos de la cuenta no se quedan en la caché del navegador.
const CACHE = 'messoff-shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return

  // Primero la red, para no quedarse con una versión vieja; sin red, lo último guardado.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch (error) {
        const cached = await cache.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await cache.match('./')
          if (shell) return shell
        }
        throw error
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const eventId = event.notification.data?.eventId
      for (const client of windows) {
        await client.focus()
        if (eventId) client.postMessage({ type: 'open-event', eventId })
        return
      }
      await self.clients.openWindow(eventId ? `./?event=${encodeURIComponent(eventId)}` : './')
    })(),
  )
})
