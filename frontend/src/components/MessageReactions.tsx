import { useState } from 'react'
import type { ReactionSummary } from '../api/types'
import { focusRing } from './ui/focusRing'

const PICKER = ['👍', '❤️', '😂', '🔥', '🎉', '👀']

interface MessageReactionsProps {
  reactions: ReactionSummary[]
  currentUsername: string
  onToggle: (emoji: string) => void
}

export default function MessageReactions({ reactions, currentUsername, onToggle }: MessageReactionsProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const mine = r.users.includes(currentUsername)
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onToggle(r.emoji)}
            title={r.users.join(', ')}
            className={`${focusRing} flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              mine
                ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                : 'border-control bg-surface-muted text-fg-secondary hover:border-control-hover'
            }`}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        )
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`hidden items-center rounded-full border border-control px-2 py-0.5 text-xs text-fg-faint transition hover:border-control-hover hover:text-fg-muted group-hover:inline-flex ${focusRing}`}
          title="Tepki ekle"
        >
          ＋
        </button>
        {open && (
          <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-border bg-surface-overlay p-1 shadow-lg">
            {PICKER.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji)
                  setOpen(false)
                }}
                className={`rounded-lg px-1 text-base transition hover:bg-surface-muted ${focusRing}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
