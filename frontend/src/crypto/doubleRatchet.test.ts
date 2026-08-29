import { describe, expect, it } from 'vitest'
import {
  fromBase64,
  generateDHKeyPair,
  initReceiverSession,
  initSenderSession,
  ratchetDecrypt,
  ratchetEncrypt,
  serializeSession,
  deserializeSession,
  toBase64,
} from './doubleRatchet'
import type { RatchetSession } from './doubleRatchet'
import { x3dhSender, x3dhReceiver } from './x3dh'
import type { PreKeyBundle } from './x3dh'

// Pure protocol-level tests for the Signal guarantees (no API/IndexedDB
// mocks): DH ratchet advance, out-of-order delivery via skipped keys,
// single-use message keys, ciphertext integrity, session persistence and
// X3DH sender/receiver interoperability.

async function makeSessionPair(): Promise<{ alice: RatchetSession; bob: RatchetSession }> {
  const secret = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer
  const bobSignedPreKey = await generateDHKeyPair()
  const bobSpkJwk = await crypto.subtle.exportKey('jwk', bobSignedPreKey.publicKey)
  const alice = await initSenderSession(secret, bobSpkJwk)
  const bob = await initReceiverSession(secret, bobSignedPreKey)
  return { alice, bob }
}

describe('double ratchet', () => {
  it('carries a multi-turn conversation and advances the DH ratchet each direction change', async () => {
    const { alice, bob } = await makeSessionPair()

    const a1 = await ratchetEncrypt(alice, 'alice #1')
    expect(await ratchetDecrypt(bob, a1.header, a1.ciphertext)).toBe('alice #1')
    const a2 = await ratchetEncrypt(alice, 'alice #2')
    expect(await ratchetDecrypt(bob, a2.header, a2.ciphertext)).toBe('alice #2')

    const b1 = await ratchetEncrypt(bob, 'bob #1')
    expect(await ratchetDecrypt(alice, b1.header, b1.ciphertext)).toBe('bob #1')

    const a3 = await ratchetEncrypt(alice, 'alice #3')
    expect(await ratchetDecrypt(bob, a3.header, a3.ciphertext)).toBe('alice #3')

    const b2 = await ratchetEncrypt(bob, 'bob #2')
    expect(await ratchetDecrypt(alice, b2.header, b2.ciphertext)).toBe('bob #2')

    // Break-in recovery comes from fresh ratchet keys: after Alice received
    // Bob's message, her next send must use a NEW ratchet public key.
    expect(a3.header.ratchetPublicKey.x).not.toBe(a1.header.ratchetPublicKey.x)
    // And the message counter restarted for the new chain.
    expect(a3.header.messageNumber).toBe(0)
    expect(a2.header.messageNumber).toBe(1)
  })

  it('decrypts out-of-order messages via skipped message keys', async () => {
    const { alice, bob } = await makeSessionPair()

    const m0 = await ratchetEncrypt(alice, 'msg 0')
    const m1 = await ratchetEncrypt(alice, 'msg 1')
    const m2 = await ratchetEncrypt(alice, 'msg 2')

    // Arrives last-first: m2, then m0, then m1.
    expect(await ratchetDecrypt(bob, m2.header, m2.ciphertext)).toBe('msg 2')
    expect(await ratchetDecrypt(bob, m0.header, m0.ciphertext)).toBe('msg 0')
    expect(await ratchetDecrypt(bob, m1.header, m1.ciphertext)).toBe('msg 1')
  })

  it('message keys are single-use: replaying the same ciphertext fails', async () => {
    const { alice, bob } = await makeSessionPair()

    const m0 = await ratchetEncrypt(alice, 'once only')
    expect(await ratchetDecrypt(bob, m0.header, m0.ciphertext)).toBe('once only')
    // The chain has advanced and the message key is gone — a replay (or an
    // attacker holding old ciphertext after a key compromise) cannot decrypt.
    await expect(ratchetDecrypt(bob, m0.header, m0.ciphertext)).rejects.toBeDefined()
  })

  it('a consumed skipped key cannot be used twice either', async () => {
    const { alice, bob } = await makeSessionPair()

    const m0 = await ratchetEncrypt(alice, 'skipped 0')
    const m1 = await ratchetEncrypt(alice, 'ooo 1')
    expect(await ratchetDecrypt(bob, m1.header, m1.ciphertext)).toBe('ooo 1')
    expect(await ratchetDecrypt(bob, m0.header, m0.ciphertext)).toBe('skipped 0')
    await expect(ratchetDecrypt(bob, m0.header, m0.ciphertext)).rejects.toBeDefined()
  })

  it('rejects tampered ciphertext (AES-GCM integrity)', async () => {
    const { alice, bob } = await makeSessionPair()

    const m = await ratchetEncrypt(alice, 'do not touch')
    const [iv, ct] = m.ciphertext.split('.')
    const mid = Math.floor(ct.length / 2)
    const flipped = ct[mid] === 'A' ? 'B' : 'A'
    const tampered = `${iv}.${ct.slice(0, mid)}${flipped}${ct.slice(mid + 1)}`

    await expect(ratchetDecrypt(bob, m.header, tampered)).rejects.toBeDefined()
  })

  it('sessions survive serialization mid-conversation, including skipped keys', async () => {
    const { alice, bob } = await makeSessionPair()

    // Establish both directions first.
    const a1 = await ratchetEncrypt(alice, 'pre-save alice')
    expect(await ratchetDecrypt(bob, a1.header, a1.ciphertext)).toBe('pre-save alice')
    const b1 = await ratchetEncrypt(bob, 'pre-save bob')
    expect(await ratchetDecrypt(alice, b1.header, b1.ciphertext)).toBe('pre-save bob')

    // Leave a hole: Bob receives s1 but not yet s0, then gets persisted.
    const s0 = await ratchetEncrypt(alice, 'delayed')
    const s1 = await ratchetEncrypt(alice, 'on time')
    expect(await ratchetDecrypt(bob, s1.header, s1.ciphertext)).toBe('on time')

    const aliceRestored = await deserializeSession(await serializeSession(alice))
    const bobRestored = await deserializeSession(await serializeSession(bob))

    // The delayed message decrypts from the restored skipped-key store …
    expect(await ratchetDecrypt(bobRestored, s0.header, s0.ciphertext)).toBe('delayed')

    // … and the restored sessions keep conversing in both directions.
    const a2 = await ratchetEncrypt(aliceRestored, 'post-restore alice')
    expect(await ratchetDecrypt(bobRestored, a2.header, a2.ciphertext)).toBe('post-restore alice')
    const b2 = await ratchetEncrypt(bobRestored, 'post-restore bob')
    expect(await ratchetDecrypt(aliceRestored, b2.header, b2.ciphertext)).toBe('post-restore bob')
  })

  it('base64 helpers round-trip arbitrary bytes', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(64))
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
    expect(toBase64(new Uint8Array(0))).toBe('')
  })

  it('caps the skipped-key store instead of letting it grow with the session', async () => {
    // MAX_SKIP bounds a single gap. Nothing bounded the store itself, which is
    // kept for the life of the session and written back to IndexedDB after
    // every message — so a peer sending a near-maximum gap each time added
    // hundreds of keys per message until the storage quota stopped it.
    const { alice, bob } = await makeSessionPair()

    for (let round = 0; round < 8; round++) {
      // Alice sends a burst; only the last one is delivered, so Bob has to
      // skip over the rest and keep their keys.
      let last = await ratchetEncrypt(alice, `round ${round} msg 0`)
      for (let i = 1; i < 200; i++) {
        last = await ratchetEncrypt(alice, `round ${round} msg ${i}`)
      }
      expect(await ratchetDecrypt(bob, last.header, last.ciphertext))
        .toBe(`round ${round} msg 199`)
    }

    // 8 rounds × 199 skipped would be 1592 without the ceiling.
    expect(bob.skippedKeys.size).toBeLessThanOrEqual(1024)
  })

  it('binds the header into the tag, so a rewritten one is rejected', async () => {
    // The header travels in the clear and was authenticated by nothing at all.
    // Anyone able to modify a message in flight could rewrite which ratchet key
    // and which chain position it claimed; the message would then fail to
    // decrypt, but only after the receiver had already ratcheted against the
    // attacker's key.
    const { alice, bob } = await makeSessionPair()
    const m = await ratchetEncrypt(alice, 'do not tamper')

    const rewritten = { ...m.header, messageNumber: m.header.messageNumber + 3 }
    await expect(ratchetDecrypt(bob, rewritten, m.ciphertext)).rejects.toThrow()
  })

  it('rejects a header pointing at a different ratchet key', async () => {
    const { alice, bob } = await makeSessionPair()
    const m = await ratchetEncrypt(alice, 'still do not tamper')
    const other = await generateDHKeyPair()

    const rewritten = {
      ...m.header,
      ratchetPublicKey: await crypto.subtle.exportKey('jwk', other.publicKey),
    }
    await expect(ratchetDecrypt(bob, rewritten, m.ciphertext)).rejects.toThrow()
  })

  it('marks the payload so a message written before the binding still reads', async () => {
    // Stored ciphertext cannot be rewritten, so the format has to say which one
    // it is rather than rely on a version agreed elsewhere. Three parts means
    // the header is bound; the two-part form predates it and is decrypted
    // without associated data.
    const { alice } = await makeSessionPair()
    const m = await ratchetEncrypt(alice, 'hello')

    expect(m.ciphertext.split('.')).toHaveLength(3)
  })
})

// ─── X3DH key agreement ─────────────────────────────────────────────

async function generateIdentity(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
}

/** Builds Bob's server-side bundle, signing the SPK with his identity key. */
async function makeBundle(
  bobIdentity: CryptoKeyPair,
  bobSpk: CryptoKeyPair,
  bobOtpk: CryptoKeyPair | null,
): Promise<PreKeyBundle> {
  const identityJwk = await crypto.subtle.exportKey('jwk', bobIdentity.publicKey)
  const spkJwk = await crypto.subtle.exportKey('jwk', bobSpk.publicKey)

  const signingPrivateJwk = await crypto.subtle.exportKey('jwk', bobIdentity.privateKey)
  signingPrivateJwk.key_ops = ['sign']
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    signingPrivateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    signingKey,
    new TextEncoder().encode(JSON.stringify(spkJwk)),
  )

  return {
    identityKey: JSON.stringify(identityJwk),
    signedPreKeyId: 1,
    signedPreKeyPublic: JSON.stringify(spkJwk),
    signedPreKeySignature: toBase64(signature),
    oneTimePreKeyId: bobOtpk ? 2 : null,
    oneTimePreKeyPublic: bobOtpk ? JSON.stringify(await crypto.subtle.exportKey('jwk', bobOtpk.publicKey)) : null,
  }
}

describe('x3dh', () => {
  it('sender and receiver derive interoperable sessions (with a one-time prekey)', async () => {
    const aliceIdentity = await generateIdentity()
    const bobIdentity = await generateIdentity()
    const bobSpk = await generateDHKeyPair()
    const bobOtpk = await generateDHKeyPair()

    const bundle = await makeBundle(bobIdentity, bobSpk, bobOtpk)
    const senderResult = await x3dhSender(aliceIdentity, bundle)
    expect(senderResult.usedOneTimePreKeyId).toBe(2)

    const bobSession = await x3dhReceiver(bobIdentity, bobSpk, bobOtpk, {
      identityKey: JSON.stringify(await crypto.subtle.exportKey('jwk', aliceIdentity.publicKey)),
      ephemeralKey: JSON.stringify(senderResult.ephemeralPublicKey),
      oneTimePreKeyId: 2,
    })

    const msg = await ratchetEncrypt(senderResult.session, 'handshake proof')
    expect(await ratchetDecrypt(bobSession, msg.header, msg.ciphertext)).toBe('handshake proof')
    const reply = await ratchetEncrypt(bobSession, 'ack')
    expect(await ratchetDecrypt(senderResult.session, reply.header, reply.ciphertext)).toBe('ack')
  })

  it('works without a one-time prekey', async () => {
    const aliceIdentity = await generateIdentity()
    const bobIdentity = await generateIdentity()
    const bobSpk = await generateDHKeyPair()

    const bundle = await makeBundle(bobIdentity, bobSpk, null)
    const senderResult = await x3dhSender(aliceIdentity, bundle)
    expect(senderResult.usedOneTimePreKeyId).toBeNull()

    const bobSession = await x3dhReceiver(bobIdentity, bobSpk, null, {
      identityKey: JSON.stringify(await crypto.subtle.exportKey('jwk', aliceIdentity.publicKey)),
      ephemeralKey: JSON.stringify(senderResult.ephemeralPublicKey),
      oneTimePreKeyId: null,
    })

    const msg = await ratchetEncrypt(senderResult.session, 'no otpk')
    expect(await ratchetDecrypt(bobSession, msg.header, msg.ciphertext)).toBe('no otpk')
  })

  it('rejects a bundle whose signed-prekey signature does not verify (MITM)', async () => {
    const aliceIdentity = await generateIdentity()
    const bobIdentity = await generateIdentity()
    const bobSpk = await generateDHKeyPair()

    const bundle = await makeBundle(bobIdentity, bobSpk, null)
    // An attacker swaps in their own signed prekey without Bob's signature.
    const mallorySpk = await generateDHKeyPair()
    bundle.signedPreKeyPublic = JSON.stringify(await crypto.subtle.exportKey('jwk', mallorySpk.publicKey))

    await expect(x3dhSender(aliceIdentity, bundle)).rejects.toThrow(/signature verification failed/i)
  })
})

