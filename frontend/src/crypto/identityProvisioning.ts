/**
 * Deciding what a device has to do to have a working E2EE identity.
 *
 * Kept apart from the component that runs it so the rules can be tested: the
 * consequence of getting them wrong is silent and permanent — an account that
 * advertises a public key nobody holds the private half of, and messages that
 * can never be read.
 */

/** The stored identity key pair. Only the public half is ever exported. */
export interface IdentityKeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export interface IdentityProvisioningDeps {
  /** The key pair held on this device, or null if there is none. */
  loadKeyPair: () => Promise<IdentityKeyPair | null>
  generateKeyPair: () => Promise<IdentityKeyPair>
  saveKeyPair: (keys: IdentityKeyPair) => Promise<void>
  exportPublicJwk: (keys: IdentityKeyPair) => Promise<string>
  /** Publishes the public half, replacing whatever the account advertised. */
  uploadPublicKey: (publicJwk: string) => Promise<void>
  /** One-time pre-keys the server still holds for this account. */
  oneTimePreKeyCount: () => Promise<number>
  replenishPreKeys: () => Promise<void>
}

export interface IdentityProvisioningResult {
  generated: boolean
  uploaded: boolean
  replenished: boolean
}

/** Below this the client tops the one-time pre-keys up. */
export const PRE_KEY_LOW_WATER_MARK = 5

/**
 * Brings this device's E2EE identity into a usable state.
 *
 * @param serverHasPublicKey whether the account already advertises a public key.
 *
 * The rule that matters: a newly generated key is always published, and always
 * followed by a pre-key refresh. Publishing only when the account had no key at
 * all left a device that had lost its private key — which is what signing out
 * does — using an identity it could not prove. Refreshing only when the supply
 * ran low left the server holding a signed pre-key signed by the previous
 * identity, which a peer verifies and rejects, taking the whole bundle with it.
 */
export async function provisionIdentity(
  serverHasPublicKey: boolean,
  deps: IdentityProvisioningDeps,
): Promise<IdentityProvisioningResult> {
  let generated = false
  let keys = await deps.loadKeyPair()
  if (!keys) {
    keys = await deps.generateKeyPair()
    await deps.saveKeyPair(keys)
    generated = true
  }

  let uploaded = false
  if (generated || !serverHasPublicKey) {
    await deps.uploadPublicKey(await deps.exportPublicJwk(keys))
    uploaded = true
  }

  let replenished = false
  const count = await deps.oneTimePreKeyCount()
  if (generated || count < PRE_KEY_LOW_WATER_MARK) {
    await deps.replenishPreKeys()
    replenished = true
  }

  return { generated, uploaded, replenished }
}
