import { useEffect, useState } from 'react'
import {
  DECRYPT_FAILED,
  decryptText,
  decryptTextAsymmetric,
  decryptTextV2,
  deriveSharedKey,
  isEncrypted,
  isEncryptedV2,
} from '../crypto/e2ee'
import { getAsymmetricKeyPair, getDecryptedCache } from '../db'
import type { Message, UserSummary } from '../api/types'

interface UseChannelE2eeProps {
  channelId: string | null
  dmPartner: UserSummary | null
  passphrase: string | undefined
  currentUserId: string | undefined
  messages: Message[]
}

/**
 * Owns the client-side decryption state for the open conversation: the ECDH
 * shared key derived from the DM partner's public key, and the plaintext cache
 * keyed by message id.
 *
 * A message id maps to `undefined` while it has not been decrypted yet and to
 * DECRYPT_FAILED once decryption has been attempted and failed — the renderer
 * needs to tell those apart.
 */
export function useChannelE2ee({
  channelId,
  dmPartner,
  passphrase,
  currentUserId,
  messages,
}: UseChannelE2eeProps) {
  const [asymmetricKey, setAsymmetricKey] = useState<CryptoKey | null>(null)
  const [decrypted, setDecrypted] = useState<Record<string, string>>({})

  // Derive the shared key for this DM. Clearing first matters: until the new
  // key lands, no key at all is safer than the previous conversation's.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when the conversation changes
    setAsymmetricKey(null)
    const partnerPublicKey = dmPartner?.publicKey
    if (!channelId || !partnerPublicKey) return

    const deriveKey = async () => {
      try {
        const ourKeyPair = await getAsymmetricKeyPair()
        if (ourKeyPair) {
          const sharedKey = await deriveSharedKey(ourKeyPair.privateKey, partnerPublicKey)
          setAsymmetricKey(sharedKey)
        }
      } catch (err) {
        console.error('Failed to derive shared key for channel:', err)
      }
    }

    deriveKey()
  }, [channelId, dmPartner])

  // Decrypt whatever is on screen but not yet in the cache.
  useEffect(() => {
    if (!channelId) return
    let cancelled = false

    const decryptPending = async () => {
      const pending = messages.filter((m) => isEncrypted(m.content) && decrypted[m.id] === undefined)
      if (pending.length === 0) return

      const newDecrypted: Record<string, string> = {}
      for (const m of pending) {
        if (cancelled) break
        try {
          if (isEncryptedV2(m.content)) {
            if (dmPartner) {
              const cached = await getDecryptedCache(m.content)
              if (cached) {
                newDecrypted[m.id] = cached
              } else {
                const plaintext = await decryptTextV2(dmPartner.id, m.content)
                newDecrypted[m.id] = plaintext
              }
            } else {
              newDecrypted[m.id] = DECRYPT_FAILED
            }
          } else {
            if (asymmetricKey) {
              newDecrypted[m.id] = await decryptTextAsymmetric(asymmetricKey, m.content)
            } else if (passphrase && currentUserId) {
              newDecrypted[m.id] = await decryptText(channelId, passphrase, m.content, currentUserId)
            }
          }
        } catch (err) {
          console.error('Decryption failed for message:', m.id, err)
          newDecrypted[m.id] = DECRYPT_FAILED
        }
      }

      if (!cancelled && Object.keys(newDecrypted).length > 0) {
        setDecrypted((prev) => ({ ...prev, ...newDecrypted }))
      }
    }

    decryptPending()

    return () => {
      cancelled = true
    }
  }, [channelId, passphrase, asymmetricKey, messages, decrypted, dmPartner, currentUserId])

  // No key material of any kind: drop the cache rather than keep showing
  // plaintexts the user can no longer decrypt.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when the key material goes away
    if (!passphrase && !asymmetricKey && !dmPartner) setDecrypted({})
  }, [passphrase, asymmetricKey, dmPartner, channelId])

  return {
    asymmetricKey,
    decrypted,
    setDecrypted,
    isE2EE: !!(dmPartner || asymmetricKey || passphrase),
  }
}
