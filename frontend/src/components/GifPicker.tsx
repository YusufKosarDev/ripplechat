import { useEffect, useState } from 'react'
import { client } from '../api/client'
import { focusRing } from './ui/focusRing'
import { useT } from '../i18n'

interface Gif {
  url: string
  preview: string
}

interface GifPickerProps {
  onPick: (url: string) => void
  onClose: () => void
}

export default function GifPicker({ onPick, onClose }: GifPickerProps) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Gif[]>([])
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)

  // Reset results when query is cleared — derived state, handled during render.
  const trimmedQuery = query.trim()
  if (!trimmedQuery && results.length > 0) {
    setResults([])
  }

  // Set loading state during render when a query is present
  if (trimmedQuery && !loading) {
    setLoading(true)
  }

  useEffect(() => {
    const term = query.trim()
    if (!term) return
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get<{ enabled: boolean; results: Gif[] }>('/api/gifs/search', {
          params: { q: term },
        })
        setEnabled(data.enabled)
        setResults(data.results)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])  

  return (
    <div className="absolute bottom-full right-0 z-20 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface-overlay p-2 shadow-elevated">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('gif.search')}
          className={`flex-1 rounded-lg bg-transparent text-sm text-fg placeholder:text-fg-faint ${focusRing}`}
        />
        <button type="button" onClick={onClose} className={`rounded text-fg-faint hover:text-fg ${focusRing}`}>
          ✕
        </button>
      </div>
      {!enabled && <p className="mt-2 text-center text-xs text-fg-muted">{t('gif.notConfigured')}</p>}
      {loading && <p className="mt-2 text-center text-xs text-fg-muted">{t('common.searching')}</p>}
      {enabled && !loading && (
        <div className="mt-2 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto">
          {results.map((gif) => (
            <button
              key={gif.url}
              type="button"
              onClick={() => onPick(gif.url)}
              className={`overflow-hidden rounded ${focusRing}`}
            >
              <img src={gif.preview} alt="" loading="lazy" className="h-24 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
