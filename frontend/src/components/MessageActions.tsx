import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'
import { useT } from '../i18n'
import type { Message } from '../api/types'

const actionBtn = `mt-1 rounded-lg text-xs text-fg-muted transition hover:text-fg sr-only group-hover:not-sr-only group-focus-within:not-sr-only ${focusRing}`

interface Props {
  msg: Message
  bookmarked: boolean
  onOpenThread: () => void
  onQuote: () => void
  onForward: () => void
  onTogglePin: () => void
  onToggleBookmark: () => void
}

/**
 * The hover/focus action row under a message: open thread, reply, quote, forward,
 * pin and bookmark. Purely presentational — the parent supplies the callbacks.
 */
export default function MessageActions({
  msg,
  bookmarked,
  onOpenThread,
  onQuote,
  onForward,
  onTogglePin,
  onToggleBookmark,
}: Props) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-2 pl-12">
      {msg.thread.replyCount > 0 && (
        <button
          onClick={onOpenThread}
          className={`mt-1 inline-flex items-center gap-1.5 rounded-lg border border-control bg-surface-muted px-2 py-1 text-xs text-accent transition hover:border-control-hover ${focusRing}`}
        >
          <span className="flex -space-x-1.5">
            {msg.thread.lastRepliers.map((u) => (
              <Avatar key={u.id} name={u.displayName ?? u.username} color={u.avatarColor} imageUrl={u.avatarUrl} size="sm" />
            ))}
          </span>
          💬 {t('msg.replies', { n: msg.thread.replyCount })}
        </button>
      )}
      {!msg.deleted && (
        <button onClick={onOpenThread} className={actionBtn}>
          {t('msg.reply')}
        </button>
      )}
      {!msg.deleted && (
        <button onClick={onQuote} className={actionBtn}>
          {t('msg.quoteAction')}
        </button>
      )}
      {!msg.deleted && (
        <button onClick={onForward} className={actionBtn}>
          {t('msg.forwardAction')}
        </button>
      )}
      {!msg.deleted && (
        <button onClick={onTogglePin} className={actionBtn}>
          {msg.pinned ? t('msg.unpinAction') : t('msg.pinAction')}
        </button>
      )}
      {!msg.deleted && (
        <button
          onClick={onToggleBookmark}
          className={`mt-1 rounded-lg text-xs transition sr-only group-hover:not-sr-only group-focus-within:not-sr-only ${focusRing} ${bookmarked ? 'text-amber-600 dark:text-amber-500' : 'text-fg-muted hover:text-fg'}`}
        >
          {bookmarked ? `🔖 ${t('msg.savedBadge')}` : t('msg.save')}
        </button>
      )}
    </div>
  )
}
