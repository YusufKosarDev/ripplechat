import { useEffect, useState } from 'react'

/**
 * Returns true once `active` has stayed on for `delayMs` — a heuristic for "the
 * request is taking long, the host is probably waking up" (Render cold start).
 * Used to surface a reassuring notice without blocking the request.
 */
export function useWakeNotice(active: boolean, delayMs = 3000): boolean {
  const [waking, setWaking] = useState(false)
  useEffect(() => {
    if (!active) {
      setWaking(false)
      return
    }
    const t = setTimeout(() => setWaking(true), delayMs)
    return () => clearTimeout(t)
  }, [active, delayMs])
  return waking
}

/** Spinner + "server is waking up" message, shown during a slow cold start. */
export default function WakeNotice({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-sm text-fg-muted">
      <span
        aria-hidden
        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      Sunucu uyanıyor, birkaç saniye sürebilir…
    </p>
  )
}
