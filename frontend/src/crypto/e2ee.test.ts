import { describe, expect, it, vi } from 'vitest'
import {
  decryptText,
  encryptText,
  isEncrypted,
  deriveSharedKey,
  encryptTextAsymmetric,
  decryptTextAsymmetric,
  encryptTextV2,
  decryptTextV2,
} from './e2ee'
import { client } from '../api/client'

const CHANNEL = '11111111-1111-1111-1111-111111111111'

// Mocking IndexedDB local database for the test
let activeDb = new Map<string, any>()

vi.mock('../db', () => ({
  getAsymmetricKeyPair: async () => activeDb.get('asymmetric_keypair') || null,
  saveAsymmetricKeyPair: async (pair: any) => { activeDb.set('asymmetric_keypair', pair) },
  saveSignedPreKeyPair: async (id: number, pair: any) => { activeDb.set('current_spk', { ...pair, keyId: id }) },
  getSignedPreKeyPair: async () => activeDb.get('current_spk') || null,
  saveOneTimePreKeyPair: async (id: number, pair: any) => { activeDb.set(`otpk:${id}`, pair) },
  getOneTimePreKeyPair: async (id: number) => activeDb.get(`otpk:${id}`) || null,
  deleteOneTimePreKeyPair: async (id: number) => { activeDb.delete(`otpk:${id}`) },
  saveRatchetSession: async (peerId: string, session: any) => { activeDb.set(`session:${peerId}`, session) },
  getRatchetSession: async (peerId: string) => activeDb.get(`session:${peerId}`) || null,
  saveDecryptedCache: async (ciphertext: string, plaintext: string) => { activeDb.set(`cache:${ciphertext}`, plaintext) },
  getDecryptedCache: async (ciphertext: string) => activeDb.get(`cache:${ciphertext}`) || null,
}))

// Mocking the Axios client
vi.mock('../api/client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  }
}))

describe('e2ee', () => {
  it('round-trips a message with the right passphrase', async () => {
    const cipher = await encryptText(CHANNEL, 'hunter2', 'gizli mesaj 🙂')
    expect(isEncrypted(cipher)).toBe(true)
    expect(cipher).not.toContain('gizli')
    const plain = await decryptText(CHANNEL, 'hunter2', cipher)
    expect(plain).toBe('gizli mesaj 🙂')
  })

  it('fails to decrypt with the wrong passphrase', async () => {
    const cipher = await encryptText(CHANNEL, 'correct', 'top secret')
    await expect(decryptText(CHANNEL, 'wrong', cipher)).rejects.toBeDefined()
  })

  it('produces different ciphertext each time (random IV)', async () => {
    const a = await encryptText(CHANNEL, 'p', 'same text')
    const b = await encryptText(CHANNEL, 'p', 'same text')
    expect(a).not.toBe(b)
  })

  it('treats plain text as not encrypted and passes it through', async () => {
    expect(isEncrypted('hello')).toBe(false)
    expect(await decryptText(CHANNEL, 'p', 'hello')).toBe('hello')
  })

  it('round-trips asymmetric encryption with ECDH key agreement', async () => {
    const aliceKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
    const bobKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )

    const alicePublicJwk = JSON.stringify(await window.crypto.subtle.exportKey('jwk', aliceKeyPair.publicKey))
    const bobPublicJwk = JSON.stringify(await window.crypto.subtle.exportKey('jwk', bobKeyPair.publicKey))

    const aliceSharedKey = await deriveSharedKey(aliceKeyPair.privateKey, bobPublicJwk)
    const bobSharedKey = await deriveSharedKey(bobKeyPair.privateKey, alicePublicJwk)

    const plainText = 'Hi Bob, this is a secret!'
    const cipherText = await encryptTextAsymmetric(aliceSharedKey, plainText)

    expect(isEncrypted(cipherText)).toBe(true)

    const decrypted = await decryptTextAsymmetric(bobSharedKey, cipherText)
    expect(decrypted).toBe(plainText)
  })

  it('round-trips E2EE v2 with Double Ratchet and X3DH', async () => {
    const aliceDb = new Map<string, any>()
    const bobDb = new Map<string, any>()

    // 1. Generate identity keys for Alice and Bob
    const aliceIdentity = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
    const bobIdentity = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )

    aliceDb.set('asymmetric_keypair', aliceIdentity)
    bobDb.set('asymmetric_keypair', bobIdentity)

    // 2. Generate Bob's pre-keys
    const bobSignedPreKey = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
    const bobOneTimePreKey = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )

    const bobSignedPreKeyJwk = await window.crypto.subtle.exportKey('jwk', bobSignedPreKey.publicKey)
    const bobOneTimePreKeyJwk = await window.crypto.subtle.exportKey('jwk', bobOneTimePreKey.publicKey)
    const bobIdentityJwk = await window.crypto.subtle.exportKey('jwk', bobIdentity.publicKey)

    const bobBundle = {
      identityKey: JSON.stringify(bobIdentityJwk),
      signedPreKeyId: 456,
      signedPreKeyPublic: JSON.stringify(bobSignedPreKeyJwk),
      signedPreKeySignature: 'bob_signature',
      oneTimePreKeyId: 789,
      oneTimePreKeyPublic: JSON.stringify(bobOneTimePreKeyJwk),
    }

    // Mock Bob's pre-key bundle endpoint
    const mockGet = vi.mocked(client.get)
    mockGet.mockResolvedValue({ data: bobBundle })

    // Set Alice's DB as active
    activeDb = aliceDb

    // 3. Alice encrypts a message for Bob (Initial message with X3DH info)
    const plainText1 = 'Hello Bob, I am initiating a Double Ratchet session!'
    const payload = await encryptTextV2('bob-user-id', plainText1)

    expect(payload).toContain('enc:v2:init:')

    // Alice should cache the plaintext locally
    const aliceCached = aliceDb.get(`cache:${payload}`)
    expect(aliceCached).toBe(plainText1)

    // 4. Bob receives the message and decrypts it
    // Set Bob's DB as active, and load his local prekeys
    activeDb = bobDb
    bobDb.set('current_spk', bobSignedPreKey)
    bobDb.set('otpk:789', bobOneTimePreKey)

    const decrypted1 = await decryptTextV2('alice-user-id', payload)
    expect(decrypted1).toBe(plainText1)

    // Bob should have deleted the OTPK locally after receipt
    const otpkDeleted = bobDb.get('otpk:789')
    expect(otpkDeleted).toBeUndefined()

    // Bob should cache the decrypted plaintext locally
    const bobCached = bobDb.get(`cache:${payload}`)
    expect(bobCached).toBe(plainText1)

    // 5. Bob sends a reply to Alice (Regular message, no X3DH info)
    const plainText2 = 'Hi Alice, I received your initial message!'
    const payload2 = await encryptTextV2('alice-user-id', plainText2)

    expect(payload2).toContain('enc:v2:msg:')

    // 6. Alice receives Bob's reply and decrypts it
    // Switch back to Alice's database context
    activeDb = aliceDb
    const decrypted2 = await decryptTextV2('bob-user-id', payload2)
    expect(decrypted2).toBe(plainText2)

    // Verify Alice caches the reply plaintext locally
    const aliceCached2 = aliceDb.get(`cache:${payload2}`)
    expect(aliceCached2).toBe(plainText2)
  })
})
