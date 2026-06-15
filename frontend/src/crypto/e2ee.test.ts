import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, isEncrypted } from './e2ee'

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
})
