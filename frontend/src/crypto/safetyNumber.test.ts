import { describe, expect, it } from 'vitest'
import { computeSafetyNumber, publicKeyBytes } from './safetyNumber'

/** A real P-256 public key, exported as JWK the way the backend stores it. */
async function generateJwk(): Promise<string> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  return JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey))
}

describe('publicKeyBytes', () => {
  it('produces the uncompressed point, not the serialised JWK', async () => {
    const jwk = await generateJwk()
    const bytes = publicKeyBytes(jwk)
    expect(bytes[0]).toBe(0x04)
    expect(bytes.length).toBe(65) // 1 + 32 + 32 for P-256
  })

  it('is stable across JSON key ordering', async () => {
    const parsed = JSON.parse(await generateJwk())
    const reordered = JSON.stringify({ y: parsed.y, kty: parsed.kty, x: parsed.x, crv: parsed.crv })
    const original = JSON.stringify(parsed)
    expect(Array.from(publicKeyBytes(reordered))).toEqual(Array.from(publicKeyBytes(original)))
  })

  it('rejects something that is not an EC public key', () => {
    expect(() => publicKeyBytes('{"kty":"oct","k":"AAAA"}')).toThrow(/EC public key/)
  })
})

describe('computeSafetyNumber', () => {
  it('gives both participants the same number regardless of argument order', async () => {
    const [alice, bob] = await Promise.all([generateJwk(), generateJwk()])
    const fromAlice = await computeSafetyNumber(alice, bob)
    const fromBob = await computeSafetyNumber(bob, alice)
    expect(fromAlice).toEqual(fromBob)
  })

  it('renders twelve groups of five digits', async () => {
    const [alice, bob] = await Promise.all([generateJwk(), generateJwk()])
    const groups = await computeSafetyNumber(alice, bob)
    expect(groups).toHaveLength(12)
    for (const group of groups) {
      expect(group).toMatch(/^\d{5}$/)
    }
  })

  it('is deterministic for the same pair of keys', async () => {
    const [alice, bob] = await Promise.all([generateJwk(), generateJwk()])
    expect(await computeSafetyNumber(alice, bob)).toEqual(await computeSafetyNumber(alice, bob))
  })

  // The whole point: if the server swaps in a key it controls, the number the
  // two people read to each other stops matching.
  it('changes when one side is given a substituted key', async () => {
    const [alice, bob, attacker] = await Promise.all([
      generateJwk(),
      generateJwk(),
      generateJwk(),
    ])
    const genuine = await computeSafetyNumber(alice, bob)
    const mitm = await computeSafetyNumber(alice, attacker)
    expect(mitm).not.toEqual(genuine)
  })
})
