// RippleChat service worker: PWA offline app shell + Web Push notifications.

const CACHE = 'ripplechat-v1'
const APP_SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

// Precache the app shell so the UI boots offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

// Drop caches from older versions, then take control of open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Only handle our own origin — never the cross-origin API or media CDNs.
  if (url.origin !== self.location.origin) return

  // SPA navigations: network-first, falling back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Static assets (hashed JS/CSS/fonts/icons): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

function getIndexedDBKey(storeName, key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('ripplechat-db', 4)
    request.onerror = () => resolve(null)
    request.onsuccess = (event) => {
      const db = event.target.result
      try {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const getReq = store.get(key)
        getReq.onsuccess = () => resolve(getReq.result || null)
        getReq.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    }
  })
}

function fromBase64(str) {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function decryptPayload(payload, channelId, senderId) {
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
    const senderKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    const plaintextBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      senderKey,
      fromBase64(ctPart)
    )

    const decryptedStr = new TextDecoder().decode(plaintextBytes)
    const parsed = JSON.parse(decryptedStr)
    return parsed.text || null
  } catch (err) {
    console.error('SW decryption failed:', err)
    return null
  }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'RippleChat'

  if (data.encrypted && data.channelId && data.senderId) {
    event.waitUntil(
      decryptPayload(data.body, data.channelId, data.senderId)
        .then((decryptedBody) => {
          const bodyText = decryptedBody || '[Şifreli Mesaj]'
          return self.registration.showNotification(title, {
            body: bodyText,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            data: { url: data.url || '/' },
          })
        })
    )
  } else {
    event.waitUntil(
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
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
