/**
 * X3DH (Extended Triple Diffie-Hellman) Key Agreement Protocol.
 *
 * Used to establish a shared secret between two parties for initializing
 * a Double Ratchet session. Follows the Signal specification.
 *
 * References:
 *   https://signal.org/docs/specifications/x3dh/
 */

import { generateDHKeyPair, initSenderSession, initReceiverSession, fromBase64, type RatchetSession } from './doubleRatchet'

const ECDH_PARAMS = { name: 'ECDH', namedCurve: 'P-256' } as const

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ECDH_PARAMS, true, [])
}

async function dhBits(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
}

function concat(...buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }
  return result.buffer as ArrayBuffer
}

async function hkdfSha256(ikm: ArrayBuffer, info: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode(info) },
    key, 256,
  )
}

// ─── PreKey Bundle (from server) ─────────────────────────────────────

export interface PreKeyBundle {
  identityKey: string           // JWK string
  signedPreKeyId: number
  signedPreKeyPublic: string    // JWK string
  signedPreKeySignature: string
  oneTimePreKeyId: number | null
  oneTimePreKeyPublic: string | null // JWK string
}

// ─── X3DH Sender (Alice) ────────────────────────────────────────────

export interface X3DHSenderResult {
  session: RatchetSession
  ephemeralPublicKey: JsonWebKey
  usedOneTimePreKeyId: number | null
}

/**
 * Perform X3DH as the sender (Alice) to establish a shared secret with Bob.
 * Verifies Bob's Signed Prekey signature using his Identity Public Key.
 *
 * Alice computes:
 *   DH1 = DH(IK_A, SPK_B)
 *   DH2 = DH(EK_A, IK_B)
 *   DH3 = DH(EK_A, SPK_B)
 *   DH4 = DH(EK_A, OPK_B)  [if available]
 *   SK  = KDF(DH1 || DH2 || DH3 [|| DH4])
 */
export async function x3dhSender(
  ourIdentityKeyPair: CryptoKeyPair,
  bundle: PreKeyBundle,
): Promise<X3DHSenderResult> {
  const bobIdentityKey = await importPublicKey(JSON.parse(bundle.identityKey))
  const bobSignedPreKey = await importPublicKey(JSON.parse(bundle.signedPreKeyPublic))

  // Import Bob's Identity Public Key as an ECDSA Public Key for signature verification.
  const bobIdentityJwk = JSON.parse(bundle.identityKey)
  bobIdentityJwk.key_ops = ['verify']
  const bobSigningPublicKey = await crypto.subtle.importKey(
    'jwk',
    bobIdentityJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  )

  // Verify Bob's Signed Pre-Key signature using his Identity Public Key
  const rawSignedPreKeyPublic = new TextEncoder().encode(bundle.signedPreKeyPublic)
  const signatureBytes = fromBase64(bundle.signedPreKeySignature)
  const isValid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    bobSigningPublicKey,
    signatureBytes as BufferSource,
    rawSignedPreKeyPublic
  )

  if (!isValid) {
    throw new Error('Bob\'s signed prekey signature verification failed! Potential Man-in-the-Middle attack detected.')
  }

  // Generate ephemeral key pair
  const ephemeralKeyPair = await generateDHKeyPair()

  // DH1: IK_A.priv × SPK_B
  const dh1 = await dhBits(ourIdentityKeyPair.privateKey, bobSignedPreKey)
  // DH2: EK_A.priv × IK_B
  const dh2 = await dhBits(ephemeralKeyPair.privateKey, bobIdentityKey)
  // DH3: EK_A.priv × SPK_B
  const dh3 = await dhBits(ephemeralKeyPair.privateKey, bobSignedPreKey)

  let sharedSecretInput: ArrayBuffer
  let usedOneTimePreKeyId: number | null = null

  if (bundle.oneTimePreKeyPublic && bundle.oneTimePreKeyId !== null) {
    const bobOTPK = await importPublicKey(JSON.parse(bundle.oneTimePreKeyPublic))
    // DH4: EK_A.priv × OPK_B
    const dh4 = await dhBits(ephemeralKeyPair.privateKey, bobOTPK)
    sharedSecretInput = concat(dh1, dh2, dh3, dh4)
    usedOneTimePreKeyId = bundle.oneTimePreKeyId
  } else {
    sharedSecretInput = concat(dh1, dh2, dh3)
  }

  const sharedSecret = await hkdfSha256(sharedSecretInput, 'RippleChatX3DH')

  // Initialize Double Ratchet session as sender
  const session = await initSenderSession(sharedSecret, JSON.parse(bundle.signedPreKeyPublic))
  const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey)

  return { session, ephemeralPublicKey, usedOneTimePreKeyId }
}

// ─── X3DH Receiver (Bob) ────────────────────────────────────────────

export interface X3DHInitialMessage {
  identityKey: string     // Alice's identity public key (JWK string)
  ephemeralKey: string    // Alice's ephemeral public key (JWK string)
  oneTimePreKeyId: number | null
}

/**
 * Perform X3DH as the receiver (Bob) to derive the shared secret.
 *
 * Bob computes:
 *   DH1 = DH(SPK_B, IK_A)
 *   DH2 = DH(IK_B, EK_A)
 *   DH3 = DH(SPK_B, EK_A)
 *   DH4 = DH(OPK_B, EK_A)  [if used]
 *   SK  = KDF(DH1 || DH2 || DH3 [|| DH4])
 */
export async function x3dhReceiver(
  ourIdentityKeyPair: CryptoKeyPair,
  ourSignedPreKeyPair: CryptoKeyPair,
  ourOneTimePreKeyPair: CryptoKeyPair | null,
  initialMessage: X3DHInitialMessage,
): Promise<RatchetSession> {
  const aliceIdentityKey = await importPublicKey(JSON.parse(initialMessage.identityKey))
  const aliceEphemeralKey = await importPublicKey(JSON.parse(initialMessage.ephemeralKey))

  // DH1: SPK_B.priv × IK_A
  const dh1 = await dhBits(ourSignedPreKeyPair.privateKey, aliceIdentityKey)
  // DH2: IK_B.priv × EK_A
  const dh2 = await dhBits(ourIdentityKeyPair.privateKey, aliceEphemeralKey)
  // DH3: SPK_B.priv × EK_A
  const dh3 = await dhBits(ourSignedPreKeyPair.privateKey, aliceEphemeralKey)

  let sharedSecretInput: ArrayBuffer

  if (ourOneTimePreKeyPair) {
    // DH4: OPK_B.priv × EK_A
    const dh4 = await dhBits(ourOneTimePreKeyPair.privateKey, aliceEphemeralKey)
    sharedSecretInput = concat(dh1, dh2, dh3, dh4)
  } else {
    sharedSecretInput = concat(dh1, dh2, dh3)
  }

  const sharedSecret = await hkdfSha256(sharedSecretInput, 'RippleChatX3DH')

  // Initialize Double Ratchet session as receiver
  return initReceiverSession(sharedSecret, ourSignedPreKeyPair)
}
