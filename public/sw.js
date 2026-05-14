/**
 * Service worker RunGen — runtime caching, sans liste de pré-cache.
 *
 * Stratégies :
 *  - Navigations + assets same-origin (`/_nuxt/...`) : stale-while-revalidate
 *    → l'app se lance hors-ligne après une première visite.
 *  - Tuiles de carte (CARTO) : cache-first plafonné → carte consultable offline.
 *  - APIs (ORS / Overpass / Nominatim) : network-only (données dynamiques,
 *    Overpass a déjà son cache localStorage applicatif).
 */

const VERSION = 'rungen-v1'
const APP_CACHE = `${VERSION}-app`
const TILE_CACHE = `${VERSION}-tiles`
const TILE_LIMIT = 600

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

async function trimCache(name, limit) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length <= limit) return
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i])
}

function isTileRequest(url) {
  return url.hostname.endsWith('basemaps.cartocdn.com')
}

function isApiRequest(url) {
  return (
    url.hostname.includes('openrouteservice.org') ||
    url.hostname.includes('overpass') ||
    url.hostname.includes('nominatim') ||
    url.pathname.startsWith('/api/')
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // APIs dynamiques : on ne touche pas.
  if (isApiRequest(url)) return

  // Tuiles de carte : cache-first, plafonné.
  if (isTileRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILE_CACHE)
        const hit = await cache.match(req)
        if (hit) return hit
        try {
          const res = await fetch(req)
          if (res.ok) {
            cache.put(req, res.clone())
            trimCache(TILE_CACHE, TILE_LIMIT)
          }
          return res
        } catch {
          return hit || Response.error()
        }
      })(),
    )
    return
  }

  // Same-origin (app shell, assets) : stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE)
        const hit = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || network
      })(),
    )
  }
})
