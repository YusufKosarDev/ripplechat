import { Pin } from 'lucide-react'
import { useT } from '../../i18n'
import { focusRing } from '../ui/focusRing'
import type { Message } from '../../api/types'

interface PinnedDrawerProps {
  pinned: Message[]
  onClose: () => void
  onUnpin: (msg: Message) => void
}

/** The pinned-message overlay opened from the channel header. */
export default function PinnedDrawer({ pinned, onClose, onUnpin }: PinnedDrawerProps) {
  const { t } = useT()

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">
            <Pin className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden /> {t('chat.pinnedTitle')}
          </span>
          <button onClick={onClose} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {pinned.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-fg-muted">{t('panel.noPinned')}</p>
          )}
          {pinned.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 border-b border-border px-2 py-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-fg-secondary">
                  {m.sender.displayName ?? m.sender.username}
                </div>
                <div className="truncate text-sm text-fg">
                  {m.content || (m.attachmentUrl ? `📷 ${t('msg.imagePlaceholder')}` : '')}
                </div>
              </div>
              <button
                onClick={() => onUnpin(m)}
                className={`shrink-0 text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
              >
                {t('common.remove')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
