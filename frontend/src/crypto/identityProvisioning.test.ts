import { describe, expect, it, vi } from 'vitest'
import {
  provisionIdentity,
  type IdentityKeyPair,
  type IdentityProvisioningDeps,
} from './identityProvisioning'

const aKeyPair = { publicKey: {}, privateKey: {} } as unknown as IdentityKeyPair

function deps(overrides: Partial<IdentityProvisioningDeps> = {}) {
  return {
    loadKeyPair: vi.fn(async () => aKeyPair),
    generateKeyPair: vi.fn(async () => aKeyPair),
    saveKeyPair: vi.fn(async () => {}),
    exportPublicJwk: vi.fn(async () => '{"kty":"EC","crv":"P-256","x":"a","y":"b"}'),
    uploadPublicKey: vi.fn(async () => {}),
    oneTimePreKeyCount: vi.fn(async () => 20),
    replenishPreKeys: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('provisionIdentity', () => {
  it('does nothing when the device already holds its key and the supply is healthy', async () => {
    const d = deps()

    const result = await provisionIdentity(true, d)

    expect(result).toEqual({ generated: false, uploaded: false, replenished: false })
    expect(d.generateKeyPair).not.toHaveBeenCalled()
    expect(d.uploadPublicKey).not.toHaveBeenCalled()
  })

  it('publishes a freshly generated key even when the account already advertises one', async () => {
    // Signing out clears the local key material while the account keeps the
    // public key it published. Uploading only when the server had none left the
    // account advertising a key whose private half no longer existed anywhere:
    // peers encrypted to it and nothing could read the result, permanently.
    const d = deps({ loadKeyPair: vi.fn(async () => null) })

    const result = await provisionIdentity(true, d)

    expect(result.generated).toBe(true)
    expect(result.uploaded).toBe(true)
    expect(d.saveKeyPair).toHaveBeenCalledWith(aKeyPair)
    expect(d.uploadPublicKey).toHaveBeenCalledOnce()
  })

  it('refreshes the pre-keys after a new identity, however many the server holds', async () => {
    // The signed pre-key is signed with the identity key. Leaving the old bundle
    // in place means a peer verifies that signature against the new identity and
    // rejects it — so a plentiful supply is exactly the case that hid this.
    const d = deps({
      loadKeyPair: vi.fn(async () => null),
      oneTimePreKeyCount: vi.fn(async () => 20),
    })

    const result = await provisionIdentity(true, d)

    expect(result.replenished).toBe(true)
    expect(d.replenishPreKeys).toHaveBeenCalledOnce()
  })

  it('publishes the key of an account that has never had one', async () => {
    const d = deps()

    const result = await provisionIdentity(false, d)

    expect(result).toMatchObject({ generated: false, uploaded: true })
    expect(d.uploadPublicKey).toHaveBeenCalledOnce()
  })

  it('tops up a low supply without touching the identity', async () => {
    const d = deps({ oneTimePreKeyCount: vi.fn(async () => 4) })

    const result = await provisionIdentity(true, d)

    expect(result).toEqual({ generated: false, uploaded: false, replenished: true })
  })
})
