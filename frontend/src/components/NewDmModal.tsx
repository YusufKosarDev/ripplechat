import { useEffect, useState } from 'react'
import { client } from '../api/client'
import type { UserSummary } from '../api/types'
import Avatar from './Avatar'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

interface NewDmModalProps {
  // One user → a 1:1 DM; two or more → a group (with optional name).
  onStart: (userIds: string[], name?: string) => void
  onClose: () => void
}

export default function NewDmModal({ onStart, onClose }: NewDmModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<UserSummary[]>([])
  const [groupName, setGroupName] = useState('')
  const panelRef = useDialog<HTMLDivElement>(onClose)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get<UserSummary[]>('/api/users/search', { params: { q: term } })
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const toggle = (u: UserSummary) =>
    setSelected((prev) => (prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u]))

  const trimmed = query.trim()
  const isGroup = selected.length >= 2

  const label =
    selected.length === 0
      ? 'Kişi seç'
      : isGroup
        ? `Grup oluştur (${selected.length})`
        : `${selected[0].displayName ?? selected[0].username} ile başlat`

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Yeni mesaj"
        tabIndex={-1}
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">Yeni mesaj</span>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}
          >
            ✕
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
            {selected.map((u) => (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className={`inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg ${focusRing}`}
              >
                {u.displayName ?? u.username} ✕
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-border px-4 py-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kullanıcı ara..."
            className={`w-full rounded-lg bg-transparent text-sm text-fg placeholder:text-fg-faint ${focusRing}`}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-center text-sm text-fg-muted">Aranıyor...</p>}
          {!loading && trimmed.length >= 2 && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">"{trimmed}" için kullanıcı bulunamadı.</p>
          )}
          {!loading && trimmed.length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-fg-faint">
              Bir kişi seç (DM) ya da birden çok kişi seç (grup).
            </p>
          )}
          {!loading &&
            results.map((u) => {
              const picked = selected.some((s) => s.id === u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-muted ${focusRing} ${picked ? 'bg-surface-muted' : ''}`}
                >
                  <Avatar name={u.displayName ?? u.username} color={u.avatarColor} imageUrl={u.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-fg-secondary">{u.displayName ?? u.username}</div>
                    <div className="truncate text-xs text-fg-faint">@{u.username}</div>
                  </div>
                  {picked && <span className="text-accent">✓</span>}
                </button>
              )
            })}
        </div>

        <div className="space-y-2 border-t border-border p-3">
          {isGroup && (
            <Input
              inputSize="sm"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Grup adı (opsiyonel)"
            />
          )}
          <Button
            className="w-full"
            disabled={selected.length === 0}
            onClick={() => onStart(selected.map((s) => s.id), groupName.trim() || undefined)}
          >
            {label}
          </Button>
        </div>
      </div>
    </div>
  )
}
