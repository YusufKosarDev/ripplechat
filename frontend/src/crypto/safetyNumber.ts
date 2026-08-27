/**
 * Safety numbers for a 1:1 encrypted conversation.
 *
 * Why this exists: prekey bundles and identity keys are served by the
 * RippleChat backend. A malicious or compromised server could hand each side a
 * key it controls and sit in the middle, and no amount of Double Ratchet
 * strength detects that — the ratchet secures the channel, not the identity at
 * the far end of it. The only fix is for the two people to compare a value
 * derived from both identity keys over some channel the server does not own.
 *
 * The construction follows Signal's: hash each party's identity key many times
 * to make brute-forcing a colliding key expensive, take 30 bytes, and render
 * them as six groups of five decimal digits. The two halves are ordered by
 * their bytes so both sides display the same number regardless of who looks.
 */

/** Iterations per side. Signal uses 5200; the cost is what makes a near-collision expensive. */
const ITERATIONS = 5200
/** 30 bytes -> six 5-digit groups per party, twelve groups shown in total. */
const FINGERPRINT_BYTES = 30
const GROUP_BYTES = 5
const GROUP_MODULUS = 100000

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * The raw uncompressed point (0x04 ‖ X ‖ Y) for a P-256 public key.
 *
 * Deliberately not the JWK string itself: JSON key order and whitespace are not
 * stable, so hashing the serialised form could give the two sides different
 * numbers for the same key.
 */
export function publicKeyBytes(jwkString: string): Uint8Array {
  const jwk = JSON.parse(jwkString) as { x?: string; y?: string; kty?: string }
  if (!jwk.x || !jwk.y) {
    throw new Error('not an EC public key: missing x/y')
  }
  const x = base64UrlToBytes(jwk.x)
  const y = base64UrlToBytes(jwk.y)
  const out = new Uint8Array(1 + x.length + y.length)
  out[0] = 0x04
  out.set(x, 1)
  out.set(y, 1 + x.length)
  return out
}

/** Iterated SHA-256 over the key material, truncated to FINGERPRINT_BYTES. */
async function fingerprint(keyBytes: Uint8Array): Promise<Uint8Array> {
  let digest: ArrayBuffer = new Uint8Array(keyBytes).buffer as ArrayBuffer
  for (let i = 0; i < ITERATIONS; i++) {
    // Re-mixing the key each round is what makes the work non-collapsible.
    const input = new Uint8Array(digest.byteLength + keyBytes.length)
    input.set(new Uint8Array(digest), 0)
    input.set(keyBytes, digest.byteLength)
    digest = await crypto.subtle.digest('SHA-256', input)
  }
  return new Uint8Array(digest).slice(0, FINGERPRINT_BYTES)
}

/** Renders bytes as 5-digit decimal groups, the form people read aloud. */
function toDigitGroups(bytes: Uint8Array): string[] {
  const groups: string[] = []
  for (let i = 0; i + GROUP_BYTES <= bytes.length; i += GROUP_BYTES) {
    let value = 0
    for (let j = 0; j < GROUP_BYTES; j++) {
      value = value * 256 + bytes[i + j]
    }
    groups.push(String(value % GROUP_MODULUS).padStart(5, '0'))
  }
  return groups
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

/**
 * The safety number both participants should see for this conversation.
 *
 * Symmetric by construction: the two fingerprints are sorted by their bytes, so
 * swapping the arguments cannot change the result.
 *
 * @param ourPublicKeyJwk   our own identity public key, as a JWK string
 * @param theirPublicKeyJwk the other party's, as served by the backend
 * @returns twelve groups of five digits
 */
export async function computeSafetyNumber(
  ourPublicKeyJwk: string,
  theirPublicKeyJwk: string,
): Promise<string[]> {
  const [ours, theirs] = await Promise.all([
    fingerprint(publicKeyBytes(ourPublicKeyJwk)),
    fingerprint(publicKeyBytes(theirPublicKeyJwk)),
  ])
  const [first, second] = compareBytes(ours, theirs) <= 0 ? [ours, theirs] : [theirs, ours]
  return [...toDigitGroups(first), ...toDigitGroups(second)]
}
