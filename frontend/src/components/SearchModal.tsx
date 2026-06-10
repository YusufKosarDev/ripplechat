import { useEffect, useState } from 'react'
import { client } from '../api/client'
import type { SearchResult } from '../api/types'
import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'ig'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-lg bg-amber-300/60 text-inherit dark:bg-amber-500/40">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface SearchModalProps {
  onPick: (channelId: string) => void
  onClose: () => void
}

export default function SearchModal({ onPick, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get<SearchResult[]>('/api/search/messages', { params: { q: term } })
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
        className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-fg-faint">🔍</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mesajlarda ara..."
            className={`flex-1 rounded-lg bg-transparent text-sm text-fg placeholder:text-fg-faint ${focusRing}`}
          />
          <button onClick={onClose} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-center text-sm text-fg-muted">Aranıyor...</p>}

          {!loading && trimmed && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">
              "{trimmed}" için sonuç bulunamadı.
            </p>
          )}

          {!loading && !trimmed && (
            <p className="px-4 py-6 text-center text-sm text-fg-faint">
              Üye olduğun kanallardaki mesajlarda ara.
            </p>
          )}

          {!loading &&
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => onPick(r.channelId)}
                className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-muted ${focusRing}`}
              >
                <Avatar name={r.sender.displayName ?? r.sender.username} color={r.sender.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium text-fg-secondary">
                      {r.sender.displayName ?? r.sender.username}
                    </span>
                    <span className="text-accent">#{r.channelName}</span>
                    <span className="text-fg-faint">{formatWhen(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-fg-secondary">
                    <Highlighted text={r.content} query={trimmed} />
                  </p>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
