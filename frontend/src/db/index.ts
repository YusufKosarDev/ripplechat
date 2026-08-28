import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Message, Channel } from '../api/types'
import type { SerializedSession } from '../crypto/doubleRatchet'

export interface PendingMessage extends Omit<Message, 'id' | 'createdAt'> {
  tempId: string
  timestamp: number
}

interface RippleChatDB extends DBSchema {
  messages: {
    key: string // messageId
    value: Message
    indexes: { 'by-channel': string }
  }
  channels: {
    key: string // channelId
    value: Channel
  }
  pending_messages: {
    key: string // tempId
    value: PendingMessage
    indexes: { 'by-channel': string }
  }
  crypto_keys: {
    key: string
    value: string | CryptoKeyPair
  }
  ratchet_sessions: {
    key: string // channelId or recipientUserId
    value: { peerId: string; session: SerializedSession }
  }
  signed_pre_keys: {
    key: string // "signed" or keyId
    value: { publicKey: CryptoKey; privateKey: CryptoKey; keyId: number }
  }
  decrypted_cache: {
    key: string // ciphertext payload
    value: string // encrypted plaintext wrapper JSON
  }
}

let dbPromise: Promise<IDBPDatabase<RippleChatDB>> | null = null

export function getDB() {
  if (typeof indexedDB === 'undefined') {
    return null
  }
  if (!dbPromise) {
    dbPromise = openDB<RippleChatDB>('ripplechat-db', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' })
          messageStore.createIndex('by-channel', 'channelId')
          db.createObjectStore('channels', { keyPath: 'id' })
          const pendingStore = db.createObjectStore('pending_messages', { keyPath: 'tempId' })
          pendingStore.createIndex('by-channel', 'channelId')
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('crypto_keys')) {
            db.createObjectStore('crypto_keys')
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('ratchet_sessions')) {
            db.createObjectStore('ratchet_sessions')
          }
          if (!db.objectStoreNames.contains('signed_pre_keys')) {
            db.createObjectStore('signed_pre_keys')
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('decrypted_cache')) {
            db.createObjectStore('decrypted_cache')
          }
        }
      },
    })
  }
  return dbPromise
}

/** Every store that holds data belonging to the signed-in account. */
const USER_DATA_STORES = [
  'messages',
  'channels',
  'pending_messages',
  'crypto_keys',
  'ratchet_sessions',
  'signed_pre_keys',
  'decrypted_cache',
] as const

/**
 * localStorage entries scoped to the signed-in account. Deliberately excludes
 * the device preferences (theme, language), which are not personal data and
 * should survive a sign-out.
 */
const USER_DATA_LOCAL_KEYS = [
  'ripplechat_unread',
  'ripplechat_muted',
  'ripplechat_channel_org',
]

/**
 * Wipes everything this browser holds about the account that is signing out:
 * the cached message history, the offline send queue, and — most importantly —
 * the E2EE key material (identity keys, pre-keys, ratchet sessions and the
 * decrypted-plaintext cache).
 *
 * Without this, signing out left the previous user's conversations readable to
 * whoever signed in next on the same machine. Called from the logout thunk.
 */
export async function clearLocalUserData(): Promise<void> {
  // In-memory first, so a failure below still drops the cache key.
  cacheEncryptionKey = null

  for (const key of USER_DATA_LOCAL_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable (private mode); nothing to clean up then.
    }
  }
  try {
    sessionStorage.removeItem('ripplechat_e2ee')
  } catch {
    // as above
  }

  if (typeof indexedDB === 'undefined') return
  try {
    const db = await getDB()
    if (!db) return
    const existing = USER_DATA_STORES.filter((s) => db.objectStoreNames.contains(s))
    if (existing.length === 0) return
    const tx = db.transaction(existing, 'readwrite')
    await Promise.all(existing.map((s) => tx.objectStore(s).clear()))
    await tx.done
  } catch (err) {
    console.error('Failed to clear local user data:', err)
  }
}

// The crypto_keys store is shared: identity/pre-key pairs live next to the
// base64 sender keys and upload flags that e2ee.ts writes. Narrow on read so a
// key written under the wrong shape surfaces as "absent" rather than as a
// CryptoKeyPair the Web Crypto calls would choke on.
function asKeyPair(
  value: string | CryptoKeyPair | undefined,
): { publicKey: CryptoKey; privateKey: CryptoKey } | null {
  return value && typeof value !== 'string' ? value : null
}

export async function getAsymmetricKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await getDB()
  if (!db) return null
  return asKeyPair(await db.get('crypto_keys', 'asymmetric_keypair'))
}

export async function saveAsymmetricKeyPair(keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.put('crypto_keys', keyPair, 'asymmetric_keypair')
}

// Helpers
export async function saveMessagesToDB(messages: Message[]) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all(messages.map((m) => tx.store.put(m)))
  await tx.done
}

export async function getMessagesFromDB(channelId: string): Promise<Message[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await getDB()
  if (!db) return []
  const tx = db.transaction('messages', 'readonly')
  const index = tx.store.index('by-channel')
  const all = await index.getAll(channelId)
  // Sort by createdAt desc
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function addPendingMessage(msg: PendingMessage) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.put('pending_messages', msg)
}

export async function removePendingMessage(tempId: string) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.delete('pending_messages', tempId)
}

export async function getPendingMessages(): Promise<PendingMessage[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await getDB()
  if (!db) return []
  return await db.getAll('pending_messages')
}

// ─── Double Ratchet Session Persistence ──────────────────────────────

export async function saveRatchetSession(peerId: string, session: SerializedSession) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.put('ratchet_sessions', { peerId, session }, peerId)
}

export async function getRatchetSession(peerId: string): Promise<SerializedSession | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await getDB()
  if (!db) return null
  const entry = await db.get('ratchet_sessions', peerId)
  return entry?.session ?? null
}

export async function deleteRatchetSession(peerId: string) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.delete('ratchet_sessions', peerId)
}

// ─── Signed Pre-Key Persistence ──────────────────────────────────────

export async function saveSignedPreKeyPair(keyId: number, keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.put('signed_pre_keys', { ...keyPair, keyId }, 'current')
}

export async function getSignedPreKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; keyId: number } | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await getDB()
  if (!db) return null
  return (await db.get('signed_pre_keys', 'current')) || null
}

// ─── One-Time Pre-Key Persistence ────────────────────────────────────

export async function saveOneTimePreKeyPair(keyId: number, keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.put('crypto_keys', keyPair, `otpk:${keyId}`)
}

export async function getOneTimePreKeyPair(keyId: number): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await getDB()
  if (!db) return null
  return asKeyPair(await db.get('crypto_keys', `otpk:${keyId}`))
}

export async function deleteOneTimePreKeyPair(keyId: number) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  await db.delete('crypto_keys', `otpk:${keyId}`)
}

// ─── Decrypted Cache Persistence & Session Encryption ────────────────

let cacheEncryptionKey: CryptoKey | null = null

async function getCacheKey(): Promise<CryptoKey> {
  if (cacheEncryptionKey) return cacheEncryptionKey
  // Generate a random 256-bit AES-GCM key in memory.
  // This key is persistent in RAM only during the active tab session.
  cacheEncryptionKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  return cacheEncryptionKey
}

export async function saveDecryptedCache(ciphertext: string, plaintext: string) {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  if (!db) return
  try {
    const key = await getCacheKey()
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    )

    const payload = {
      iv: btoa(String.fromCharCode(...iv)),
      ct: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    }
    await db.put('decrypted_cache', JSON.stringify(payload), ciphertext)
  } catch (err) {
    console.error('Failed to encrypt decrypted cache entry:', err)
  }
}

export async function getDecryptedCache(ciphertext: string): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await getDB()
  if (!db) return null
  const raw = await db.get('decrypted_cache', ciphertext)
  if (!raw) return null
  try {
    const payload = JSON.parse(raw)
    const key = await getCacheKey()

    const ivBin = atob(payload.iv)
    const iv = new Uint8Array(ivBin.length)
    for (let i = 0; i < ivBin.length; i++) iv[i] = ivBin.charCodeAt(i)

    const ctBin = atob(payload.ct)
    const ct = new Uint8Array(ctBin.length)
    for (let i = 0; i < ctBin.length; i++) ct[i] = ctBin.charCodeAt(i)

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    // If decryption fails (e.g. tab reloaded/key reset), return null gracefully
    // so the client falls back to standard key exchange / ratchet decryption.
    return null
  }
}
