import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchLinkPreview } from '../features/linkPreviews/linkPreviewsSlice'

export default function LinkPreviewCard({ url }: { url: string }) {
  const dispatch = useAppDispatch()
  const entry = useAppSelector((state) => state.linkPreviews.byUrl[url])

  useEffect(() => {
    if (!entry) dispatch(fetchLinkPreview(url))
  }, [url, entry, dispatch])

  const preview = entry?.data
  if (!preview || !preview.title) return null

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex max-w-md overflow-hidden rounded-lg border border-border bg-surface-muted/40 transition hover:bg-surface-muted"
    >
      {preview.image && (
        <img src={preview.image} alt="" loading="lazy" className="h-16 w-16 shrink-0 object-cover" />
      )}
      <span className="min-w-0 px-3 py-2">
        <span className="block truncate text-sm font-medium text-fg">{preview.title}</span>
        {preview.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">{preview.description}</span>
        )}
        {preview.siteName && <span className="mt-0.5 block truncate text-2xs text-fg-faint">{preview.siteName}</span>}
      </span>
    </a>
  )
}
