import { useState } from 'react'
import type { ConnectionStatus } from '../../features/connection/connectionSlice'
import { forceReconnectChat } from '../../realtime/chatSocket'
import { useT } from '../../i18n'
import Button from './Button'
import { RefreshCw, TriangleAlert } from 'lucide-react'

interface ConnectionBannerProps {
  status: ConnectionStatus
}

export default function ConnectionBanner({ status }: ConnectionBannerProps) {
  const { t } = useT()
  const [reconnecting, setReconnecting] = useState(false)

  if (status === 'connected') return null

  const handleReconnect = () => {
    setReconnecting(true)
    forceReconnectChat()
    // Give it a brief spin animation duration feedback
    setTimeout(() => {
      setReconnecting(false)
    }, 1500)
  }

  const isConnecting = status === 'connecting'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex w-full items-center justify-between gap-4 px-4 py-2 text-sm font-medium transition-all duration-300 ${
        isConnecting
          ? 'bg-amber-500/10 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-b border-amber-500/20'
          : 'bg-rose-500/10 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border-b border-rose-500/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`${isConnecting || reconnecting ? 'animate-spin' : ''}`} aria-hidden="true">
          {isConnecting || reconnecting ? <RefreshCw className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
        </span>
        <span>
          {isConnecting
            ? t('conn.connecting')
            : t('conn.lost')}
        </span>
      </div>

      {!isConnecting && (
        <Button
          onClick={handleReconnect}
          size="sm"
          variant="secondary"
          className="shrink-0 flex items-center gap-1.5 border border-rose-500/30 bg-surface-overlay hover:bg-surface-muted transition-transform active:scale-95 duration-100 font-semibold"
          disabled={reconnecting}
        >
          {reconnecting ? t('conn.reconnecting') : t('conn.reconnectNow')}
        </Button>
      )}
    </div>
  )
}
