/* global self, caches, fetch */

const CACHE_PREFIX = 'photoview-app-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/logo192.png',
  '/logo512.png',
  '/photoview-logo.svg',
]

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch('/', { cache: 'reload' })

  if (response.ok) {
    await cache.put('/', response.clone())
    const html = await response.text()
    const assets = Array.from(
      html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g),
      match => match[1]
    )
    await Promise.all(
      [...new Set(assets)].map(asset => cache.add(asset).catch(() => undefined))
    )
  }

  await Promise.all(
    CORE_ASSETS.slice(1).map(asset => cache.add(asset).catch(() => undefined))
  )
}

self.addEventListener('install', event => {
  event.waitUntil(cacheAppShell())
})

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then(names =>
          Promise.all(
            names
              .filter(
                name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
              )
              .map(name => caches.delete(name))
          )
        ),
      self.clients.claim(),
    ])
  )
})

const navigationResponse = async request => {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put('/', response.clone())
    }
    return response
  } catch {
    return (await caches.match('/')) || Response.error()
  }
}

const staticAssetResponse = async request => {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/photo/') ||
    url.pathname.startsWith('/video/')
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request))
    return
  }

  if (
    url.pathname.startsWith('/assets/') ||
    CORE_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(staticAssetResponse(request))
  }
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
