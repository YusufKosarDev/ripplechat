/**
 * Double Ratchet Protocol — Web Crypto API implementation.
 *
 * Implements the Signal Double Ratchet algorithm providing:
 * - Forward Secrecy: past message keys are deleted after use
 * - Break-in Recovery: new DH ratchet steps heal compromised sessions
 * - Out-of-order message handling: skipped message keys are cached
 *
 * References:
 *   https://signal.org/docs/specifications/doubleratchet/
 */

// ─── Helpers ─────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(s: string): Uint8Array {
  const binary = atob(s)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ─── HKDF ────────────────────────────────────────────────────────────

/** HKDF-SHA256: derives `length` bytes of keying material. */
async function hkdf(
  ikm: ArrayBuffer,
  salt: ArrayBuffer | Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  )
}

/** KDF_RK: Root Key KDF — derives a new root key + chain key from DH output. */
async function kdfRK(rootKey: ArrayBuffer, dhOut: ArrayBuffer): Promise<{ rootKey: ArrayBuffer; chainKey: ArrayBuffer }> {
  const derived = await hkdf(dhOut, rootKey, encoder.encode('DoubleRatchetRK'), 64)
  return {
    rootKey: derived.slice(0, 32),
    chainKey: derived.slice(32, 64),
  }
}

/** KDF_CK: Chain Key KDF — derives a message key and the next chain key. */
async function kdfCK(chainKey: ArrayBuffer): Promise<{ chainKey: ArrayBuffer; messageKey: ArrayBuffer }> {
  const ck = await crypto.subtle.importKey('raw', chainKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const messageKey = await crypto.subtle.sign('HMAC', ck, encoder.encode('\x01'))
  const nextChainKey = await crypto.subtle.sign('HMAC', ck, encoder.encode('\x02'))
  return { chainKey: nextChainKey, messageKey }
}

// ─── ECDH ────────────────────────────────────────────────────────────

const ECDH_PARAMS = { name: 'ECDH', namedCurve: 'P-256' } as const

export async function generateDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

async function dh(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ECDH_PARAMS, true, [])
}

async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key)
}

// ─── AES-GCM Encrypt / Decrypt ──────────────────────────────────────

async function aesEncrypt(messageKey: ArrayBuffer, plaintext: string): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const key = await crypto.subtle.importKey('raw', messageKey, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  return { iv, ciphertext: new Uint8Array(ct) }
}

async function aesDecrypt(messageKey: ArrayBuffer, iv: Uint8Array, ciphertext: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', messageKey, 'AES-GCM', false, ['decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource)
  return decoder.decode(pt)
}

// ─── Session State ───────────────────────────────────────────────────

/** Maximum number of skipped message keys to store (prevents DoS). */
const MAX_SKIP = 256

export interface SerializedSession {
  rootKey: string               // base64
  sendChainKey: string | null   // base64
  recvChainKey: string | null   // base64
  sendRatchetKeyPair: { publicKey: JsonWebKey; privateKey: JsonWebKey } | null
  recvRatchetPublicKey: JsonWebKey | null
  sendN: number                 // send message counter
  recvN: number                 // recv message counter
  prevSendN: number             // previous send chain length
  skippedKeys: Record<string, string>  // "pubKeyHash:n" → base64 message key
}

export interface RatchetSession {
  rootKey: ArrayBuffer
  sendChainKey: ArrayBuffer | null
  recvChainKey: ArrayBuffer | null
  sendRatchetKeyPair: CryptoKeyPair | null
  recvRatchetPublicKey: CryptoKey | null
  sendN: number
  recvN: number
  prevSendN: number
  skippedKeys: Map<string, ArrayBuffer>
}

export interface MessageHeader {
  ratchetPublicKey: JsonWebKey
  prevChainLength: number
  messageNumber: number
}

// ─── Session Initialization (from X3DH shared secret) ────────────────

/**
 * Initialize a ratchet session as the SENDER (Alice).
 * Alice has already computed the X3DH shared secret and has Bob's signed pre-key.
 */
export async function initSenderSession(
  sharedSecret: ArrayBuffer,
  recipientSignedPreKey: JsonWebKey,
): Promise<RatchetSession> {
  const sendRatchetKeyPair = await generateDHKeyPair()
  const recipientKey = await importPublicKey(recipientSignedPreKey)
  const dhOut = await dh(sendRatchetKeyPair.privateKey, recipientKey)
  const { rootKey, chainKey } = await kdfRK(sharedSecret, dhOut)

  return {
    rootKey,
    sendChainKey: chainKey,
    recvChainKey: null,
    sendRatchetKeyPair,
    recvRatchetPublicKey: recipientKey,
    sendN: 0,
    recvN: 0,
    prevSendN: 0,
    skippedKeys: new Map(),
  }
}

/**
 * Initialize a ratchet session as the RECEIVER (Bob).
 * Bob uses his signed pre-key pair and the X3DH shared secret.
 */
export async function initReceiverSession(
  sharedSecret: ArrayBuffer,
  ourSignedPreKeyPair: CryptoKeyPair,
): Promise<RatchetSession> {
  return {
    rootKey: sharedSecret,
    sendChainKey: null,
    recvChainKey: null,
    sendRatchetKeyPair: ourSignedPreKeyPair,
    recvRatchetPublicKey: null,
    sendN: 0,
    recvN: 0,
    prevSendN: 0,
    skippedKeys: new Map(),
  }
}

// ─── Ratchet Encrypt ─────────────────────────────────────────────────

export async function ratchetEncrypt(
  session: RatchetSession,
  plaintext: string,
): Promise<{ header: MessageHeader; ciphertext: string }> {
  if (!session.sendChainKey || !session.sendRatchetKeyPair) {
    throw new Error('Session not ready for sending')
  }

  const { chainKey, messageKey } = await kdfCK(session.sendChainKey)
  session.sendChainKey = chainKey

  const header: MessageHeader = {
    ratchetPublicKey: await exportPublicKey(session.sendRatchetKeyPair.publicKey),
    prevChainLength: session.prevSendN,
    messageNumber: session.sendN,
  }
  session.sendN++

  const { iv, ciphertext } = await aesEncrypt(messageKey, plaintext)
  const payload = `${toBase64(iv)}.${toBase64(ciphertext)}`

  return { header, ciphertext: payload }
}

// ─── Ratchet Decrypt ─────────────────────────────────────────────────

async function pubKeyId(key: CryptoKey): Promise<string> {
  const jwk = await exportPublicKey(key)
  const raw = encoder.encode(JSON.stringify({ x: jwk.x, y: jwk.y }))
  const hash = await crypto.subtle.digest('SHA-256', raw)
  return toBase64(hash).slice(0, 16)
}

async function trySkippedKeys(session: RatchetSession, header: MessageHeader, ciphertext: string): Promise<string | null> {
  const headerKey = await importPublicKey(header.ratchetPublicKey)
  const id = await pubKeyId(headerKey)
  const lookupKey = `${id}:${header.messageNumber}`
  const mk = session.skippedKeys.get(lookupKey)
  if (!mk) return null

  session.skippedKeys.delete(lookupKey)
  const [ivPart, ctPart] = ciphertext.split('.')
  return aesDecrypt(mk, fromBase64(ivPart), fromBase64(ctPart))
}

async function skipMessageKeys(session: RatchetSession, until: number): Promise<void> {
  if (!session.recvChainKey) return
  if (session.recvN + MAX_SKIP < until) {
    throw new Error('Too many skipped messages')
  }

  const recvPubId = session.recvRatchetPublicKey ? await pubKeyId(session.recvRatchetPublicKey) : 'init'

  while (session.recvN < until) {
    const { chainKey, messageKey } = await kdfCK(session.recvChainKey)
    session.recvChainKey = chainKey
    session.skippedKeys.set(`${recvPubId}:${session.recvN}`, messageKey)
    session.recvN++
  }
}

async function dhRatchetStep(session: RatchetSession, header: MessageHeader): Promise<void> {
  session.prevSendN = session.sendN
  session.sendN = 0
  session.recvN = 0

  const headerPub = await importPublicKey(header.ratchetPublicKey)
  session.recvRatchetPublicKey = headerPub

  // Receiving chain
  const dhRecv = await dh(session.sendRatchetKeyPair!.privateKey, headerPub)
  const recv = await kdfRK(session.rootKey, dhRecv)
  session.rootKey = recv.rootKey
  session.recvChainKey = recv.chainKey

  // Sending chain — generate new ratchet key pair
  session.sendRatchetKeyPair = await generateDHKeyPair()
  const dhSend = await dh(session.sendRatchetKeyPair.privateKey, headerPub)
  const send = await kdfRK(session.rootKey, dhSend)
  session.rootKey = send.rootKey
  session.sendChainKey = send.chainKey
}

export async function ratchetDecrypt(
  session: RatchetSession,
  header: MessageHeader,
  ciphertext: string,
): Promise<string> {
  // 1. Try skipped keys first
  const skipped = await trySkippedKeys(session, header, ciphertext)
  if (skipped !== null) return skipped

  // 2. Check if we need a DH ratchet step
  const headerPub = await importPublicKey(header.ratchetPublicKey)
  const headerPubJwk = await exportPublicKey(headerPub)
  const currentRecvJwk = session.recvRatchetPublicKey ? await exportPublicKey(session.recvRatchetPublicKey) : null

  const isSameKey = currentRecvJwk && headerPubJwk.x === currentRecvJwk.x && headerPubJwk.y === currentRecvJwk.y

  if (!isSameKey) {
    // Skip any remaining messages in the old chain
    await skipMessageKeys(session, header.prevChainLength)
    // Perform DH ratchet step
    await dhRatchetStep(session, header)
  }

  // 3. Skip any messages before this one in the current chain
  await skipMessageKeys(session, header.messageNumber)

  // 4. Derive message key
  if (!session.recvChainKey) throw new Error('No receive chain key')
  const { chainKey, messageKey } = await kdfCK(session.recvChainKey)
  session.recvChainKey = chainKey
  session.recvN++

  // 5. Decrypt
  const [ivPart, ctPart] = ciphertext.split('.')
  return aesDecrypt(messageKey, fromBase64(ivPart), fromBase64(ctPart))
}

// ─── Serialization ───────────────────────────────────────────────────

export async function serializeSession(session: RatchetSession): Promise<SerializedSession> {
  const skippedKeys: Record<string, string> = {}
  for (const [k, v] of session.skippedKeys) {
    skippedKeys[k] = toBase64(v)
  }

  let sendRatchetKeyPair = null
  if (session.sendRatchetKeyPair) {
    sendRatchetKeyPair = {
      publicKey: await exportPublicKey(session.sendRatchetKeyPair.publicKey),
      privateKey: await crypto.subtle.exportKey('jwk', session.sendRatchetKeyPair.privateKey),
    }
  }

  let recvRatchetPublicKey = null
  if (session.recvRatchetPublicKey) {
    recvRatchetPublicKey = await exportPublicKey(session.recvRatchetPublicKey)
  }

  return {
    rootKey: toBase64(session.rootKey),
    sendChainKey: session.sendChainKey ? toBase64(session.sendChainKey) : null,
    recvChainKey: session.recvChainKey ? toBase64(session.recvChainKey) : null,
    sendRatchetKeyPair,
    recvRatchetPublicKey,
    sendN: session.sendN,
    recvN: session.recvN,
    prevSendN: session.prevSendN,
    skippedKeys,
  }
}

export async function deserializeSession(s: SerializedSession): Promise<RatchetSession> {
  const skippedKeys = new Map<string, ArrayBuffer>()
  for (const [k, v] of Object.entries(s.skippedKeys)) {
    skippedKeys.set(k, fromBase64(v).buffer as ArrayBuffer)
  }

  let sendRatchetKeyPair: CryptoKeyPair | null = null
  if (s.sendRatchetKeyPair) {
    sendRatchetKeyPair = {
      publicKey: await importPublicKey(s.sendRatchetKeyPair.publicKey),
      privateKey: await crypto.subtle.importKey(
        'jwk', s.sendRatchetKeyPair.privateKey, ECDH_PARAMS, true, ['deriveBits'],
      ),
    }
  }

  let recvRatchetPublicKey: CryptoKey | null = null
  if (s.recvRatchetPublicKey) {
    recvRatchetPublicKey = await importPublicKey(s.recvRatchetPublicKey)
  }

  return {
    rootKey: fromBase64(s.rootKey).buffer as ArrayBuffer,
    sendChainKey: s.sendChainKey ? fromBase64(s.sendChainKey).buffer as ArrayBuffer : null,
    recvChainKey: s.recvChainKey ? fromBase64(s.recvChainKey).buffer as ArrayBuffer : null,
    sendRatchetKeyPair,
    recvRatchetPublicKey,
    sendN: s.sendN,
    recvN: s.recvN,
    prevSendN: s.prevSendN,
    skippedKeys,
  }
}
