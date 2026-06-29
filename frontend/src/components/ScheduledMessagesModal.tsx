import { useEffect, useState } from 'react'
import { useAppDispatch } from '../app/hooks'
import { showToast } from '../features/toast/toastSlice'
import {
  cancelScheduledMessage,
  listScheduledMessages,
  scheduleMessage,
  type ScheduledMessage,
} from '../api/scheduled'
import Button from './ui/Button'
import { Textarea } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

interface ScheduledMessagesModalProps {
  channelId: string
  initialDraft?: string
  onClose: () => void
}

/** Pads to a `datetime-local` value (YYYY-MM-DDTHH:mm) in the browser's timezone. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScheduledMessagesModal({ channelId, initialDraft, onClose }: ScheduledMessagesModalProps) {
  const dispatch = useAppDispatch()
  const panelRef = useDialog<HTMLDivElement>(onClose)

  const [text, setText] = useState(initialDraft?.trim() ?? '')
  // Default the picker to an hour from now (lazy initializer runs once).
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [items, setItems] = useState<ScheduledMessage[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listScheduledMessages().then(setItems).catch(() => setItems([]))
  }
  useEffect(refresh, [])

  const onSchedule = async () => {
    if (!text.trim() || !when) return
    setBusy(true)
    try {
      await scheduleMessage(channelId, text.trim(), new Date(when).toISOString())
      dispatch(showToast({ message: 'Mesaj zamanlandı', variant: 'success' }))
      setText('')
      refresh()
    } catch {
      dispatch(showToast({ message: 'Zamanlanamadı — zaman gelecekte olmalı.', variant: 'error' }))
    } finally {
      setBusy(false)
    }
  }

  const onCancel = async (id: string) => {
    try {
      await cancelScheduledMessage(id)
      refresh()
    } catch {
      dispatch(showToast({ message: 'İptal edilemedi.', variant: 'error' }))
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Zamanlanmış mesajlar"
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">⏰ Zamanlanmış mesajlar</span>
          <button onClick={onClose} aria-label="Kapat" className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        <div className="border-b border-border p-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bu kanala gönderilecek mesaj…"
            aria-label="Zamanlanacak mesaj"
            rows={2}
            maxLength={4000}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Gönderim zamanı"
              className={`rounded-lg border border-control bg-surface px-2 py-1 text-sm text-fg ${focusRing}`}
            />
            <Button size="sm" onClick={onSchedule} disabled={busy || !text.trim() || !when}>
              Zamanla
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">Bekleyen zamanlanmış mesaj yok.</p>
          ) : (
            items.map((m) => (
              <div key={m.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs text-fg-faint">
                    <span className="text-accent">#{m.channelName}</span>
                    <span>{formatWhen(m.scheduledAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{m.content}</p>
                </div>
                <button
                  onClick={() => onCancel(m.id)}
                  className={`shrink-0 rounded-lg text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
                >
                  İptal
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
