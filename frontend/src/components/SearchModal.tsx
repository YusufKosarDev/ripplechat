import { useEffect, useRef, useState } from 'react'
import { client } from '../api/client'
import { useAppSelector } from '../app/hooks'
import type { SearchResult } from '../api/types'
import { dateLocale, useT } from '../i18n'
import { Search } from 'lucide-react'

const PAGE_SIZE = 20

interface SearchPage {
  results: SearchResult[]
  hasMore: boolean
}
import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

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

function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface SearchModalProps {
  onPick: (channelId: string, messageId: string) => void
  onClose: () => void
}

export default function SearchModal({ onPick, onClose }: SearchModalProps) {
  const { t, lang } = useT()
  const locale = dateLocale(lang)
  const channels = useAppSelector((state) => state.channels.items)
  const dms = useAppSelector((state) => state.channels.dms)

  const [query, setQuery] = useState('')
  const [channelId, setChannelId] = useState('')
  const [from, setFrom] = useState('')
  const [since, setSince] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const pageRef = useRef(0)
  const panelRef = useDialog<HTMLDivElement>(onClose)

  const buildParams = (page: number): Record<string, string> => {
    const params: Record<string, string> = { q: query.trim(), page: String(page), size: String(PAGE_SIZE) }
    if (channelId) params.channelId = channelId
    if (from.trim()) params.from = from.trim()
    if (since) params.since = since
    return params
  }

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      // Query cleared: drop stale results and stop any pending spinner.
      setResults([])
      setHasMore(false)
      setLoading(false)
      return
    }
    // Setting loading here (not during render) lets it actually settle to
    // false when the response lands; a render-time setter kept forcing it
    // back to true, which hid every result behind the spinner forever.
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get<SearchPage>('/api/search/messages', { params: buildParams(0) })
        setResults(data.results)
        setHasMore(data.hasMore)
        pageRef.current = 0
      } catch {
        setResults([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, channelId, from, since])

  const loadMore = async () => {
    const next = pageRef.current + 1
    setLoadingMore(true)
    try {
      const { data } = await client.get<SearchPage>('/api/search/messages', { params: buildParams(next) })
      setResults((prev) => [...prev, ...data.results])
      setHasMore(data.hasMore)
      pageRef.current = next
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const trimmed = query.trim()
  const dmLabel = (d: (typeof dms)[number]) =>
    d.group ? (d.name ?? t('sidebar.group')) : (d.otherUser?.displayName ?? d.otherUser?.username ?? 'DM')

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('search.title')}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-fg-faint" aria-hidden="true"><Search className="h-4 w-4" /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.title')}
            className={`flex-1 rounded-lg bg-transparent text-sm text-fg placeholder:text-fg-faint ${focusRing}`}
          />
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 text-sm">
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className={`min-w-0 flex-1 rounded-lg border border-control bg-surface px-2 py-1 text-fg ${focusRing}`}
          >
            <option value="">{t('search.allChats')}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
            {dms.map((d) => (
              <option key={d.id} value={d.id}>
                {dmLabel(d)}
              </option>
            ))}
          </select>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder={t('search.fromPlaceholder')}
            className={`w-28 rounded-lg border border-control bg-surface px-2 py-1 text-fg placeholder:text-fg-faint ${focusRing}`}
          />
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            title={t('search.sinceTitle')}
            className={`rounded-lg border border-control bg-surface px-2 py-1 text-fg ${focusRing}`}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-center text-sm text-fg-muted">{t('common.searching')}</p>}

          {!loading && trimmed && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">{t('search.noResults', { q: trimmed })}</p>
          )}

          {!loading && !trimmed && (
            <p className="px-4 py-6 text-center text-sm text-fg-faint">
              {t('search.hint')}
            </p>
          )}

          {!loading &&
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => onPick(r.channelId, r.id)}
                className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-muted ${focusRing}`}
              >
                <Avatar name={r.sender.displayName ?? r.sender.username} color={r.sender.avatarColor} imageUrl={r.sender.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium text-fg-secondary">{r.sender.displayName ?? r.sender.username}</span>
                    <span className="text-accent">#{r.channelName}</span>
                    <span className="text-fg-faint">{formatWhen(r.createdAt, locale)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-fg-secondary">
                    <Highlighted text={r.content} query={trimmed} />
                  </p>
                </div>
              </button>
            ))}

          {!loading && hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={`w-full px-4 py-3 text-center text-sm font-medium text-accent transition hover:bg-surface-muted disabled:opacity-60 ${focusRing}`}
            >
              {loadingMore ? t('common.loading') : t('search.loadMore')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
