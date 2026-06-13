import { useEffect, useState } from 'react'
import { client } from '../api/client'
import type { UserSummary } from '../api/types'
import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'

interface NewDmModalProps {
  onPick: (userId: string) => void
  onClose: () => void
}

export default function NewDmModal({ onPick, onClose }: NewDmModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)

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

  const trimmed = query.trim()

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-fg-faint">💬</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kullanıcı ara..."
            className={`flex-1 rounded-lg bg-transparent text-sm text-fg placeholder:text-fg-faint ${focusRing}`}
          />
          <button onClick={onClose} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-center text-sm text-fg-muted">Aranıyor...</p>}

          {!loading && trimmed.length >= 2 && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">"{trimmed}" için kullanıcı bulunamadı.</p>
          )}

          {!loading && trimmed.length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-fg-faint">
              Direkt mesaj başlatmak için kullanıcı adı yaz (en az 2 harf).
            </p>
          )}

          {!loading &&
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => onPick(u.id)}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-muted ${focusRing}`}
              >
                <Avatar name={u.displayName ?? u.username} color={u.avatarColor} imageUrl={u.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg-secondary">{u.displayName ?? u.username}</div>
                  <div className="truncate text-xs text-fg-faint">@{u.username}</div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
