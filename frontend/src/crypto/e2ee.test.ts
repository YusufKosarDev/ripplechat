import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, isEncrypted, deriveSharedKey, encryptTextAsymmetric, decryptTextAsymmetric } from './e2ee'

const CHANNEL = '11111111-1111-1111-1111-111111111111'

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
})
