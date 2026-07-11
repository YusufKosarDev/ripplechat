import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchBookmarks, toggleBookmark } from '../features/bookmarks/bookmarksSlice'
import { selectChannel } from '../features/channels/channelsSlice'
import { useT } from '../i18n'
import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

function when(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  onClose: () => void
}

export default function SavedMessagesModal({ onClose }: Props) {
  const dispatch = useAppDispatch()
  const { t } = useT()
  const { items, status } = useAppSelector((s) => s.bookmarks)
  const panelRef = useDialog<HTMLDivElement>(onClose)

  useEffect(() => {
    dispatch(fetchBookmarks())
  }, [dispatch])

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('saved.title')}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">🔖 {t('saved.title')}</span>
          <button onClick={onClose} aria-label={t('common.close')} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {status === 'loading' && <p className="px-4 py-6 text-center text-sm text-fg-muted">{t('common.loading')}</p>}

          {status !== 'loading' && items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-fg-faint">{t('saved.empty')}</p>
          )}

          {items.map((s) => (
            <div key={s.messageId} className="flex gap-3 border-b border-border px-4 py-3">
              <Avatar
                name={s.sender.displayName ?? s.sender.username}
                color={s.sender.avatarColor}
                imageUrl={s.sender.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-fg-secondary">{s.sender.displayName ?? s.sender.username}</span>
                  <span className="text-accent">#{s.channelName}</span>
                  <span className="text-fg-faint">{when(s.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">{s.content}</p>
                <div className="mt-1 flex gap-3 text-xs">
                  <button
                    onClick={() => {
                      dispatch(selectChannel(s.channelId))
                      onClose()
                    }}
                    className="text-accent hover:underline"
                  >
                    {t('saved.open')}
                  </button>
                  <button
                    onClick={() => dispatch(toggleBookmark({ messageId: s.messageId, saved: true }))}
                    className="text-fg-muted transition hover:text-danger"
                  >
                    {t('saved.remove')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
