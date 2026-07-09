// Hook has been moved to src/hooks/useWakeNotice.ts

import { useEffect, useState } from 'react'
import { useT } from '../../i18n'

// After this many visible seconds the short copy gives way to the honest one:
// a free-tier cold start is measured in minutes, not seconds, and pretending
// otherwise makes visitors give up.
const SLOW_AFTER_SECONDS = 30

/** Spinner + staged "server is waking up" message, shown during a slow cold start. */
export default function WakeNotice({ show }: { show: boolean }) {
  const { t } = useT()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!show) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [show])

  if (!show) return null

  const slow = elapsed >= SLOW_AFTER_SECONDS
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const elapsedLabel = minutes > 0 ? t('wake.elapsedMin', { m: minutes, s: seconds }) : t('wake.elapsedSec', { s: seconds })

  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-sm text-fg-muted">
      <span
        aria-hidden
        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      <span>
        {slow ? t('wake.slow') : t('wake.starting')}
        {slow && <span className="tabular-nums"> ({elapsedLabel})</span>}
      </span>
    </p>
  )
}
