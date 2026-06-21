import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useT } from '../i18n'
import { focusRing } from './ui/focusRing'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches render-time errors anywhere in the tree and shows a friendly fallback
 * instead of a blank white screen, so one broken component can't take the whole
 * app down. The fallback is a separate component so it can use the i18n hook.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the crash for diagnostics; the UI stays generic.
    console.error('Unhandled UI error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}

function ErrorFallback() {
  const { t } = useT()
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-950"
    >
      <h1 className="text-xl font-semibold text-fg">{t('error.title')}</h1>
      <p className="max-w-sm text-sm text-fg-muted">{t('error.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={`rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 ${focusRing}`}
      >
        {t('error.retry')}
      </button>
    </div>
  )
}
