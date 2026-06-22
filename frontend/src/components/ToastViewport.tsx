import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { dismissToast } from '../features/toast/toastSlice'
import type { Toast } from '../features/toast/toastSlice'
import { useT } from '../i18n'
import { focusRing } from './ui/focusRing'

const AUTO_DISMISS_MS = 4000

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  info: 'bg-slate-800 text-white dark:bg-slate-700',
}

/**
 * Renders transient notifications from the toast slice in a polite live region,
 * so success/error feedback is announced and visible without blocking the UI.
 */
export default function ToastViewport() {
  const toasts = useAppSelector((state) => state.toast.toasts)
  if (toasts.length === 0) {
    return null
  }
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch()
  const { t } = useT()

  useEffect(() => {
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [dispatch, toast.id])

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-elevated ${VARIANT_STYLES[toast.variant]}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        aria-label={t('toast.dismiss')}
        className={`rounded-lg text-white/80 transition hover:text-white ${focusRing}`}
      >
        ✕
      </button>
    </div>
  )
}
