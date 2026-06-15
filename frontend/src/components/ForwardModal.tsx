import { useAppSelector } from '../app/hooks'
import Avatar from './Avatar'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

interface ForwardModalProps {
  onPick: (channelId: string) => void
  onClose: () => void
}

/** Picks a channel or DM to forward a message into. */
export default function ForwardModal({ onPick, onClose }: ForwardModalProps) {
  const channels = useAppSelector((state) => state.channels.items)
  const dms = useAppSelector((state) => state.channels.dms)
  const panelRef = useDialog<HTMLDivElement>(onClose)

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Şuraya ilet"
        tabIndex={-1}
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">Şuraya ilet</span>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {channels.length > 0 && (
            <div className="px-2 pt-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-fg-faint">Kanallar</div>
          )}
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-surface-muted ${focusRing}`}
            >
              <span className="text-fg-faint">#</span>
              <span className="truncate text-fg">{c.name}</span>
            </button>
          ))}

          {dms.length > 0 && (
            <div className="px-2 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-fg-faint">
              Direkt Mesajlar
            </div>
          )}
          {dms.map((d) => {
            const name = d.group ? (d.name ?? 'Grup') : (d.otherUser?.displayName ?? d.otherUser?.username ?? 'DM')
            return (
              <button
                key={d.id}
                onClick={() => onPick(d.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-surface-muted ${focusRing}`}
              >
                {d.group ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm">
                    👥
                  </span>
                ) : (
                  <Avatar name={name} color={d.otherUser?.avatarColor} imageUrl={d.otherUser?.avatarUrl} size="sm" />
                )}
                <span className="truncate text-fg">{name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
