/// <reference lib="webworker" />
// RippleChat service worker: PWA offline app shell + Web Push notifications.
//
// This file IS the shipped worker. vite-plugin-pwa runs in `injectManifest`
// mode, which bundles this source and replaces `self.__WB_MANIFEST` with the
// build's precache manifest. It used to run in the default `generateSW` mode,
// which emitted its own worker over the top of the hand-written one and
// silently dropped every push handler below — see `injectManifest` in
// vite.config.ts.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Hashed build assets, precached by workbox. Replaces the hand-rolled
// APP_SHELL list, which only covered the four unhashed entrypoint files and so
// left the actual JS/CSS to be fetched from the network on a cold offline start.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Runtime cache for anything workbox does not precache. Namespaced so the
// sweep below can tell our caches from workbox's own `workbox-precache-v2-*`.
const RUNTIME_CACHE = 'ripplechat-runtime-v1'
const OWN_CACHE_PREFIX = 'ripplechat-'

self.addEventListener('install', () => {
  self.skipWaiting()
})

// Drop caches from older versions of *this* worker, then take control of open
// pages. The prefix check matters: an unfiltered sweep would delete workbox's
// precache on every activation and defeat the precaching above.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(OWN_CACHE_PREFIX) && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Runtime stale-while-revalidate for same-origin GETs that are not precached
// (lazy chunks that were filtered out of the manifest, fonts, and so on).
// Registered after precacheAndRoute, so precached URLs are served by workbox.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Only handle our own origin — never a cross-origin API or media CDN.
  if (url.origin !== self.location.origin) return
  // Navigations are handled by workbox's precached index.html route.
  if (request.mode === 'navigate') return
  // And never the API or the socket, whatever origin they are on.
  //
  // The origin check above was doing this job by accident: the deployed backend
  // happens to sit on another host. Put the API behind the same origin — the
  // ordinary single-domain deployment, and what the dev and preview proxies
  // model — and every authenticated GET landed in the cache and was served
  // stale-while-revalidate. That is wrong twice over: the app shows the previous
  // load's channels and messages, and Cache Storage is keyed by URL alone and
  // survives a sign-out, so the next person on this browser could be handed the
  // previous one's /api/users/me, channel list and notifications.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || (network as Promise<Response>)
    }),
  )
})

function getIndexedDBKey(storeName: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open('ripplechat-db', 4)
    request.onerror = () => resolve(null)
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      try {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const getReq = store.get(key)
        getReq.onsuccess = () => resolve((getReq.result as string) || null)
        getReq.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    }
  })
}

// Returns Uint8Array<ArrayBuffer> rather than the default Uint8Array<ArrayBufferLike>
// so it satisfies BufferSource without a cast (ArrayBufferLike admits
// SharedArrayBuffer, which the Web Crypto signatures reject).
function fromBase64(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// The sender id is not a parameter: the ciphertext carries its own, and using
// the envelope's instead would let a mismatched pair pick the wrong key.
async function decryptPayload(payload: string, channelId: string): Promise<string | null> {
  try {
    let rawCipher = payload
    // If body has sender prefix e.g. "Elif: enc:group:...", strip prefix
    const encIndex = payload.indexOf('enc:group:')
    if (encIndex > 0) {
      rawCipher = payload.slice(encIndex)
    }

    if (!rawCipher.startsWith('enc:group:')) {
      return null
    }

    const parts = rawCipher.slice('enc:group:'.length).split(':')
    const msgSenderId = parts[0]
    const cryptoPart = parts[1]
    if (!msgSenderId || !cryptoPart) return null

    const [ivPart, ctPart] = cryptoPart.split('.')
    if (!ivPart || !ctPart) return null

    const dbKey = `group_member_key:${channelId}:${msgSenderId}`
    const senderKeyB64 = await getIndexedDBKey('crypto_keys', dbKey)
    if (!senderKeyB64) return null

    const keyBytes = fromBase64(senderKeyB64)
    const senderKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
      'decrypt',
    ])

    const plaintextBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      senderKey,
      fromBase64(ctPart),
    )

    const decryptedStr = new TextDecoder().decode(plaintextBytes)
    const parsed = JSON.parse(decryptedStr)
    return parsed.text || null
  } catch (err) {
    console.error('SW decryption failed:', err)
    return null
  }
}

interface PushPayload {
  title?: string
  body?: string
  url?: string
  encrypted?: boolean
  channelId?: string
  senderId?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data ? (event.data.json() as PushPayload) : {}
  } catch {
    data = {}
  }
  const title = data.title || 'RippleChat'

  if (data.encrypted && data.channelId && data.senderId) {
    event.waitUntil(
      decryptPayload(data.body ?? '', data.channelId).then((decryptedBody) => {
        const bodyText = decryptedBody || '[Encrypted message]'
        return self.registration.showNotification(title, {
          body: bodyText,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          data: { url: data.url || '/' },
        })
      }),
    )
  } else {
    event.waitUntil(
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url: data.url || '/' },
      }),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
