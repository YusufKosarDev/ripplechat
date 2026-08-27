import { useEffect, useState } from 'react'
import { computeSafetyNumber } from '../crypto/safetyNumber'
import { useT } from '../i18n'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

interface SafetyNumberModalProps {
  /** Our own identity public key, as a JWK string. */
  ourPublicKey: string
  /** The other participant's, as served by the backend. */
  theirPublicKey: string
  theirName: string
  onClose: () => void
}

/**
 * Shows the safety number for a DM so the two people can compare it out of
 * band. See crypto/safetyNumber.ts for why that comparison is the only thing
 * that rules out a server-side key substitution.
 */
export default function SafetyNumberModal({
  ourPublicKey,
  theirPublicKey,
  theirName,
  onClose,
}: SafetyNumberModalProps) {
  const { t } = useT()
  const panelRef = useDialog<HTMLDivElement>(onClose)
  const [groups, setGroups] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    computeSafetyNumber(ourPublicKey, theirPublicKey)
      .then((result) => {
        if (active) setGroups(result)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [ourPublicKey, theirPublicKey])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('safety.title')}
        tabIndex={-1}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">🔒 {t('safety.title')}</span>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {failed && <p className="text-sm text-danger">{t('safety.failed')}</p>}

          {!failed && groups === null && (
            <p className="text-sm text-fg-muted">{t('common.loading')}</p>
          )}

          {groups !== null && (
            <>
              <p
                className="grid grid-cols-3 gap-x-4 gap-y-1 rounded-xl bg-surface-muted px-4 py-3 text-center font-mono text-sm tracking-wider text-fg"
                // One string for assistive tech: the grid is a reading aid, not
                // twelve separate values.
                aria-label={groups.join(' ')}
              >
                {groups.map((group, i) => (
                  <span key={i} aria-hidden>
                    {group}
                  </span>
                ))}
              </p>
              <p className="text-sm text-fg-muted">{t('safety.compare', { name: theirName })}</p>
              <p className="text-xs text-fg-faint">{t('safety.why')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
