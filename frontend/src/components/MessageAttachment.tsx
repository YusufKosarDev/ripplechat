import type { Message } from '../api/types'

/**
 * A message's attachment, rendered by kind: a download card for files, an inline
 * player for voice/audio, or an inline image otherwise. Nothing when there is no
 * attachment. Depends only on the message, so it's a pure leaf component.
 */
export default function MessageAttachment({ msg }: { msg: Message }) {
  if (!msg.attachmentUrl) return null

  if (msg.attachmentType === 'file') {
    return (
      <a
        href={msg.attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm text-fg transition hover:bg-surface-muted"
      >
        <span className="text-lg">📄</span>
        <span className="truncate">{msg.attachmentName ?? 'Dosya'}</span>
        <span className="ml-auto text-xs text-fg-faint">↓</span>
      </a>
    )
  }

  if (msg.attachmentType === 'audio') {
    return <audio controls src={msg.attachmentUrl} className="mt-1 w-64 max-w-full" />
  }

  return (
    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block w-fit">
      <img
        src={msg.attachmentUrl}
        alt="ek görsel"
        loading="lazy"
        className="max-h-80 max-w-sm rounded-lg border border-border"
      />
    </a>
  )
}
