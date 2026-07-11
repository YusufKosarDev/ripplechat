import { focusRing } from './ui/focusRing'
import { useT } from '../i18n'

/** Shared centered-overlay shell for the small info modals below. */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface-overlay p-4 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">{title}</span>
          <button onClick={onClose} aria-label="Kapat" className={`text-fg-faint transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** AI channel summary result. */
export function SummaryModal({ summary, onClose }: { summary: string; onClose: () => void }) {
  const { t } = useT()
  return (
    <ModalShell title={`✨ ${t('info.summary')}`} onClose={onClose}>
      <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
        {summary}
      </div>
    </ModalShell>
  )
}

export interface EditHistoryEntry {
  content: string
  editedAt: string
}

/** Prior versions of an edited message, newest first. */
export function EditHistoryModal({
  entries,
  loading,
  onClose,
}: {
  entries: EditHistoryEntry[] | null
  loading: boolean
  onClose: () => void
}) {
  const { t } = useT()
  return (
    <ModalShell title={t('info.editHistory')} onClose={onClose}>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
        {loading ? (
          <p className="text-fg-faint">{t('common.loading')}</p>
        ) : entries && entries.length > 0 ? (
          entries.map((h, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-2">
              <div className="mb-1 text-xs text-fg-faint">
                {t('info.editedAtRow', { when: new Date(h.editedAt).toLocaleString() })}
              </div>
              <div className="whitespace-pre-wrap text-fg-secondary">{h.content}</div>
            </div>
          ))
        ) : (
          <p className="text-fg-faint">{t('info.noPrevious')}</p>
        )}
      </div>
    </ModalShell>
  )
}
