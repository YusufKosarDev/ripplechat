import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { selectChannel } from '../features/channels/channelsSlice'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'
import { buildQuickItems, filterQuickItems } from './quickSwitcherItems'
import { useT } from '../i18n'
import { Zap } from 'lucide-react'

interface QuickSwitcherProps {
  onClose: () => void
}

/**
 * Slack-style quick switcher (Ctrl/Cmd+K): type to filter channels and DMs,
 * arrow keys to move, Enter to jump, Esc to close.
 */
export default function QuickSwitcher({ onClose }: QuickSwitcherProps) {
  const { t } = useT()
  const dispatch = useAppDispatch()
  const channels = useAppSelector((state) => state.channels.items)
  const dms = useAppSelector((state) => state.channels.dms)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const panelRef = useDialog<HTMLDivElement>(onClose)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(
    () => filterQuickItems(buildQuickItems(channels, dms), query),
    [channels, dms, query],
  )

  // Keep the active row visible as the cursor moves.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (id: string | undefined) => {
    if (!id) return
    dispatch(selectChannel(id))
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(items[active]?.id)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('qs.aria')}
        tabIndex={-1}
        className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-fg-faint" aria-hidden="true"><Zap className="h-4 w-4" /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0) // reset the cursor to the top of the new result set
            }}
            onKeyDown={onKeyDown}
            placeholder={t('qs.placeholder')}
            aria-label={t('qs.placeholder')}
            className={`flex-1 rounded-lg bg-transparent text-sm text-fg placeholder:text-fg-faint ${focusRing}`}
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-xs text-fg-faint">Esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">{t('qs.noMatch')}</p>
          ) : (
            items.map((item, i) => (
              <button
                key={`${item.kind}-${item.id}`}
                data-active={i === active}
                onClick={() => pick(item.id)}
                onMouseMove={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition ${
                  i === active ? 'bg-indigo-500/15 text-fg' : 'text-fg-secondary hover:bg-surface-muted'
                } ${focusRing}`}
              >
                <span className="w-4 text-center text-fg-faint" aria-hidden="true">
                  {item.kind === 'channel' ? '#' : '@'}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-xs text-fg-faint">{item.kind === 'channel' ? 'Kanal' : 'DM'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
