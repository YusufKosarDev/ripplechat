import { useEffect, useState } from 'react'
import { client } from '../api/client'
import type { MediaItem } from '../api/types'
import { focusRing } from './ui/focusRing'

interface MediaGalleryModalProps {
  channelId: string
  onClose: () => void
}

export default function MediaGalleryModal({ channelId, onClose }: MediaGalleryModalProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    client
      .get<MediaItem[]>(`/api/channels/${channelId}/media`)
      .then((r) => {
        if (active) setItems(r.data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [channelId])

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">🖼️ Medya</span>
          <button onClick={onClose} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading && <p className="py-6 text-center text-sm text-fg-muted">Yükleniyor...</p>}
          {!loading && items.length === 0 && (
            <p className="py-6 text-center text-sm text-fg-muted">Bu sohbette paylaşılmış görsel yok.</p>
          )}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {items.map((m) => (
                <a key={m.messageId} href={m.url} target="_blank" rel="noopener noreferrer" className={`block ${focusRing}`}>
                  <img
                    src={m.url}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-lg border border-border object-cover transition hover:opacity-90"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
