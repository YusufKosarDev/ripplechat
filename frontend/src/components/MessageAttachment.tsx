import { useEffect, useState } from 'react'
import type { Message } from '../api/types'
import { fromBase64 } from '../crypto/doubleRatchet'
import { useT } from '../i18n'

/**
 * A message's attachment, rendered by kind: a download card for files, an inline
 * player for voice/audio, or an inline image otherwise. Nothing when there is no
 * attachment.
 * Supports end-to-end encrypted (E2EE) attachments by fetching and decrypting them
 * client-side on the fly.
 */
export default function MessageAttachment({ msg }: { msg: Message }) {
  const { t } = useT()
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const isE2EE = !!msg.e2eeAttachment
  const attachment = msg.e2eeAttachment || (msg.attachmentUrl ? {
    url: msg.attachmentUrl,
    name: msg.attachmentName,
    type: msg.attachmentType as 'image' | 'file' | 'audio'
  } : null)

  useEffect(() => {
    if (!msg.e2eeAttachment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when attachment changes
      setDecryptedUrl(null)
      setError(false)
      return
    }

    let active = true
    const decrypt = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(msg.e2eeAttachment!.url)
        if (!res.ok) throw new Error('Failed to download encrypted attachment')
        const encryptedBytes = await res.arrayBuffer()

        // Import the AES-GCM decryption key
        const key = await crypto.subtle.importKey(
          'raw',
          fromBase64(msg.e2eeAttachment!.key) as BufferSource,
          'AES-GCM',
          false,
          ['decrypt']
        )

        // Decrypt the attachment payload
        const decryptedBytes = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: fromBase64(msg.e2eeAttachment!.iv) as BufferSource },
          key,
          encryptedBytes
        )

        // Create a local blob url for rendering / downloading
        const mimeType = msg.e2eeAttachment!.type === 'image' ? 'image/*' : msg.e2eeAttachment!.type === 'audio' ? 'audio/*' : 'application/octet-stream'
        const blob = new Blob([decryptedBytes], { type: mimeType })
        const blobUrl = URL.createObjectURL(blob)

        if (active) {
          setDecryptedUrl(blobUrl)
        }
      } catch (err) {
        console.error('Failed to decrypt E2EE attachment:', err)
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    decrypt()

    return () => {
      active = false
      if (decryptedUrl) {
        URL.revokeObjectURL(decryptedUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.e2eeAttachment])

  if (!attachment) return null

  if (isE2EE && loading) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs text-fg-faint">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
        <span>{t('attach.decrypting')}</span>
      </div>
    )
  }

  if (isE2EE && error) {
    return (
      <div className="mt-1 text-xs text-danger">
        ⚠️ {t('attach.decryptFailed')}
      </div>
    )
  }

  const finalUrl = isE2EE ? decryptedUrl : attachment.url
  if (!finalUrl) return null

  if (attachment.type === 'file') {
    return (
      <a
        href={finalUrl}
        download={attachment.name ?? 'dosya'}
        target={isE2EE ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm text-fg transition hover:bg-surface-muted"
      >
        <span className="text-lg">🔒📄</span>
        <span className="truncate">{attachment.name ?? 'Dosya'}</span>
        <span className="ml-auto text-xs text-fg-faint">↓</span>
      </a>
    )
  }

  if (attachment.type === 'audio') {
    return <audio controls src={finalUrl} className="mt-1 w-64 max-w-full" />
  }

  return (
    <a href={finalUrl} download={isE2EE ? attachment.name ?? 'gorsel' : undefined} target="_blank" rel="noopener noreferrer" className="mt-1 block w-fit">
      <img
        src={finalUrl}
        alt={t('attach.imageAlt')}
        loading="lazy"
        className="max-h-80 max-w-sm rounded-lg border border-border"
      />
    </a>
  )
}
