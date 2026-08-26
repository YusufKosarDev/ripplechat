// Opt-in end-to-end encryption for direct messages. A shared passphrase (never
// sent to the server) is stretched with PBKDF2 into an AES-GCM key; message text
// is encrypted client-side. The server only ever stores/relays the opaque
// "enc:v1:<iv>.<ciphertext>" string, so plaintext, attachments and search are
// all unaffected for non-encrypted chats.

import { client } from '../api/client'
import {
  getAsymmetricKeyPair,
  saveSignedPreKeyPair,
  getSignedPreKeyPair,
  saveOneTimePreKeyPair,
  getOneTimePreKeyPair,
  deleteOneTimePreKeyPair,
  saveRatchetSession,
  getRatchetSession,
  saveDecryptedCache,
  getDecryptedCache,
  getDB,
} from '../db'
import {
  generateDHKeyPair,
  ratchetEncrypt,
  ratchetDecrypt,
  serializeSession,
  deserializeSession,
  toBase64,
  fromBase64,
  type RatchetSession,
  type MessageHeader,
} from './doubleRatchet'
import {
  x3dhSender,
  x3dhReceiver,
  type PreKeyBundle,
  type X3DHInitialMessage,
} from './x3dh'

const PREFIX = 'enc:v1:'
const PREFIX_V2 = 'enc:v2:'
const keyCache = new Map<string, Promise<CryptoKey>>()

async function deriveKey(channelId: string, passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  // A per-channel, deterministic salt so both participants derive the same key
  // from the same passphrase without exchanging a salt.
  const salt = await crypto.subtle.digest('SHA-256', encoder.encode(`ripplechat:${channelId}`))
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function getKey(channelId: string, passphrase: string): Promise<CryptoKey> {
  const cacheKey = `${channelId}\0${passphrase}`
  let promise = keyCache.get(cacheKey)
  if (!promise) {
    promise = deriveKey(channelId, passphrase)
    keyCache.set(cacheKey, promise)
  }
  return promise
}

const PREFIX_GROUP = 'enc:group:'
const groupKeysCache = new Map<string, Map<string, CryptoKey>>()

/**
 * Sentinel stored in place of a plaintext when decryption fails, so the UI can
 * tell "not decrypted yet" (undefined) apart from "cannot be decrypted".
 */
export const DECRYPT_FAILED = '__rc_decrypt_failed__'

export function isEncrypted(content: string | null | undefined): boolean {
  return typeof content === 'string' && (content.startsWith(PREFIX) || content.startsWith(PREFIX_V2) || content.startsWith(PREFIX_GROUP))
}

export function isEncryptedV2(content: string | null | undefined): boolean {
  return typeof content === 'string' && content.startsWith(PREFIX_V2)
}

export { PREFIX_V2 }

async function getOrGenerateLocalSenderKey(channelId: string): Promise<string> {
  const cacheKey = `group_sender_key:${channelId}`
  const db = await getDB()
  if (db) {
    const raw = await db.get('crypto_keys', cacheKey)
    if (raw) return raw as string
  }
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const keyB64 = toBase64(randomBytes)
  if (db) {
    await db.put('crypto_keys', keyB64, cacheKey)
  }
  return keyB64
}

export async function encryptText(
  channelId: string,
  passphrase: string,
  plaintext: string,
  senderId: string,
  members: { user: { id: string } }[]
): Promise<string> {
  const senderKeyB64 = await getOrGenerateLocalSenderKey(channelId)
  
  const uploadFlagKey = `group_sender_key_uploaded:${channelId}`
  const db = await getDB()
  let alreadyUploaded = false
  if (db) {
    alreadyUploaded = !!(await db.get('crypto_keys', uploadFlagKey))
  }

  if (!alreadyUploaded) {
    const stretchedKey = await getKey(channelId, passphrase)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encryptedSenderKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      stretchedKey,
      new TextEncoder().encode(senderKeyB64)
    )
    const encryptedKeyPayload = `enc:groupkey:${toBase64(iv)}.${toBase64(new Uint8Array(encryptedSenderKey))}`

    const uploadPayload = members
      .filter((m) => m.user.id !== senderId)
      .map((m) => ({
        recipientId: m.user.id,
        encryptedKey: encryptedKeyPayload
      }))

    if (uploadPayload.length > 0) {
      await client.post(`/api/e2ee/group-keys/${channelId}`, uploadPayload)
    }

    if (db) {
      await db.put('crypto_keys', 'true', uploadFlagKey)
    }
  }

  const keyBytes = fromBase64(senderKeyB64)
  const aesKey = await crypto.subtle.importKey('raw', keyBytes as BufferSource, 'AES-GCM', false, ['encrypt'])
  const msgIv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: msgIv },
    aesKey,
    new TextEncoder().encode(plaintext)
  )

  return `${PREFIX_GROUP}${senderId}:${toBase64(msgIv)}.${toBase64(new Uint8Array(ciphertext))}`
}

export async function decryptText(
  channelId: string,
  passphrase: string,
  payload: string,
  currentUserId: string
): Promise<string> {
  if (!isEncrypted(payload)) return payload

  if (payload.startsWith(PREFIX)) {
    const [ivPart, ctPart] = payload.slice(PREFIX.length).split('.')
    if (!ivPart || !ctPart) throw new Error('malformed ciphertext')
    const key = await getKey(channelId, passphrase)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) as BufferSource },
      key,
      fromBase64(ctPart) as BufferSource,
    )
    return new TextDecoder().decode(plaintext)
  }

  if (!payload.startsWith(PREFIX_GROUP)) {
    return payload
  }

  const parts = payload.slice(PREFIX_GROUP.length).split(':')
  const senderId = parts[0]
  const cryptoPart = parts[1]
  if (!senderId || !cryptoPart) throw new Error('malformed group ciphertext')

  const [ivPart, ctPart] = cryptoPart.split('.')
  if (!ivPart || !ctPart) throw new Error('malformed group ciphertext parts')

  let senderKey: CryptoKey | null = null

  if (senderId === currentUserId) {
    const senderKeyB64 = await getOrGenerateLocalSenderKey(channelId)
    const keyBytes = fromBase64(senderKeyB64)
    senderKey = await crypto.subtle.importKey('raw', keyBytes as BufferSource, 'AES-GCM', false, ['decrypt'])
  } else {
    if (!groupKeysCache.has(channelId)) {
      groupKeysCache.set(channelId, new Map())
    }
    const channelKeys = groupKeysCache.get(channelId)!

    if (channelKeys.has(senderId)) {
      senderKey = channelKeys.get(senderId)!
    } else {
      const db = await getDB()
      const dbKey = `group_member_key:${channelId}:${senderId}`
      let senderKeyB64: string | null = null

      if (db) {
        senderKeyB64 = await db.get('crypto_keys', dbKey) as string | null
      }

      if (!senderKeyB64) {
        const response = await client.get<{ senderId: string; encryptedKey: string }[]>(`/api/e2ee/group-keys/${channelId}`)
        const stretchedKey = await getKey(channelId, passphrase)

        for (const entry of response.data) {
          try {
            const [kIvPart, kCtPart] = entry.encryptedKey.slice('enc:groupkey:'.length).split('.')
            const decryptedKeyBytes = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: fromBase64(kIvPart) as BufferSource },
              stretchedKey,
              fromBase64(kCtPart) as BufferSource
            )
            const decKeyB64 = new TextDecoder().decode(decryptedKeyBytes)

            if (db) {
              await db.put('crypto_keys', decKeyB64, `group_member_key:${channelId}:${entry.senderId}`)
            }

            const kBytes = fromBase64(decKeyB64)
            const cryptoKey = await crypto.subtle.importKey('raw', kBytes as BufferSource, 'AES-GCM', false, ['decrypt'])
            channelKeys.set(entry.senderId, cryptoKey)

            if (entry.senderId === senderId) {
              senderKey = cryptoKey
            }
          } catch (err) {
            console.error('Failed to decrypt group sender key entry:', entry.senderId, err)
          }
        }
      } else {
        const kBytes = fromBase64(senderKeyB64)
        const cryptoKey = await crypto.subtle.importKey('raw', kBytes as BufferSource, 'AES-GCM', false, ['decrypt'])
        channelKeys.set(senderId, cryptoKey)
        senderKey = cryptoKey
      }
    }
  }

  if (!senderKey) {
    throw new Error('Sender key not found or not decrypted')
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivPart) as BufferSource },
    senderKey,
    fromBase64(ctPart) as BufferSource
  )

  return new TextDecoder().decode(plaintext)
}

export async function deriveSharedKey(ourPrivateKey: CryptoKey, partnerPublicKeyJwkString: string): Promise<CryptoKey> {
  const partnerPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    JSON.parse(partnerPublicKeyJwkString),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
  return window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: partnerPublicKey },
    ourPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptTextAsymmetric(sharedKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    new TextEncoder().encode(plaintext),
  )
  return `${PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`
}

export async function decryptTextAsymmetric(sharedKey: CryptoKey, payload: string): Promise<string> {
  if (!isEncrypted(payload)) return payload
  const [ivPart, ctPart] = payload.slice(PREFIX.length).split('.')
  if (!ivPart || !ctPart) throw new Error('malformed ciphertext')
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivPart) as BufferSource },
    sharedKey,
    fromBase64(ctPart) as BufferSource,
  )
  return new TextDecoder().decode(plaintext)
}

// ─── E2EE V2 (Double Ratchet & X3DH) ──────────────────────────────────

export async function replenishPreKeys() {
  const identityKeyPair = await getAsymmetricKeyPair()
  if (!identityKeyPair) throw new Error('Identity key pair not found')

  // Generate new Signed Pre-Key
  const signedPreKeyPair = await generateDHKeyPair()
  const signedPreKeyJwk = await crypto.subtle.exportKey('jwk', signedPreKeyPair.publicKey)
  const signedPreKeyId = Math.floor(Math.random() * 1000000)

  // Generate 20 One-Time Pre-Keys
  const oneTimePreKeyDtos = []
  for (let i = 0; i < 20; i++) {
    const keyPair = await generateDHKeyPair()
    const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    const keyId = Math.floor(Math.random() * 1000000)
    
    // Save locally
    await saveOneTimePreKeyPair(keyId, keyPair)
    
    oneTimePreKeyDtos.push({
      keyId,
      publicKey: JSON.stringify(jwk)
    })
  }

  // Save signed pre-key locally
  await saveSignedPreKeyPair(signedPreKeyId, signedPreKeyPair)

  // Export our Identity Private Key to JWK
  const identityPrivateJwk = await crypto.subtle.exportKey('jwk', identityKeyPair.privateKey)
  // Modify JWK usage for ECDSA signing
  identityPrivateJwk.key_ops = ['sign']
  // Import it as an ECDSA Private Key
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    identityPrivateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  
  // Sign the public key of the Signed Pre-Key
  const rawSignedPreKeyPublic = new TextEncoder().encode(JSON.stringify(signedPreKeyJwk))
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    signingKey,
    rawSignedPreKeyPublic
  )
  const realSignature = toBase64(new Uint8Array(signatureBuffer))

  // Upload to backend
  await client.post('/api/e2ee/keys', {
    signedPreKeyId,
    signedPreKeyPublic: JSON.stringify(signedPreKeyJwk),
    signedPreKeySignature: realSignature,
    oneTimePreKeys: oneTimePreKeyDtos
  })
}

export async function encryptTextV2(partnerId: string, plaintext: string): Promise<string> {
  const ourKeyPair = await getAsymmetricKeyPair()
  if (!ourKeyPair) {
    throw new Error('Identity key pair not found')
  }

  const serialized = await getRatchetSession(partnerId)
  let session: RatchetSession
  let x3dhInfo: X3DHInitialMessage | null = null

  if (serialized) {
    session = await deserializeSession(serialized)
  } else {
    // Fetch partner's prekey bundle
    const response = await client.get<PreKeyBundle>(`/api/e2ee/keys/${partnerId}`)
    const bundle = response.data

    // Run x3dhSender
    const x3dhResult = await x3dhSender(ourKeyPair, bundle)
    session = x3dhResult.session

    const identityJwk = await crypto.subtle.exportKey('jwk', ourKeyPair.publicKey)
    x3dhInfo = {
      identityKey: JSON.stringify(identityJwk),
      ephemeralKey: JSON.stringify(x3dhResult.ephemeralPublicKey),
      oneTimePreKeyId: x3dhResult.usedOneTimePreKeyId,
    }
  }

  // Encrypt the plaintext
  const { header, ciphertext } = await ratchetEncrypt(session, plaintext)

  // Save the updated session
  await saveRatchetSession(partnerId, await serializeSession(session))

  // Construct payload
  let payload: string
  if (x3dhInfo) {
    const infoB64 = btoa(JSON.stringify(x3dhInfo))
    const headerB64 = btoa(JSON.stringify(header))
    payload = `${PREFIX_V2}init:${infoB64}:${headerB64}:${ciphertext}`
  } else {
    const headerB64 = btoa(JSON.stringify(header))
    payload = `${PREFIX_V2}msg:${headerB64}:${ciphertext}`
  }

  // Cache plaintext
  await saveDecryptedCache(payload, plaintext)

  return payload
}

export async function decryptTextV2(partnerId: string, payload: string): Promise<string> {
  if (!payload.startsWith(PREFIX_V2)) {
    throw new Error('Invalid V2 payload prefix')
  }

  // Check cache first
  const cached = await getDecryptedCache(payload)
  if (cached !== null) return cached

  const parts = payload.slice(PREFIX_V2.length).split(':')
  const type = parts[0] // 'init' or 'msg'

  const ourKeyPair = await getAsymmetricKeyPair()
  if (!ourKeyPair) {
    throw new Error('Identity key pair not found')
  }

  let session: RatchetSession
  let plaintext: string

  if (type === 'init') {
    const infoB64 = parts[1]
    const headerB64 = parts[2]
    const ciphertext = parts[3]

    const initialMessage = JSON.parse(atob(infoB64)) as X3DHInitialMessage
    const header = JSON.parse(atob(headerB64)) as MessageHeader

    const ourSignedPreKeyPair = await getSignedPreKeyPair()
    if (!ourSignedPreKeyPair) {
      throw new Error('Signed prekey pair not found')
    }

    let ourOneTimePreKeyPair = null
    if (initialMessage.oneTimePreKeyId !== null) {
      ourOneTimePreKeyPair = await getOneTimePreKeyPair(initialMessage.oneTimePreKeyId)
    }

    session = await x3dhReceiver(
      ourKeyPair,
      ourSignedPreKeyPair,
      ourOneTimePreKeyPair,
      initialMessage
    )

    plaintext = await ratchetDecrypt(session, header, ciphertext)
    await saveRatchetSession(partnerId, await serializeSession(session))

    if (initialMessage.oneTimePreKeyId !== null) {
      await deleteOneTimePreKeyPair(initialMessage.oneTimePreKeyId)
    }
  } else if (type === 'msg') {
    const headerB64 = parts[1]
    const ciphertext = parts[2]

    const header = JSON.parse(atob(headerB64)) as MessageHeader

    const serialized = await getRatchetSession(partnerId)
    if (!serialized) {
      throw new Error('Oturum bulunamadı')
    }

    session = await deserializeSession(serialized)
    plaintext = await ratchetDecrypt(session, header, ciphertext)
    await saveRatchetSession(partnerId, await serializeSession(session))
  } else {
    throw new Error('Unknown V2 payload type')
  }

  // Cache decrypted plaintext
  await saveDecryptedCache(payload, plaintext)

  return plaintext
}
