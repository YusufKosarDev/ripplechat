import { useEffect, useState } from 'react'
import { useAppDispatch } from '../app/hooks'
import { joinChannel } from '../features/channels/channelsSlice'
import { client } from '../api/client'
import { useT } from '../i18n'
import type { Channel } from '../api/types'
import Button from './ui/Button'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

interface Props {
  onClose: () => void
  onJoined: (channelId: string) => void
}

export default function DiscoverChannelsModal({ onClose, onJoined }: Props) {
  const dispatch = useAppDispatch()
  const { t } = useT()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const panelRef = useDialog<HTMLDivElement>(onClose)

  useEffect(() => {
    let active = true
    client
      .get<Channel[]>('/api/channels/discover')
      .then(({ data }) => active && setChannels(data))
      .catch(() => active && setChannels([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const onJoin = async (id: string) => {
    setJoining(id)
    await dispatch(joinChannel(id))
    onJoined(id)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('discover.title')}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">🧭 {t('discover.title')}</span>
          <button onClick={onClose} aria-label={t('common.close')} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-center text-sm text-fg-muted">{t('common.loading')}</p>}

          {!loading && channels.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-fg-faint">{t('discover.empty')}</p>
          )}

          {channels.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg-secondary"># {c.name}</p>
                {c.description && <p className="truncate text-xs text-fg-faint">{c.description}</p>}
              </div>
              <Button size="sm" disabled={joining === c.id} onClick={() => onJoin(c.id)}>
                {joining === c.id ? '...' : t('sidebar.join')}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
