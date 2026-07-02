import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchNotifications, markAllNotificationsRead } from '../features/notifications/notificationsSlice'
import { selectChannel } from '../features/channels/channelsSlice'
import { useT } from '../i18n'
import type { NotificationItem } from '../api/types'
import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'

function label(n: NotificationItem, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const who = n.actor.displayName ?? n.actor.username
  switch (n.type) {
    case 'MENTION':
      return t('notifications.mention', { who })
    case 'REPLY':
      return t('notifications.reply', { who })
    case 'REACTION':
      return t('notifications.reaction', { who })
    default:
      return who
  }
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationBell() {
  const dispatch = useAppDispatch()
  const { t } = useT()
  const { items, unreadCount } = useAppSelector((s) => s.notifications)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchNotifications())
  }, [dispatch])

  const onPick = (n: NotificationItem) => {
    dispatch(selectChannel(n.channelId))
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t('notifications.title')}
        aria-label={unreadCount > 0 ? t('notifications.unreadAria', { count: unreadCount }) : t('notifications.title')}
        className={`relative rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-surface-overlay shadow-elevated">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium text-fg-secondary">{t('notifications.title')}</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => dispatch(markAllNotificationsRead())}
                  className="text-xs text-accent hover:underline"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-faint">{t('notifications.empty')}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onPick(n)}
                  className={`flex w-full gap-2 border-b border-border px-3 py-2 text-left transition hover:bg-surface-muted ${
                    n.read ? '' : 'bg-indigo-500/5'
                  } ${focusRing}`}
                >
                  <Avatar
                    name={n.actor.displayName ?? n.actor.username}
                    color={n.actor.avatarColor}
                    imageUrl={n.actor.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg-secondary">{label(n, t)}</p>
                    {n.preview && <p className="truncate text-xs text-fg-faint">{n.preview}</p>}
                    <p className="text-[11px] text-fg-faint">{when(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
