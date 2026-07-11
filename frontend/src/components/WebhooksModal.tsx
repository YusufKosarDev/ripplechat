import { useEffect, useState } from 'react'
import { config } from '../config'
import { createWebhook, deleteWebhook, listWebhooks, type Webhook } from '../api/webhooks'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'
import { useT } from '../i18n'

interface WebhooksModalProps {
  channelId: string
  onClose: () => void
}

/** Builds the absolute ingest URL an external system POSTs to. */
function absoluteUrl(relative: string | null): string {
  if (!relative) return ''
  const base = config.apiUrl || window.location.origin
  return base.replace(/\/$/, '') + relative
}

export default function WebhooksModal({ channelId, onClose }: WebhooksModalProps) {
  const { t } = useT()
  const panelRef = useDialog<HTMLDivElement>(onClose)
  const [items, setItems] = useState<Webhook[]>([])
  const [name, setName] = useState('')
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listWebhooks(channelId).then(setItems).catch(() => setItems([]))
  }
  useEffect(refresh, [channelId])

  const onCreate = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const created = await createWebhook(channelId, name.trim())
      setName('')
      setCreatedUrl(absoluteUrl(created.url))
      setCopied(false)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const onCopy = () => {
    if (!createdUrl) return
    navigator.clipboard?.writeText(createdUrl).then(() => setCopied(true)).catch(() => {})
  }

  const onDelete = async (id: string) => {
    await deleteWebhook(channelId, id).catch(() => {})
    refresh()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('wh.title')}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">🔗 {t('chat.webhooks')}</span>
          <button onClick={onClose} aria-label={t('common.close')} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        <div className="border-b border-border p-4">
          <p className="mb-2 text-xs text-fg-muted">
            {t('wh.explainPre')} <code className="rounded bg-surface-muted px-1">{`{"text":"..."}`}</code> {t('wh.explainPost')}
          </p>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('wh.namePlaceholder')}
              aria-label={t('wh.nameAria')}
              maxLength={80}
            />
            <Button size="sm" onClick={onCreate} disabled={busy || !name.trim()}>
              {t('wh.create')}
            </Button>
          </div>

          {createdUrl && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                {t('wh.urlOnce')}
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-xs text-fg">{createdUrl}</code>
                <Button size="sm" variant="secondary" onClick={onCopy}>
                  {copied ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">{t('wh.empty')}</p>
          ) : (
            items.map((w) => (
              <div key={w.id} className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{w.name}</div>
                  <div className="truncate text-xs text-fg-faint">@{w.botUsername}</div>
                </div>
                <button
                  onClick={() => onDelete(w.id)}
                  className={`shrink-0 rounded-lg text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
                >
                  Sil
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
