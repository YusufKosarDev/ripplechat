import { useEffect, useState } from 'react'

/**
 * Returns true once `active` has stayed on for `delayMs` — a heuristic for "the
 * request is taking long, the host is probably waking up" (Render cold start).
 * Used to surface a reassuring notice without blocking the request.
 */
export function useWakeNotice(active: boolean, delayMs = 3000): boolean {
  const [waking, setWaking] = useState(false)

  if (!active && waking) {
    setWaking(false)
  }

  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setWaking(true), delayMs)
    return () => clearTimeout(t)
  }, [active, delayMs])

  return waking
}
