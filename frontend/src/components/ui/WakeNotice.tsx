// Hook has been moved to src/hooks/useWakeNotice.ts

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
